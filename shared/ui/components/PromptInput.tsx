"use client";

import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import { Textarea } from "@/shared/ui/components/TextArea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";
import { cn } from "@/shared/lib/utils";
import { getTextareaCaretCoordinates } from "@/shared/lib/autocomplete/getTextareaCaretCoordinates";
import type { InlineAutocompleteContext } from "@/shared/lib/autocomplete/inlineAutocomplete";
import { isInlineSuggestionWordAcceptKey } from "@/shared/lib/autocomplete/inlineSuggestionKeys";
import {
  buildTextareaGhostMirrorStyle,
  isSameTextareaGhostMirrorStyle,
} from "@/shared/lib/autocomplete/textareaGhostMirror";
import { useInlineAutocomplete } from "@/shared/hooks/useInlineAutocomplete";
import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";
import { MentionEntityMenu } from "@/shared/ui/components/mentions/MentionEntityMenu";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type PromptInputContextType = {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
  textareaRef: React.createRef<HTMLTextAreaElement>(),
});

function usePromptInput() {
  return useContext(PromptInputContext);
}

export function insertTextareaTextWithUndo(args: {
  textarea: HTMLTextAreaElement;
  text: string;
  selectionStart: number;
  selectionEnd: number;
}) {
  const { textarea, text, selectionStart, selectionEnd } = args;
  const nextSelection = selectionStart + text.length;
  const view = textarea.ownerDocument.defaultView;
  let insertedWithNativeUndo = false;

  textarea.focus();
  textarea.setSelectionRange(selectionStart, selectionEnd);

  if (typeof textarea.ownerDocument.execCommand === "function") {
    try {
      insertedWithNativeUndo = textarea.ownerDocument.execCommand(
        "insertText",
        false,
        text
      );
    } catch {
      insertedWithNativeUndo = false;
    }
  }

  if (!insertedWithNativeUndo) {
    textarea.setRangeText(text, selectionStart, selectionEnd, "end");

    const inputEvent = view?.InputEvent
      ? new view.InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: text,
        })
      : new Event("input", { bubbles: true });

    textarea.dispatchEvent(inputEvent);
  }

  const normalizedSelection = (() => {
    const expectedSelection = nextSelection;
    const actualSelectionStart = textarea.selectionStart ?? expectedSelection;
    const actualSelectionEnd = textarea.selectionEnd ?? expectedSelection;
    const insertedText = textarea.value.slice(
      selectionStart,
      expectedSelection
    );

    if (
      actualSelectionStart === actualSelectionEnd &&
      actualSelectionStart < expectedSelection &&
      insertedText === text
    ) {
      textarea.setSelectionRange(expectedSelection, expectedSelection);
      return expectedSelection;
    }

    return actualSelectionStart;
  })();

  return {
    value: textarea.value,
    selectionStart: normalizedSelection,
    selectionEnd: textarea.selectionEnd ?? normalizedSelection,
  };
}

