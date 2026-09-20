import { describe, expect, test } from "vitest";
import {
  parseReacherXBlogIndex,
  rankReacherXBlogResults,
} from "./researchCore";

const index = `# ReacherX Blog

- [How to reach out and actually get replies](https://reacherx.com/blog/reach-out-and-get-replies/markdown): The outreach practices that get high reply rates.
- [Workspaces explained](https://reacherx.com/blog/workspaces-explained/markdown): Keep different audiences organized.
`;

describe("ReacherX blog search index", () => {
  test("parses published markdown index entries into safe page references", () => {
    expect(parseReacherXBlogIndex(index)).toEqual([
      {
        title: "How to reach out and actually get replies",
        url: "https://reacherx.com/blog/reach-out-and-get-replies",
        snippet: "The outreach practices that get high reply rates.",
      },
      {
        title: "Workspaces explained",
        url: "https://reacherx.com/blog/workspaces-explained",
        snippet: "Keep different audiences organized.",
      },
    ]);
  });

  test("ranks natural language requests without a keyword lookup table", () => {
    const findings = parseReacherXBlogIndex(index);
    expect(
      rankReacherXBlogResults("how to get more replies", findings)
    ).toEqual([findings[0]]);
    expect(rankReacherXBlogResults("workspace", findings)).toEqual([
      findings[1],
    ]);
    expect(rankReacherXBlogResults("workspace?", findings)).toEqual([
      findings[1],
    ]);
  });

  test("does not treat an unrelated request as a first-party match", () => {
    expect(
      rankReacherXBlogResults(
        "how to configure SMTP",
        parseReacherXBlogIndex(index)
      )
    ).toEqual([]);
  });
});
