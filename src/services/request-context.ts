import { AsyncLocalStorage } from 'node:async_hooks';

// Request lifetime follows asynchronous tool/prompt work without coupling each
// domain helper's parameters to MCP transport types.
const requestSignal = new AsyncLocalStorage<AbortSignal | undefined>();

export function currentRequestSignal(): AbortSignal | undefined {
  return requestSignal.getStore();
}

export function withRequestSignal<T>(signal: AbortSignal | undefined, operation: () => T): T {
  signal?.throwIfAborted();
  return requestSignal.run(signal, operation);
}

export interface SharedRequest<T> {
  controller: AbortController;
  promise: Promise<T>;
  consumers: number;
  settled: boolean;
}

/** Each consumer owns its wait; the last cancellation owns the shared abort. */
export function shareRequest<T>(
  requests: Map<string, SharedRequest<T>>,
  key: string,
  operation: () => Promise<T>
): Promise<T> {
  const signal = currentRequestSignal();
  signal?.throwIfAborted();
  let entry = requests.get(key);
  if (!entry) {
    const controller = new AbortController();
    const created: SharedRequest<T> = {
      controller, consumers: 0, settled: false,
      promise: Promise.resolve().then(() => withRequestSignal(controller.signal, operation)),
    };
    entry = created;
    requests.set(key, created);
    created.promise = created.promise.finally(() => {
      created.settled = true;
      if (requests.get(key) === created) requests.delete(key);
    });
  }
  const shared = entry;
  shared.consumers++;
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const release = () => {
      if (finished) return false;
      finished = true;
      signal?.removeEventListener('abort', abort);
      shared.consumers--;
      if (!shared.settled && shared.consumers === 0) {
        if (requests.get(key) === shared) requests.delete(key);
        shared.controller.abort();
      }
      return true;
    };
    const abort = () => {
      if (release()) reject(signal!.reason);
    };
    signal?.addEventListener('abort', abort, { once: true });
    shared.promise.then(
      value => { if (release()) resolve(value); },
      error => { if (release()) reject(error); }
    );
  });
}
