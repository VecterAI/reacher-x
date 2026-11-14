import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ProposalReference = Readonly<{ path: string; sha256: string }>;

/** A changed proposal requires reviewing the executable plan before it is used. */
export async function verifyProposal(
  root: string,
  reference: ProposalReference
) {
  const bytes = await readFile(join(root, reference.path));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== reference.sha256) {
    throw new Error(
      "The proposal changed. Review the benchmark plan before continuing."
    );
  }
}
