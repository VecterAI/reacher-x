import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVendorPreview,
  renderVendorPreview,
  writeVendorPreview,
} from "../../core/analysis/preview";
import type { AggregateReport } from "../../core/analysis/report";
import { wilson } from "../../core/analysis/stats";
import { summarizeUsage } from "../../core/execution/spend";
import type { CaseRecord } from "../../core/judging/judgeCandidate";

// Synthetic results only; not benchmark findings.
const row = (toolId: string) => ({
  taskId: "p13",
  category: "company-signal",
  entityType: "organization" as const,
  toolId,
  returned: 1,
  verifiedMatches: 1,
  precision: wilson(1, 1),
  speed: {
    requestLatencyMs: 1,
    firstVerifiedMatchMs: 1,
    fifthVerifiedMatchMs: null,
    activeProcessingMs: 1,
    scheduledWaitMs: 0,
  },
  usage: summarizeUsage([]),
});

const report: AggregateReport = {
  runId: "synthetic-run",
  planSha256: "0".repeat(64),
  rows: [row("exa"), row("lusha")],
};

const record = (toolId: string, name: string, rank: number) =>
  ({
    caseId: "3d8c5d3e-0b7c-4a8e-9f61-1d2c3b4a5e6f",
    taskId: "p13",
    toolId,
    sourceId: `${toolId}-${rank}`,
    rank,
    identity: null,
    webEvidence: null,
    input: {
      caseId: "3d8c5d3e-0b7c-4a8e-9f61-1d2c3b4a5e6f",
      prompt: "Synthetic company prompt",
      referenceDate: "2026-11-14T00:00:00Z",
      definitionNotes: [],
      criteria: [
        { id: "region", requirement: "Based in Europe", required: true },
        { id: "stage", requirement: "Series A", required: false },
      ],
      entity: {
        prospectType: "organization",
        name,
        profileUrl: "https://northwind.example",
        location: "Berlin, Germany",
        description: null,
        domain: "northwind.example",
        industry: "Fintech",
        employeeCount: 80,
        evidence: [
          {
            id: "e1",
            url: "https://northwind.example/news",
            text: "Synthetic funding news",
            publishedAt: "2026-06-01T00:00:00Z",
            retrievedAt: "2026-11-14T00:00:00Z",
          },
        ],
      },
    },
    panel: {
      verdicts: { region: "met", stage: "partly_met" },
      verifiedMatch: true,
    },
    newestCitedEvidenceAgeDays: 166,
  }) as unknown as CaseRecord;

test("a vendor's preview holds only its own rows, requests and returned results for 3 days", async () => {
  const preview = buildVendorPreview({
    runId: "synthetic-run",
    toolId: "exa",
    createdAt: new Date("2026-11-20T00:00:00Z"),
    report,
    cases: [
      record("lusha", "Other Vendor Co", 1),
      record("exa", "Northwind Example", 1),
    ],
    receipts: [
      {
        toolId: "exa",
        taskId: "p13",
        endpoints: ["https://api.exa.ai/search"],
      },
      { toolId: "lusha", taskId: "p13", endpoints: ["lusha.companies.search"] },
    ],
  });
  assert.equal(preview.previewEndsAt, "2026-11-23T00:00:00.000Z");
  assert.deepEqual(
    preview.rows.map((item) => item.toolId),
    ["exa"]
  );
  assert.deepEqual(
    preview.requests.map((item) => item.toolId),
    ["exa"]
  );
  assert.equal(preview.results.length, 1);
  const [result] = preview.results;
  assert.equal(result.entity.name, "Northwind Example");
  assert.equal(result.entity.evidenceItems, 1);
  assert.equal("evidence" in result.entity, false);
  assert.deepEqual(result.verdicts[1], {
    requirement: "Series A",
    required: false,
    verdict: "partly_met",
  });
  const markdown = renderVendorPreview(preview);
  assert.match(markdown, /Northwind Example/);
  assert.doesNotMatch(markdown, /Other Vendor Co|lusha/);

  const written: Record<string, string> = {};
  const paths = await writeVendorPreview(
    { writePrivate: async (path, data) => void (written[path] = data) },
    "benchmarks/.local/people-search/vendor-preview",
    preview
  );
  assert.deepEqual(
    Object.keys(written).sort(),
    [paths.json, paths.markdown].sort()
  );
  assert.equal(
    paths.json,
    "benchmarks/.local/people-search/vendor-preview/synthetic-run/exa.json"
  );
  await assert.rejects(
    writeVendorPreview(
      { writePrivate: async () => {} },
      "benchmarks/people-search/results",
      preview
    ),
    /private files/
  );
  assert.throws(
    () =>
      buildVendorPreview({
        runId: "synthetic-run",
        toolId: "clay",
        createdAt: new Date(),
        report,
        cases: [],
      }),
    /No results for clay/
  );
});
