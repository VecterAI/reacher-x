import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { verifyProposal } from "../../core/proposal";

test("changed proposal bytes invalidate the plan's source reference", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "reacherx-proposal-contract-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from("synthetic proposal fixture");
  const reference = {
    path: "proposal.pdf",
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  await writeFile(join(root, reference.path), bytes);
  await verifyProposal(root, reference);
  await writeFile(join(root, reference.path), "changed fixture");
  await assert.rejects(verifyProposal(root, reference), /proposal changed/);
});
