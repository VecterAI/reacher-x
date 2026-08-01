import { notFound } from "next/navigation";
import { MockSetupThreadPreview } from "@/features/agent/ui/components/setup-mock/MockSetupThreadPreview";

/**
 * Dev-only visual mock of the final chat-first setup thread.
 * Flip cases with the floating "Mock setup thread" switcher.
 * No Convex setup session — pure frontend for locking UI.
 */
export default function AgentSetupPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <MockSetupThreadPreview />;
}
