import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Hook to monitor reply status and show notifications
 * This hook automatically shows Sonner toasts for reply status changes
 */
export function useReplyStatus() {
  const recentReplies = useQuery(api.replyQueueMutations.getUserRecentReplies, {
    limit: 5,
  });
  const pendingReplies = useQuery(
    api.replyQueueMutations.getUserPendingReplies,
    {}
  );
  const processingReplies = useQuery(
    api.replyQueueMutations.getUserProcessingReplies,
    {}
  );

  // Track processed replies to avoid duplicate notifications
  const processedRepliesRef = useRef<Set<string>>(new Set());

  // Show notifications for completed replies
  useEffect(() => {
    if (!recentReplies) return;

    recentReplies.forEach((reply) => {
      const replyId = reply._id;

      // Skip if we've already processed this reply
      if (processedRepliesRef.current.has(replyId)) return;

      if (reply.status === "completed") {
        toast.success("Reply posted successfully!", {
          description: `Reply to tweet ${reply.tweetId}`,
          duration: 4000,
        });

        // Mark as processed
        processedRepliesRef.current.add(replyId);
      } else if (reply.status === "failed") {
        toast.error("Reply failed to post", {
          description: reply.errorMessage || "Unknown error occurred",
          duration: 6000,
        });

        // Mark as processed
        processedRepliesRef.current.add(replyId);
      }
    });
  }, [recentReplies]);

  // Show processing status for new replies
  useEffect(() => {
    if (processingReplies && processingReplies.length > 0) {
      // Only show if we have processing replies and no pending ones
      // This prevents showing "processing" when we're just queuing
      if (pendingReplies && pendingReplies.length === 0) {
        toast.info("Posting reply...", {
          description: "Your reply is being processed",
          duration: 3000,
        });
      }
    }
  }, [processingReplies, pendingReplies]);

  // Clean up processed replies ref periodically to prevent memory leaks
  useEffect(() => {
    const cleanup = setInterval(() => {
      if (processedRepliesRef.current.size > 100) {
        processedRepliesRef.current.clear();
      }
    }, 60000); // Clean up every minute

    return () => clearInterval(cleanup);
  }, []);

  return {
    recentReplies: recentReplies || [],
    pendingReplies: pendingReplies || [],
    processingReplies: processingReplies || [],
  };
}
