import assert from "node:assert/strict";
import { test } from "node:test";
import { POST, GET } from "../app/api/upload/route";
import { NextRequest } from "next/server";

test("oversized streamed uploads are cancelled without trusting a missing or false length", async () => {
  for (const declaredSize of [undefined, "3"]) {
    let reads = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          reads++;
          controller.enqueue(new Uint8Array(1024 * 1024));
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 }
    );
    const request = new NextRequest("http://demo.test/api/upload", {
      method: "POST",
      body,
      // Required by Node when constructing a streaming request.
      duplex: "half",
      headers: {
        "content-type": "audio/mp4",
        ...(declaredSize ? { "content-length": declaredSize } : {}),
      },
    });
    assert.equal((await POST(request)).status, 413);
    assert.equal(cancelled, true);
    assert.equal(reads, 16);
  }
});

test("demo storage validates uploads and releases them without subsequent writes", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const invalid = await POST(
    new NextRequest("http://demo.test/api/upload", {
      method: "POST",
      body: "bad",
      headers: { "content-type": "text/html", "content-length": "3" },
    })
  );
  assert.equal(invalid.status, 400);
  const upload = await POST(
    new NextRequest("http://demo.test/api/upload", {
      method: "POST",
      body: new Uint8Array([1, 2, 3]),
      headers: { "content-type": "audio/wav", "content-length": "3" },
    })
  );
  assert.equal(upload.status, 200);
  const { storageId } = await upload.json();
  const request = new Request(`http://demo.test/api/upload?id=${storageId}`);
  assert.equal((await GET(request)).status, 200);
  // Only advance timers, not the wall clock: 404 proves the entry was deleted.
  t.mock.timers.tick(10 * 60 * 1000);
  assert.equal((await GET(request)).status, 404);
});

test("one demo session cannot consume another session's twenty-upload quota", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const upload = (cookie?: string) =>
    POST(
      new NextRequest("https://demo.test/api/upload", {
        method: "POST",
        body: new Uint8Array([1, 2, 3]),
        headers: {
          "content-type": "audio/wav",
          "content-length": "3",
          ...(cookie ? { cookie } : {}),
        },
      })
    );
  const first = await upload();
  const setCookie = first.headers.get("set-cookie")!;
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /Partitioned/i);
  const cookie = setCookie.split(";")[0];
  for (let index = 1; index < 20; index++)
    assert.equal((await upload(cookie)).status, 200);
  assert.equal((await upload(cookie)).status, 429);
  assert.equal((await upload()).status, 200);
  t.mock.timers.tick(10 * 60 * 1000);
});

test("audio uploads accept unknown length but reject invalid declared sizes", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const request = (size?: string) =>
    new NextRequest("http://demo.test/api/upload", {
      method: "POST",
      body: new Uint8Array([1, 2, 3]),
      headers: {
        "content-type": "audio/wav",
        ...(size === undefined ? {} : { "content-length": size }),
      },
    });
  assert.equal((await POST(request())).status, 200);
  for (const size of ["0", "-1", "invalid", "16000000"])
    assert.equal((await POST(request(size))).status, 413);
  t.mock.timers.tick(10 * 60 * 1000);
});
