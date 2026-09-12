import { afterEach, expect, test, vi } from "vitest";
import {
  runLinkedInProfileRequest,
  LINKEDIN_PROFILE_REQUEST_TIMEOUT_MS,
} from "./profileRequests";
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
test("successful profile reads clear their timeout", async () => {
  vi.useFakeTimers();
  await expect(
    runLinkedInProfileRequest(Promise.resolve({ posts: [] }))
  ).resolves.toEqual({ posts: [] });
  expect(vi.getTimerCount()).toBe(0);
});
test("provider failures propagate without leaving timers", async () => {
  vi.useFakeTimers();
  await expect(
    runLinkedInProfileRequest(Promise.reject(new Error("Unavailable")))
  ).rejects.toThrow("Unavailable");
  expect(vi.getTimerCount()).toBe(0);
});
test("hung reads settle so the UI can offer Retry, even if the old response arrives later", async () => {
  vi.useFakeTimers();
  let finish!: (value: string) => void;
  const request = runLinkedInProfileRequest(
    new Promise<string>((resolve) => {
      finish = resolve;
    })
  );
  const result = expect(request).rejects.toThrow("taking longer than expected");
  await vi.advanceTimersByTimeAsync(LINKEDIN_PROFILE_REQUEST_TIMEOUT_MS);
  await result;
  finish("late result");
  expect(vi.getTimerCount()).toBe(0);
  await expect(
    runLinkedInProfileRequest(Promise.resolve("retry"))
  ).resolves.toBe("retry");
});
