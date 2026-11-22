import type { z } from "zod";
import {
  FileCheckpointStore,
  RunnerStateError,
} from "../execution/checkpoints";
import { BudgetStop } from "../execution/spend";
import {
  canonicalJson,
  identifierSchema,
  jsonSchema,
  type Checkpoint,
  type JsonValue,
  type WorkUnit,
} from "../setup/manifest";
import type { ArtifactReference, LearningCondition } from "../types";

/**
 * Resume safety for live steps: one checkpoint per unit of work (a workspace,
 * a competitor request, a judged result). A completed unit is reused and never
 * paid for twice. A unit that started but never finished (a crash or a kill)
 * may already have spent money, so it becomes needs-review and is never
 * repeated automatically; neither is one that failed. Units are created when
 * they are reached, and each unit's description is frozen as its input, so a
 * changed plan cannot reuse an old checkpoint.
 */

export type UnitSpec = Readonly<{
  id: string;
  taskId: string;
  toolId: string;
  learning: LearningCondition | null;
  cycle: number | null;
  // What the unit does; frozen as the unit's input artifact.
  input: JsonValue;
}>;

export type UnitState = "new" | Checkpoint["status"];

export type UnitOutcome<T> =
  | Readonly<{ status: "completed"; value: T; reused: boolean }>
  | Readonly<{
      status: "needs-review";
      reason: string;
      receipt: ArtifactReference | null;
    }>;

/**
 * Raised when units keep failing in one attempt, so an outage (a provider or
 * the deployment down) holds a few units for review instead of every one left.
 */
export class StepHalted extends Error {}

/** What ends a phase early without being an error: the budget, or a halt. */
export type StepStop = BudgetStop | StepHalted;

/** Runs a phase's loop; a budget stop or halt ends it and is returned, other errors are thrown. */
export async function untilStopped(
  loop: () => Promise<void>
): Promise<StepStop | null> {
  try {
    await loop();
    return null;
  } catch (error) {
    if (error instanceof BudgetStop || error instanceof StepHalted)
      return error;
    throw error;
  }
}

/** Thrown by a unit's work to keep what it received (for example raw responses) as its review receipt. */
export class UnitFailed extends Error {
  constructor(
    message: string,
    readonly receipt: JsonValue | null,
    options?: { cause?: unknown }
  ) {
    super(message, options);
  }
}

/** A value readable as T: what a unit's work may return before its schema checks it. */
type ReadonlyDeep<T> = T extends readonly (infer U)[]
  ? readonly ReadonlyDeep<U>[]
  : T extends object
    ? { readonly [K in keyof T]: ReadonlyDeep<T[K]> }
    : T;

/** Plain JSON for storage; values that JSON cannot hold are dropped as JSON.stringify drops them. */
export function toJson(value: unknown): JsonValue {
  return jsonSchema.parse(JSON.parse(JSON.stringify(value)));
}

const now = () => new Date().toISOString();

export class UnitLedger {
  // Units run in this attempt, and units reused from an earlier one.
  readonly tally = { executed: 0, reused: 0 };
  // Units that failed in a row in this attempt.
  private failing = 0;

  constructor(private readonly store: FileCheckpointStore) {}

  get runId() {
    return this.store.runId;
  }

  /** Freezes what the run executes; a different record under the same run ID is refused. */
  open(record: JsonValue) {
    return this.store.freeze(record);
  }

  async state(unitId: string): Promise<UnitState> {
    return (await this.store.read(unitId))?.status ?? "new";
  }

  private async workUnit(spec: UnitSpec): Promise<WorkUnit> {
    return {
      id: identifierSchema.parse(spec.id),
      runId: this.store.runId,
      taskId: spec.taskId,
      toolId: spec.toolId,
      learning: spec.learning,
      cycle: spec.cycle,
      input: await this.store.saveFrozenJson(
        this.store.runFile(`inputs/${spec.id}.json`),
        spec.input
      ),
    };
  }

  private async review(
    unit: WorkUnit,
    reason: string,
    receipt: JsonValue | null
  ): Promise<UnitOutcome<never>> {
    const saved = await this.store.saveResult(
      `${unit.id}-review`,
      toJson({ reason, receipt })
    );
    await this.store.write({
      unit,
      status: "needs-review",
      receipt: saved,
      updatedAt: now(),
    });
    return { status: "needs-review", reason, receipt: saved };
  }

