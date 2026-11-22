import assert from "node:assert/strict";
import test from "node:test";
import { toolCatalog } from "../../people-search/tools/catalog";
import { searchAdapters } from "../../people-search/tools/registry";

test("every catalog tool except ReacherX has one adapter with the same ID and declared capabilities", () => {
  for (const tool of toolCatalog) {
    if (tool.id === "reacherx") {
      assert.equal(tool.implementation, "convex-driver");
      continue;
    }
    const adapter = searchAdapters[tool.id];
    assert.equal(adapter.id, tool.id);
    assert.equal(tool.implementation, "adapter");
    for (const capability of Object.values(adapter.capabilities))
      assert.notEqual(capability.status, "unverified", tool.id);
  }
});
