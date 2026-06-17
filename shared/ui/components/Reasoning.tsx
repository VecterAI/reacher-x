"use client";

import { cn } from "@/shared/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Markdown } from "./Markdown";

type ReasoningContextType = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

const ReasoningContext = createContext<ReasoningContextType | undefined>(
  undefined
);

function useReasoningContext() {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error(
      "useReasoningContext must be used within a Reasoning provider"
    );
  }
  return context;
}

export type ReasoningProps = {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isStreaming?: boolean;
};
function Reasoning({
  children,
  className,
  open,
  onOpenChange,
  isStreaming,
}: ReasoningProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled
    ? Boolean(open)
    : isStreaming
      ? true
      : internalOpen;

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange]
  );

  const contextValue = useMemo(
    () => ({
      isOpen,
      onOpenChange: handleOpenChange,
    }),
    [isOpen, handleOpenChange]
  );

  return (
    <ReasoningContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </ReasoningContext.Provider>
  );
}

export type ReasoningTriggerProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLButtonElement>;

function ReasoningTrigger({
  children,
  className,
  ...props
}: ReasoningTriggerProps) {
  const { isOpen, onOpenChange } = useReasoningContext();

  return (
    <button
      type="button"
      className={cn("flex cursor-pointer items-center gap-2", className)}
      onClick={() => onOpenChange(!isOpen)}
      {...props}
    >
      <span className="text-primary">{children}</span>
      <div
        className={cn(
          "transform transition-transform",
          isOpen ? "rotate-180" : ""
        )}
      >
        <ChevronDownIcon className="size-4" />
      </div>
    </button>
  );
}

export type ReasoningContentProps = {
  children: React.ReactNode;
  className?: string;
  markdown?: boolean;
  contentClassName?: string;
} & React.HTMLAttributes<HTMLDivElement>;

function ReasoningContent({
  children,
  className,
  contentClassName,
  markdown = false,
  ...props
}: ReasoningContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const { isOpen } = useReasoningContext();
  // Track height in state to avoid ref access during render
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (!contentRef.current || !innerRef.current) return;

    const updateHeight = () => {
      if (innerRef.current) {
        setContentHeight(innerRef.current.scrollHeight);
      }
    };

    const observer = new ResizeObserver(updateHeight);
    observer.observe(innerRef.current);

    // Initial height calculation
    updateHeight();

    return () => observer.disconnect();
  }, []);

  // Safe handling of markdown content - perform runtime check
  const content = markdown ? (
    typeof children === "string" ? (
      <Markdown>{children}</Markdown>
    ) : (
      // Fallback for non-string children when markdown=true
      <>{String(children)}</>
    )
  ) : (
    children
  );

  return (
    <div
      ref={contentRef}
      className={cn(
        "overflow-hidden transition-[max-height] duration-150 ease-out",
        className
      )}
      style={{
        maxHeight: isOpen ? contentHeight : 0,
      }}
      {...props}
    >
      <div
        ref={innerRef}
        className={cn(
          "text-muted-foreground prose prose-sm dark:prose-invert",
          contentClassName
        )}
      >
        {content}
      </div>
    </div>
  );
}

export { Reasoning, ReasoningTrigger, ReasoningContent };
