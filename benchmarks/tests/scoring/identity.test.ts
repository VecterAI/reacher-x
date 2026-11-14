import assert from "node:assert/strict";
import test from "node:test";
import {
  domainKey,
  flagRepeats,
  identityKeys,
  linkedinKey,
  primaryIdentity,
  xHandleKey,
} from "../../core/identity";
import type { BenchmarkEntity } from "../../core/types";

// Synthetic entities only.
const person = (
  name: string,
  profileUrl: string | null,
  employer: string | null = null
): BenchmarkEntity => ({
  prospectType: "individual",
  name,
  profileUrl,
  location: null,
  description: null,
  evidence: [],
  title: null,
  employer,
});

const company = (
  name: string,
  domain: string | null,
  profileUrl: string | null = null
): BenchmarkEntity => ({
  prospectType: "organization",
  name,
  profileUrl,
  location: null,
  description: null,
  evidence: [],
  domain,
  industry: null,
  employeeCount: null,
});

test("profile URLs and domains normalize across formatting differences", () => {
  assert.equal(
    linkedinKey("https://uk.linkedin.com/in/Jane-Example/?trk=x"),
    "in/jane-example"
  );
  assert.equal(
    linkedinKey("linkedin.com/company/example-co"),
    "company/example-co"
  );
  assert.equal(linkedinKey("https://example.com/in/jane"), null);
  assert.equal(
    xHandleKey("https://twitter.com/Example_Dev/status/1"),
    "example_dev"
  );
  assert.equal(xHandleKey("https://x.com/home"), null);
  assert.equal(domainKey("https://www.Example.co.uk/about"), "example.co.uk");
  assert.equal(domainKey("https://www.linkedin.com/company/example"), null);
});

test("a name is used only when nothing stronger identifies the entity", () => {
  assert.deepEqual(identityKeys(person("Jane Example", "https://x.com/jane")), [
    { kind: "x", value: "jane" },
  ]);
  assert.deepEqual(identityKeys(person("Zoë Example", null, "Example Co.")), [
    { kind: "name", value: "zoe example @ example co" },
  ]);
  assert.equal(
    primaryIdentity(company("Example", "example.com")),
    "organization:domain:example.com"
  );
});

test("repeats across tools are flagged, and a name-only match is marked possible", () => {
  const flags = flagRepeats([
    {
      toolId: "a",
      resultId: "a1",
      entity: person("Jane", "https://linkedin.com/in/jane"),
    },
    {
      toolId: "b",
      resultId: "b1",
      entity: person("J. Example", "https://www.linkedin.com/in/JANE/"),
    },
    {
      toolId: "b",
      resultId: "b2",
      entity: person("Sam Example", null, "Example"),
    },
    {
      toolId: "c",
      resultId: "c1",
      entity: person("Sam Example", null, "Example"),
    },
    { toolId: "c", resultId: "c2", entity: company("Example", "example.com") },
    // Same tool twice is not a repeat across tools.
    { toolId: "a", resultId: "a2", entity: company("Other", "other.com") },
    {
      toolId: "a",
      resultId: "a3",
      entity: company("Other Inc", "https://other.com"),
    },
  ]);
  assert.deepEqual(flags, [
    { resultId: "a1", repeatsTools: ["b"], confidence: "identity" },
    { resultId: "b1", repeatsTools: ["a"], confidence: "identity" },
    { resultId: "b2", repeatsTools: ["c"], confidence: "possible" },
    { resultId: "c1", repeatsTools: ["b"], confidence: "possible" },
  ]);
});

test("a person and a company never repeat each other", () => {
  const flags = flagRepeats([
    { toolId: "a", resultId: "a1", entity: person("Example", null) },
    { toolId: "b", resultId: "b1", entity: company("Example", null) },
  ]);
  assert.deepEqual(flags, []);
});
