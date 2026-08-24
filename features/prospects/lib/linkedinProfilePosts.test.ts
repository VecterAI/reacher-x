import { describe, expect, test } from "vitest";
import {
  getLinkedInProfilePostsFailureMessage,
  LINKEDIN_PROFILE_POSTS_UNAVAILABLE_MESSAGE,
} from "../../../shared/lib/linkedin/profilePosts";

describe("LinkedIn profile post failures", () => {
  test("never exposes provider or Convex diagnostics to the user", () => {
    const providerError = new Error(
      "Uncaught ProviderCircuitOpenError at convex/linkedin.ts:3907"
    );

    expect(getLinkedInProfilePostsFailureMessage(providerError)).toBe(
      LINKEDIN_PROFILE_POSTS_UNAVAILABLE_MESSAGE
    );
    expect(getLinkedInProfilePostsFailureMessage({ stack: "sensitive" })).toBe(
      LINKEDIN_PROFILE_POSTS_UNAVAILABLE_MESSAGE
    );
  });
});
