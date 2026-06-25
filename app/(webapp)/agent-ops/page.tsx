"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { AgentOpsDashboard } from "@/features/agent-ops/ui/AgentOpsDashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import type { AgentOpsTab } from "@/features/agent-ops/ui/types";

const TAB_OPTIONS: { value: AgentOpsTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "discovery", label: "Discovery" },
  { value: "quality", label: "Quality" },
  { value: "memory", label: "Memory" },
  { value: "activity", label: "Activity" },
];

export default function AgentOpsPage() {
  const router = useRouter();
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral([
      "overview",
      "discovery",
      "quality",
      "memory",
      "activity",
    ] as const).withDefault("overview")
  );

  return (
    <PageLayout className="flex max-w-none flex-col overflow-hidden border-none">
      <PageHeader
        title="Agent Ops"
        onBack={() => router.back()}
        actions={
          <Select
            value={tab}
            onValueChange={(value) => void setTab(value as AgentOpsTab)}
          >
            <SelectTrigger size="xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAB_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <PageContent className="scroll-fade-effect-y min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-none p-4">
        <AgentOpsDashboard />
      </PageContent>
    </PageLayout>
  );
}
