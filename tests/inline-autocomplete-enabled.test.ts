import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isInlineAutocompleteEnabled,
  readBoolean,
} from "../convex/lib/runtimeConfigHelpers";

test("readBoolean accepts common truthy and falsy env spellings", () => {
  assert.equal(readBoolean("1", false), true);
  assert.equal(readBoolean("true", false), true);
  assert.equal(readBoolean("ON", false), true);
  assert.equal(readBoolean("0", true), false);
  assert.equal(readBoolean("false", true), false);
  assert.equal(readBoolean("off", true), false);
  assert.equal(readBoolean(undefined, true), true);
  assert.equal(readBoolean("maybe", true), true);
});

test("inline autocomplete defaults on in production and off in development", () => {
  assert.equal(isInlineAutocompleteEnabled({}, true), true);
  assert.equal(isInlineAutocompleteEnabled({}, false), false);
});

test("INLINE_AUTOCOMPLETE_ENABLED overrides the NODE_ENV default", () => {
  assert.equal(
    isInlineAutocompleteEnabled({ INLINE_AUTOCOMPLETE_ENABLED: "0" }, true),
    false
  );
  assert.equal(
    isInlineAutocompleteEnabled({ INLINE_AUTOCOMPLETE_ENABLED: "1" }, false),
    true
  );
});

test("docs and env templates document INLINE_AUTOCOMPLETE_ENABLED", () => {
  const convexConfig = readFileSync("convex/convex.config.ts", "utf8");
  const envExample = readFileSync(".env.example", "utf8");
  const configurationDocs = readFileSync("docs/configuration.md", "utf8");

  assert.match(convexConfig, /\bINLINE_AUTOCOMPLETE_ENABLED:/);
  assert.match(envExample, /^# INLINE_AUTOCOMPLETE_ENABLED=/m);
  assert.match(configurationDocs, /`INLINE_AUTOCOMPLETE_ENABLED`/);
});
