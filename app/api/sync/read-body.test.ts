/** @jest-environment node */

import {
  readRequestBodyWithLimit,
  SyncPayloadTooLargeError,
} from "./read-body";

function streamRequest(
  chunks: Uint8Array[],
  onCancel?: () => void,
  onPull?: () => void,
) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        onPull?.();
        const chunk = chunks[index++];
        if (chunk) {
          controller.enqueue(chunk);
        } else {
          controller.close();
        }
      },
      cancel() {
        onCancel?.();
      },
    },
    { highWaterMark: 0 },
  );

  return new Request("http://localhost/api/sync", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("readRequestBodyWithLimit", () => {
  it("reads a UTF-8 body split across chunks", async () => {
    const bytes = new TextEncoder().encode("你好 NextChat");
    const request = streamRequest([
      bytes.slice(0, 1),
      bytes.slice(1, 5),
      bytes.slice(5),
    ]);

    await expect(
      readRequestBodyWithLimit(request, bytes.byteLength),
    ).resolves.toBe("你好 NextChat");
  });

  it("rejects an oversized Content-Length before reading the body", async () => {
    let pulls = 0;
    const request = streamRequest(
      [new TextEncoder().encode("small")],
      undefined,
      () => pulls++,
    );
    request.headers.set("content-length", "6");

    await expect(readRequestBodyWithLimit(request, 5)).rejects.toBeInstanceOf(
      SyncPayloadTooLargeError,
    );
    expect(pulls).toBe(0);
  });

  it("cancels without consuming the rest of a stream after the limit", async () => {
    let cancelled = false;
    let pulls = 0;
    const chunks = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
      new Uint8Array([7, 8, 9]),
    ];
    const request = streamRequest(
      chunks,
      () => {
        cancelled = true;
      },
      () => pulls++,
    );

    await expect(readRequestBodyWithLimit(request, 5)).rejects.toBeInstanceOf(
      SyncPayloadTooLargeError,
    );
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThan(chunks.length);
  });
});
