"use client";

import { useEffect, useRef, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { normalizeProspectProfileData } from "@/features/prospects/lib/normalizeProspectProfileData";
import { ProspectProfilePanel } from "@/features/prospects/ui/components/ProspectProfilePanel";
import { EvidencePostsPanel } from "@/features/prospects/ui/components/EvidencePostsPanel";
import {
  getEditorialDemoPlan,
  type DemoEditorialScenario,
} from "../demoEditorialHelpers";
import type { DemoPresentation } from "../demoPresentationHelpers";
import { DemoPlatformProfilePanel } from "./DemoPlatformProfilePanel";
import { DemoConversationPanel } from "./DemoConversationPanel";
import { DemoOutreachPlanSection } from "./DemoOutreachPlanSection";
import type { DemoProspectView } from "./useDemoProspectActions";
import type { ProspectCardMenuActions } from "@/features/prospects/ui/components/prospect-card/ProspectCardMenu";

/** Shared production panels, composed once for all demo prospect lists. */
export function DemoProspectPanel({
  prospect,
  actions,
  onBack,
  initialView = "profile",
  presentation,
  editorialScenario,
}: {
  prospect: Doc<"prospects">;
  actions: ProspectCardMenuActions;
  onBack: () => void;
  initialView?: DemoProspectView;
  presentation?: DemoPresentation;
  editorialScenario?: DemoEditorialScenario;
}) {
  const data = normalizeProspectProfileData(prospect);
  const [conversation, setConversation] = useState(
    initialView === "conversation"
  );
  const [platformProfile, setPlatformProfile] = useState(
    initialView === "platform"
  );
  const [evidence, setEvidence] = useState<{
    title: string;
    posts: unknown[];
    platform: "twitter" | "linkedin";
  } | null>(null);
  const panel = useRef<HTMLElement>(null);
  const plan = getEditorialDemoPlan(prospect._id, editorialScenario);
  useEffect(() => {
    const viewport = panel.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport], [data-slot="scroll-area-viewport"]'
    );
    if (viewport) viewport.scrollTop = presentation?.profileScroll ?? 0;
  }, [presentation?.profileScroll, conversation, platformProfile, evidence]);
  if (!data) return null;
  return (
    <aside
      ref={panel}
      data-demo-profile
      className="border-border flex h-full w-[520px] shrink-0 flex-col border-l"
    >
      {conversation ? (
        <DemoConversationPanel
          prospect={data}
          onBack={() => setConversation(false)}
          onViewProfile={() => {
            setConversation(false);
            setPlatformProfile(false);
          }}
          onViewPlatformProfile={() => {
            setConversation(false);
            setPlatformProfile(true);
          }}
        />
      ) : platformProfile ? (
        <DemoPlatformProfilePanel
          prospect={prospect}
          onBack={() => setPlatformProfile(false)}
          onOpenConversation={() => setConversation(true)}
        />
      ) : evidence ? (
        <EvidencePostsPanel
          {...evidence}
          readOnly
          offline
          onBack={() => setEvidence(null)}
        />
      ) : (
        <ProspectProfilePanel
          prospect={data}
          mode="ui_preview"
          initialTab={presentation?.profileTab}
          preview={{
            useCaseKey: actions.useCaseKey,
            menuOpen: presentation?.profileMenu,
            onStatusChange: actions.onStatusChange,
            onShareProfile: actions.onShareProfile,
          }}
          onChatWithAgent={actions.onOpenAgent}
          onOpenConversation={() => setConversation(true)}
          onOpenEvidencePosts={setEvidence}
          onOpenTwitterProfile={() => setPlatformProfile(true)}
          onOpenLinkedInProfile={() => setPlatformProfile(true)}
          onBack={onBack}
          disableMobileDrawer
          className="max-w-none"
          renderOutreachPlanSection={
            plan
              ? () => (
                  <DemoOutreachPlanSection
                    key={prospect._id}
                    plan={plan}
                    prospectId={prospect._id}
                  />
                )
              : undefined
          }
        />
      )}
    </aside>
  );
}
