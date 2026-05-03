import type { Doc } from "@/convex/_generated/dataModel";
import type { ProspectProfileData } from "@/features/prospects";
import { normalizeProspectProfileData } from "@/features/prospects/lib/normalizeProspectProfileData";

export type SetupPreviewProspectRecord = Doc<"prospects">;

export function buildSetupPreviewProfileData(
  preview: SetupPreviewProspectRecord
): ProspectProfileData {
  return (
    normalizeProspectProfileData(preview) ?? {
      id: String(preview._id),
      displayName: preview.displayName ?? "Unknown",
      platform: preview.platform,
      prospectType: preview.prospectType ?? "unknown",
      status: preview.status,
    }
  );
}
