import type { DecisionPoint } from "../../core/execution/runner";
import type { LearningCondition } from "../../core/types";
import { taskId } from "./criteria";
import {
  drawStage2StaticPrompts,
  learningOrder,
  peopleSearchPlan,
} from "./plan";

/**
 * What each live step runs (proposal 6 and 7.2), derived from the approved
 * plan. Stage 1: 1 company smoke test + 2 people prompts x 4 cycles x 2
 * learning conditions + 17 first cycles = 34 cycles, with competitors on the
 * smoke prompt and then the 19 remaining prompts. Stage 2: 7 to 10 people
 * prompts x 5 to 8 cycles x 2 conditions, in fresh workspaces, paused for D4
 * a third of the way in. Workspaces run one at a time, in this order.
 */

type Prompt = (typeof peopleSearchPlan.prompts)[number];
export type PromptId = Prompt["id"];

export const STEPS = ["smoke", "pilot", "main", "stage2"] as const;
export type StepId = (typeof STEPS)[number];

// A step runs its segments in order, each ending at a decision point (or,
// for the last, the write-up). Only stage 2 has two.
export const STEP_SEGMENTS = {
  smoke: ["smoke"],
  pilot: ["pilot"],
  main: ["main"],
  stage2: ["stage2-first", "stage2-rest"],
} as const satisfies Record<StepId, readonly string[]>;
export type SegmentId = (typeof STEP_SEGMENTS)[StepId][number];
export const SEGMENTS: readonly SegmentId[] = STEPS.flatMap(
  (step) => STEP_SEGMENTS[step]
);

/**
 * The proposal sets how many prompts the smoke test and pilot use but not
 * which, so they are fixed here by rule, before any result is seen: the
 * lowest-numbered company static prompt for the smoke test (static is the
 * plainest check of the organization result path), and the lowest-numbered
 * people static and people signal prompts for the pilot, so the pilot times
 * one prompt of each kind. Changing them is a plan change made before the
 * freeze.
 */
export const SMOKE_PROMPT = 14 satisfies PromptId;
export const PILOT_PROMPTS = [1, 6] as const satisfies readonly PromptId[];

/**
 * The workspace use case passed to ReacherX's setup. Following round 1:
 * company prompts are customer prospecting, the one hiring prompt is
 * recruiting, and other people prompts are general outreach.
 */
export type UseCaseKey =
  | "customer_prospecting"
  | "recruiting"
  | "general_outreach";
export function useCaseKey(prompt: Prompt): UseCaseKey {
  if (peopleSearchPlan.categories[prompt.category].entityType !== "individual")
    return "customer_prospecting";
  return prompt.id === 2 ? "recruiting" : "general_outreach";
}

// The same rule runWorkspace and the Convex hook apply.
const LABEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;

export type WorkspaceSlot = Readonly<{
  label: string;
  promptId: PromptId;
  taskId: string;
  prompt: string;
  useCaseKey: UseCaseKey;
  learning: LearningCondition;
  cycles: number;
}>;

export type Stage2Size = Readonly<{
  staticPrompts: number;
  cyclesPerWorkspace: number;
}>;

export type SegmentSchedule = Readonly<{
  segment: SegmentId;
  step: StepId;
  decisionPoint: DecisionPoint | null;
  workspaces: readonly WorkspaceSlot[];
  // Prompts whose competitor searches run in this segment.
  competitorTasks: readonly string[];
  // Whether this segment judges results; the first third of stage 2 only
  // measures cost (D4), and its workspaces are judged with the rest.
  judges: boolean;
  judgesWorkspacesOf: readonly SegmentId[];
  // Blind human labels drawn after judging (proposal 3.3 and 6.2).
  humanLabels: number | null;
  stage2: Stage2Size | null;
}>;

const promptById = (id: PromptId) =>
  peopleSearchPlan.prompts.find((prompt) => prompt.id === id)!;
const byId = (a: PromptId, b: PromptId) => a - b;

