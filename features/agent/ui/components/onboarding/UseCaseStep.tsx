"use client";

import { RadioGroup, RadioGroupItem } from "@/shared/ui/components/RadioGroup";
import {
  isWorkspaceUseCaseKey,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";
import { UseCaseIllustration } from "./use-case-illustrations/useCaseIllustrationByKey";

const USE_CASE_GROUPS: {
  categoryLabel: string;
  items: {
    key: WorkspaceUseCaseKey;
    title: string;
    description: string;
  }[];
}[] = [
  {
    categoryLabel: "For business growth",
    items: [
      {
        key: "customer_prospecting",
        title: "Leads, Customers & Users",
        description:
          "Find people and companies who are likely to need what you offer and are ready to buy.",
      },
      {
        key: "partnership_outreach",
        title: "Partnerships",
        description:
          "Find companies or individuals you could collaborate with to grow each other's business.",
      },
      {
        key: "investor_outreach",
        title: "Investors",
        description:
          "Find investors whose focus areas and recent activity suggest they'd be interested in your opportunity.",
      },
    ],
  },
  {
    categoryLabel: "For hiring & talent",
    items: [
      {
        key: "recruiting",
        title: "Candidates",
        description:
          "Find and reach out to candidates who match your open role, even if they're not actively looking.",
      },
    ],
  },
  {
    categoryLabel: "For audience & content",
    items: [
      {
        key: "community_growth",
        title: "Community members",
        description:
          "Find people who share an interest in your niche and are likely to engage with your community.",
      },
      {
        key: "creator_outreach",
        title: "Creators",
        description:
          "Find creators whose audience, tone, and content style align with your brand or campaign.",
      },
      {
        key: "podcast_speaker_sourcing",
        title: "Podcast guests",
        description:
          "Find people with the right expertise and story who would make a great guest on your show.",
      },
    ],
  },
  {
    categoryLabel: "For research",
    items: [
      {
        key: "user_research_recruitment",
        title: "Research participants",
        description:
          "Find people you can interview or survey to get real feedback on your product or market.",
      },
    ],
  },
];

interface UseCaseStepProps {
  activeUseCaseKey: WorkspaceUseCaseKey;
  onSelectUseCase: (useCaseKey: WorkspaceUseCaseKey) => void;
}

export function UseCaseStep({
  activeUseCaseKey,
  onSelectUseCase,
}: UseCaseStepProps) {
  return (
    <section className="min-w-0">
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-4 block w-full px-0 text-xl font-semibold">
          Who are you looking for?
        </legend>

        <RadioGroup
          className="flex flex-col gap-0"
          value={activeUseCaseKey}
          onValueChange={(value) => {
            if (isWorkspaceUseCaseKey(value)) {
              onSelectUseCase(value);
            }
          }}
        >
          {USE_CASE_GROUPS.map((group, groupIndex) => (
            <div
              key={group.categoryLabel}
              className={groupIndex > 0 ? "mt-4" : undefined}
            >
              <p className="text-muted-foreground mb-2 text-xs">
                {group.categoryLabel}
              </p>
              <div className="flex flex-col gap-2">
                {group.items.map((item) => {
                  const controlId = `use-case-${item.key}`;
                  return (
                    <label
                      key={item.key}
                      htmlFor={controlId}
                      className="flex cursor-pointer items-center gap-3"
                    >
                      <UseCaseIllustration useCaseKey={item.key} />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm font-medium">
                          {item.title}
                        </span>
                        <p className="text-muted-foreground mt-0.5 text-sm">
                          {item.description}
                        </p>
                      </span>
                      <RadioGroupItem
                        id={controlId}
                        value={item.key}
                        className="shrink-0 self-center"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </RadioGroup>
      </fieldset>
    </section>
  );
}
