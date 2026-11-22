import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import type { Exchange, Transport } from "../../../core/calls/http";
import { FileCheckpointStore } from "../../../core/execution/checkpoints";
import type { CommandRunner } from "../../../core/execution/convex";
import { ReplayDeployment } from "../../../people-search/quick-check/deployment";

/**
 * An in-memory development deployment for the quick check: env settings,
 * the benchmarkReplay functions, file storage and the upload URL. Every value
 * is synthetic and nothing reaches a deployment.
 */

export type FakeProspect = Readonly<{
  workspaceId: string;
  prospectType: "individual" | "organization";
  decision: Readonly<{ qualified: boolean; score: number | null }>;
  linkedPages: readonly Readonly<{
    url: string;
    sourcePostIds: readonly string[];
  }>[];
}>;

const RESTING = {
  PAUSE_AUTONOMOUS_JOBS: "true",
  PROSPECTING_AUTO_RESCHEDULE: "false",
};

export function fakeReplay(
  prospects: Readonly<Record<string, FakeProspect>>,
  options: {
    env?: Record<string, string>;
    // The decision a replayed case receives; throws to simulate a failed case.
    decide?: (caseId: string, learning: string) => boolean;
    // The model recorded for a call; defaults to the configured one.
    recordedModel?: (configured: string) => string;
    activeWorkspaces?: string[];
    // A setting whose read right after its first write returns a wrong value.
    garbleReadAfterSet?: string;
  } = {}
) {
  const env = new Map(Object.entries({ ...RESTING, ...options.env }));
  const storage = new Map<string, string>();
  const usage = new Map<string, { model: string; cost: number }[]>();
  const calls: string[] = [];
  const configuredModel = () =>
    env.get("AI_ONBOARDING_MODEL") ?? "openai/gpt-6-luna-pro";

  const functions: Record<string, (args: Record<string, unknown>) => unknown> =
    {
      "benchmarkPeopleSearch:deploymentActivity": () => ({
        workspaceIds: options.activeWorkspaces ?? [],
        truncated: false,
      }),
      "benchmarkReplay:captureQualificationInputs": (args) => {
        const learning = args.learning as string;
        const workspaceId = args.workspaceId as string;
        const off = env.get("BENCHMARK_LEARNING_OFF_WORKSPACE_IDS");
        if ((off === workspaceId) !== (learning === "off"))
          throw new Error("learning switch mismatch");
        return (args.prospectIds as string[]).map((prospectId) => {
          const prospect = prospects[prospectId];
          if (prospect?.workspaceId !== workspaceId)
            throw new Error("not in workspace");
          return learning === "off"
            ? {
                prospectId,
                learning,
                operatorOnlyMemoryPolicy: "Operator: Europe only.",
              }
            : {
                prospectId,
                learning,
                prospectType: prospect.prospectType,
                decision: prospect.decision,
                linkedPages: prospect.linkedPages,
                input: {
                  platform: "twitter",
                  evidencePosts: [{ id: "post-1", text: "Synthetic post" }],
                  discoveryQueries: [],
                  totalKeywords: 1,
                  profileData: { screen_name: `synthetic-${prospectId}` },
                  targetingSpec: {},
                  workspaceMemoryPolicy: "Operator and learned lessons.",
                  relevantMemories: ["a lesson"],
                  now: 1_700_000_000_000,
                },
              };
        });
      },
      "benchmarkReplay:createDatasetUploadUrl": () =>
        "https://upload.example.test/upload?token=synthetic",
      "benchmarkReplay:replayDatasetInfo": (args) => {
        const data = storage.get(args.datasetId as string);
        return data === undefined
          ? null
          : {
              size: Buffer.byteLength(data),
              sha256: createHash("sha256").update(data).digest("base64"),
            };
      },
      "benchmarkReplay:replayQualification": (args) => {
        const dataset = JSON.parse(storage.get(args.datasetId as string)!);
        if (dataset.kind !== "reacherx-benchmark-qualification-replay")
          throw new Error("not a dataset");
        const known = new Set(
          dataset.cases.map((item: { caseId: string }) => item.caseId)
        );
        const events: { model: string; cost: number }[] = [];
        const results = (args.caseIds as string[]).map((caseId) => {
          if (!known.has(caseId)) throw new Error("unknown case");
          try {
            const qualified =
              options.decide?.(caseId, args.learning as string) ?? true;
            const model = (options.recordedModel ?? ((value) => value))(
              configuredModel()
            );
            events.push({ model, cost: 0.004 });
            return {
              caseId,
              status: "ok",
              qualified,
              score: qualified ? 80 : 30,
              reasoning: "Synthetic reasoning.",
              latencyMs: 10,
            };
          } catch {
            return { caseId, status: "error", error: "failed", latencyMs: 5 };
          }
        });
        usage.set(args.replayId as string, events);
        return results;
      },
      "benchmarkReplay:replayUsageSince": (args) => {
        const events = usage.get(args.replayId as string) ?? [];
        const models: Record<string, number> = {};
        for (const event of events)
          models[event.model] = (models[event.model] ?? 0) + 1;
        return {
          calls: events.length,
          models,
          recordedUsd: events.reduce((sum, event) => sum + event.cost, 0),
          capped: false,
        };
      },
    };

  let garbleNextRead = false;
  let garbled = false;
  const run: CommandRunner = async (args, stdin) => {
    const [command, action, name] = args;
    if (command === "env" && action === "get" && name) {
      if (garbleNextRead && name === options.garbleReadAfterSet) {
        garbleNextRead = false;
        return { exitCode: 0, stdout: "garbled\n", stderr: "" };
      }
      return {
        exitCode: 0,
        stdout: env.has(name) ? `${env.get(name)}\n` : "",
        stderr: "",
      };
    }
    if (command === "env" && action === "set" && name) {
      env.set(name, (stdin ?? "").replace(/\n$/, ""));
      // Only the first write's read-back is wrong.
      if (name === options.garbleReadAfterSet && !garbled)
        garbleNextRead = garbled = true;
      calls.push(`env set ${name}`);
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    if (command === "env" && action === "remove" && name) {
      env.delete(name);
      calls.push(`env remove ${name}`);
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    const handler = command === "run" && action ? functions[action] : null;
    if (!handler) return { exitCode: 1, stdout: "", stderr: "unknown" };
    calls.push(action!);
    try {
      const output = await handler(JSON.parse(name ?? "{}"));
      // The CLI prints nothing when the function returns null.
      const stdout = output === null ? "" : JSON.stringify(output);
      return { exitCode: 0, stdout, stderr: "" };
    } catch {
      return { exitCode: 1, stdout: "", stderr: "failed" };
    }
  };

  let uploads = 0;
  const fetcher = (async (_url: unknown, init?: RequestInit) => {
    uploads += 1;
    const storageId = `storage-${uploads}`;
    storage.set(storageId, String(init?.body));
    return new Response(JSON.stringify({ storageId }), { status: 200 });
  }) as typeof fetch;

  return {
    env,
    storage,
    calls,
    deployment: new ReplayDeployment("dev:test", run, fetcher),
  };
}

/** A private store in a temporary checkout. */
export async function temporaryStore(t: TestContext, runId = "quick-check") {
  const root = await mkdtemp(join(tmpdir(), "reacherx-quick-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return new FileCheckpointStore(root, runId);
}

/** Answers Exa contents requests from a page table; records each request. */
export function fakeExa(
  pages: Readonly<Record<string, { text: string; author?: string }>>,
  costPerPage = 0.001
) {
  const requests: Parameters<Transport>[0][] = [];
  const transport: Transport = async (request) => {
    requests.push(request);
    const urls = (request.body as { urls: string[] }).urls;
    const exchange: Exchange = {
      step: request.step,
      request: {
        method: request.method,
        url: request.url,
        body: request.body,
      },
      response: {
        status: 200,
        body: {
          results: urls.flatMap((url) =>
            pages[url] ? [{ url, ...pages[url] }] : []
          ),
          costDollars: { total: urls.length * costPerPage },
        },
        headers: {},
      },
      latencyMs: 20,
    };
    return exchange;
  };
  return { transport, requests };
}
