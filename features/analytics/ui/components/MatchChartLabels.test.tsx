import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getWorkspaceUseCase } from "@/shared/lib/workspaceUseCases";
import { getDemoUseCaseLabels } from "@/features/landing/ui/components/use-case-demo/demoLabels";
import { PipelineFunnelChart } from "./PipelineFunnelChart";
import { ProspectsTrendChart } from "./ProspectsTrendChart";
import { FitDistributionChart } from "./FitDistributionChart";

vi.mock("@/shared/hooks", () => ({
  useActiveUseCaseLabels: () => getWorkspaceUseCase("customer_prospecting"),
}));

describe("chart labels in a demo with a different signed-in workspace", () => {
  it.each(["candidates", "investors", "job_seekers"] as const)(
    "uses the selected %s goal instead of the signed-in customer goal",
    (goal) => {
      const labels = getDemoUseCaseLabels(goal);
      const html = renderToStaticMarkup(
        <>
          <PipelineFunnelChart data={[]} labels={labels} />
          <ProspectsTrendChart data={[]} labels={labels} />
          <FitDistributionChart data={[]} labels={labels} />
        </>
      );
      expect(html).toContain(`${labels.entityPlural} by stage`);
      expect(html).toContain(`${labels.entityPlural} over time`);
      expect(html).toContain(`${labels.entityPlural} by match score`);
      expect(html).not.toContain("People by");
    }
  );

  it("uses the active workspace when no demo labels are supplied", () => {
    const html = renderToStaticMarkup(
      <>
        <PipelineFunnelChart data={[]} />
        <ProspectsTrendChart data={[]} />
        <FitDistributionChart data={[]} />
      </>
    );
    expect(html).toContain("People by stage");
    expect(html).toContain("People over time");
    expect(html).toContain("People by match score");
  });
});
