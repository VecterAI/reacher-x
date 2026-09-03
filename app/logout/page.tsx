"use client";

import { useEffect, useRef } from "react";
import { clearXChatBrowserData } from "@/features/agent/lib/xChatBrowserSession";
import { submitDocumentFormIntentionally } from "@/shared/lib/convex/intentionalDocumentNavigation";

const LOGOUT_COMPLETION_HREF = "/logout/complete";

export default function LogoutPage() {
  const completionFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let isActive = true;

    void clearXChatBrowserData()
      .catch((error: unknown) => {
        console.error("[Logout] Failed to clear XChat browser data", error);
      })
      .finally(() => {
        if (isActive && completionFormRef.current) {
          submitDocumentFormIntentionally(completionFormRef.current);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form
        ref={completionFormRef}
        action={LOGOUT_COMPLETION_HREF}
        method="post"
      />
      <p className="text-muted-foreground text-sm" role="status">
        Logging out…
      </p>
    </main>
  );
}
