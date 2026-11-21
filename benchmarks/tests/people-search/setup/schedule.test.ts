import assert from "node:assert/strict";
import test from "node:test";
import { peopleSearchPlan } from "../../../people-search/setup/plan";
import {
  PILOT_PROMPTS,
  PILOT_PROMPTS_DROPPED,
  SMOKE_PROMPT,
  plannedCycles,
  segmentSchedule,
  stage2FirstPrompts,
  stage2Prompts,
  stage2RestPrompts,
} from "../../../people-search/setup/schedule";

const runId = "ps-0123456789ab-smoke";
const options = { runId, seed: 7 };
const LABEL = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;

test("stage 1 plans 35 cycles (pilot amended 20 Nov 2026) and runs competitors on all 20 prompts", () => {
  const smoke = segmentSchedule("smoke", options);
  const pilot = segmentSchedule("pilot", options);
  const main = segmentSchedule("main", options);
  // 1 company smoke test + the pilot's frozen 16 (prompt 6's 8 dropped by
  // approval) + 18 first cycles, prompt 6's among them.
  assert.deepEqual(
    [plannedCycles(smoke), plannedCycles(pilot), plannedCycles(main)],
    [1, 16, 18]
  );
  assert.ok(main.workspaces.some((slot) => slot.promptId === 6));
  const dropped: readonly number[] = PILOT_PROMPTS_DROPPED;
  const smokePrompt = peopleSearchPlan.prompts.find(
    (item) => item.id === SMOKE_PROMPT
  )!;
  assert.equal(
    peopleSearchPlan.categories[smokePrompt.category].entityType,
    "organization"
  );
  assert.deepEqual(smoke.competitorTasks, ["p14"]);
  assert.equal(pilot.competitorTasks.length, 0);
  assert.equal(main.competitorTasks.length, 19);
  assert.deepEqual(
    new Set([...smoke.competitorTasks, ...main.competitorTasks]).size,
    20
  );
  // Every prompt gets exactly one first cycle in stage 1.
  const firstCycles = [
    ...smoke.workspaces,
    ...pilot.workspaces.filter(
      (slot) => slot.learning === "on" && !dropped.includes(slot.promptId)
    ),
    ...main.workspaces,
  ].map((slot) => slot.taskId);
  assert.equal(firstCycles.length, 20);
  assert.equal(new Set(firstCycles).size, 20);
  assert.deepEqual(
    [smoke.decisionPoint, pilot.decisionPoint, main.decisionPoint],
    ["D1", "D2", "D3"]
  );
  assert.equal(pilot.humanLabels, 40);
  assert.equal(main.humanLabels, 60);
});

test("the pilot pairs each prompt's runs back to back, alternating their order", () => {
  const pilot = segmentSchedule("pilot", options);
  assert.deepEqual(
    pilot.workspaces.map((slot) => [slot.promptId, slot.learning, slot.cycles]),
    [
      [PILOT_PROMPTS[0], "on", 4],
      [PILOT_PROMPTS[0], "off", 4],
      [PILOT_PROMPTS[1], "off", 4],
      [PILOT_PROMPTS[1], "on", 4],
    ]
  );
  for (const slot of pilot.workspaces) {
    assert.match(slot.label, LABEL);
    assert.equal(
      peopleSearchPlan.categories[
        peopleSearchPlan.prompts.find((item) => item.id === slot.promptId)!
          .category
      ].entityType,
      "individual"
    );
  }
  assert.equal(
    segmentSchedule("main", options).workspaces.find(
      (slot) => slot.promptId === 2
    )?.useCaseKey,
    "recruiting"
  );
  assert.throws(
    () => segmentSchedule("smoke", { ...options, runId: "x".repeat(80) }),
    /80 characters/
  );
});

