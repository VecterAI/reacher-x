import {
  buildInlineAutocompleteRequestSignature,
  getInlineAutocompleteInsertionText,
  INLINE_AUTOCOMPLETE_DEBOUNCE_MS,
  normalizeInlineAutocompleteWhitespace,
  shouldRequestInlineAutocomplete,
  type InlineAutocompleteRequest,
  type InlineAutocompleteResponse,
} from "@/shared/lib/autocomplete/inlineAutocomplete";

/**
 * One inline-suggestion state machine shared by every surface
 * (Lexical composer, textarea prompt input).
 *
 *   idle -> requesting -> showing -> (accepted | dismissed) -> idle
 *
 * Surfaces only report the text around the caret (`update`) and keyboard
 * intents (`acceptAll`, `acceptNextWord`, `dismiss`). Rendering the ghost
 * text is left to each surface.
 */

export type InlineSuggestionDismissReason =
  /** The text changed in a way that no longer extends the suggestion. */
  | "input_changed"
  /** The caret moved while the text stayed the same. */
  | "selection_changed"
  | "escape"
  | "blur"
  /** The surface or the feature was switched off (IME, read-only, flag). */
  | "disabled";

export type InlineSuggestionEventName =
  | "inline_autocomplete_shown"
  | "inline_autocomplete_accepted"
  | "inline_autocomplete_partial_accept"
  | "inline_autocomplete_dismissed";

export type InlineSuggestionStatus = "idle" | "requesting" | "showing";

export type InlineSuggestionSnapshot = {
  status: InlineSuggestionStatus;
  /** Ghost text to render right after the caret (may start with a space). */
  ghostText: string;
  /** Increments each time a new suggestion (not a trimmed one) is shown. */
  suggestionId: number;
  /** Screen reader text for the current suggestion, stable while it shrinks. */
  announcement: string;
};

export type InlineSuggestionControllerOptions = {
  fetchSuggestion: (
    request: InlineAutocompleteRequest
  ) => Promise<InlineAutocompleteResponse>;
  /**
   * Server-side cancel for requests tied to a persisted thread helper.
   * Called only on an explicit dismiss (Escape, blur) or teardown while a
   * request is in flight, never per keystroke.
   */
  cancelRemote?: (request: InlineAutocompleteRequest) => void;
  onEvent?: (
    name: InlineSuggestionEventName,
    properties: Record<string, unknown>
  ) => void;
  debounceMs?: number;
  cacheSize?: number;
};

type ActiveSuggestion = {
  /** Full insertion text measured from `anchorBeforeCursor`. */
  insertion: string;
  anchorBeforeCursor: string;
  contextKey: string;
  request: InlineAutocompleteRequest;
  response: InlineAutocompleteResponse;
  /** Characters of `insertion` already present in the text. */
  consumed: number;
  shownEventSent: boolean;
};

type InFlight = {
  id: number;
  signature: string;
  request: InlineAutocompleteRequest;
};

type CurrentInput = {
  request: InlineAutocompleteRequest;
  beforeCursor: string;
  fullText: string;
  contextKey: string;
  signature: string;
};

export const INLINE_SUGGESTION_CACHE_SIZE = 32;

const IDLE_SNAPSHOT: InlineSuggestionSnapshot = {
  status: "idle",
  ghostText: "",
  suggestionId: 0,
  announcement: "",
};

const REQUESTING_SNAPSHOT: InlineSuggestionSnapshot = {
  ...IDLE_SNAPSHOT,
  status: "requesting",
};

/** Text accepted by one word-by-word step: leading spaces plus one word. */
export function getNextInlineSuggestionWord(ghostText: string): string {
  const match = /^\s*\S+/.exec(ghostText);
  return match ? match[0] : ghostText;
}

/**
 * Remaining ghost text when `beforeCursor` extends the text the suggestion
 * was made for, or `null` when the new text diverges from it.
 */
export function getInlineSuggestionRemainder(args: {
  insertion: string;
  anchorBeforeCursor: string;
  beforeCursor: string;
}): string | null {
  const { insertion, anchorBeforeCursor, beforeCursor } = args;
  if (!beforeCursor.startsWith(anchorBeforeCursor)) {
    return null;
  }
  const typed = beforeCursor.slice(anchorBeforeCursor.length);
  if (!insertion.startsWith(typed)) {
    return null;
  }
  return insertion.slice(typed.length);
}

