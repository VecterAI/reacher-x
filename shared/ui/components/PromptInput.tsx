"use client";

import { Textarea } from "@/shared/ui/components/TextArea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";
import { cn } from "@/shared/lib/utils";
import { getTextareaCaretCoordinates } from "@/shared/lib/autocomplete/getTextareaCaretCoordinates";
import {
  getInlineAutocompleteInsertionText,
  type InlineAutocompleteContext,
} from "@/shared/lib/autocomplete/inlineAutocomplete";
import { useInlineAutocomplete } from "@/shared/hooks/useInlineAutocomplete";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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

function insertTextareaTextWithUndo(args: {
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

  return {
    value: textarea.value,
    selectionStart: textarea.selectionStart ?? nextSelection,
    selectionEnd: textarea.selectionEnd ?? nextSelection,
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

  const handleChange = (newValue: string) => {
    setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!disabled) textareaRef.current?.focus();
    onClick?.(e);
  };

  return (
    <TooltipProvider>
      <PromptInputContext.Provider
        value={{
          isLoading,
          value: value ?? internalValue,
          setValue: onValueChange ?? handleChange,
          maxHeight,
          onSubmit,
          disabled,
          textareaRef,
        }}
      >
        <div
          onClick={handleClick}
          className={cn(
            "border-input bg-background cursor-text rounded-xl border p-2",
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
  inlineAutocompleteContext?: InlineAutocompleteContext;
} & React.ComponentProps<typeof Textarea>;

function PromptInputTextarea({
  className,
  onKeyDown,
  disableAutosize = false,
  inlineAutocompleteContext,
  ...props
}: PromptInputTextareaProps) {
  const { value, setValue, maxHeight, onSubmit, disabled, textareaRef } =
    usePromptInput();
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const pendingAutocompleteValueRef = useRef<string | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties | null>(
    null
  );
  const request =
    inlineAutocompleteContext && isFocused && selectionStart === selectionEnd
      ? {
          ...inlineAutocompleteContext,
          surface: "prompt_input" as const,
          beforeCursor: value.slice(0, selectionStart),
          afterCursor: value.slice(selectionStart),
        }
      : null;
  const { suggestion, dismissSuggestion, recordAccepted, isLoading } =
    useInlineAutocomplete({
      request,
      enabled:
        Boolean(inlineAutocompleteContext) &&
        !disabled &&
        !isComposing &&
        isFocused &&
        inlineAutocompleteContext?.enabled !== false,
    });

  const adjustHeight = (el: HTMLTextAreaElement | null) => {
    if (!el || disableAutosize) return;

    el.style.height = "auto";

    if (typeof maxHeight === "number") {
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    } else {
      el.style.height = `min(${el.scrollHeight}px, ${maxHeight})`;
    }
  };

  const handleRef = (el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
    adjustHeight(el);
    if (el) {
      setSelectionStart(el.selectionStart ?? 0);
      setSelectionEnd(el.selectionEnd ?? 0);
    }
  };

  useLayoutEffect(() => {
    if (!textareaRef.current || disableAutosize) return;

    const el = textareaRef.current;
    el.style.height = "auto";

    if (typeof maxHeight === "number") {
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    } else {
      el.style.height = `min(${el.scrollHeight}px, ${maxHeight})`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, maxHeight, disableAutosize]);

  useLayoutEffect(() => {
    const el = textareaRef.current;

    if (!el || !suggestion || !isFocused || selectionStart !== selectionEnd) {
      setOverlayStyle(null);
      return;
    }

    const caret = getTextareaCaretCoordinates(el, selectionStart);
    const computed = window.getComputedStyle(el);
    const paddingRight = Number.parseFloat(computed.paddingRight) || 0;

    setOverlayStyle({
      top: caret.top,
      left: caret.left,
      maxWidth: Math.max(64, el.clientWidth - caret.left - paddingRight - 4),
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
    });
  }, [isFocused, selectionEnd, selectionStart, suggestion, value, textareaRef]);

  useEffect(() => {
    if (!suggestion) {
      setOverlayStyle(null);
    }
  }, [suggestion]);

  const syncSelection = useCallback(
    (target?: HTMLTextAreaElement | null) => {
      const el = target ?? textareaRef.current;
      if (!el) {
        return;
      }

      setSelectionStart(el.selectionStart ?? 0);
      setSelectionEnd(el.selectionEnd ?? 0);
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

  const acceptSuggestion = useCallback(() => {
    const el = textareaRef.current;
    if (!suggestion || !el) {
      return;
    }

    const insertionText = getInlineAutocompleteInsertionText({
      beforeCursor: value.slice(0, selectionStart),
      suggestion,
    });

    if (!insertionText) {
      return;
    }

    const result = insertTextareaTextWithUndo({
      textarea: el,
      text: insertionText,
      selectionStart,
      selectionEnd,
    });

    adjustHeight(el);
    pendingAutocompleteValueRef.current = result.value;
    setValue(result.value);
    recordAccepted();

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
      syncSelection(el);
    });
  }, [
    adjustHeight,
    recordAccepted,
    selectionEnd,
    selectionStart,
    setValue,
    suggestion,
    syncSelection,
    textareaRef,
    value,
  ]);

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
    dismissSuggestion("blur");
    props.onBlur?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(true);
    syncSelection(e.currentTarget);
    props.onFocus?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestion && e.key === "Tab") {
      e.preventDefault();
      acceptSuggestion();
      onKeyDown?.(e);
      return;
    }

    if (suggestion && e.key === "Escape") {
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
      {suggestion && overlayStyle && !isLoading ? (
        <div
          className="text-muted-foreground pointer-events-none absolute z-10 overflow-hidden whitespace-nowrap opacity-55 select-none"
          style={{
            ...overlayStyle,
            WebkitMaskImage:
              "linear-gradient(to right, black 0%, black 82%, transparent 100%)",
            maskImage:
              "linear-gradient(to right, black 0%, black 82%, transparent 100%)",
          }}
        >
          {suggestion}
        </div>
      ) : null}
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
          dismissSuggestion("manual");
          syncSelection(e.currentTarget);
          props.onScroll?.(e);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onCompositionStart={(e) => {
          setIsComposing(true);
          dismissSuggestion("manual");
          props.onCompositionStart?.(e);
        }}
        onCompositionEnd={(e) => {
          setIsComposing(false);
          syncSelection(e.currentTarget);
          props.onCompositionEnd?.(e);
        }}
        className={cn(
          "text-primary min-h-11 w-full resize-none border-none bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
          className
        )}
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
