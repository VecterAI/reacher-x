"use client";

import { toast } from "sonner";
import { submitDocumentFormIntentionally } from "@/shared/lib/convex/intentionalDocumentNavigation";
import { createLogoutController } from "./logoutCore";

const LOGOUT_TOAST_ID = "logout";

const controller = createLogoutController({
  clearBrowserData: async () => {
    const { clearXChatBrowserData } =
      await import("@/features/agent/lib/xChatBrowserSession");
    await clearXChatBrowserData();
  },
  submitLogout: () => {
    const form = document.createElement("form");
    form.action = "/logout/complete";
    form.method = "post";
    form.hidden = true;
    document.body.append(form);
    try {
      submitDocumentFormIntentionally(form);
    } finally {
      form.remove();
    }
  },
  showPending: () =>
    toast.loading("Logging out…", {
      id: LOGOUT_TOAST_ID,
      action: undefined,
    }),
  dismissPending: () => toast.dismiss(LOGOUT_TOAST_ID),
  showError: () =>
    toast.error("Couldn't log out. Please try again.", {
      id: LOGOUT_TOAST_ID,
      duration: Infinity,
      action: { label: "Try again", onClick: () => void logout() },
    }),
});

export function logout(): Promise<void> {
  // The same listener is registered only once. Reset on pagehide also allows
  // another logout after this document is restored from the back/forward cache.
  window.addEventListener("pagehide", controller.reset);
  return controller.start();
}
