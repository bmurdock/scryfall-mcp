import { Readable } from 'node:stream';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/stream-array';
import chain from 'stream-chain';

export async function* iterateArrayStream<T>(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<T> {
  const pipeline = chain([Readable.fromWeb(body), parser(), streamArray()]);

  for await (const chunk of pipeline as AsyncIterable<{ value: T }>) {
    yield chunk.value;
  }
}
