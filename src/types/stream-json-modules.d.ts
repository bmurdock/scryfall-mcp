declare module 'stream-json/streamers/stream-array' {
  import type { Transform } from 'node:stream';

  export function streamArray(): Transform;
}
