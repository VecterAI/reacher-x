"use node";

import type {
  TwitterActionApprovalMode,
  TwitterActionRiskLevel,
  TwitterActionCatalogEntry,
} from "./twitterActionCatalog";

export function getApprovalModeForRiskLevel(
  riskLevel: TwitterActionRiskLevel
): TwitterActionApprovalMode {
  switch (riskLevel) {
    case "read_safe":
    case "write_low_risk":
      return "auto_execute";
    case "write_medium_risk":
      return "confirm_first";
    case "write_high_risk":
      return "always_approval";
    default:
      return "always_approval";
  }
}

export function requiresApproval(
  metadata: Pick<TwitterActionCatalogEntry, "approvalMode">
) {
  return metadata.approvalMode !== "auto_execute";
}

export function isHighRiskTwitterAction(
  metadata: Pick<TwitterActionCatalogEntry, "riskLevel">
) {
  return metadata.riskLevel === "write_high_risk";
}
