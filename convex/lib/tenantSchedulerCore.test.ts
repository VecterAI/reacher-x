import { describe, expect, it } from "vitest";
import {
  DEFAULT_TENANT_BURST_SLOTS,
  TENANT_EXECUTION_POOL_MAX_PARALLELISM,
  clampTenantBaseSlots,
  clampTenantBurstSlots,
  clampTenantSchedulerSlotCount,
  getTenantEnqueueRetryDelayMs,
  getTenantDispatchCap,
} from "./tenantSchedulerCore";

describe("tenant scheduler capacity policy", () => {
  it("lets one tenant borrow most capacity while preserving newcomer headroom", () => {
    expect(
      getTenantDispatchCap({
        slotCount: 36,
        activeTenantCount: 1,
        baseSlotsPerTenant: 1,
        burstSlotsPerTenant: DEFAULT_TENANT_BURST_SLOTS,
      })
    ).toBe(30);
  });

  it("rebalances fair shares as more tenants become active", () => {
    const capFor = (activeTenantCount: number) =>
      getTenantDispatchCap({
        slotCount: 36,
        activeTenantCount,
        baseSlotsPerTenant: 1,
        burstSlotsPerTenant: 30,
      });

    expect(capFor(2)).toBe(18);
    expect(capFor(3)).toBe(12);
    expect(capFor(10)).toBe(3);
    expect(capFor(50)).toBe(1);
    expect(capFor(36)).toBe(1);
    expect(capFor(100)).toBe(1);
  });

  it("does not grant more work to a noisy tenant after smaller tenants arrive", () => {
    const noisyTenantRunning = 30;
    const capAfterTwoNewTenantsArrive = getTenantDispatchCap({
      slotCount: 36,
      activeTenantCount: 3,
      baseSlotsPerTenant: 1,
      burstSlotsPerTenant: 30,
    });

    expect(noisyTenantRunning).toBeGreaterThan(capAfterTwoNewTenantsArrive);
    expect(36 - noisyTenantRunning).toBe(6);
    expect(capAfterTwoNewTenantsArrive).toBe(12);
  });

  it("clamps operator settings to the configured Pro-safe pool split", () => {
    expect(clampTenantSchedulerSlotCount(1_000)).toBe(
      TENANT_EXECUTION_POOL_MAX_PARALLELISM
    );
    expect(clampTenantSchedulerSlotCount(0)).toBe(1);
    expect(clampTenantBaseSlots(50, 12)).toBe(12);
    expect(
      clampTenantBurstSlots({
        burstSlots: 2,
        baseSlots: 4,
        slotCount: 12,
      })
    ).toBe(4);
  });

  it("backs off bounded enqueue retries with deterministic jitter", () => {
    expect(getTenantEnqueueRetryDelayMs(1, 0)).toBe(250);
    expect(getTenantEnqueueRetryDelayMs(2, 0.5)).toBe(625);
    expect(getTenantEnqueueRetryDelayMs(3, 1)).toBe(1_250);
  });
});
