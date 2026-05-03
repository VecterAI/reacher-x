"use client";

import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/components/Collapsible";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import {
  ChangeHistoryIcon,
  CheckCircleIcon,
  ErrorIcon,
} from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export type ToolPart = {
  type: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  toolCallId?: string;
  errorText?: string;
};

export type ToolProps = {
  toolPart: ToolPart;
  defaultOpen?: boolean;
  className?: string;
};

const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";

const formatValue = (value: unknown): string => {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    try {
      const seen = new WeakSet();
      return JSON.stringify(
        value,
        (key, val) => {
          if (typeof val === "object" && val !== null) {
            if (seen.has(val)) {
              return "[Circular]";
            }
            seen.add(val);
          }
          return val;
        },
        2
      );
    } catch {
      return "[Unable to stringify]";
    }
  }
  return String(value);
};

function ToolStateIndicator({ state }: Pick<ToolPart, "state">) {
  switch (state) {
    case "input-streaming":
    case "input-available":
      return (
        <AsciiSpinnerText
          className="text-muted-foreground font-mono text-sm"
        />
      );
    case "output-available":
      return (
        <CheckCircleIcon className="text-[hsl(142_72%_45%)] size-4 fill-current" />
      );
    case "output-error":
      return <ErrorIcon className="text-destructive size-4 fill-current" />;
    default:
      return null;
  }
}

function ToolStatusText({ state }: Pick<ToolPart, "state">) {
  if (state === "output-available") {
    return null;
  }

  if (state === "output-error") {
    return <span>Tool call failed.</span>;
  }

  return (
    <AsciiSpinnerText
      text="Processing tool call..."
      className="font-mono text-sm"
    />
  );
}

const Tool = ({ toolPart, defaultOpen = false, className }: ToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen && IS_DEVELOPMENT);

  const { state, input, output, toolCallId } = toolPart;
  const canExpand = IS_DEVELOPMENT;

  const strip = (
    <InlineFeatureStrip
      className={cn(
        "mt-3",
        canExpand && "mt-0 rounded-none border-0",
        className
      )}
      leading={
        <>
          <div className="border-border rounded-md border p-1">
            <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
          </div>
          <span className="text-sm font-medium">{toolPart.type}</span>
        </>
      }
      trailing={
        <div className="flex items-center gap-2">
          {canExpand ? (
            <ChevronDown
              className={cn(
                "text-muted-foreground h-4 w-4 transition-transform",
                isOpen && "rotate-180"
              )}
            />
          ) : null}
          <ToolStateIndicator state={state} />
        </div>
      }
    />
  );

  if (!canExpand) {
    return strip;
  }

  return (
    <div className="bg-background border-border mt-3 overflow-hidden rounded-xl border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="block w-full text-left"
            aria-expanded={isOpen}
          >
            {strip}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn(
            "border-border border-t",
            "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden"
          )}
        >
          <div className="space-y-3 p-3">
            <div>
              <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Status
              </h4>
              <div className="bg-muted/30 rounded-lg border px-3 py-2 text-sm">
                <ToolStatusText state={state} />
              </div>
            </div>

            {input && Object.keys(input).length > 0 ? (
              <div>
                <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  Input
                </h4>
                <div className="bg-muted/30 rounded-lg border p-3 font-mono text-xs">
                  <pre className="whitespace-pre-wrap">{formatValue(input)}</pre>
                </div>
              </div>
            ) : null}

            {output ? (
              <div>
                <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  Output
                </h4>
                <div className="bg-muted/30 max-h-60 overflow-auto scroll-fade-effect-y rounded-lg border p-3 font-mono text-xs">
                  <pre className="whitespace-pre-wrap">{formatValue(output)}</pre>
                </div>
              </div>
            ) : null}

            {state === "output-error" && toolPart.errorText ? (
              <div>
                <h4 className="text-destructive mb-2 text-xs font-medium tracking-wide uppercase">
                  Error
                </h4>
                <div className="bg-destructive/5 border-destructive/20 rounded-lg border px-3 py-2 text-sm">
                  {toolPart.errorText}
                </div>
              </div>
            ) : null}

            {toolCallId ? (
              <div className="text-muted-foreground border-border border-t pt-2 text-xs">
                <span className="font-mono">Call ID: {toolCallId}</span>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export { Tool };
