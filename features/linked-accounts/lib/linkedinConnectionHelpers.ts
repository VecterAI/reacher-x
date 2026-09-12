import { runLinkedInRequest } from "@/shared/lib/linkedin/requests";

type ConnectionStatus = { isConnected: boolean; status?: string };

/** Read Unipile again while its account is connecting; never infer success from the redirect. */
export async function finishLinkedInConnection<T extends ConnectionStatus>(
  sync: () => Promise<T>
): Promise<T> {
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await runLinkedInRequest(
      (async () => {
        for (let attempt = 0; attempt < 6; attempt++) {
          const status = await sync();
          if (stopped) throw new Error("Connection check ended.");
          if (status.isConnected && status.status === "connected")
            return status;
          if (status.status !== "connecting") {
            throw new Error(
              "LinkedIn could not connect. Try connecting again."
            );
          }
          if (attempt < 5) {
            await new Promise<void>((resolve) => {
              retryTimer = setTimeout(resolve, 2_000);
            });
          }
        }
        throw new Error("LinkedIn is still connecting. Try checking again.");
      })()
    );
  } finally {
    stopped = true;
    clearTimeout(retryTimer);
  }
}
