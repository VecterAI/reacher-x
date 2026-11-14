import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  canonicalJson,
  checkpointSchema,
  hashBytes,
  identifierSchema,
  jsonSchema,
  type Checkpoint,
  type JsonValue,
  type OfflineRunFile,
} from "./manifest";
import type { ArtifactReference } from "./types";

export class RunnerStateError extends Error {}

function isMissing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** All checkpoint writes and raw results stay below the repository's ignored private root. */
export class FileCheckpointStore {
  readonly repositoryRoot: string;
  readonly runId: string;
  private locked = false;

  constructor(repositoryRoot: string, runId: string) {
    this.repositoryRoot = resolve(repositoryRoot);
    this.runId = identifierSchema.parse(runId);
  }

  private runPath(file: string) {
    return `benchmarks/.local/runs/${this.runId}/${file}`;
  }

  private async path(path: string) {
    const parts = path.split("/");
    if (
      !path.startsWith("benchmarks/.local/") ||
      parts.some(
        (part) =>
          !/^[a-zA-Z0-9_.-]+$/.test(part) || part === "." || part === ".."
      )
    )
      throw new RunnerStateError("Invalid private artifact path.");
    let cursor = this.repositoryRoot;
    for (const part of parts) {
      cursor = join(cursor, part);
      try {
        if ((await lstat(cursor)).isSymbolicLink())
          throw new RunnerStateError(
            "Private artifact paths must not contain symlinks."
          );
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
    return cursor;
  }

  private async directory(path: string) {
    await this.path(`${path}/check`);
    await mkdir(join(this.repositoryRoot, path), {
      recursive: true,
      mode: 0o700,
    });
    const parts = path.split("/");
    for (let count = 2; count <= parts.length; count++)
      await chmod(join(this.repositoryRoot, ...parts.slice(0, count)), 0o700);
  }

  private assertLocked() {
    if (!this.locked)
      throw new RunnerStateError("Checkpoint writes require the runner lock.");
  }

  private async atomicWrite(path: string, data: string) {
    this.assertLocked();
    await this.directory(dirname(path));
    const target = await this.path(path);
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(data);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, target);
      if (process.platform !== "win32") {
        const directory = await open(dirname(target), "r");
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      }
    } finally {
      await unlink(temporary).catch((error: unknown) => {
        if (!isMissing(error)) throw error;
      });
    }
  }

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await this.directory("benchmarks/.local");
    const lockPath = await this.path("benchmarks/.local/runner.lock");
    let handle;
    try {
      handle = await open(lockPath, "wx", 0o600);
    } catch {
      throw new RunnerStateError(
        "Runner lock is held or cannot be acquired. Review existing work before removing a stale lock."
      );
    }
    try {
      await handle.writeFile(
        JSON.stringify({
          pid: process.pid,
          runId: this.runId,
          startedAt: new Date().toISOString(),
        })
      );
      await handle.sync();
      this.locked = true;
      return await operation();
    } finally {
      this.locked = false;
      await handle.close();
      await unlink(lockPath);
    }
  }

  async readArtifact(reference: ArtifactReference): Promise<JsonValue> {
    const bytes = await readFile(await this.path(reference.path));
    if (hashBytes(bytes) !== reference.sha256)
      throw new RunnerStateError(
        "A private artifact no longer matches its frozen hash."
      );
    return jsonSchema.parse(JSON.parse(bytes.toString("utf8")));
  }

  async freeze(run: OfflineRunFile) {
    this.assertLocked();
    const path = this.runPath("frozen-run.json");
    const expected = canonicalJson(run);
    await this.directory("benchmarks/.local/runs");
    let created = false;
    try {
      await mkdir(dirname(await this.path(path)), { mode: 0o700 });
      created = true;
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "EEXIST")
      )
        throw error;
    }
    if (created) {
      await this.atomicWrite(path, expected);
      return true;
    }
    try {
      const existing = await readFile(await this.path(path), "utf8");
      if (existing !== expected)
        throw new RunnerStateError(
          "This run ID already has a different frozen plan or work order. Use a new run ID."
        );
    } catch (error) {
      if (!isMissing(error)) throw error;
      throw new RunnerStateError(
        "This run directory is missing its frozen record. Review it before continuing."
      );
    }
    return false;
  }

  async read(unitId: string): Promise<Checkpoint | null> {
    identifierSchema.parse(unitId);
    try {
      const value = checkpointSchema.parse(
        JSON.parse(
          await readFile(
            await this.path(this.runPath(`checkpoints/${unitId}.json`)),
            "utf8"
          )
        )
      );
      if (value.unit.runId !== this.runId || value.unit.id !== unitId)
        throw new RunnerStateError(
          "Checkpoint identity does not match this run."
        );
      return value;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async write(checkpoint: Checkpoint) {
    this.assertLocked();
    const next = checkpointSchema.parse(checkpoint);
    if (next.unit.runId !== this.runId)
      throw new RunnerStateError("Checkpoint belongs to a different run.");
    const previous = await this.read(next.unit.id);
    const valid =
      previous === null
        ? next.status === "pending"
        : previous.status === "pending"
          ? next.status === "started"
          : previous.status === "started" &&
            (next.status === "completed" || next.status === "needs-review");
    if (
      !valid ||
      (previous && canonicalJson(previous.unit) !== canonicalJson(next.unit))
    )
      throw new RunnerStateError(
        "Invalid checkpoint transition or changed work unit."
      );
    await this.atomicWrite(
      this.runPath(`checkpoints/${next.unit.id}.json`),
      canonicalJson(next)
    );
  }

  async saveResult(
    unitId: string,
    result: JsonValue
  ): Promise<ArtifactReference> {
    identifierSchema.parse(unitId);
    const data = canonicalJson(jsonSchema.parse(result));
    const sha256 = hashBytes(data);
    const path = this.runPath(`results/${unitId}-${sha256}.json`);
    await this.atomicWrite(path, data);
    return { path, sha256 };
  }

  async saveReport(report: JsonValue): Promise<ArtifactReference> {
    const data = canonicalJson(report);
    const path = this.runPath("checkpoint-report.json");
    await this.atomicWrite(path, data);
    return { path, sha256: hashBytes(data) };
  }
}
