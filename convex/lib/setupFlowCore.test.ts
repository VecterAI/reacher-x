import { describe, expect, it } from "vitest";
import {
  buildVisibleSetupSteps,
  getNextSetupStatusAfterConnections,
  getNextSetupStatusAfterProvisioning,
  isSetupComposerLocked,
} from "./setupFlowCore";

describe("setupFlowCore lean chat-first flow", () => {
  it("exposes input → connections → plan visible steps", () => {
    expect(
      buildVisibleSetupSteps({
        requiresConnections: true,
        requiresPlan: true,
      }).map((step) => step.id)
    ).toEqual(["input", "connections", "plan"]);
  });

  it("skips connections and plan when not required", () => {
    expect(
      buildVisibleSetupSteps({
        requiresConnections: false,
        requiresPlan: false,
      }).map((step) => step.id)
    ).toEqual(["input"]);
  });

  it("finishes to ready after provisioning when no later steps", () => {
    expect(
      getNextSetupStatusAfterProvisioning({
        requiresConnections: false,
        requiresPlan: false,
      })
    ).toBe("ready");
  });

  it("routes to connections then plan when required", () => {
    expect(
      getNextSetupStatusAfterProvisioning({
        requiresConnections: true,
        requiresPlan: true,
      })
    ).toBe("awaiting_connections");
    expect(getNextSetupStatusAfterConnections({ requiresPlan: true })).toBe(
      "awaiting_plan"
    );
    expect(getNextSetupStatusAfterConnections({ requiresPlan: false })).toBe(
      "ready"
    );
  });

  it("unlocks composer for collecting, ICP review, and ready", () => {
    expect(isSetupComposerLocked("awaiting_input")).toBe(false);
    expect(isSetupComposerLocked("awaiting_icp_confirmation")).toBe(false);
    expect(isSetupComposerLocked("ready")).toBe(false);
  });

  it("locks composer during generation, preview, connections, and plan", () => {
    expect(isSetupComposerLocked("generating_profiles")).toBe(true);
    expect(isSetupComposerLocked("awaiting_preview_confirmation")).toBe(true);
    expect(isSetupComposerLocked("awaiting_connections")).toBe(true);
    expect(isSetupComposerLocked("awaiting_plan")).toBe(true);
  });
});
