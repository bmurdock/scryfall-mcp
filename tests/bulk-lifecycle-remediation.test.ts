import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createConfiguredServer } from '../src/server.js';
import { ScryfallClient } from '../src/services/scryfall-client.js';
import { CacheService } from '../src/services/cache-service.js';
import { CardDatabaseResource } from '../src/resources/card-database.js';

const bulkInfo = { type: 'oracle_cards', updated_at: '2026-10-22T00:00:00Z', download_uri: 'https://data.scryfall.io/test.json' };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function upstream() {
  vi.spyOn(ScryfallClient.prototype, 'getBulkDataInfo').mockResolvedValue([bulkInfo] as never);
  let signal: AbortSignal | undefined;
  let body: ReadableStreamDefaultController<Uint8Array> | undefined;
  const fetchMock = vi.fn((_url: string, options: RequestInit) => {
    signal = options.signal!;
    return Promise.resolve(new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        body = controller;
        controller.enqueue(new TextEncoder().encode('['));
        signal!.addEventListener('abort', () => {
          try { controller.error(signal!.reason); } catch { /* Already settled. */ }
        }, { once: true });
      },
    })));
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    signal: () => signal,
    finish: () => {
      try {
        body?.enqueue(new TextEncoder().encode('{"id":"a","name":"Test"}]'));
        body?.close();
      } catch { /* Cancellation already closed the stream. */ }
    },
  };
}

async function mcpFixture() {
  const runtime = await createConfiguredServer();
  const client = new Client({ name: 'bulk-cancel-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await runtime.sdkServer.connect(b);
  await client.connect(a);
  return { ...runtime, client, close: async () => {
    await client.close(); await runtime.sdkServer.close(); await runtime.appServer.destroy();
  } };
}

describe('bulk resource lifetime', () => {
  it('aborts a cancelled MCP bulk read and permits a subsequent rebuild', async () => {
    const source = upstream();
    const runtime = await mcpFixture();
    try {
      const controller = new AbortController();
      const read = runtime.client.readResource({ uri: 'card-database://bulk' }, { signal: controller.signal }).catch(error => error);
      await vi.waitFor(() => expect(source.signal()).toBeDefined());
      controller.abort();
      await read;
      await vi.waitFor(() => expect(source.signal()?.aborted).toBe(true));
      const next = runtime.client.readResource({ uri: 'card-database://bulk' });
      await vi.waitFor(() => expect(source.fetchMock).toHaveBeenCalledTimes(2));
      source.finish();
      expect((await next).contents[0].text).toContain('"total_cards":1');
    } finally { source.finish(); await runtime.close(); }
  });

  it('keeps a shared bulk read alive until its remaining MCP reader finishes', async () => {
    const source = upstream();
    const runtime = await mcpFixture();
    try {
      const controller = new AbortController();
      const first = runtime.client.readResource({ uri: 'card-database://bulk' }, { signal: controller.signal }).catch(error => error);
      await vi.waitFor(() => expect(source.signal()).toBeDefined());
      const second = runtime.client.readResource({ uri: 'card-database://bulk' });
      await new Promise(resolve => setImmediate(resolve));
      controller.abort();
      await first;
      expect(source.signal()?.aborted).toBe(false);
      source.finish();
      expect((await second).contents[0].text).toContain('"total_cards":1');
      expect(source.fetchMock).toHaveBeenCalledTimes(1);
    } finally { source.finish(); await runtime.close(); }
  });

  it('aborts and settles an active rebuild before resource destruction returns', async () => {
    const source = upstream();
    const cache = new CacheService(60_000, 100, 0.0001);
    const client = new ScryfallClient();
    const resource = new CardDatabaseResource(client, cache);
    const owner = (resource as unknown as { diskSnapshotOwner: string }).diskSnapshotOwner;
    const read = resource.getData().catch(error => error);
    try {
      await vi.waitFor(() => expect(source.signal()).toBeDefined());
      await resource.destroy();
      expect(source.signal()?.aborted).toBe(true);
      expect(await read).toMatchObject({ name: 'AbortError' });
      expect((await readdir(join(tmpdir(), 'scryfall-mcp'))).filter(name => name.includes(owner))).toEqual([]);
    } finally { source.finish(); await read; await resource.destroy(); client.destroy(); cache.destroy(); }
  });
});