function slot(
  runId: string,
  id: PromptId,
  learning: LearningCondition,
  cycles: number
): WorkspaceSlot {
  const prompt = promptById(id);
  const task = taskId(id);
  const label = `${runId}_${task}_${learning}`;
  if (!LABEL_PATTERN.test(label))
    throw new Error(
      "Workspace labels use letters, digits, '-' and '_', at most 80 characters."
    );
  return {
    label,
    promptId: id,
    taskId: task,
    prompt: prompt.text,
    useCaseKey: useCaseKey(prompt),
    learning,
    cycles,
  };
}

/** A prompt's two runs go back to back; the order alternates by position (proposal 3.2). */
function paired(
  runId: string,
  ids: readonly PromptId[],
  cycles: number,
  firstPosition = 0
) {
  return ids.flatMap((id, index) =>
    learningOrder(firstPosition + index).map((learning) =>
      slot(runId, id, learning, cycles)
    )
  );
}

export function checkStage2Size(size: Stage2Size): Stage2Size {
  const { stage2 } = peopleSearchPlan;
  const prompts = 5 + size.staticPrompts;
  if (
    !Number.isInteger(size.staticPrompts) ||
    !Number.isInteger(size.cyclesPerWorkspace) ||
    prompts < stage2.peoplePrompts.min ||
    prompts > stage2.peoplePrompts.max ||
    size.cyclesPerWorkspace < stage2.cyclesPerWorkspace.min ||
    size.cyclesPerWorkspace > stage2.cyclesPerWorkspace.max
  )
    throw new Error(
      "Stage 2 adds 2 to 5 people static prompts and runs 5 to 8 cycles per workspace."
    );
  return size;
}

/**
 * Stage 2's prompts in run order: the five people signal prompts plus the
 * static prompts drawn with the frozen seed, by prompt number.
 */
export function stage2Prompts(seed: number, staticPrompts: number) {
  const drawn = drawStage2StaticPrompts(seed, staticPrompts);
  return peopleSearchPlan.prompts
    .filter(
      (prompt) =>
        prompt.category === "people-signals" || drawn.includes(prompt.id)
    )
    .map((prompt): PromptId => prompt.id)
    .sort(byId);
}

/** The first third of stage 2's prompts, rounded up, each with both of its workspaces. */
export function stage2FirstPrompts(seed: number, size: Stage2Size) {
  const prompts = stage2Prompts(seed, checkStage2Size(size).staticPrompts);
  return prompts.slice(0, Math.ceil(prompts.length / 3));
}

const isStatic = (id: PromptId) => promptById(id).category === "people-static";

/**
 * The people static prompts in the order the frozen seed drew them: a larger
 * draw never changes a smaller one, so each further draw adds the next.
 */
function staticDrawOrder(seed: number) {
  const order: number[] = [];
  for (let count = 2; count <= 5; count++)
    for (const id of drawStage2StaticPrompts(seed, count))
      if (!order.includes(id)) order.push(id);
  return order;
}

/**
 * The rest of stage 2 after D4 (proposal 6.4: "shrink the rest"). The
 * prompts its first third already ran stay in, and the static prompts are
 * topped up in draw order to the new count, so stage 2 never exceeds its
 * new size. A size that cannot hold the static prompts already run, or that
 * grows stage 2 beyond what D3 approved, is refused.
 */
export function stage2RestPrompts(
  seed: number,
  first: Stage2Size,
  rest: Stage2Size
) {
  checkStage2Size(first);
  checkStage2Size(rest);
  if (
    rest.staticPrompts > first.staticPrompts ||
    rest.cyclesPerWorkspace > first.cyclesPerWorkspace
  )
    throw new Error(
      "D4 can shrink the rest of stage 2, never grow it beyond the size approved at D3."
    );
  const ran = stage2FirstPrompts(seed, first);
  const ranStatic: number[] = ran.filter(isStatic);
  if (ranStatic.length > rest.staticPrompts)
    throw new Error(
      `The first third already ran ${ranStatic.length} people static prompt(s), so stage 2 cannot shrink to ${rest.staticPrompts}.`
    );
  const statics = [...ranStatic];
  for (const id of staticDrawOrder(seed))
    if (statics.length < rest.staticPrompts && !statics.includes(id))
      statics.push(id);
  return peopleSearchPlan.prompts
    .filter(
      (prompt) =>
        (prompt.category === "people-signals" || statics.includes(prompt.id)) &&
        !ran.includes(prompt.id)
    )
    .map((prompt): PromptId => prompt.id)
    .sort(byId);
}