const PROMPT_INPUT_MENTION_REGEX = /(^|\s|\()@([^\s@()]*)$/;

function getPromptInputMentionMatch(args: {
  beforeCursor: string;
  selectionCollapsed: boolean;
}) {
  if (!args.selectionCollapsed) {
    return null;
  }

  const match = PROMPT_INPUT_MENTION_REGEX.exec(args.beforeCursor);
  if (!match) {
    return null;
  }

  return {
    query: match[2] ?? "",
    replaceStart: match.index + match[1].length,
    replaceEnd: args.beforeCursor.length,
  };
}

export type PromptInputProps = {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
} & React.ComponentProps<"div">;

function PromptInput({
  className,
  isLoading = false,
  maxHeight = 240,
  value,
  onValueChange,
  onSubmit,
  children,
  disabled = false,
  onClick,
  ...props
}: PromptInputProps) {
  const [internalValue, setInternalValue] = useState(value || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentValue = value ?? internalValue;

  const handleChange = useCallback(
    (newValue: string) => {
      setInternalValue((current) =>
        current === newValue ? current : newValue
      );
      onValueChange?.(newValue);
    },
    [onValueChange]
  );

  const handleClick: React.MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (!disabled) textareaRef.current?.focus();
      onClick?.(e);
    },
    [disabled, onClick]
  );

  const contextValue = useMemo(
    () => ({
      isLoading,
      value: currentValue,
      setValue: onValueChange ?? handleChange,
      maxHeight,
      onSubmit,
      disabled,
      textareaRef,
    }),
    [
      currentValue,
      disabled,
      handleChange,
      isLoading,
      maxHeight,
      onSubmit,
      onValueChange,
    ]
  );

  return (
    <TooltipProvider>
      <PromptInputContext.Provider value={contextValue}>
        <div
          onClick={handleClick}
          className={cn(
            "border-input bg-background ring-offset-background focus-within:ring-ring cursor-text rounded-xl border p-2 transition-shadow focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-hidden",
            disabled && "cursor-not-allowed opacity-60",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </PromptInputContext.Provider>
    </TooltipProvider>
  );
}

export type PromptInputTextareaProps = {
  disableAutosize?: boolean;
  textareaElementRef?: React.Ref<HTMLTextAreaElement>;
  inlineAutocompleteContext?: InlineAutocompleteContext;
  mentionAutocomplete?: {
    enabled?: boolean;
    items: MentionEntitySearchResult[];
    loading?: boolean;
    onQueryChange: (query: string | null) => void;
    onSelectItem?: (item: MentionEntitySearchResult) => void;
    getReplacementText?: (
      item: MentionEntitySearchResult,
      context: {
        currentValue: string;
        replaceStart: number;
        replaceEnd: number;
      }
    ) => string;
  };
} & React.ComponentProps<typeof Textarea>;

function PromptInputTextarea({
  className,
  onKeyDown,
  disableAutosize = false,
  textareaElementRef,
  inlineAutocompleteContext,
  mentionAutocomplete,
  ...props
}: PromptInputTextareaProps) {
  const { value, setValue, maxHeight, onSubmit, disabled, textareaRef } =
    usePromptInput();
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const mentionListboxId = useId();
  const pendingAutocompleteValueRef = useRef<string | null>(null);
  const suppressMentionAutocompleteRef = useRef(false);
  const mentionCloseSuppressionTimeoutRef = useRef<number | null>(null);
  const ghostMirrorRef = useRef<HTMLDivElement | null>(null);
  const [ghostMirrorStyle, setGhostMirrorStyle] =
    useState<React.CSSProperties | null>(null);
  const hasTextareaFocus =
    isFocused ||
    (typeof document !== "undefined" &&
      textareaRef.current === document.activeElement);
  const activeMentionMatch = useMemo(() => {
    if (
      !mentionAutocomplete ||
      mentionAutocomplete.enabled === false ||
      disabled ||
      isComposing ||
      suppressMentionAutocompleteRef.current ||
      !hasTextareaFocus
    ) {
      return null;
    }

    return getPromptInputMentionMatch({
      beforeCursor: value.slice(0, selectionStart),
      selectionCollapsed: selectionStart === selectionEnd,
    });
  }, [
    disabled,
    isComposing,
    hasTextareaFocus,
    mentionAutocomplete,
    selectionEnd,
    selectionStart,
    value,
  ]);
  const autocompleteEnabled =
    Boolean(inlineAutocompleteContext) &&
    !disabled &&
    !props.readOnly &&
    !isComposing &&
    hasTextareaFocus &&
    inlineAutocompleteContext?.enabled !== false &&
    activeMentionMatch === null;
  const request = useMemo(
    () =>
      autocompleteEnabled &&
      inlineAutocompleteContext &&
      selectionStart === selectionEnd
        ? {
            ...inlineAutocompleteContext,
            surface: "prompt_input" as const,
            beforeCursor: value.slice(0, selectionStart),
            afterCursor: value.slice(selectionStart),
          }
        : null,
    [
      autocompleteEnabled,
      inlineAutocompleteContext,
      selectionEnd,
      selectionStart,
      value,
    ]
  );
  const {
    ghostText,
    announcement,
    acceptSuggestion: takeSuggestion,
    acceptNextWord: takeNextSuggestionWord,
    dismissSuggestion,
    hasPendingSuggestion,
    isGloballyEnabled,
  } = useInlineAutocomplete({
    request,
    enabled: autocompleteEnabled,
  });
  // `aria-autocomplete` states the capability, not whether a ghost shows.
  const supportsInlineAutocomplete =
    Boolean(inlineAutocompleteContext) &&
    inlineAutocompleteContext?.enabled !== false &&
    !disabled &&
    !props.readOnly &&
    isGloballyEnabled;
  const showGhost =
    Boolean(ghostText) && hasTextareaFocus && selectionStart === selectionEnd;
  const mentionMenuOpen =
    Boolean(activeMentionMatch && mentionAutocomplete) &&
    hasTextareaFocus &&
    !isComposing;
  const mentionMenuWidth = useMemo(() => {
    const el = textareaRef.current;

    if (!el || !mentionMenuOpen || !activeMentionMatch) {
      return 280;
    }

    const caret = getTextareaCaretCoordinates(el, selectionStart);
    const computed = window.getComputedStyle(el);
    const paddingRight = Number.parseFloat(computed.paddingRight) || 0;

    return Math.min(
      360,
      Math.max(240, el.clientWidth - caret.left - paddingRight)
    );
  }, [activeMentionMatch, mentionMenuOpen, selectionStart, textareaRef]);
  const mentionPositionReference = useMemo(() => {
    const el = textareaRef.current;

    if (!el || !mentionMenuOpen || !activeMentionMatch) {
      return null;
    }

    return {
      contextElement: el,
      getBoundingClientRect() {
        const caret = getTextareaCaretCoordinates(el, selectionStart);
        const rect = el.getBoundingClientRect();
        const x = rect.left + caret.left;
        const y = rect.top + caret.top + caret.lineHeight;

        return {
          width: 0,
          height: 0,
          x,
          y,
          top: y,
          left: x,
          right: x,
          bottom: y,
        };
      },
    };
  }, [activeMentionMatch, mentionMenuOpen, selectionStart, textareaRef]);
  const {
    refs: mentionMenuFloatingRefs,
    floatingStyles: mentionMenuFloatingStyles,
    update: updateMentionMenuPosition,
  } = useFloating({
    open: mentionMenuOpen,
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [
      offset(8),
      flip({
        padding: 12,
        fallbackPlacements: ["top-start", "bottom-end", "top-end"],
      }),
      shift({ padding: 12 }),
      size(
        {
          padding: 12,
          apply({ availableHeight, elements }) {
            const nextMaxHeight = Math.max(120, Math.min(availableHeight, 288));
            elements.floating.style.width = `${mentionMenuWidth}px`;
            elements.floating.style.maxWidth = `${Math.max(
              220,
              window.innerWidth - 24
            )}px`;
            elements.floating.style.setProperty(
              "--prompt-input-mention-menu-max-height",
              `${nextMaxHeight}px`
            );
          },
        },
        [mentionMenuWidth]
      ),
    ],
    whileElementsMounted: mentionPositionReference ? autoUpdate : undefined,
  });
  useLayoutEffect(() => {
    if (!mentionPositionReference) {
      return;
    }

    mentionMenuFloatingRefs.setPositionReference(mentionPositionReference);
  }, [mentionMenuFloatingRefs, mentionPositionReference]);

  const mentionQueryChangeHandler = mentionAutocomplete?.onQueryChange;
  useEffect(() => {
    mentionQueryChangeHandler?.(activeMentionMatch?.query ?? null);
  }, [activeMentionMatch?.query, mentionQueryChangeHandler]);
  useEffect(
    () => () => {
      if (mentionCloseSuppressionTimeoutRef.current !== null) {
        window.clearTimeout(mentionCloseSuppressionTimeoutRef.current);
      }
    },
    []
  );
  const resolvedMentionSelectedIndex = useMemo(() => {
    const itemCount = mentionAutocomplete?.items.length ?? 0;
    if (!mentionMenuOpen || itemCount === 0) {
      return 0;
    }

    return mentionSelectedIndex >= itemCount ? 0 : mentionSelectedIndex;
  }, [
    mentionAutocomplete?.items.length,
    mentionMenuOpen,
    mentionSelectedIndex,
  ]);
  const mentionItems = mentionAutocomplete?.items ?? [];
  const selectedMentionItem =
    mentionItems[resolvedMentionSelectedIndex] ?? mentionItems[0] ?? null;
  const getMentionOptionId = useCallback(
    (item: MentionEntitySearchResult, index: number) =>
      `${mentionListboxId}-option-${item.id}-${index}`,
    [mentionListboxId]
  );
  const activeMentionOptionId =
    mentionMenuOpen && selectedMentionItem
      ? getMentionOptionId(
          selectedMentionItem,
          resolvedMentionSelectedIndex < mentionItems.length
            ? resolvedMentionSelectedIndex
            : 0
        )
      : undefined;

  const adjustHeight = useCallback(
    (el: HTMLTextAreaElement | null) => {
      if (!el || disableAutosize) return;

      el.style.height = "auto";

      // The ghost is part of the text flow: when it wraps onto a new line the
      // field grows for it, as it would for typed text.
      const mirror = ghostMirrorRef.current;
      const contentHeight = Math.max(
        el.scrollHeight,
        mirror?.scrollHeight ?? 0
      );

      if (typeof maxHeight === "number") {
        el.style.height = `${Math.min(contentHeight, maxHeight)}px`;
      } else {
        el.style.height = `min(${contentHeight}px, ${maxHeight})`;
      }
    },
    [disableAutosize, maxHeight]
  );

  const handleRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      if (textareaRef.current === el) {
        adjustHeight(el);
        return;
      }

      textareaRef.current = el;
      if (typeof textareaElementRef === "function") {
        textareaElementRef(el);
      } else if (textareaElementRef) {
        textareaElementRef.current = el;
      }
      adjustHeight(el);
      if (el) {
        const nextSelectionStart = el.selectionStart ?? 0;
        const nextSelectionEnd = el.selectionEnd ?? 0;

        setSelectionStart((current) =>
          current === nextSelectionStart ? current : nextSelectionStart
        );
        setSelectionEnd((current) =>
          current === nextSelectionEnd ? current : nextSelectionEnd
        );
      }
    },
    [adjustHeight, textareaElementRef, textareaRef]
  );

  useLayoutEffect(() => {
    adjustHeight(textareaRef.current);
  }, [value, ghostText, adjustHeight, textareaRef]);

  // Lay the ghost mirror over the textarea (after autosize, so it copies the
  // final box) and keep it scrolled with the textarea.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (el && showGhost && ghostMirrorRef.current) {
      // Grow for a ghost that wraps onto a new line before copying the box.
      adjustHeight(el);
    }
    const nextStyle =
      el && showGhost ? buildTextareaGhostMirrorStyle(el) : null;

    setGhostMirrorStyle((current) =>
      isSameTextareaGhostMirrorStyle(current, nextStyle) ? current : nextStyle
    );
    if (el && ghostMirrorRef.current) {
      ghostMirrorRef.current.scrollTop = el.scrollTop;
    }
    // `ghostMirrorStyle` re-runs this once the mirror has mounted, so the
    // field can grow for a wrapped ghost; the equality check above ends it.
  }, [
    adjustHeight,
    ghostMirrorStyle,
    ghostText,
    selectionStart,
    showGhost,
    textareaRef,
    value,
  ]);

  // A width change without a React render (window resize, sidebar toggle)
  // re-wraps the textarea; re-measure so the mirror wraps at the same column.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !showGhost || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      const nextStyle = buildTextareaGhostMirrorStyle(el);
      setGhostMirrorStyle((current) =>
        isSameTextareaGhostMirrorStyle(current, nextStyle) ? current : nextStyle
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [showGhost, textareaRef]);

  useLayoutEffect(() => {
    if (!mentionMenuOpen) {
      return;
    }

    void updateMentionMenuPosition();
  }, [
    mentionMenuOpen,
    mentionMenuWidth,
    selectionEnd,
    selectionStart,
    updateMentionMenuPosition,
    value,
    mentionAutocomplete?.items.length,
    mentionAutocomplete?.loading,
  ]);

  const syncSelection = useCallback(
    (target?: HTMLTextAreaElement | null) => {
      const el = target ?? textareaRef.current;
      if (!el) {
        return;
      }

      const nextSelectionStart = el.selectionStart ?? 0;
      const nextSelectionEnd = el.selectionEnd ?? 0;

      setSelectionStart((current) =>
        current === nextSelectionStart ? current : nextSelectionStart
      );
      setSelectionEnd((current) =>
        current === nextSelectionEnd ? current : nextSelectionEnd
      );
    },
    [textareaRef]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;

    adjustHeight(e.target);

    if (pendingAutocompleteValueRef.current === nextValue) {
      pendingAutocompleteValueRef.current = null;
      syncSelection(e.target);
      return;
    }

    pendingAutocompleteValueRef.current = null;
    setValue(nextValue);
    syncSelection(e.target);
  };

  const insertGhostText = useCallback(
    (text: string) => {
      const el = textareaRef.current;
      if (!text || !el) {
        return;
      }

      const result = insertTextareaTextWithUndo({
        textarea: el,
        text,
        selectionStart,
        selectionEnd,
      });

      adjustHeight(el);
      pendingAutocompleteValueRef.current = result.value;
      setValue(result.value);
      setSelectionStart(result.selectionStart);
      setSelectionEnd(result.selectionEnd);

      requestAnimationFrame(() => {
        if (el.ownerDocument.activeElement !== el) {
          return;
        }
        el.focus();
        el.setSelectionRange(result.selectionStart, result.selectionEnd);
        syncSelection(el);
      });
    },
    [
      adjustHeight,
      selectionEnd,
      selectionStart,
      setValue,
      syncSelection,
      textareaRef,
    ]
  );

  const acceptMentionSelection = useCallback(
    (item: MentionEntitySearchResult) => {
      const el = textareaRef.current;
      if (!el || !mentionAutocomplete || !activeMentionMatch) {
        return;
      }

      const replacementText =
        mentionAutocomplete.getReplacementText?.(item, {
          currentValue: value,
          replaceStart: activeMentionMatch.replaceStart,
          replaceEnd: activeMentionMatch.replaceEnd,
        }) ?? `@${item.mentionText} `;

      const result = insertTextareaTextWithUndo({
        textarea: el,
        text: replacementText,
        selectionStart: activeMentionMatch.replaceStart,
        selectionEnd: activeMentionMatch.replaceEnd,
      });

      adjustHeight(el);
      pendingAutocompleteValueRef.current = result.value;
      suppressMentionAutocompleteRef.current = true;
      if (mentionCloseSuppressionTimeoutRef.current !== null) {
        window.clearTimeout(mentionCloseSuppressionTimeoutRef.current);
      }
      setValue(result.value);
      setSelectionStart((current) =>
        current === result.selectionStart ? current : result.selectionStart
      );
      setSelectionEnd((current) =>
        current === result.selectionEnd ? current : result.selectionEnd
      );
      setMentionSelectedIndex(0);
      mentionAutocomplete.onSelectItem?.(item);
      mentionAutocomplete.onQueryChange(null);
      mentionCloseSuppressionTimeoutRef.current = window.setTimeout(() => {
        suppressMentionAutocompleteRef.current = false;
        mentionCloseSuppressionTimeoutRef.current = null;
      }, 250);

      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(result.selectionStart, result.selectionEnd);
        syncSelection(el);
      });
    },
    [
      activeMentionMatch,
      adjustHeight,
      mentionAutocomplete,
      setValue,
      syncSelection,
      textareaRef,
      value,
    ]
  );

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused((current) => (current ? false : current));
    dismissSuggestion("blur");
    mentionAutocomplete?.onQueryChange(null);
    props.onBlur?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused((current) => (current ? current : true));
    syncSelection(e.currentTarget);
    props.onFocus?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionMenuOpen && e.key === "ArrowDown") {
      e.preventDefault();
      if (mentionItems.length > 0) {
        setMentionSelectedIndex(
          (current) => (current + 1) % mentionItems.length
        );
      }
      onKeyDown?.(e);
      return;
    }

    if (mentionMenuOpen && e.key === "ArrowUp") {
      e.preventDefault();
      if (mentionItems.length > 0) {
        setMentionSelectedIndex((current) =>
          current === 0 ? mentionItems.length - 1 : current - 1
        );
      }
      onKeyDown?.(e);
      return;
    }

    if (
      mentionMenuOpen &&
      selectedMentionItem &&
      (e.key === "Enter" || e.key === "Tab")
    ) {
      e.preventDefault();
      acceptMentionSelection(selectedMentionItem);
      onKeyDown?.(e);
      return;
    }

    if (mentionMenuOpen && e.key === "Escape") {
      e.preventDefault();
      mentionAutocomplete?.onQueryChange(null);
      onKeyDown?.(e);
      return;
    }

    if (ghostText && e.key === "Tab") {
      e.preventDefault();
      insertGhostText(takeSuggestion());
      onKeyDown?.(e);
      return;
    }

    if (ghostText && isInlineSuggestionWordAcceptKey(e)) {
      e.preventDefault();
      insertGhostText(takeNextSuggestionWord());
      onKeyDown?.(e);
      return;
    }

    if (e.key === "Escape" && !ghostText && hasPendingSuggestion()) {
      // Cancel a pending request; nothing visible changed, so the key keeps
      // its usual meaning for the caller.
      dismissSuggestion("escape");
    }

    if (ghostText && e.key === "Escape") {
      e.preventDefault();
      dismissSuggestion("escape");
      onKeyDown?.(e);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      {mentionMenuOpen && mentionPositionReference && mentionAutocomplete ? (
        <FloatingPortal>
          <div
            ref={mentionMenuFloatingRefs.setFloating}
            className="z-50"
            style={mentionMenuFloatingStyles}
          >
            <MentionEntityMenu
              results={mentionAutocomplete.items}
              loading={mentionAutocomplete.loading}
              selectedIndex={resolvedMentionSelectedIndex}
              onHover={setMentionSelectedIndex}
              onSelect={acceptMentionSelection}
              listboxId={mentionListboxId}
              getOptionId={getMentionOptionId}
              className="w-full"
              bodyStyle={{
                maxHeight: "var(--prompt-input-mention-menu-max-height, 18rem)",
              }}
            />
          </div>
        </FloatingPortal>
      ) : null}
      {showGhost && ghostMirrorStyle ? (
        <div ref={ghostMirrorRef} aria-hidden="true" style={ghostMirrorStyle}>
          {value.slice(0, selectionStart)}
          <span className="text-muted-foreground">{ghostText}</span>
          {value.slice(selectionStart)}
          {/* Keeps a trailing newline's empty last line in the layout. */}
          {"\u200b"}
        </div>
      ) : null}
      <span role="status" className="sr-only">
        {announcement}
      </span>
      <Textarea
        ref={handleRef}
        {...props}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={(e) => {
          syncSelection(e.currentTarget);
          props.onSelect?.(e);
        }}
        onClick={(e) => {
          syncSelection(e.currentTarget);
          props.onClick?.(e);
        }}
        onKeyUp={(e) => {
          syncSelection(e.currentTarget);
          props.onKeyUp?.(e);
        }}
        onScroll={(e) => {
          if (ghostMirrorRef.current) {
            ghostMirrorRef.current.scrollTop = e.currentTarget.scrollTop;
          }
          syncSelection(e.currentTarget);
          props.onScroll?.(e);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onCompositionStart={(e) => {
          setIsComposing((current) => (current ? current : true));
          mentionAutocomplete?.onQueryChange(null);
          props.onCompositionStart?.(e);
        }}
        onCompositionEnd={(e) => {
          setIsComposing((current) => (current ? false : current));
          syncSelection(e.currentTarget);
          props.onCompositionEnd?.(e);
        }}
        className={cn(
          "text-primary min-h-11 w-full resize-none border-none bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
          className
        )}
        style={
          showGhost && ghostMirrorStyle
            ? // The mirror draws the text with the ghost in flow; the textarea
              // keeps the caret and input but hides its own glyphs meanwhile.
              { ...props.style, WebkitTextFillColor: "transparent" }
            : props.style
        }
        role={mentionAutocomplete ? "combobox" : undefined}
        aria-autocomplete={
          mentionAutocomplete
            ? supportsInlineAutocomplete
              ? "both"
              : "list"
            : supportsInlineAutocomplete
              ? "inline"
              : undefined
        }
        aria-controls={mentionMenuOpen ? mentionListboxId : undefined}
        aria-expanded={mentionAutocomplete ? mentionMenuOpen : undefined}
        aria-activedescendant={activeMentionOptionId}
        rows={1}
        disabled={disabled}
      />
    </div>
  );
}

export type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>;

function PromptInputActions({
  children,
  className,
  ...props
}: PromptInputActionsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)} {...props}>
      {children}
    </div>
  );
}

export type PromptInputActionProps = {
  className?: string;
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
} & React.ComponentProps<typeof Tooltip>;

function PromptInputAction({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: PromptInputActionProps) {
  const { disabled } = usePromptInput();

  return (
    <Tooltip {...props}>
      <TooltipTrigger
        asChild
        disabled={disabled}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
};
