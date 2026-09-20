import { afterEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '../src/services/cache-service.js';
import { ScryfallClient } from '../src/services/scryfall-client.js';
import { RateLimiter } from '../src/services/rate-limiter.js';
import { withRequestSignal } from '../src/services/request-context.js';
import { fetchCardMapWithDiagnostics } from '../src/tools/batch-card-analysis/fetcher.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createConfiguredServer } from '../src/server.js';

const caches: CacheService[] = [];
afterEach(() => { caches.splice(0).forEach(cache => cache.destroy()); vi.unstubAllGlobals(); vi.useRealTimers(); });

function clientFixture() {
  const cache = new CacheService();
  caches.push(cache);
  const limiter = new RateLimiter(0);
  return { client: new ScryfallClient(limiter, cache), limiter };
}

describe('request cancellation', () => {
  it('propagates MCP cancellation to the active upstream fetch', async () => {
    const { sdkServer, appServer } = await createConfiguredServer();
    const client = new Client({ name: 'cancel-test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    let signal: AbortSignal | undefined;
    let rejectFetch: ((error: Error) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      signal = options.signal;
      rejectFetch = reject;
      signal!.addEventListener('abort', () => reject(signal!.reason), { once: true });
    })));
    try {
      await sdkServer.connect(b);
      await client.connect(a);
      const controller = new AbortController();
      const result = client.callTool({ name: 'get_card', arguments: { identifier: 'test' } }, undefined, { signal: controller.signal }).catch(error => error);
      await vi.waitFor(() => expect(signal).toBeDefined());
      controller.abort();
      await result;
      await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    } finally {
      rejectFetch?.(new Error('test cleanup'));
      await client.close(); await sdkServer.close(); await appServer.destroy();
    }
  });
  it('removes cancelled queued work and releases a cancelled pacing wait', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(500);
    await limiter.execute(async () => undefined);
    const controller = new AbortController();
    const run = vi.fn();
    const waiting = limiter.execute(run, { signal: controller.signal });
    const queued = limiter.execute(run, { signal: controller.signal });
    const results = Promise.allSettled([waiting, queued]);
    controller.abort();
    await results;
    expect(run).not.toHaveBeenCalled();
    expect(limiter.getStatus().queueLength).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['card', 'search'] as const)('keeps a shared %s request alive for its remaining caller', async kind => {
    const { client, limiter } = clientFixture();
    let complete!: (response: Response) => void;
    let upstreamSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url, options) => {
      upstreamSignal = options.signal;
      return new Promise<Response>(resolve => { complete = resolve; });
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const lookup = () => kind === 'card'
      ? client.getCard({ identifier: 'shared' })
      : client.searchCards({ query: 'shared', limit: 1 });
    const first = withRequestSignal(controller.signal, lookup);
    const firstResult = first.catch(error => error);
    const second = lookup();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();
    expect((await firstResult).name).toBe('AbortError');
    expect(upstreamSignal?.aborted).toBe(false);
    complete(new Response(JSON.stringify(kind === 'card' ? { id: 'shared' } : {
      object: 'list', data: [{ id: 'shared' }], total_cards: 1, has_more: false,
    }), { status: 200 }));
    await second;
    await lookup();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(limiter.getStatus().consecutiveErrors).toBe(0);
  });

  it('aborts a fetch when its last consumer cancels without poisoning the circuit', async () => {
    const { client, limiter } = clientFixture();
    let upstreamSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      upstreamSignal = options.signal;
      upstreamSignal!.addEventListener('abort', () => reject(upstreamSignal!.reason), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const result = withRequestSignal(controller.signal, () => client.getCard({ identifier: 'alone' })).catch(error => error);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();
    expect((await result).name).toBe('AbortError');
    expect(upstreamSignal?.aborted).toBe(true);
    await vi.waitFor(() => expect(limiter.getStatus().processing).toBe(false));
    expect(limiter.getStatus().consecutiveErrors).toBe(0);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'fresh' }), { status: 200 }) as never);
    await expect(client.getCard({ identifier: 'alone' })).resolves.toMatchObject({ id: 'fresh' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops batch workers before scheduling subsequent names after cancellation', async () => {
    const controller = new AbortController();
    const getCard = vi.fn(async () => { controller.abort(); return { id: 'first' }; });
    const result = withRequestSignal(controller.signal, () => fetchCardMapWithDiagnostics(
      { getCard } as never, ['first', 'second', 'third'], { concurrency: 1 }
    ));
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(getCard).toHaveBeenCalledTimes(1);
  });

  it('does not give the next queued request a preceding caller\'s aborted context', async () => {
    const { client, limiter } = clientFixture();
    const controller = new AbortController();
    let complete!: (value: Response) => void;
    const fetchMock = vi.fn()
      .mockImplementationOnce((_url, options) => new Promise<Response>((resolve, reject) => {
        complete = resolve;
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      }))
      .mockImplementationOnce((_url, options) => {
        expect(options.signal.aborted).toBe(false);
        return Promise.resolve(new Response(JSON.stringify({ id: 'second' }), { status: 200 }));
      });
    vi.stubGlobal('fetch', fetchMock);
    const first = withRequestSignal(controller.signal, () => client.getCard({ identifier: 'first' })).catch(error => error);
    await vi.waitFor(() => expect(complete).toBeDefined());
    const second = client.getCard({ identifier: 'second' });
    await vi.waitFor(() => expect(limiter.getStatus().queueLength).toBe(1));
    controller.abort();
    await first;
    await expect(second).resolves.toMatchObject({ id: 'second' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
