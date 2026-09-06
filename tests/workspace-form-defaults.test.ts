import assert from "node:assert/strict";
import test from "node:test";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { workspaceDocToFormValues } from "../features/webapp/workspace/workspaceFormDefaults";
const workspace: Doc<"workspaces"> = {
  _id: "workspace-test" as Id<"workspaces">,
  _creationTime: 1,
  userId: "user-test" as Id<"users">,
  name: "Recruiting",
  description: "Find product designers",
  updatedAt: 1,
  isDefault: true,
  icps: [
    {
      title: "Product designers",
      description: "Designers at B2B startups",
      painPoints: ["Complex workflows"],
      channels: ["X", "LinkedIn"],
    },
  ],
};
test("editing a one-persona workspace does not invent empty additional profiles", () => {
  const values = workspaceDocToFormValues(workspace);
  assert.equal(values.icps.length, 1);
  assert.equal(values.icps[0].title, "Product designers");
});
test("an empty legacy workspace gets one editable profile", () => {
  assert.equal(
    workspaceDocToFormValues({ ...workspace, icps: [] }).icps.length,
    1
  );
});
