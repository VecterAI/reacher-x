import assert from "node:assert/strict";
import test from "node:test";
import { identifierSchema } from "../../../core/setup/manifest";
import { criterionSchema } from "../../../core/types";
import { buildTasks } from "../../../people-search/setup/criteria";
import { peopleSearchPlan } from "../../../people-search/setup/plan";

const referenceDate = "2026-11-20T00:00:00.000Z";

test("every prompt becomes one task with valid, uniquely named criteria", () => {
  const tasks = buildTasks(referenceDate);
  assert.equal(tasks.length, peopleSearchPlan.prompts.length);
  assert.equal(new Set(tasks.map((task) => task.id)).size, tasks.length);
  for (const task of tasks) {
    assert.ok(identifierSchema.safeParse(task.id).success, task.id);
    assert.equal(task.referenceDate, referenceDate);
    assert.ok(task.criteria.length >= 2, task.id);
    for (const criterion of task.criteria)
      assert.ok(criterionSchema.safeParse(criterion).success, task.id);
    const ids = task.criteria.map((criterion) => criterion.id);
    assert.equal(new Set(ids).size, ids.length, task.id);
  }
});

test("tasks keep the prompt's entity type, and signal prompts carry a signal requirement", () => {
  const tasks = buildTasks(referenceDate);
  for (const [index, prompt] of peopleSearchPlan.prompts.entries()) {
    const task = tasks[index];
    const category = peopleSearchPlan.categories[prompt.category];
    assert.equal(task.prompt, prompt.text);
    assert.equal(task.entityType, category.entityType);
    if (prompt.category.endsWith("-signals"))
      assert.ok(
        task.criteria.some((criterion) => criterion.id === "signal"),
        task.id
      );
  }
});
