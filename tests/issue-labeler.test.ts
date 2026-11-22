import test from "node:test";
import assert from "node:assert/strict";
import {
  canAuthorApplyCommentLabels,
  extractLabelsFromComment,
  extractLabelsFromIssueBody,
  selectLabelsToAdd,
} from "../.github/scripts/issue-labeler.mjs";

test("extractLabelsFromIssueBody parses checked allowlisted Areas only", () => {
  const body = `### Summary

Something broke.

### Areas

- [x] backend
- [ ] ui
- [X] prospecting - LinkedIn pipeline
- [x] P2
- [x] help wanted
- [x] unknown-tag

### Checks

- [x] documentation
`;

  assert.deepEqual(extractLabelsFromIssueBody(body), [
    "backend",
    "prospecting",
  ]);
});

test("extractLabelsFromIssueBody accepts all seven Areas offered by the issue forms", () => {
  const body = `### Areas

- [x] backend
- [x] ui
- [x] prospecting
- [x] benchmark
- [x] performance
- [x] architecture
- [x] documentation
`;

  assert.deepEqual(extractLabelsFromIssueBody(body), [
    "backend",
    "ui",
    "prospecting",
    "benchmark",
    "performance",
    "architecture",
    "documentation",
  ]);
});

test("extractLabelsFromComment caps labels per comment command", () => {
  const comment =
    "/label backend, ui, prospecting, benchmark, performance, architecture, documentation";

  assert.deepEqual(extractLabelsFromComment(comment), [
    "backend",
    "ui",
    "prospecting",
    "benchmark",
    "performance",
  ]);
});

test("extractLabelsFromComment parses /label commands and drops disallowed labels", () => {
  const comment = `Thanks for looking into this!
/label backend, prospecting, P2, help wanted
/LABEL \`performance\`, UI.
Not a command: /label documentation`;

  assert.deepEqual(extractLabelsFromComment(comment), [
    "backend",
    "prospecting",
    "performance",
    "ui",
  ]);
});

test("canAuthorApplyCommentLabels allows only issue author or collaborators", () => {
  assert.equal(
    canAuthorApplyCommentLabels({
      commentAuthorId: 42,
      issueAuthorId: 42,
      authorAssociation: "NONE",
    }),
    true
  );

  assert.equal(
    canAuthorApplyCommentLabels({
      commentAuthorId: 99,
      issueAuthorId: 42,
      authorAssociation: "COLLABORATOR",
    }),
    true
  );

  assert.equal(
    canAuthorApplyCommentLabels({
      commentAuthorId: 99,
      issueAuthorId: 42,
      authorAssociation: "CONTRIBUTOR",
    }),
    false
  );
});

test("selectLabelsToAdd skips existing labels, missing repo labels, and disallowed labels", () => {
  assert.deepEqual(
    selectLabelsToAdd({
      requestedLabels: ["backend", "ui", "P2", "benchmark", "nonexistent"],
      existingIssueLabels: ["bug", "Backend"],
      repoLabels: ["bug", "backend", "ui", "P2"],
    }),
    ["ui"]
  );
});
