/**
 * Fails the build when any route's traced server files exceed a size budget.
 *
 * Runs after `next build` (see the `build` script). Each route's
 * `.nft.json` lists the files Vercel packs into its function, and Vercel
 * rejects functions over 250 MB uncompressed. Healthy routes trace about
 * 20 MB, so the budget leaves plenty of room for growth while catching
 * tracing blowups (like a dynamic path pulling in all of `node_modules`)
 * with a readable report before deploy.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const BUDGET_MB = 150;
const SERVER_DIR = path.join(".next", "server");
const INSTRUMENTATION_TRACE = path.join(
  SERVER_DIR,
  "instrumentation.js.nft.json"
);

const fileSizes = new Map<string, number>();

function sizeOf(file: string): number {
  const cached = fileSizes.get(file);
  if (cached !== undefined) return cached;
  let size = 0;
  try {
    const stats = statSync(file);
    if (stats.isFile()) size = stats.size;
  } catch {
    // Traces can list optional files that do not exist on this machine.
  }
  fileSizes.set(file, size);
  return size;
}

// Groups `node_modules/.pnpm/<id>/node_modules/<name>/...` by package name.
function packageOf(file: string): string {
  const match = file.match(
    /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/
  );
  return match?.[1] ?? "(app)";
}

function readTraceFiles(tracePath: string): string[] {
  const entryPath = path.resolve(tracePath.replace(/\.nft\.json$/, ""));
  const { files } = JSON.parse(readFileSync(tracePath, "utf8")) as {
    files: string[];
  };
  return [
    entryPath,
    ...files.map((entry) => path.resolve(path.dirname(tracePath), entry)),
  ];
}

// Vercel packs `instrumentation.js` and its traced files into every server function.
const sharedInstrumentationFiles = existsSync(INSTRUMENTATION_TRACE)
  ? readTraceFiles(INSTRUMENTATION_TRACE)
  : [];

const traces = readdirSync(SERVER_DIR, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".nft.json"))
  .map((file) => {
    const tracePath = path.join(SERVER_DIR, file);
    const resolved = [
      ...new Set([...sharedInstrumentationFiles, ...readTraceFiles(tracePath)]),
    ];
    const bytes = resolved.reduce((total, entry) => total + sizeOf(entry), 0);
    return {
      route: file.replace(/\.nft\.json$/, ""),
      files: resolved,
      megabytes: bytes / 1e6,
    };
  })
  .sort((a, b) => b.megabytes - a.megabytes);

const overBudget = traces.filter((trace) => trace.megabytes > BUDGET_MB);
const largest = traces[0];

if (overBudget.length === 0) {
  console.info(
    `[FunctionSize] ${traces.length} traces within ${BUDGET_MB} MB (largest: ${largest?.route ?? "none"}, ${largest?.megabytes.toFixed(1) ?? 0} MB)`
  );
} else {
  console.error(
    `[FunctionSize] ${overBudget.length} route(s) exceed the ${BUDGET_MB} MB budget:`
  );
  for (const trace of overBudget.slice(0, 10)) {
    console.error(`  ${trace.megabytes.toFixed(1)} MB  ${trace.route}`);
  }

  const byPackage = new Map<string, number>();
  for (const file of largest.files) {
    const name = packageOf(file);
    byPackage.set(name, (byPackage.get(name) ?? 0) + sizeOf(file));
  }
  console.error(`\nLargest packages in ${largest.route}:`);
  for (const [name, bytes] of [...byPackage]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)) {
    console.error(`  ${(bytes / 1e6).toFixed(1).padStart(6)} MB  ${name}`);
  }
  console.error(
    "\nDev tools (typescript, eslint, vitest) in this list mean the bundler traced all of node_modules." +
      "\nLook for a 'file pattern matches N files' warning in the build output to find the import."
  );
  process.exitCode = 1;
}
