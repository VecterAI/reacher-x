/**
 * ChatInput - Input component for chat with contextual suggestions
 *
 * Simplified for useChat-based architecture.
 * Suggestions are shown based on whether there are messages.
 */

import { memo, useCallback, type KeyboardEvent } from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/shared/ui/components/PromptInput";
import { PromptSuggestion } from "@/shared/ui/components/PromptSuggestion";
import { Button } from "@/shared/ui/components/Button";
import { Send, Square, Globe } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ChatInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (message?: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  showSuggestions?: boolean;
  className?: string;
}

// ============================================================================
// Suggestion Config
// ============================================================================

const INITIAL_SUGGESTIONS = [
  "Analyze my website",
  "I'll describe my business",
  "Help me find customers",
];

// ============================================================================
// Component
// ============================================================================

export const ChatInput = memo(function ChatInput({
  value,
  onValueChange,
  onSubmit,
  onStop,
  isLoading = false,
  showSuggestions = false,
  className,
}: ChatInputProps) {
  const handleSubmit = useCallback(() => {
    if (!value.trim() || isLoading) return;
    onSubmit();
  }, [value, isLoading, onSubmit]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      onSubmit(suggestion);
    },
    [onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className={className}>
      {/* Contextual Suggestions */}
      {showSuggestions && (
        <div className="mb-3 flex flex-wrap gap-2">
          {INITIAL_SUGGESTIONS.map((suggestion) => (
            <PromptSuggestion
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={isLoading}
            >
              {suggestion}
            </PromptSuggestion>
          ))}
        </div>
      )}

      {/* Text Input */}
      <PromptInput
        value={value}
        onValueChange={onValueChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        className="bg-background"
      >
        <PromptInputTextarea
          placeholder="Enter your website URL or describe your product..."
          onKeyDown={handleKeyDown}
        />
        <PromptInputActions className="justify-between px-2 pb-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Globe className="size-3" />
            <span>Share your website or describe your product</span>
          </div>
          {isLoading && onStop ? (
            <PromptInputAction tooltip="Stop generating">
              <Button
                size="sm"
                variant="ghost"
                onClick={onStop}
                className="gap-2"
              >
                <Square className="size-4" />
              </Button>
            </PromptInputAction>
          ) : (
            <PromptInputAction tooltip="Send message">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!value.trim() || isLoading}
                className="gap-2"
              >
                <Send className="size-4" />
              </Button>
            </PromptInputAction>
          )}
        </PromptInputActions>
      </PromptInput>
    </div>
  );
});
