import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertAggregateOnly,
  PersonalDataError,
  personalDataFindings,
  writePublicResults,
  type PublicVocabulary,
} from "../../core/analysis/publish";
import type { AggregateReport } from "../../core/analysis/report";
import { wilson } from "../../core/analysis/stats";
import { summarizeUsage } from "../../core/execution/spend";

// Synthetic aggregates only; not benchmark findings.
const report: AggregateReport = {
  runId: "run-main",
  planSha256: "0".repeat(64),
  rows: [
    {
      taskId: "p14",
      category: "company-static",
      entityType: "organization",
      toolId: "context",
      returned: 10,
      verifiedMatches: 6,
      precision: wilson(6, 10),
      speed: {
        requestLatencyMs: 1200,
        firstVerifiedMatchMs: 1200,
        fifthVerifiedMatchMs: null,
        activeProcessingMs: 1200,
        scheduledWaitMs: 0,
      },
      usage: summarizeUsage([
        {
          provider: "context.dev",
          quantity: 43,
          unit: "credit",
          valuation: { status: "unpriced", reason: "grant credits" },
          funding: { grantUnitsUsed: 43, cashUsd: null },
        },
      ]),
    },
  ],
};

const PUBLIC = "benchmarks/people-search/results";

// A synthetic approved vocabulary; the people-search one comes from the plan.
const vocabulary: PublicVocabulary = {
  runId: /^run-(?:smoke|main)$/,
  taskIds: ["p14", "p15"],
  categories: ["company-static", "Companies, static filters"],
  toolIds: ["context", "exa"],
  providers: ["context.dev", "exa"],
  units: ["credit", "request"],
};

test("aggregate results are written as Markdown and JSON to the public folder", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "reacherx-public-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const paths = await writePublicResults(root, PUBLIC, report, vocabulary);
  assert.deepEqual(paths, {
    markdown: `${PUBLIC}/run-main.md`,
    json: `${PUBLIC}/run-main.json`,
  });
  assert.deepEqual(
    JSON.parse(await readFile(join(root, paths.json), "utf8")),
    report
  );
  assert.match(
    await readFile(join(root, paths.markdown), "utf8"),
    /^ {2}context {2}█{12}░{8} {2}60\.0% {2}6\/10 /m
  );
});

test("a personal field, a profile link or an extra field anywhere refuses the write", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "reacherx-public-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const row = report.rows[0];
  const leaks: unknown[] = [
    // A returned entity slipped into a row.
    { ...report, rows: [{ ...row, name: "Synthetic Person" }] },
    // A profile URL hidden in a label.
    {
      ...report,
      rows: [{ ...row, category: "https://www.linkedin.com/in/synthetic" }],
    },
    // An email address in usage units.
    {
      ...report,
      rows: [
        {
          ...row,
          usage: {
            ...row.usage,
            unpricedUsage: [
              { provider: "someone@example.com", quantity: 1, unit: "x" },
            ],
          },
        },
      ],
    },
    // Raw evidence nested anywhere.
    { ...report, evidence: [{ text: "Synthetic post" }] },
  ];
  for (const leak of leaks) {
    await assert.rejects(
      writePublicResults(root, PUBLIC, leak, vocabulary),
      PersonalDataError
    );
  }
  // Nothing was written by any refused call.
  await assert.rejects(readdir(join(root, PUBLIC)));
  await assert.rejects(
    writePublicResults(
      root,
      "benchmarks/.local/people-search",
      report,
      vocabulary
    ),
    /public folder only/
  );
});

test("findings name every path that holds personal data", () => {
  assert.deepEqual(
    personalDataFindings({
      rows: [{ entity: { displayName: "x" } }, { note: "see www.example.com" }],
    }),
    [
      "$.rows[0].entity: personal field",
      "$.rows[0].entity.displayName: personal field",
      "$.rows[1].note: identifying text",
    ]
  );
  assert.deepEqual(assertAggregateOnly(report, vocabulary), report);
});

test("public labels and metadata must be approved values, so free text is refused", () => {
  const row = report.rows[0];
  const refused: [string, unknown][] = [
    // A person's name as a category, a tool or a prompt.
    ["category", { ...report, rows: [{ ...row, category: "Jane Example" }] }],
    ["toolId", { ...report, rows: [{ ...row, toolId: "jane-example" }] }],
    ["taskId", { ...report, rows: [{ ...row, taskId: "jane" }] }],
    ["runId", { ...report, runId: "jane-example" }],
    [
      "provider",
      {
        ...report,
        rows: [
          {
            ...row,
            usage: {
              ...row.usage,
              unpricedUsage: [
                { provider: "Jane Example", quantity: 1, unit: "credit" },
              ],
            },
          },
        ],
      },
    ],
    [
      "unit",
      {
        ...report,
        rows: [
          {
            ...row,
            usage: {
              ...row.usage,
              unpricedUsage: [
                { provider: "exa", quantity: 1, unit: "Jane Example" },
              ],
            },
          },
        ],
      },
    ],
  ];
  for (const [field, value] of refused)
    assert.throws(
      () => assertAggregateOnly(value, vocabulary),
      new RegExp(`${field} is not an approved`),
      field
    );
  // A category label from the plan is accepted as well as its key.
  assertAggregateOnly(
    {
      ...report,
      rows: [{ ...row, category: "Companies, static filters" }],
    },
    vocabulary
  );
});
