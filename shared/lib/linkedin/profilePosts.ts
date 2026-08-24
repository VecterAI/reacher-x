export const LINKEDIN_PROFILE_POSTS_UNAVAILABLE_MESSAGE =
  "LinkedIn posts are temporarily unavailable.";

export function getLinkedInProfilePostsFailureMessage(_error: unknown): string {
  return LINKEDIN_PROFILE_POSTS_UNAVAILABLE_MESSAGE;
}
