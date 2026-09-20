import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createConfiguredServer } from '../src/server.js';
import { RateLimitError, ScryfallAPIError } from '../src/types/mcp-types.js';

const environment = { ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'fatal' };

describe('server lifecycle and protocol boundaries', () => {
  it('rejects a malformed Host without terminating the HTTP process', async () => {
    const { stdout } = await promisify(execFile)(process.execPath, [
      '--import', 'tsx', '--input-type=module', '--eval', `
      import { request } from 'node:http';
      import { createHttpAppServer } from './src/http.ts';
      const runtime = createHttpAppServer({ host: '127.0.0.1', port: 0 });
      await new Promise(resolve => runtime.server.listen(0, '127.0.0.1', resolve));
      try {
        const status = await new Promise((resolve, reject) => {
          const req = request({ host: '127.0.0.1', port: runtime.server.address().port,
            path: '/health', headers: { Host: '[' } }, res => {
            res.resume(); res.on('end', () => resolve(res.statusCode));
          });
          req.on('error', reject); req.end();
        });
        const healthy = await fetch('http://127.0.0.1:' + runtime.server.address().port + '/health');
        await healthy.text();
        process.stdout.write(JSON.stringify([status, healthy.status]));
      } finally { await runtime.close(); }
    `], { env: environment, timeout: 5000 });
    expect(JSON.parse(stdout)).toEqual([400, 200]);
  });

  it('exits cleanly when its initialized stdio client closes input', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      env: environment, stdio: ['pipe', 'pipe', 'pipe'],
    });
    const exited = once(child, 'exit');
    let timer: NodeJS.Timeout | undefined;
    try {
      const response = once(child.stdout, 'data');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'eof-test', version: '1' },
      } }) + '\n');
      const result = await Promise.race([
        response.then(async () => { child.stdin.end(); return exited; }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Server retained resources after stdin EOF')), 3000);
        }),
      ]);
      expect(result).toEqual([0, null]);
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null) child.kill('SIGTERM');
      await exited;
    }
  });

  it('preserves actionable prompt validation errors over the MCP wire', async () => {
    const { sdkServer, appServer } = await createConfiguredServer();
    const client = new Client({ name: 'error-test', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await sdkServer.connect(serverTransport);
      await client.connect(clientTransport);
      await expect(client.getPrompt({ name: 'build_deck', arguments: {} })).rejects.toMatchObject({
        code: -32602,
        message: expect.stringContaining('card_identifier is required'),
      });
      await expect(client.getPrompt({ name: 'analyze_card', arguments: {} })).rejects.toMatchObject({
        code: -32602,
        message: expect.stringContaining('card_identifier is required'),
      });
    } finally {
      await client.close();
      await sdkServer.close();
      await appServer.destroy();
    }
  });

  it.each([
    new ScryfallAPIError('Card not found', 404, 'not_found'),
    new RateLimitError('Please retry later', 12),
  ])('preserves safe upstream prompt diagnostics: $message', async upstreamError => {
    const { sdkServer, appServer } = await createConfiguredServer();
    Object.assign((appServer as unknown as { scryfallClient: object }).scryfallClient, {
      getCard: async () => { throw upstreamError; },
    });
    const client = new Client({ name: 'upstream-error-test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    try {
      await sdkServer.connect(b);
      await client.connect(a);
      for (const name of ['analyze_card', 'build_deck']) {
        const error = await client.getPrompt({ name, arguments: { card_identifier: 'test', format: 'modern' } }).catch(error => error);
        expect(error.code).toBe(-32603);
        expect(error.message).toContain(upstreamError.message);
        expect(error.data).toEqual(upstreamError instanceof RateLimitError
          ? { code: 'RATE_LIMIT_ERROR', retryAfter: 12 }
          : { code: 'not_found', status: 404 });
      }
    } finally {
      await client.close(); await sdkServer.close(); await appServer.destroy();
    }
  });
});
