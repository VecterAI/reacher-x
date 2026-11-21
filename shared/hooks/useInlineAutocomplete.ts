"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { usePostHog } from "posthog-js/react";
import { api } from "@/convex/_generated/api";
import {
  INLINE_AUTOCOMPLETE_DEBOUNCE_MS,
  type InlineAutocompleteRequest,
  type InlineAutocompleteResponse,
} from "@/shared/lib/autocomplete/inlineAutocomplete";
import {
  InlineSuggestionController,
  type InlineSuggestionControllerOptions,
  type InlineSuggestionDismissReason,
  type InlineSuggestionSnapshot,
} from "@/shared/lib/autocomplete/inlineSuggestionController";

export type { InlineSuggestionDismissReason };

const SERVER_SNAPSHOT: InlineSuggestionSnapshot = {
  status: "idle",
  ghostText: "",
  suggestionId: 0,
  announcement: "",
};

const getServerSnapshot = () => SERVER_SNAPSHOT;

/**
 * React binding for the shared inline suggestion controller. Surfaces pass
 * the text around the caret; they render `ghostText` and call the accept and
 * dismiss functions from their key handlers.
 *
 * Pass `request: undefined` when the surface reports the caret itself through
 * `updateRequest` (the Lexical plugin does this from its update listener so
 * the ghost follows each keystroke without waiting for a React render).
 */
export function useInlineAutocomplete(args: {
  request?: InlineAutocompleteRequest | null;
  enabled?: boolean;
  debounceMs?: number;
}) {
  const {
    request,
    enabled = true,
    debounceMs = INLINE_AUTOCOMPLETE_DEBOUNCE_MS,
  } = args;
  const autocompleteApi = api as any;
  const globallyEnabled = useQuery(api.autocompleteControl.isEnabled);
  const effectivelyEnabled = enabled && globallyEnabled === true;
  const getInlineSuggestion = useAction(
    autocompleteApi.autocomplete.getInlineSuggestion
  ) as (
    request: InlineAutocompleteRequest
  ) => Promise<InlineAutocompleteResponse>;
  const cancelThreadHelperRequests = useMutation(
    autocompleteApi.autocompleteControl.cancelThreadHelperRequests
  ) as (args: { threadId: string }) => Promise<unknown>;
  const posthog = usePostHog();

  const options: InlineSuggestionControllerOptions = {
    debounceMs,
    fetchSuggestion: getInlineSuggestion,
    cancelRemote: (canceled) => {
      if (canceled.threadId) {
        void cancelThreadHelperRequests({
          threadId: canceled.threadId,
        }).catch(() => {});
      }
    },
    onEvent: (name, properties) => {
      posthog?.capture(name, properties);
    },
  };
  const [controller] = useState(() => new InlineSuggestionController(options));

  // Layout effects: a prefix-extending keystroke trims the ghost before paint.
  // Options first, so a request in this commit uses the current callbacks.
  useLayoutEffect(() => {
    controller.setOptions(options);
  });

  useLayoutEffect(() => {
    controller.setEnabled(effectivelyEnabled);
  }, [controller, effectivelyEnabled]);

  useLayoutEffect(() => {
    if (request !== undefined) {
      controller.update(request);
    }
  }, [controller, request]);

  useEffect(() => () => controller.dispose(), [controller]);

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    getServerSnapshot
  );

  const actions = useMemo(
    () => ({
      /** Imperative caret report, for surfaces that pass `request: undefined`. */
      updateRequest: (next: InlineAutocompleteRequest | null) =>
        controller.update(next),
      /** Live ghost text, readable outside React renders (key handlers). */
      getGhostText: () => {
        const current = controller.getSnapshot();
        return current.status === "showing" ? current.ghostText : "";
      },
      /** Returns the text to insert for Tab, or "" when nothing is shown. */
      acceptSuggestion: () => controller.acceptAll(),
      /** Returns the next word to insert, or "" when nothing is shown. */
      acceptNextWord: () => controller.acceptNextWord(),
      /** A ghost is showing or a request is pending (Escape should cancel). */
      hasPendingSuggestion: () => controller.hasPendingSuggestion(),
      dismissSuggestion: (reason: InlineSuggestionDismissReason) =>
        controller.dismiss(reason),
    }),
    [controller]
  );

  return {
    ...actions,
    /**
     * The global autocomplete switch. Surfaces combine it with their own
     * static settings for `aria-autocomplete`, which describes the
     * capability, not whether a suggestion is showing right now.
     */
    isGloballyEnabled: globallyEnabled === true,
    /** Text to render after the caret; empty when nothing is shown. */
    ghostText: snapshot.status === "showing" ? snapshot.ghostText : "",
    announcement: snapshot.status === "showing" ? snapshot.announcement : "",
    suggestionId: snapshot.suggestionId,
    isLoading: snapshot.status === "requesting",
  };
}