export function buildInlineSuggestionAnnouncement(ghostText: string) {
  const text = ghostText.trim();
  return text ? `Suggestion: ${text}. Press Tab to accept.` : "";
}

function getContextKey(request: InlineAutocompleteRequest) {
  return buildInlineAutocompleteRequestSignature({
    ...request,
    beforeCursor: "",
  });
}

function getSurfaceProperties(request: InlineAutocompleteRequest) {
  return {
    surface: request.surface ?? "composer",
    surfaceLabel: request.surfaceLabel,
    platform: request.platform ?? "generic",
  };
}

export class InlineSuggestionController {
  private options: InlineSuggestionControllerOptions;
  private snapshot: InlineSuggestionSnapshot = IDLE_SNAPSHOT;
  private listeners = new Set<() => void>();
  private enabled = true;
  private current: CurrentInput | null = null;
  private active: ActiveSuggestion | null = null;
  private inFlight: InFlight | null = null;
  private needsRequestAfterInFlight = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private nextRequestId = 0;
  private suggestionCount = 0;
  /** Text the user dismissed with Escape or blur; no re-request until it changes. */
  private suppressed: { signature: string; fullText: string } | null = null;
  /**
   * Thread-helper requests still running on the server, by request id. Kept
   * apart from `inFlight` so a request whose answer will be ignored (after
   * disable) can still be canceled on blur or teardown.
   */
  private remoteOutstanding = new Map<number, InlineAutocompleteRequest>();
  private cache = new Map<string, InlineAutocompleteResponse>();
  private lastEmitted: InlineSuggestionSnapshot | null = null;

  constructor(options: InlineSuggestionControllerOptions) {
    this.options = options;
  }

