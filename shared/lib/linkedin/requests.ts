/** Bound LinkedIn reads so an unavailable provider cannot leave the UI waiting forever. */
export const LINKEDIN_REQUEST_TIMEOUT_MS = 30_000;

export async function runLinkedInRequest<T>(request: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error("LinkedIn is taking longer than expected. Try again.")
            ),
          LINKEDIN_REQUEST_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
