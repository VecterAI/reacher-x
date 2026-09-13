import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { createServices } from "./conversationServices";

const prospectId = "experiment-prospect" as Id<"prospects">;
const queryArgs = { prospectId, platform: "linkedin" as const };
const message = {
  ...queryArgs,
  clientRequestId: "request-1",
  text: "Hello Maya",
};

test("registered service results satisfy the actual API and notify real query observers", async () => {
  const { client } = createServices();
  const watch = client.watchQuery(
    api.outboundMessageOperations.listForProspect,
    queryArgs
  );
  const before = watch.localQueryResult();
  assert.deepEqual(before, []);
  assert.strictEqual(watch.localQueryResult(), before);
  let updates = 0;
  const unsubscribe = watch.onUpdate(() => updates++);
  const result = await client.mutation(
    api.outboundMessageOperations.queueMessage,
    message
  );
  assert.equal(result.status, "sent");
  assert.equal(updates, 1);
  assert.equal(watch.localQueryResult()?.[0].text, message.text);
  assert.deepEqual(before, [], "previous query snapshot must remain immutable");
  unsubscribe();
  client.notify();
  assert.equal(updates, 1);
});

test("failed send does not persist, retry succeeds, and sessions remain isolated", async () => {
  const first = createServices();
  const second = createServices();
  first.failNextSend();
  await assert.rejects(
    first.client.mutation(api.outboundMessageOperations.queueMessage, message),
    /connection interrupted/
  );
  assert.deepEqual(
    await first.client.query(
      api.outboundMessageOperations.listForProspect,
      queryArgs
    ),
    []
  );
  await first.client.mutation(
    api.outboundMessageOperations.queueMessage,
    message
  );
  assert.equal(
    (
      await first.client.query(
        api.outboundMessageOperations.listForProspect,
        queryArgs
      )
    ).length,
    1
  );
  assert.deepEqual(
    await second.client.query(
      api.outboundMessageOperations.listForProspect,
      queryArgs
    ),
    []
  );
});

test("unimplemented queries and mutations fail explicitly instead of reaching Convex", async () => {
  const { client } = createServices();
  assert.throws(
    () =>
      client
        .watchQuery(api.prospects.getProspect, { prospectId })
        .localQueryResult(),
    /Unimplemented demo service/
  );
  await assert.rejects(
    client.mutation(api.outreach.approvePlan, {
      planId: "experiment-plan" as Id<"outreachPlans">,
    }),
    /Unimplemented demo service/
  );
});
