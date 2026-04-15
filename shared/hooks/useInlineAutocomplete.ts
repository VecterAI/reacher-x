"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAction } from "convex/react";
import { usePostHog } from "posthog-js/react";
import { api } from "@/convex/_generated/api";
import {
  buildInlineAutocompleteRequestSignature,
  INLINE_AUTOCOMPLETE_DEBOUNCE_MS,
  type InlineAutocompleteRequest,
  type InlineAutocompleteResponse,
  shouldRequestInlineAutocomplete,
} from "@/shared/lib/autocomplete/inlineAutocomplete";
import { useDebouncedValue } from "@/shared/lib/utils/useDebouncedValue";

type InlineAutocompleteDismissReason =
  | "input_changed"
  | "escape"
  | "blur"
  | "selection_changed"
  | "disabled"
  | "manual";

type InlineAutocompleteState = {
  suggestion: string;
  latencyMs: number | null;
  model: string | null;
  workspaceId?: string;
  styleProfileCategory?: string;
  styleProfileApplied: boolean;
  requestSignature: string | null;
};

const EMPTY_STATE: InlineAutocompleteState = {
  suggestion: "",
  latencyMs: null,
  model: null,
  workspaceId: undefined,
  styleProfileCategory: undefined,
  styleProfileApplied: false,
  requestSignature: null,
};

export function useInlineAutocomplete(args: {
  request: InlineAutocompleteRequest | null;
  enabled?: boolean;
  debounceMs?: number;
}) {
  const {
    request,
    enabled = true,
    debounceMs = INLINE_AUTOCOMPLETE_DEBOUNCE_MS,
  } = args;
  const autocompleteApi = api as any;
  const getInlineSuggestion = useAction(
    autocompleteApi.autocomplete.getInlineSuggestion
  ) as (
    request: InlineAutocompleteRequest
  ) => Promise<InlineAutocompleteResponse>;
  const posthog = usePostHog();
  const [state, setState] = useState<InlineAutocompleteState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const requestSignature = useMemo(
    () => buildInlineAutocompleteRequestSignature(request),
    [request]
  );
  const debouncedRequestSignature = useDebouncedValue(
    requestSignature,
    debounceMs
  );
  const requestMapRef = useRef(new Map<string, InlineAutocompleteRequest>());
  const activeRequestIdRef = useRef(0);
  const dismissedSignatureRef = useRef<string | null>(null);

  if (request && requestSignature) {
    requestMapRef.current.set(requestSignature, request);
  }

  const clearSuggestion = useCallback(
    (reason: InlineAutocompleteDismissReason) => {
      setIsLoading(false);
      setState((current) => {
        if (current.suggestion && current.requestSignature) {
          posthog?.capture("inline_autocomplete_dismissed", {
            reason,
            surface: request?.surface ?? "composer",
            surfaceLabel: request?.surfaceLabel,
            platform: request?.platform ?? "generic",
            suggestionLength: current.suggestion.length,
            workspaceId: current.workspaceId,
            styleProfileCategory: current.styleProfileCategory,
            styleProfileApplied: current.styleProfileApplied,
          });
        }
        return EMPTY_STATE;
      });
    },
    [posthog, request]
  );

  useEffect(() => {
    if (!enabled || !shouldRequestInlineAutocomplete(request)) {
      activeRequestIdRef.current += 1;
      clearSuggestion("disabled");
      return;
    }
  }, [clearSuggestion, enabled, request]);

  useEffect(() => {
    if (
      !state.suggestion ||
      !state.requestSignature ||
      !requestSignature ||
      state.requestSignature === requestSignature
    ) {
      return;
    }

    activeRequestIdRef.current += 1;
    clearSuggestion("input_changed");
  }, [clearSuggestion, requestSignature, state.requestSignature, state.suggestion]);

  useEffect(() => {
    if (!enabled || !debouncedRequestSignature) {
      return;
    }

    if (dismissedSignatureRef.current === debouncedRequestSignature) {
      return;
    }

    const nextRequest = requestMapRef.current.get(debouncedRequestSignature);
    if (!shouldRequestInlineAutocomplete(nextRequest)) {
      return;
    }

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    setIsLoading(true);

    void getInlineSuggestion(nextRequest)
      .then((result) => {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        const suggestion = result.suggestion.trimEnd();
        if (!suggestion) {
          startTransition(() => {
            setState(EMPTY_STATE);
            setIsLoading(false);
          });
          return;
        }

        startTransition(() => {
          setState({
            suggestion,
            latencyMs: result.latencyMs,
            model: result.model,
            workspaceId: result.workspaceId,
            styleProfileCategory: result.styleProfileCategory,
            styleProfileApplied: result.styleProfileApplied,
            requestSignature: debouncedRequestSignature,
          });
          setIsLoading(false);
        });

        posthog?.capture("inline_autocomplete_shown", {
          surface: nextRequest.surface ?? "composer",
          surfaceLabel: nextRequest.surfaceLabel,
          platform: nextRequest.platform ?? "generic",
          suggestionLength: suggestion.length,
          latencyMs: result.latencyMs,
          model: result.model,
          workspaceId: result.workspaceId,
          styleProfileCategory: result.styleProfileCategory,
          styleProfileApplied: result.styleProfileApplied,
        });
      })
      .catch((error: unknown) => {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        console.warn("[InlineAutocomplete] Failed to fetch suggestion:", error);
        startTransition(() => {
          setState(EMPTY_STATE);
          setIsLoading(false);
        });
      });
  }, [debouncedRequestSignature, enabled, getInlineSuggestion, posthog]);

  const dismissSuggestion = useCallback(
    (reason: InlineAutocompleteDismissReason) => {
      if (state.requestSignature) {
        dismissedSignatureRef.current = state.requestSignature;
      }
      clearSuggestion(reason);
    },
    [clearSuggestion, state.requestSignature]
  );

  const recordAccepted = useCallback(() => {
    if (!state.suggestion) {
      return;
    }

    posthog?.capture("inline_autocomplete_accepted", {
      surface: request?.surface ?? "composer",
      surfaceLabel: request?.surfaceLabel,
      platform: request?.platform ?? "generic",
      suggestionLength: state.suggestion.length,
      latencyMs: state.latencyMs,
      model: state.model,
      workspaceId: state.workspaceId,
      styleProfileCategory: state.styleProfileCategory,
      styleProfileApplied: state.styleProfileApplied,
    });

    dismissedSignatureRef.current = null;
    setState(EMPTY_STATE);
    setIsLoading(false);
  }, [posthog, request, state]);

  return {
    suggestion: state.suggestion,
    latencyMs: state.latencyMs,
    model: state.model,
    workspaceId: state.workspaceId,
    styleProfileCategory: state.styleProfileCategory,
    styleProfileApplied: state.styleProfileApplied,
    isLoading,
    dismissSuggestion,
    recordAccepted,
  };
}
