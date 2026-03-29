"use client";

import * as React from "react";
import { Alert, AlertDescription } from "@/shared/ui/components/Alert";

export function UnavailableInteractionCard({
  message = "This post is no longer available.",
}: {
  message?: string;
}) {
  return (
    <Alert>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
