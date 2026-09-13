import { cn } from "@/shared/lib/utils";
import {
  pillClassName,
  pillListClassName,
} from "@/shared/ui/components/pill-navigation/Pill";
import Link from "next/link";
import { MARKETING_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/components/Tabs";
import { MarketingDemo } from "./MarketingDemo";
import { marketingButton } from "./MarketingLayout";

/** Each panel mounts only its selected demo; Radix handles keyboard navigation. */
export function MarketingUseCaseExplorer() {
  return (
    <Tabs defaultValue={MARKETING_USE_CASES[0].slug}>
      <div className="scroll-fade-x max-w-full scrollbar-none overflow-x-auto pb-2">
        <TabsList
          aria-label="Explore use cases"
          className={cn(
            pillListClassName,
            "h-auto rounded-none bg-transparent p-0"
          )}
        >
          {MARKETING_USE_CASES.map((item) => (
            <TabsTrigger
              key={item.slug}
              value={item.slug}
              className={cn(
                pillClassName,
                "data-[state=active]:bg-muted data-[state=active]:text-foreground h-11 flex-none px-4 text-base data-[state=active]:shadow-none"
              )}
            >
              {item.title}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {MARKETING_USE_CASES.map((item) => (
        <TabsContent key={item.slug} value={item.slug} className="mt-8">
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_3fr] lg:gap-10">
            <div className="pt-2 lg:pt-10">
              <h3 className="max-w-xs text-2xl font-normal tracking-tight sm:text-3xl">
                {item.goal}
              </h3>
              <p className="text-muted-foreground mt-4 max-w-sm text-sm leading-6">
                {item.explanation}
              </p>
              <Link
                href={item.href}
                className={marketingButton({
                  variant: "outline",
                  className: "mt-6",
                })}
              >
                Explore {item.title.toLowerCase()}{" "}
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className="min-w-0">
              <MarketingDemo
                scenario={item.guide}
                title={`${item.title}: explore the workspace`}
                caption="Interactive example. Open a profile to see the research behind a match."
              />
            </div>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
