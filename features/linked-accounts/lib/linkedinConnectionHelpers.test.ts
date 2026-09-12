import { afterEach, expect, test, vi } from "vitest";
import { finishLinkedInConnection } from "./linkedinConnectionHelpers";

const connecting = { isConnected: false, status: "connecting" };
const connected = { isConnected: true, status: "connected" };

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

test("checks the provider again until the connection is actually ready", async () => {
  vi.useFakeTimers();
  const sync = vi
    .fn()
    .mockResolvedValueOnce(connecting)
    .mockResolvedValueOnce(connecting)
    .mockResolvedValue(connected);
  const result = finishLinkedInConnection(sync);
  await vi.advanceTimersByTimeAsync(4_000);
  await expect(result).resolves.toEqual(connected);
  expect(sync).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
});

test("persistent connecting state ends with a recoverable error", async () => {
  vi.useFakeTimers();
  const sync = vi.fn().mockResolvedValue(connecting);
  const result = expect(finishLinkedInConnection(sync)).rejects.toThrow(
    "Try checking again"
  );
  await vi.advanceTimersByTimeAsync(10_000);
  await result;
  expect(sync).toHaveBeenCalledTimes(6);
  expect(vi.getTimerCount()).toBe(0);
  await expect(
    finishLinkedInConnection(async () => connected)
  ).resolves.toEqual(connected);
});

test("a hung request times out and a late answer cannot restart polling", async () => {
  vi.useFakeTimers();
  let resolve!: (value: typeof connecting) => void;
  const sync = vi.fn(
    () =>
      new Promise<typeof connecting>((done) => {
        resolve = done;
      })
  );
  const result = expect(finishLinkedInConnection(sync)).rejects.toThrow(
    "taking longer than expected"
  );
  await vi.advanceTimersByTimeAsync(30_000);
  await result;
  resolve(connecting);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(sync).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

test("permission or credential failures require reconnection rather than endless polling", async () => {
  vi.useFakeTimers();
  const sync = vi
    .fn()
    .mockResolvedValue({ isConnected: false, status: "reconnect_required" });
  await expect(finishLinkedInConnection(sync)).rejects.toThrow(
    "Try connecting again"
  );
  expect(sync).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

test("provider errors do not turn into a successful connection", async () => {
  vi.useFakeTimers();
  await expect(
    finishLinkedInConnection(async () => {
      throw new Error("Provider unavailable");
    })
  ).rejects.toThrow("Provider unavailable");
  expect(vi.getTimerCount()).toBe(0);
});