  /** Swap callbacks without resetting state (React re-renders). */
  setOptions(options: InlineSuggestionControllerOptions) {
    this.options = options;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  /** A ghost is showing, a request is running, or one is about to start. */
  hasPendingSuggestion() {
    return this.snapshot.status !== "idle" || this.debounceTimer !== null;
  }

  /** Number of cached responses (for tests and diagnostics). */
  getCacheSize() {
    return this.cache.size;
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    if (!enabled) {
      this.clearDebounce();
      this.dropInFlight();
      this.clearActive("disabled");
      this.emit();
      return;
    }
    if (this.current) {
      const request = this.current.request;
      this.current = null;
      this.update(request);
    }
  }

  /**
   * Report the text around the caret. Pass `null` when the caret is not in a
   * place that can show a suggestion (selection, no focus).
   */
  update(request: InlineAutocompleteRequest | null) {
    if (!this.enabled) {
      this.current = request ? this.toCurrentInput(request) : null;
      return;
    }

    const previous = this.current;
    const next = request ? this.toCurrentInput(request) : null;
    this.current = next;

    if (previous && next && previous.signature === next.signature) {
      return;
    }

    // A dismissal holds only while the text is the same; caret moves keep it.
    if (next && this.suppressed && this.suppressed.fullText !== next.fullText) {
      this.suppressed = null;
    }

    if (this.active) {
      const remainder = next ? this.getActiveRemainder(next) : null;
      if (remainder) {
        this.active.consumed = this.active.insertion.length - remainder.length;
        this.showActive();
        return;
      }
      if (remainder === "") {
        // The user typed the whole suggestion: nothing left to show.
        this.active = null;
      } else {
        const textUnchanged =
          !next || (previous !== null && previous.fullText === next.fullText);
        this.clearActive(textUnchanged ? "selection_changed" : "input_changed");
      }
    }

    this.clearDebounce();
    this.resetStatus();

    if (!next || !shouldRequestInlineAutocomplete(next.request)) {
      this.needsRequestAfterInFlight = false;
      this.emit();
      return;
    }

    if (this.suppressed?.signature === next.signature) {
      this.emit();
      return;
    }

    const cached = this.cache.get(next.signature);
    if (cached) {
      this.touchCache(next.signature, cached);
      // The cache satisfies this text: drop any request queued for older text.
      this.needsRequestAfterInFlight = false;
      this.activate(next, cached);
      return;
    }

    this.emit();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.startRequest();
    }, this.options.debounceMs ?? INLINE_AUTOCOMPLETE_DEBOUNCE_MS);
  }

  /** Tab: returns the full text to insert, or "" when nothing is shown. */
  acceptAll(): string {
    const active = this.active;
    if (!active || this.snapshot.status !== "showing") {
      return "";
    }
    const text = active.insertion.slice(active.consumed);
    if (!text) {
      return "";
    }
    this.sendEvent("inline_autocomplete_accepted", active, {
      acceptedLength: text.length,
      latencyMs: active.response.latencyMs,
      model: active.response.model,
    });
    this.active = null;
    this.suppressed = null;
    this.setIdle();
    this.emit();
    return text;
  }

  /**
   * Ctrl/Cmd+Right: returns the next word to insert. The surface inserts it,
   * then the following `update` trims the ghost through prefix reuse.
   */
  acceptNextWord(): string {
    const active = this.active;
    if (!active || this.snapshot.status !== "showing") {
      return "";
    }
    const remaining = active.insertion.slice(active.consumed);
    const word = getNextInlineSuggestionWord(remaining);
    if (!word) {
      return "";
    }
    if (word.length >= remaining.length) {
      return this.acceptAll();
    }
    this.sendEvent("inline_autocomplete_partial_accept", active, {
      acceptedLength: word.length,
      remainingLength: remaining.length - word.length,
      latencyMs: active.response.latencyMs,
      model: active.response.model,
    });
    return word;
  }

  dismiss(reason: InlineSuggestionDismissReason) {
    this.clearDebounce();
    if (this.current) {
      this.suppressed = {
        signature: this.current.signature,
        fullText: this.current.fullText,
      };
    }
    if (reason === "escape" || reason === "blur") {
      this.cancelInFlightRemotely();
    }
    this.dropInFlight();
    this.clearActive(reason);
    this.emit();
  }

  /** Teardown on unmount. The controller stays usable (React strict mode). */
  dispose() {
    this.clearDebounce();
    this.cancelInFlightRemotely();
    this.dropInFlight();
    this.active = null;
    this.current = null;
    this.setIdle();
  }

  private toCurrentInput(request: InlineAutocompleteRequest): CurrentInput {
    const beforeCursor = normalizeInlineAutocompleteWhitespace(
      request.beforeCursor
    );
    const afterCursor = normalizeInlineAutocompleteWhitespace(
      request.afterCursor ?? ""
    );
    return {
      request,
      beforeCursor,
      fullText: `${beforeCursor}${afterCursor}`,
      contextKey: getContextKey(request),
      signature: buildInlineAutocompleteRequestSignature(request),
    };
  }

  private getActiveRemainder(next: CurrentInput): string | null {
    const active = this.active;
    if (!active || active.contextKey !== next.contextKey) {
      return null;
    }
    return getInlineSuggestionRemainder({
      insertion: active.insertion,
      anchorBeforeCursor: active.anchorBeforeCursor,
      beforeCursor: next.beforeCursor,
    });
  }

  private startRequest() {
    const current = this.current;
    if (!this.enabled || !current) {
      return;
    }
    if (!shouldRequestInlineAutocomplete(current.request) || this.active) {
      return;
    }
    if (this.inFlight) {
      // One request at a time; ask again for the latest text when it ends.
      this.needsRequestAfterInFlight = true;
      return;
    }

    const inFlight: InFlight = {
      id: ++this.nextRequestId,
      signature: current.signature,
      request: current.request,
    };
    this.inFlight = inFlight;
    if (current.request.threadId) {
      this.remoteOutstanding.set(inFlight.id, current.request);
    }
    this.needsRequestAfterInFlight = false;
    this.snapshot = REQUESTING_SNAPSHOT;
    this.emit();

    let response: InlineAutocompleteResponse | null = null;
    this.options
      .fetchSuggestion(current.request)
      .then((result) => {
        response = result;
      })
      .catch(() => {
        response = null;
      })
      .finally(() => {
        this.remoteOutstanding.delete(inFlight.id);
        if (this.inFlight?.id !== inFlight.id) {
          return;
        }
        this.inFlight = null;
        if (response) {
          this.storeInCache(inFlight.signature, response);
          if (this.tryApplyResponse(inFlight, response)) {
            return;
          }
        }
        if (this.needsRequestAfterInFlight && !this.debounceTimer) {
          this.needsRequestAfterInFlight = false;
          this.startRequest();
          return;
        }
        if (!this.active) {
          this.setIdle();
          this.emit();
        }
      });
  }

  /**
   * Show `response` (made for `inFlight.request`) if the current text still
   * matches it, either exactly or as a prefix extension.
   */
  private tryApplyResponse(
    inFlight: InFlight,
    response: InlineAutocompleteResponse | null
  ): boolean {
    if (!response) {
      return false;
    }
    const current = this.current;
    if (!current || !this.enabled || this.active) {
      return false;
    }
    const origin = this.toCurrentInput(inFlight.request);
    if (origin.contextKey !== current.contextKey) {
      return false;
    }
    const insertion = getInlineAutocompleteInsertionText({
      beforeCursor: origin.beforeCursor,
      suggestion: response.suggestion,
    });
    if (!insertion) {
      return false;
    }
    const remainder = getInlineSuggestionRemainder({
      insertion,
      anchorBeforeCursor: origin.beforeCursor,
      beforeCursor: current.beforeCursor,
    });
    if (!remainder) {
      return false;
    }
    this.clearDebounce();
    this.needsRequestAfterInFlight = false;
    this.activate(origin, response, insertion.length - remainder.length);
    return true;
  }

  private activate(
    origin: CurrentInput,
    response: InlineAutocompleteResponse,
    consumed = 0
  ) {
    const insertion = getInlineAutocompleteInsertionText({
      beforeCursor: origin.beforeCursor,
      suggestion: response.suggestion,
    });
    if (!insertion || consumed >= insertion.length) {
      this.setIdle();
      this.emit();
      return;
    }
    this.active = {
      insertion,
      anchorBeforeCursor: origin.beforeCursor,
      contextKey: origin.contextKey,
      request: origin.request,
      response,
      consumed,
      shownEventSent: false,
    };
    this.suggestionCount += 1;
    this.showActive();
  }

  private showActive() {
    const active = this.active;
    if (!active) {
      return;
    }
    const ghostText = active.insertion.slice(active.consumed);
    const isNew = !active.shownEventSent;
    this.snapshot = {
      status: "showing",
      ghostText,
      suggestionId: this.suggestionCount,
      announcement: isNew
        ? buildInlineSuggestionAnnouncement(ghostText)
        : this.snapshot.announcement,
    };
    if (isNew) {
      active.shownEventSent = true;
      this.sendEvent("inline_autocomplete_shown", active, {
        latencyMs: active.response.latencyMs,
        model: active.response.model,
      });
    }
    this.emit();
  }

  private clearActive(reason: InlineSuggestionDismissReason) {
    const active = this.active;
    this.active = null;
    if (active && this.snapshot.status === "showing") {
      this.sendEvent("inline_autocomplete_dismissed", active, { reason });
    }
    this.resetStatus();
  }

  private sendEvent(
    name: InlineSuggestionEventName,
    active: ActiveSuggestion,
    extra: Record<string, unknown>
  ) {
    this.options.onEvent?.(name, {
      ...getSurfaceProperties(active.request),
      suggestionLength: active.response.suggestion.trimEnd().length,
      workspaceId: active.response.workspaceId,
      styleProfileCategory: active.response.styleProfileCategory,
      styleProfileApplied: active.response.styleProfileApplied,
      ...extra,
    });
  }

  private cancelInFlightRemotely() {
    const canceledThreads = new Set<string>();
    for (const request of this.remoteOutstanding.values()) {
      // The server cancel is per thread; one call covers all its requests.
      if (request.threadId && !canceledThreads.has(request.threadId)) {
        canceledThreads.add(request.threadId);
        this.options.cancelRemote?.(request);
      }
    }
    this.remoteOutstanding.clear();
  }

  private dropInFlight() {
    this.inFlight = null;
    this.needsRequestAfterInFlight = false;
  }

  private clearDebounce() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private storeInCache(
    signature: string,
    response: InlineAutocompleteResponse
  ) {
    if (!response.suggestion.trim()) {
      return;
    }
    this.touchCache(signature, response);
    const limit = this.options.cacheSize ?? INLINE_SUGGESTION_CACHE_SIZE;
    while (this.cache.size > limit) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.cache.delete(oldest);
    }
  }

  private touchCache(signature: string, response: InlineAutocompleteResponse) {
    this.cache.delete(signature);
    this.cache.set(signature, response);
  }

  /** Not showing anything: "requesting" while a request runs, else idle. */
  private resetStatus() {
    this.snapshot = this.inFlight ? REQUESTING_SNAPSHOT : IDLE_SNAPSHOT;
  }

  private setIdle() {
    this.snapshot = IDLE_SNAPSHOT;
  }

  private emit() {
    if (this.lastEmitted === this.snapshot) {
      return;
    }
    this.lastEmitted = this.snapshot;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
