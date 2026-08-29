import assert from "node:assert/strict";
import test from "node:test";
import {
  MODELS,
  OPENROUTER_PROVIDERS,
  PINNED_VISION_MODEL,
  PINNED_VISION_PROVIDER_OPTIONS,
} from "../convex/lib/ai";

test("vision requests fail over between compatible Kimi providers", () => {
  const provider = PINNED_VISION_PROVIDER_OPTIONS.openrouter.provider;

  assert.equal(PINNED_VISION_MODEL, MODELS.KIMI_K2_6);
  assert.deepEqual(provider.order, [
    OPENROUTER_PROVIDERS.BASETEN,
    OPENROUTER_PROVIDERS.WANDB_FP4,
  ]);
  assert.equal(provider.allow_fallbacks, true);
  assert.equal(provider.require_parameters, true);
  assert.equal(provider.only, undefined);
});