  /**
   * Runs one unit at most once. `review` can turn a finished value into
   * needs-review (for example a workspace the harness interrupted); the value
   * is then kept as the receipt instead of a result. Callers check the budget
   * and the stop signal before calling, so a unit is marked started only when
   * its work really begins.
   */
  async run<S extends z.ZodType>(
    spec: UnitSpec,
    schema: S,
    execute: () => Promise<ReadonlyDeep<z.output<S>>>,
    review: (value: z.output<S>) => string | null = () => null
  ): Promise<UnitOutcome<z.output<S>>> {
    const unit = await this.workUnit(spec);
    const checkpoint = await this.store.read(unit.id);
    if (checkpoint && canonicalJson(checkpoint.unit) !== canonicalJson(unit))
      throw new RunnerStateError(
        `Checkpoint ${unit.id} no longer matches this step's schedule.`
      );
    if (checkpoint?.status === "completed") {
      const value = schema.parse(
        await this.store.readArtifact(checkpoint.result)
      );
      this.tally.reused += 1;
      return { status: "completed", value, reused: true };
    }
    if (checkpoint?.status === "needs-review")
      return {
        status: "needs-review",
        reason: "Marked for review in an earlier attempt.",
        receipt: checkpoint.receipt,
      };
    if (checkpoint?.status === "started") {
      // A continuation that crashed keeps the receipt it continued, so it
      // can be continued again after review.
      const earlier = checkpoint.resumedFrom
        ? await this.store
            .readArtifact(checkpoint.resumedFrom)
            .catch(() => null)
        : null;
      return this.review(
        unit,
        "Started in an earlier attempt that did not finish; it may have been billed.",
        earlier !== null &&
          typeof earlier === "object" &&
          !Array.isArray(earlier) &&
          "receipt" in earlier
          ? (earlier.receipt ?? null)
          : null
      );
    }
    if (!checkpoint)
      await this.store.write({ unit, status: "pending", updatedAt: now() });
    const startedAt = now();
    await this.store.write({
      unit,
      status: "started",
      startedAt,
      updatedAt: startedAt,
    });
    return this.finish(unit, schema, execute, review);
  }

  /** A completed unit's value, read without counting it as reused; null otherwise. */
  async completed<S extends z.ZodType>(
    unitId: string,
    schema: S
  ): Promise<z.output<S> | null> {
    const checkpoint = await this.store.read(unitId);
    if (checkpoint?.status !== "completed") return null;
    return schema.parse(await this.store.readArtifact(checkpoint.result));
  }

  /** A held unit's review receipt as saved, or null when it is not held or kept none. */
  async held(
    unitId: string
  ): Promise<{ receipt: ArtifactReference; value: JsonValue } | null> {
    const checkpoint = await this.store.read(unitId);
    if (checkpoint?.status !== "needs-review" || !checkpoint.receipt)
      return null;
    return {
      receipt: checkpoint.receipt,
      value: await this.store.readArtifact(checkpoint.receipt),
    };
  }

  /**
   * Continues a unit held for review, only when explicitly asked (for a
   * workspace the harness stopped, `--resume-held`). The held checkpoint is
   * copied into the run's held/ folder first and its receipt stays in
   * results/, so nothing is lost; the unit then runs as `run` does and is
   * completed or held again.
   */
  async resume<S extends z.ZodType>(
    spec: UnitSpec,
    receipt: ArtifactReference,
    schema: S,
    execute: () => Promise<ReadonlyDeep<z.output<S>>>,
    review: (value: z.output<S>) => string | null = () => null
  ): Promise<UnitOutcome<z.output<S>>> {
    const unit = await this.workUnit(spec);
    const checkpoint = await this.store.read(unit.id);
    if (
      checkpoint?.status !== "needs-review" ||
      !checkpoint.receipt ||
      canonicalJson(checkpoint.receipt) !== canonicalJson(receipt) ||
      canonicalJson(checkpoint.unit) !== canonicalJson(unit)
    )
      throw new RunnerStateError(
        `Checkpoint ${unit.id} is not the held unit this continuation expects.`
      );
    const startedAt = now();
    await this.store.keepCheckpoint(
      unit.id,
      `before-resume-${startedAt.replace(/[^0-9a-zA-Z]/g, "-")}`
    );
    await this.store.write({
      unit,
      status: "started",
      startedAt,
      updatedAt: startedAt,
      resumedFrom: receipt,
    });
    return this.finish(unit, schema, execute, review);
  }

  private async finish<S extends z.ZodType>(
    unit: WorkUnit,
    schema: S,
    execute: () => Promise<ReadonlyDeep<z.output<S>>>,
    review: (value: z.output<S>) => string | null
  ): Promise<UnitOutcome<z.output<S>>> {
    let raw: unknown;
    try {
      raw = await execute();
    } catch (error) {
      this.failing += 1;
      return this.review(
        unit,
        error instanceof Error ? error.message : "The unit failed.",
        error instanceof UnitFailed ? error.receipt : null
      );
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      this.failing += 1;
      return this.review(
        unit,
        "The unit's result does not match its record format.",
        toJson(raw)
      );
    }
    const value: z.output<S> = parsed.data;
    const problem = review(value);
    if (problem) {
      this.failing += 1;
      return this.review(unit, problem, toJson(value));
    }
    const result = await this.store.saveResult(unit.id, toJson(value));
    await this.store.write({
      unit,
      status: "completed",
      result,
      updatedAt: now(),
    });
    this.tally.executed += 1;
    this.failing = 0;
    return { status: "completed", value, reused: false };
  }

  /** Throws StepHalted once `limit` units in a row have failed in this attempt. */
  haltAfter(limit: number, unitId: string, reason: string) {
    if (this.failing >= limit)
      throw new StepHalted(
        `${this.failing} unit(s) in a row failed, the last ${unitId}: ${reason} The step stopped; review them before resuming.`
      );
  }
}
