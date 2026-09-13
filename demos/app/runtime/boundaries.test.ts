import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { getBlogDemoUrl } from "@/features/blog/lib/blogDemoUrl";

test("embedding URLs require an explicit safe origin and keep story routes intact", () => {
  assert.throws(
    () =>
      getBlogDemoUrl(
        "find-candidates",
        "https://blog.example.test",
        "https://blog.example.test"
      ),
    /different origin/
  );
  assert.equal(
    getBlogDemoUrl("find-candidates", "https://demo.example.test"),
    "https://demo.example.test/workspace?scenario=find-candidates"
  );
  assert.equal(
    getBlogDemoUrl("workspaces-explained", "http://localhost:3130"),
    "http://localhost:3130/?scenario=workspaces-explained"
  );
  for (const origin of [
    "",
    "http://remote.example.test",
    "javascript:alert(1)",
    "https://user:secret@example.test",
    "https://example.test/path",
    "https://example.test?scenario=wrong",
  ]) {
    assert.throws(() => getBlogDemoUrl("find-candidates", origin));
  }
});

test("production source never imports the isolated app or local services", async () => {
  const root = resolve(import.meta.dirname, "../../..");
  for (const directory of ["app", "features", "shared", "convex"]) {
    const files = await readdir(resolve(root, directory), { recursive: true });
    for (const file of files.filter((name) => /\.[cm]?[jt]sx?$/.test(name))) {
      const source = await readFile(resolve(root, directory, file), "utf8");
      assert.doesNotMatch(
        source,
        /(?:from\s*|import\s*\(?|require\s*\()\s*["'][^"']*demos\/app\//,
        `${directory}/${file}`
      );
    }
  }
});
