import assert from "node:assert/strict";
import test from "node:test";
import {
  drawStage2StaticPrompts,
  learningOrder,
  peopleSearchPlan,
  type NoOpenAIModel,
} from "../../people-search/plan";

// The real assertion is the type check: typecheck fails if either line stops holding.
test("an OpenAI model in any judge slot fails the independence check", () => {
  const independent: NoOpenAIModel<"z-ai/a" | "deepseek/b" | "qwen/c"> = true;
  // @ts-expect-error An OpenAI tie-breaker alone must be rejected.
  const dependent: NoOpenAIModel<"z-ai/a" | "deepseek/b" | "openai/c"> = true;
  assert.equal(independent, dependent);
});

test("learning order alternates between prompts, as in proposal 3.2", () => {
  assert.deepEqual(
    [0, 1, 2].map((position) => learningOrder(position)),
    [
      ["on", "off"],
      ["off", "on"],
      ["on", "off"],
    ]
  );
});

test("stage 2 draws people static prompts reproducibly from the seed", () => {
  const staticIds = peopleSearchPlan.prompts
    .filter((prompt) => prompt.category === "people-static")
    .map((prompt) => prompt.id);
  const draw = drawStage2StaticPrompts(42, 3);
  assert.deepEqual(draw, drawStage2StaticPrompts(42, 3));
  assert.equal(draw.length, 3);
  assert.ok(draw.every((id) => (staticIds as number[]).includes(id)));
  assert.throws(() => drawStage2StaticPrompts(42, 6));
});
