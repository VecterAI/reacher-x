import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "node:util";

type Environment = Readonly<Record<string, string | undefined>>;

const variables = [
  {
    name: "CONVEX_DEPLOYMENT",
    purpose: "Development deployment",
    required: true,
  },
  {
    name: "BENCHMARK_USER_ID",
    purpose: "Benchmark workspace owner",
    required: true,
  },
  {
    name: "OPENROUTER_API_KEY",
    purpose: "Deployment spend tracking",
    required: true,
  },
  {
    name: "BENCHMARK_JUDGE_OPENROUTER_API_KEY",
    purpose: "Independent judges",
    required: true,
  },
  {
    name: "SOCIALAPI_API_KEY",
    purpose: "ReacherX X discovery",
    required: true,
  },
  {
    name: "LINKDAPI_API_KEY",
    purpose: "ReacherX LinkedIn discovery (Renidly)",
    required: true,
  },
  {
    name: "EXA_API_KEY",
    purpose: "Exa search and qualification evidence",
    required: true,
  },
  {
    name: "TREG_TOKEN",
    purpose: "Apollo, Lusha and Crustdata through Treg",
    required: true,
  },
  {
    name: "TREG_TOKEN_REACHERX",
    purpose: "Treg routed search account",
    required: true,
  },
  { name: "CLAY_API_KEY", purpose: "Clay search", required: true },
  {
    name: "CONTEXT_DEV_API_KEY",
    purpose: "Context.dev search and scraping",
    required: true,
  },
  { name: "FIRECRAWL_API_KEY", purpose: "Firecrawl search", required: true },
  {
    name: "TAVILY_API_KEY",
    purpose: "Independent judging evidence",
    required: true,
  },
  {
    name: "OPENAI_API_KEY",
    purpose: "Optional direct OpenAI embeddings",
    required: false,
  },
] as const;

// These can take precedence over a dev selection in the Convex CLI.
const conflictingVariables = [
  "CONVEX_DEPLOY_KEY",
  "CONVEX_DEPLOYMENT_TOKEN",
  "CONVEX_SELF_HOSTED_URL",
  "CONVEX_SELF_HOSTED_ADMIN_KEY",
] as const;

function hasValue(value: string | undefined): value is string {
  if (!value?.trim()) return false;
  return !/^(?:<.*>|your[_ -].*|replace[_ -].*|change[_ -]?me|placeholder|todo|\.{3})$/i.test(
    value.trim()
  );
}

/** Read credentials locally without modifying process.env or contacting services. */
export async function readBenchmarkEnvironment(
  root: string,
  inherited: Environment = process.env
): Promise<Environment> {
  const path = join(root, ".env.benchmark.local");
  let local: Environment = {};
  try {
    const metadata = await stat(path);
    if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
      throw new Error(
        "Run chmod 600 .env.benchmark.local before reading keys."
      );
    }
    local = parseEnv(await readFile(path, "utf8"));
  } catch (error) {
    if (
      !(error instanceof Error && "code" in error && error.code === "ENOENT")
    ) {
      // Do not forward parser errors, which could contain secret input.
      throw new Error(
        "Cannot read .env.benchmark.local. Check its format and file permissions."
      );
    }
  }
  return { ...local, ...inherited };
}

/** Presence is not a balance, authentication or deployment-readiness check. */
export function inspectBenchmarkEnvironment(environment: Environment) {
  const entries = variables.map(({ name, purpose, required }) => ({
    name,
    purpose,
    required,
    present: hasValue(environment[name]),
  }));
  const issues: string[] = entries
    .filter((entry) => entry.required && !entry.present)
    .map((entry) => `Missing ${entry.name}.`);

  if (
    hasValue(environment.CONVEX_DEPLOYMENT) &&
    !/^dev:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(environment.CONVEX_DEPLOYMENT)
  ) {
    issues.push("CONVEX_DEPLOYMENT must select a dev deployment (dev:<name>).");
  }
  for (const name of conflictingVariables) {
    if (environment[name]?.trim()) {
      issues.push(
        `Unset ${name} to avoid overriding the development deployment.`
      );
    }
  }
  if (
    hasValue(environment.OPENROUTER_API_KEY) &&
    hasValue(environment.BENCHMARK_JUDGE_OPENROUTER_API_KEY) &&
    environment.OPENROUTER_API_KEY.trim() ===
      environment.BENCHMARK_JUDGE_OPENROUTER_API_KEY.trim()
  ) {
    issues.push(
      "Use distinct OpenRouter keys for the deployment and the judges."
    );
  }
  return { entries, issues };
}

export function formatEnvironmentReport(
  report: ReturnType<typeof inspectBenchmarkEnvironment>
) {
  return [
    "Local benchmark environment (offline check)",
    ...report.entries.map(
      (entry) =>
        `${entry.present ? "SET" : entry.required ? "MISSING" : "OPTIONAL"} ${entry.name} | ${entry.purpose}`
    ),
    "",
    ...report.issues,
    "",
    "Values are never printed. Key validity, credit balances, Convex login and remote configuration have not been checked.",
  ].join("\n");
}
