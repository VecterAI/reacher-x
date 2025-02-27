"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function ThreadsPage() {
  // Fetch thread IDs using useQuery (remains unchanged)
  const threadIds = useQuery(api.socialdata.getThreadIds);

  // Get the action function for getThreads
  const getThreadsAction = useAction(api.socialdata.getThreads);

  // State to hold the fetched threads, initialized as null
  const [threads, setThreads] = useState<any[] | null>(null);

  // Fetch threads when threadIds are available
  useEffect(() => {
    if (threadIds !== undefined) {
      getThreadsAction({ threadIds })
        .then((fetchedThreads) => setThreads(fetchedThreads))
        .catch((error) => {
          console.error("Failed to fetch threads:", error);
          // Optionally set an error state here if desired
        });
    }
  }, [threadIds, getThreadsAction]);

  // Show loading state until both threadIds and threads are ready
  if (threadIds === undefined || threads === null) {
    return <div>Loading...</div>;
  }

  // Render the threads
  return (
    <div className="space-y-8 p-4">
      <h1 className="text-2xl font-bold">Threads</h1>
      {threads.length === 0 ? (
        <p>No threads available yet.</p>
      ) : (
        threads.map((thread, index) => (
          <Link key={threadIds[index]} href={`/threads/${threadIds[index]}`}>
            <div className="rounded border p-4 hover:bg-gray-100">
              <h2 className="text-lg font-semibold">Thread {index + 1}</h2>
              <p>{thread.tweets[0].full_text.slice(0, 100)}...</p>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
