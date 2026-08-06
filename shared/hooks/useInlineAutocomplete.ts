"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAction, useMutation, useQuery } from "convex/react";
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
  const requestRef = useRef<InlineAutocompleteRequest | null>(request);
  const enabledRef = useRef(effectivelyEnabled);
  const activeRequestIdRef = useRef(0);
  const dismissedSignatureRef = useRef<string | null>(null);
  const inFlightSignatureRef = useRef<string | null>(null);
  const queuedSignatureRef = useRef<string | null>(null);
  const canceledInFlightSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    requestRef.current = request;
    enabledRef.current = effectivelyEnabled;
  }, [effectivelyEnabled, request]);

  useEffect(() => {
    if (request && requestSignature) {
      requestMapRef.current.set(requestSignature, request);
    }
  }, [request, requestSignature]);

  const resolveRequestForSignature = useCallback((signature: string | null) => {
    if (!signature) {
      return requestRef.current;
    }
    return requestMapRef.current.get(signature) ?? requestRef.current;
  }, []);

  const cancelActiveThreadHelperRequests = useCallback(
    (signature?: string | null) => {
      const requestToCancel = resolveRequestForSignature(
        signature ?? inFlightSignatureRef.current ?? state.requestSignature
      );
      const threadId = requestToCancel?.threadId;
      if (!threadId) {
        return;
      }
      void cancelThreadHelperRequests({ threadId }).catch(() => {});
    },
    [
      cancelThreadHelperRequests,
      resolveRequestForSignature,
      state.requestSignature,
    ]
  );

  const clearSuggestion = useCallback(
    (reason: InlineAutocompleteDismissReason) => {
      setIsLoading((current) => (current ? false : current));
      setState((current) => {
        if (!current.suggestion && !current.requestSignature) {
          return current;
        }

        if (current.suggestion && current.requestSignature) {
          const currentRequest = resolveRequestForSignature(
            current.requestSignature
          );
          posthog?.capture("inline_autocomplete_dismissed", {
            reason,
            surface: currentRequest?.surface ?? "composer",
            surfaceLabel: currentRequest?.surfaceLabel,
            platform: currentRequest?.platform ?? "generic",
            suggestionLength: current.suggestion.length,
            workspaceId: current.workspaceId,
            styleProfileCategory: current.styleProfileCategory,
            styleProfileApplied: current.styleProfileApplied,
          });
        }
        return EMPTY_STATE;
      });
    },
    [posthog, resolveRequestForSignature]
  );

  const dismissSuggestionAfterEffect = useCallback(
    (reason: InlineAutocompleteDismissReason) => {
      queueMicrotask(() => {
        clearSuggestion(reason);
      });
    },
    [clearSuggestion]
  );

  const startSuggestionRequest = useCallback(
    (signature: string) => {
      if (!enabledRef.current || !signature) {
        return;
      }

      if (inFlightSignatureRef.current) {
        queuedSignatureRef.current = signature;
        return;
      }

      const nextRequest = requestMapRef.current.get(signature);
      if (!shouldRequestInlineAutocomplete(nextRequest)) {
        return;
      }

      const requestId = activeRequestIdRef.current + 1;
      activeRequestIdRef.current = requestId;
      inFlightSignatureRef.current = signature;
      canceledInFlightSignatureRef.current = null;
      queueMicrotask(() => {
        setIsLoading(true);
      });

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
              requestSignature: signature,
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
        .catch(() => {
          if (activeRequestIdRef.current !== requestId) {
            return;
          }
          startTransition(() => {
            setState(EMPTY_STATE);
            setIsLoading(false);
          });
        })
        .finally(() => {
          if (inFlightSignatureRef.current === signature) {
            inFlightSignatureRef.current = null;
          }
          canceledInFlightSignatureRef.current = null;

          const queuedSignature = queuedSignatureRef.current;
          queuedSignatureRef.current = null;
          if (
            queuedSignature &&
            queuedSignature !== signature &&
            enabledRef.current
          ) {
            queueMicrotask(() => {
              startSuggestionRequest(queuedSignature);
            });
          }
        });
    },
    [getInlineSuggestion, posthog]
  );

  useEffect(() => {
    if (!effectivelyEnabled || !shouldRequestInlineAutocomplete(request)) {
      activeRequestIdRef.current += 1;
      queuedSignatureRef.current = null;
      if (
        inFlightSignatureRef.current &&
        canceledInFlightSignatureRef.current !== inFlightSignatureRef.current
      ) {
        canceledInFlightSignatureRef.current = inFlightSignatureRef.current;
        cancelActiveThreadHelperRequests(inFlightSignatureRef.current);
      }
      if (isLoading || state.suggestion || state.requestSignature) {
        dismissSuggestionAfterEffect("disabled");
      }
      return;
    }
  }, [
    cancelActiveThreadHelperRequests,
    dismissSuggestionAfterEffect,
    effectivelyEnabled,
    isLoading,
    request,
    state.requestSignature,
    state.suggestion,
  ]);

  useEffect(() => {
    if (
      !requestSignature ||
      !inFlightSignatureRef.current ||
      requestSignature === inFlightSignatureRef.current
    ) {
      return;
    }

    queuedSignatureRef.current = requestSignature;
    activeRequestIdRef.current += 1;
    if (canceledInFlightSignatureRef.current !== inFlightSignatureRef.current) {
      canceledInFlightSignatureRef.current = inFlightSignatureRef.current;
      cancelActiveThreadHelperRequests(inFlightSignatureRef.current);
    }
  }, [cancelActiveThreadHelperRequests, requestSignature]);

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
    dismissSuggestionAfterEffect("input_changed");
  }, [
    dismissSuggestionAfterEffect,
    requestSignature,
    state.requestSignature,
    state.suggestion,
  ]);

  useEffect(() => {
    if (!effectivelyEnabled || !debouncedRequestSignature) {
      return;
    }

    if (dismissedSignatureRef.current === debouncedRequestSignature) {
      return;
    }

    const nextRequest = requestMapRef.current.get(debouncedRequestSignature);
    if (!shouldRequestInlineAutocomplete(nextRequest)) {
      return;
    }

    startSuggestionRequest(debouncedRequestSignature);
  }, [debouncedRequestSignature, effectivelyEnabled, startSuggestionRequest]);

  const dismissSuggestion = useCallback(
    (reason: InlineAutocompleteDismissReason) => {
      if (state.requestSignature) {
        dismissedSignatureRef.current = state.requestSignature;
      }
      if (
        inFlightSignatureRef.current &&
        canceledInFlightSignatureRef.current !== inFlightSignatureRef.current
      ) {
        canceledInFlightSignatureRef.current = inFlightSignatureRef.current;
        cancelActiveThreadHelperRequests(inFlightSignatureRef.current);
      }
      clearSuggestion(reason);
    },
    [cancelActiveThreadHelperRequests, clearSuggestion, state.requestSignature]
  );

  const recordAccepted = useCallback(() => {
    if (!state.suggestion) {
      return;
    }

    const currentRequest = resolveRequestForSignature(state.requestSignature);
    posthog?.capture("inline_autocomplete_accepted", {
      surface: currentRequest?.surface ?? "composer",
      surfaceLabel: currentRequest?.surfaceLabel,
      platform: currentRequest?.platform ?? "generic",
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
  }, [posthog, resolveRequestForSignature, state]);

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
