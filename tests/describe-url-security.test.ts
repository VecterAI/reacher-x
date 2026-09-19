import assert from "node:assert/strict";
import test from "node:test";

import { validateDescribeUrlInput } from "../shared/lib/urls/describeUrl";
import {
  isPrivateHostname,
  isPublicHttpUrl,
} from "../shared/lib/utils/url/urlSafety";

test("blocks private, link-local, metadata and non-public IP ranges", () => {
  for (const hostname of [
    "localhost",
    "127.0.0.1",
    "10.10.0.4",
    "100.64.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "198.18.0.1",
    "203.0.113.10",
    "metadata.google.internal",
    "::1",
    "0:0:0:0:0:0:0:1",
    "0:0:0:0:0:0:0:0",
    "fc00::1",
    "fe80::1",
    "::ffff:7f00:1",
  ]) {
    assert.equal(isPrivateHostname(hostname), true, hostname);
    const urlHost = hostname.includes(":") ? `[${hostname}]` : hostname;
    assert.equal(isPublicHttpUrl(`https://${urlHost}`), false, hostname);
  }
});

test("keeps public URL validation available for ordinary destinations", () => {
  assert.deepEqual(validateDescribeUrlInput("https://example.com/path"), {
    ok: true,
    url: "https://example.com/path",
  });
  assert.equal(isPublicHttpUrl("https://example.com/path"), true);
});

test("rejects private destinations before a network request", () => {
  const result = validateDescribeUrlInput("http://127.0.0.1:3107/private");
  assert.ok(!result.ok);
  assert.match(
    result.error,
    /Local and private-network URLs are not supported/
  );
});
