import { describe, expect, it } from "vitest";
import { iterateArrayStream } from "../src/services/bulk-json-stream.js";

function chunkedBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("iterateArrayStream", () => {
  it("yields top-level array items from a chunked JSON body", async () => {
    const values: Array<{ id: string }> = [];

    for await (const value of iterateArrayStream<{ id: string }>(
      chunkedBody(['[{"id":"a"},', '{"id":"b"}', "]"])
    )) {
      values.push(value);
    }

    expect(values).toEqual([{ id: "a" }, { id: "b" }]);
  });
});
