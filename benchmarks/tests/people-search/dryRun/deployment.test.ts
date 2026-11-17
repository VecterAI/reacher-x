import assert from "node:assert/strict";
import test from "node:test";
import { syntheticClock } from "../../../people-search/dryRun/dryRun";
import { syntheticDeployment } from "../../../people-search/dryRun/deployment";
import { SyntheticAccounts } from "../../../people-search/dryRun/providers";
import { peopleSearchPlan } from "../../../people-search/setup/plan";

// The simulated deployment only; nothing leaves the process.
test("stopping a workspace cancels its running cycle, so nothing is found or charged later", async () => {
  const accounts = new SyntheticAccounts();
  const clock = syntheticClock(1_000_000);
  const { driver } = syntheticDeployment(accounts, clock, "synthetic-key");
  const workspace = await driver.prepare({
    userId: "synthetic-user",
    label: "synthetic_p01_on",
    prompt: peopleSearchPlan.prompts[0].text,
    useCaseKey: "general_outreach",
  });
  await driver.start(workspace);
  // Into the first cycle's discovery, then stop it.
  await clock.sleep(3 * 60_000);
  assert.equal((await driver.status(workspace))?.workflowState, "inProgress");
  const spent = { ...accounts };
  await driver.stop(workspace);
  // Hours later the canceled cycle still has found nothing and charged nothing.
  await clock.sleep(5 * 60 * 60_000);
  const status = await driver.status(workspace);
  assert.equal(status?.workflowState, "canceled");
  assert.equal(status?.workspaceStatus, "paused");
  assert.equal(status?.nextRunAt, null);
  assert.deepEqual(await driver.exportCandidates(workspace), []);
  assert.deepEqual({ ...accounts }, spent);
  const costs = await driver.runCosts(workspace, workspace.createdAt);
  assert.equal(costs.providers.socialapi.billableUnits, 0);
  assert.equal(
    (await driver.linkdApiUnitsSince(workspace.createdAt)).billableUnits,
    0
  );
});

test("a cycle that finished before the stop keeps what it found and charged", async () => {
  const accounts = new SyntheticAccounts();
  const clock = syntheticClock(1_000_000);
  const { driver } = syntheticDeployment(accounts, clock, "synthetic-key");
  const workspace = await driver.prepare({
    userId: "synthetic-user",
    label: "synthetic_p01_on",
    prompt: peopleSearchPlan.prompts[0].text,
    useCaseKey: "general_outreach",
  });
  await driver.start(workspace);
  await clock.sleep(20 * 60_000);
  await driver.stop(workspace);
  const found = (await driver.exportCandidates(workspace)).length;
  assert.ok(found > 0);
  await clock.sleep(5 * 60 * 60_000);
  assert.equal((await driver.exportCandidates(workspace)).length, found);
  // The deployment records 300 X items for the cycle; production's use of the
  // shared key makes the balance drop by more than that.
  const costs = await driver.runCosts(workspace, workspace.createdAt);
  assert.equal(costs.providers.socialapi.billableUnits, 300);
  assert.ok(
    new SyntheticAccounts().socialApiCents - accounts.socialApiCents >
      300 * 0.02
  );
});

test("an earlier cycle's qualification and lessons still count as pending after the next cycle starts", async () => {
  const accounts = new SyntheticAccounts();
  const clock = syntheticClock(1_000_000);
  const { driver, env } = syntheticDeployment(accounts, clock, "synthetic-key");
  // A one-minute gap, so cycle 2 starts while cycle 1 is still qualifying.
  env.set("PROSPECTING_AUTO_RESCHEDULE", "1");
  env.set("PROSPECTING_RESCHEDULE_INTERVAL_MINUTES", "1");
  const workspace = await driver.prepare({
    userId: "synthetic-user",
    label: "synthetic_p01_on",
    prompt: peopleSearchPlan.prompts[0].text,
    useCaseKey: "general_outreach",
  });
  await driver.start(workspace);
  // Cycle 1 runs from 20 s to 8 min 20 s; cycle 2 starts a minute later.
  await clock.sleep(10 * 60_000);
  const status = await driver.status(workspace);
  assert.equal(status?.workflowId, `${workspace.workspaceId}-wf2`);
  assert.equal(status?.workflowState, "inProgress");
  assert.equal(status?.counts.pending, 3);
  assert.equal(status?.pendingLessonWrites, 1);
  // Once cycle 1's phases are over and cycle 2 is still discovering, nothing is pending.
  await clock.sleep(5 * 60_000);
  const later = await driver.status(workspace);
  assert.equal(later?.workflowState, "inProgress");
  assert.deepEqual([later?.counts.pending, later?.pendingLessonWrites], [0, 0]);
});