test("stage 2 is 70 to 160 cycles, paused a third of the way in", () => {
  const smallest = { staticPrompts: 2, cyclesPerWorkspace: 5 };
  const largest = { staticPrompts: 5, cyclesPerWorkspace: 8 };
  const total = (size: typeof smallest) =>
    plannedCycles(
      segmentSchedule("stage2-first", { ...options, stage2: size })
    ) +
    plannedCycles(
      segmentSchedule("stage2-rest", { ...options, stage2First: size })
    );
  assert.equal(total(smallest), 70);
  assert.equal(total(largest), 160);

  const prompts = stage2Prompts(7, 3);
  assert.equal(prompts.length, 8);
  // The five people signal prompts are always in.
  for (const id of [6, 7, 8, 11, 12])
    assert.ok(prompts.some((prompt) => prompt === id));
  const first = segmentSchedule("stage2-first", {
    ...options,
    stage2: { staticPrompts: 3, cyclesPerWorkspace: 6 },
  });
  assert.deepEqual(
    first.workspaces.map((slot) => slot.promptId),
    stage2FirstPrompts(7, { staticPrompts: 3, cyclesPerWorkspace: 6 }).flatMap(
      (id) => [id, id]
    )
  );
  assert.equal(first.judges, false);
  assert.equal(first.decisionPoint, "D4");

  // D4 can shrink the rest; the prompts already run are not repeated and the order keeps alternating.
  const rest = segmentSchedule("stage2-rest", {
    ...options,
    stage2First: { staticPrompts: 3, cyclesPerWorkspace: 6 },
    stage2: { staticPrompts: 3, cyclesPerWorkspace: 5 },
  });
  const firstIds = new Set(first.workspaces.map((slot) => slot.promptId));
  assert.ok(
    rest.workspaces.every(
      (slot) => !firstIds.has(slot.promptId) && slot.cycles === 5
    )
  );
  assert.equal(
    rest.workspaces[0].learning,
    (first.workspaces.length / 2) % 2 === 0 ? "on" : "off"
  );
  assert.deepEqual(rest.judgesWorkspacesOf, ["stage2-first", "stage2-rest"]);
  assert.throws(() =>
    segmentSchedule("stage2-first", {
      ...options,
      stage2: { staticPrompts: 6, cyclesPerWorkspace: 5 },
    })
  );
});

test("a D4 reduction keeps the prompts already run and never exceeds the new size", () => {
  const isStatic = (id: number) =>
    peopleSearchPlan.prompts.find((item) => item.id === id)!.category ===
    "people-static";
  const first = { staticPrompts: 5, cyclesPerWorkspace: 8 };
  // Find seeds whose first third ran 1 and 2 static prompts, so both cases are checked.
  const seeds = Array.from({ length: 60 }, (_, seed) => seed);
  const ranStatic = (seed: number) =>
    stage2FirstPrompts(seed, first).filter(isStatic);
  for (const seed of seeds.filter((item) => ranStatic(item).length >= 1)) {
    const ran = stage2FirstPrompts(seed, first);
    for (const staticPrompts of [2, 3, 4, 5]) {
      const size = { staticPrompts, cyclesPerWorkspace: 5 };
      if (ranStatic(seed).length > staticPrompts) {
        assert.throws(
          () => stage2RestPrompts(seed, first, size),
          /cannot shrink/
        );
        continue;
      }
      const rest = stage2RestPrompts(seed, first, size);
      const all = [...ran, ...rest];
      // No prompt twice, all five signal prompts, and exactly the new static count.
      assert.equal(new Set(all).size, all.length);
      assert.equal(all.filter((id) => !isStatic(id)).length, 5);
      assert.equal(all.filter(isStatic).length, staticPrompts);
      // A reduction is a subset of the original draw.
      for (const id of all.filter(isStatic))
        assert.ok(stage2Prompts(seed, 5).some((prompt) => prompt === id));
    }
  }
  assert.ok(seeds.some((seed) => ranStatic(seed).length >= 3));
  assert.throws(
    () =>
      stage2RestPrompts(
        7,
        { staticPrompts: 2, cyclesPerWorkspace: 5 },
        {
          staticPrompts: 3,
          cyclesPerWorkspace: 5,
        }
      ),
    /never grow/
  );
  assert.throws(
    () =>
      stage2RestPrompts(
        7,
        { staticPrompts: 2, cyclesPerWorkspace: 5 },
        {
          staticPrompts: 2,
          cyclesPerWorkspace: 6,
        }
      ),
    /never grow/
  );
});
