import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getWorkspaceUseCase } from "@/shared/lib/workspaceUseCases";
import { getProspectMatchReasoning } from "@/shared/lib/prospectMatchReasoningHelpers";
import { resolveQualificationPresentation } from "../../lib/qualificationUi";
import { MatchResultIcon } from "./MatchResultIcon";
import { ProspectDetailsCard } from "./ProspectDetailsCard";
import { ProspectCardFooter } from "./prospect-card/ProspectCardFooter";
import {
  ModeHeatIcon,
  FireCheckIcon,
  EmergencyHeatIcon,
} from "@/shared/ui/components/icons";

vi.mock("@/shared/hooks", () => ({
  useActiveUseCaseLabels: () => getWorkspaceUseCase("customer_prospecting"),
}));

describe("match presentation for existing records", () => {
  it.each([
    ["qualified", "Good match", "match", true],
    ["disqualified", "Not a match", "not-match", true],
    ["pending", "Awaiting match check", "pending", false],
    [undefined, "Awaiting match check", "pending", false],
  ] as const)(
    "maps %s without changing its stored status",
    (status, label, icon, showCardBadge) => {
      expect(resolveQualificationPresentation(status)).toMatchObject({
        profileValueText: label,
        icon,
        showCardBadge,
      });
      const html = renderToStaticMarkup(
        <ProspectDetailsCard qualificationStatus={status} />
      );
      expect(html).toContain(label);
      expect(html).toContain("Match result");
      expect(html).not.toMatch(/Flagged as|Qualified|Unqualified|Disqualified/);
      const footer = renderToStaticMarkup(
        <ProspectCardFooter qualificationStatus={status} />
      );
      expect(footer.includes(label)).toBe(showCardBadge);
    }
  );

  it.each([0, 70, 88, 100])(
    "renders the unchanged %i score with the match label",
    (score) => {
      const html = renderToStaticMarkup(
        <ProspectCardFooter
          qualificationStatus="qualified"
          qualificationScore={score}
        />
      );
      expect(html).toContain('aria-label="Person match score"');
      expect(html).toContain(`aria-valuenow="${score}"`);
      expect(html).toContain("% match");
      expect(html).not.toContain("% fit");
      expect(html).toContain("overflow-x-auto");
    }
  );

  it("does not invent a score when the record has none", () => {
    const html = renderToStaticMarkup(
      <ProspectCardFooter qualificationStatus="pending" />
    );
    expect(html).toBe("");
  });

  it("keeps Reasoning and original saved text", () => {
    const original = "Qualified because the original ICP fit was strong.";
    expect(
      getProspectMatchReasoning({ qualificationReasoning: original })
    ).toBe(original);
    const html = renderToStaticMarkup(
      <ProspectDetailsCard
        qualificationReasoning={original}
        status="converted"
      />
    );
    expect(html).toContain("Reasoning");
    expect(html).toContain(original);
    expect(html).toContain("Customer");
    expect(html).not.toContain("Became a customer");
  });

  it.each([ModeHeatIcon, FireCheckIcon, EmergencyHeatIcon])(
    "uses theme-aware SVGs without duplicate mask IDs",
    (Icon) => {
      const html = renderToStaticMarkup(
        <>
          <Icon aria-hidden />
          <Icon aria-hidden />
        </>
      );
      expect(html.match(/fill="currentColor"/g)).toHaveLength(2);
      expect(html).not.toMatch(/id=|#0A0A0A/);
    }
  );

  it("uses distinct glyphs for match, non-match, and pending", () => {
    const icons = ["match", "not-match", "pending"].map((result) =>
      renderToStaticMarkup(
        <MatchResultIcon
          result={result as "match" | "not-match" | "pending"}
          aria-hidden
        />
      )
    );
    expect(new Set(icons).size).toBe(3);
  });
});
