import assert from "node:assert/strict";
import test from "node:test";
import { parseContextPeople } from "../../people-search/tools/context";

// Shaped like context.dev people search; values are synthetic.
test("context.dev people keep facts and drop the provider's own match confidence", () => {
  const [person] = parseContextPeople(
    {
      results: [
        {
          id: "ctx-1",
          name: "Synthetic Two",
          description: "Product manager.",
          role: {
            title: "Product Manager",
            company: { name: "Health Example" },
            started_on: "2025-01-01",
          },
          location: { city: "London", region: "England", country_code: "GB" },
          profiles: [
            "https://github.com/synthetic",
            "https://linkedin.com/in/synthetic-two",
          ],
          match: { confidence: 0.97, reason: "private provider verdict" },
        },
      ],
      key_metadata: { credits_consumed: 50 },
    },
    "2026-11-14T00:00:00Z",
    5
  );
  assert.deepEqual(person.entity, {
    prospectType: "individual",
    name: "Synthetic Two",
    profileUrl: "https://linkedin.com/in/synthetic-two",
    title: "Product Manager",
    employer: "Health Example",
    location: "London, England, GB",
    description: "Product manager.",
    evidence: [],
  });
  assert.ok(!JSON.stringify(person).includes("private provider verdict"));
});
