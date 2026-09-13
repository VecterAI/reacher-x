"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/components/Button";

export function BlogCopyButton({
  text,
  label = "Copy",
  copyLocation = false,
}: {
  text?: string;
  label?: string;
  copyLocation?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  useEffect(() => {
    if (status !== "copied") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    // Clear the previous announcement on retry; errors remain readable until
    // the next attempt, while success feedback returns to the normal label.
    setStatus("idle");
    try {
      await navigator.clipboard.writeText(
        copyLocation ? window.location.href : (text ?? "")
      );
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="ghost" size="xs" onClick={copy}>
        {status === "copied" ? "Copied" : label}
      </Button>
      <span
        role="status"
        className={status === "error" ? "text-destructive text-xs" : "sr-only"}
      >
        {status === "error"
          ? "Could not copy. Select and copy the text manually."
          : status === "copied"
            ? "Copied to clipboard"
            : ""}
      </span>
    </span>
  );
}
