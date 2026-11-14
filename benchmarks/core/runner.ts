import { FileCheckpointStore, RunnerStateError } from "./checkpoints";
import {
  canonicalJson,
  jsonSchema,
  offlineRunFileSchema,
  type JsonValue,
  type WorkUnit,
} from "./manifest";
import { verifyProposal } from "./proposal";

export type { RunManifest, WorkUnit, Checkpoint } from "./manifest";

export type BenchmarkStep = "smoke" | "pilot" | "main" | "stage2" | "replay";
export type DecisionPoint = "D1" | "D2" | "D3" | "D4";

export type OfflineExecutor = (
  unit: Readonly<WorkUnit>,
  savedInput: JsonValue
) => Promise<JsonValue>;

/** Sequential saved-data execution only. Live orchestration and spend-limit updates are not enabled. */
export async function runOfflineUnits(
  repositoryRoot: string,
  input: unknown,
  execute: OfflineExecutor = async (_unit, savedInput) => savedInput
) {
  const run = offlineRunFileSchema.parse(input);
  const store = new FileCheckpointStore(repositoryRoot, run.manifest.runId);
  return store.withLock(async () => {
    await verifyProposal(repositoryRoot, run.manifest.sourceProposal);
    const references = [
      run.manifest.rateSnapshot,
      run.manifest.runtimeSnapshot,
      ...run.manifest.referenceExamples.map((example) => example.artifact),
      ...run.units.map((unit) => unit.input),
    ];
    for (const reference of references) await store.readArtifact(reference);
    const newRun = await store.freeze(run);

    // A later ambiguous unit blocks the entire schedule before any new work starts.
    for (const unit of run.units) {
      const checkpoint = await store.read(unit.id);
      if (!checkpoint && !newRun)
        throw new RunnerStateError(
          "An existing run is missing a checkpoint. Review it before continuing."
        );
      if (checkpoint && canonicalJson(checkpoint.unit) !== canonicalJson(unit))
        throw new RunnerStateError(
          "Checkpoint inputs differ from the frozen schedule."
        );
      if (
        checkpoint?.status === "started" ||
        checkpoint?.status === "needs-review"
      )
        throw new RunnerStateError(
          `Work unit ${unit.id} requires review before this run can resume.`
        );
      if (checkpoint?.status === "completed")
        await store.readArtifact(checkpoint.result);
      if (!checkpoint)
        await store.write({
          unit,
          status: "pending",
          updatedAt: new Date().toISOString(),
        });
    }

    const completed: string[] = [];
    const reused: string[] = [];
    for (const unit of run.units) {
      const checkpoint = await store.read(unit.id);
      if (checkpoint?.status === "completed") {
        reused.push(unit.id);
        continue;
      }
      const savedInput = await store.readArtifact(unit.input);
      const startedAt = new Date().toISOString();
      await store.write({
        unit,
        status: "started",
        startedAt,
        updatedAt: startedAt,
      });
      let result;
      try {
        result = await store.saveResult(
          unit.id,
          jsonSchema.parse(await execute(unit, savedInput))
        );
        await store.write({
          unit,
          status: "completed",
          result,
          updatedAt: new Date().toISOString(),
        });
        completed.push(unit.id);
      } catch {
        // If this write fails, the durable 'started' state still blocks an automatic retry.
        await store.write({
          unit,
          status: "needs-review",
          receipt: result ?? null,
          updatedAt: new Date().toISOString(),
        });
        await store.saveReport({
          runId: run.manifest.runId,
          mode: "offline",
          status: "needs-review",
          blockedUnitId: unit.id,
          completed,
          reused,
        });
        throw new RunnerStateError(
          `Work unit ${unit.id} did not confirm completion. Review it before retrying.`
        );
      }
    }
    const checkpointReport = await store.saveReport({
      runId: run.manifest.runId,
      mode: "offline",
      status: "complete",
      step: run.manifest.step,
      planSha256: run.manifest.planSha256,
      completed,
      reused,
    });
    return {
      runId: run.manifest.runId,
      completed: completed.length,
      reused: reused.length,
      checkpointReport,
    };
  });
}
