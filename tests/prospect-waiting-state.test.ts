import assert from "node:assert/strict";
import test from "node:test";
import {
  getProspectWaitingStateCopy,
  shouldShowProspectWaitingState,
} from "../features/prospects/lib/prospectEmptyStateCopy";

test("waiting-state copy follows the active use-case terminology", () => {
  assert.deepEqual(getProspectWaitingStateCopy({ entityPlural: "Investors" }), {
    message:
      "Agent is preparing your investors. They will appear here in 5 to 30 minutes.",
  });
});

test("waiting state is reserved for healthy discovery, not recovery", () => {
  assert.equal(
    shouldShowProspectWaitingState({
      actionableReadyCount: 0,
      systemMode: "running",
    }),
    true
  );
  assert.equal(
    shouldShowProspectWaitingState({
      actionableReadyCount: 0,
      systemMode: "degraded",
    }),
    false
  );
  assert.equal(
    shouldShowProspectWaitingState({
      actionableReadyCount: 1,
      systemMode: "running",
    }),
    false
  );
});