export type ScheduleOptions = Readonly<{
  runId: string;
  seed: number;
  // Stage 2 only: the size approved at D3, and for the rest (which D4 may
  // shrink) the size its first third ran with.
  stage2?: Stage2Size;
  stage2First?: Stage2Size;
}>;

export function segmentSchedule(
  segment: SegmentId,
  options: ScheduleOptions
): SegmentSchedule {
  const { runId, seed } = options;
  const all = peopleSearchPlan.prompts.map((prompt) => prompt.id);
  const { stage1 } = peopleSearchPlan;
  const base = {
    segment,
    judges: true,
    judgesWorkspacesOf: [segment],
    humanLabels: null,
    stage2: null,
  };
  switch (segment) {
    case "smoke":
      return {
        ...base,
        step: "smoke",
        decisionPoint: "D1",
        workspaces: [
          slot(runId, SMOKE_PROMPT, "on", stage1.companySmokeCycles),
        ],
        competitorTasks: [taskId(SMOKE_PROMPT)],
      };
    case "pilot":
      return {
        ...base,
        step: "pilot",
        decisionPoint: "D2",
        workspaces: paired(
          runId,
          PILOT_PROMPTS,
          stage1.cyclesPerPilotWorkspace
        ),
        competitorTasks: [],
        humanLabels: peopleSearchPlan.judging.pilotHumanLabels,
      };
    case "main": {
      const done: PromptId[] = [SMOKE_PROMPT, ...PILOT_PROMPTS];
      // First cycles of the 17 remaining prompts, as the product runs them.
      const first = all.filter((id) => !done.includes(id));
      return {
        ...base,
        step: "main",
        decisionPoint: "D3",
        workspaces: first.map((id) => slot(runId, id, "on", 1)),
        competitorTasks: all
          .filter((id) => id !== SMOKE_PROMPT)
          .map((id) => taskId(id)),
        humanLabels: peopleSearchPlan.judging.mainHumanLabels,
      };
    }
    case "stage2-first": {
      if (!options.stage2) throw new Error("Stage 2 needs its approved size.");
      const size = checkStage2Size(options.stage2);
      return {
        ...base,
        step: "stage2",
        decisionPoint: "D4",
        workspaces: paired(
          runId,
          stage2FirstPrompts(seed, size),
          size.cyclesPerWorkspace
        ),
        competitorTasks: [],
        judges: false,
        judgesWorkspacesOf: [],
        stage2: size,
      };
    }
    case "stage2-rest": {
      if (!options.stage2First)
        throw new Error("The rest of stage 2 needs its first third's size.");
      const size = checkStage2Size(options.stage2 ?? options.stage2First);
      const first = stage2FirstPrompts(seed, options.stage2First);
      const rest = stage2RestPrompts(seed, options.stage2First, size);
      return {
        ...base,
        step: "stage2",
        decisionPoint: null,
        // Positions continue from the first third, so the order keeps alternating.
        workspaces: paired(runId, rest, size.cyclesPerWorkspace, first.length),
        competitorTasks: [],
        judgesWorkspacesOf: ["stage2-first", "stage2-rest"],
        stage2: size,
      };
    }
  }
}

/** Cycles a schedule plans, for budgets and the 7.2 totals. */
export function plannedCycles(schedule: SegmentSchedule) {
  return schedule.workspaces.reduce((sum, item) => sum + item.cycles, 0);
}
