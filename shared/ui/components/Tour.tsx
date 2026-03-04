"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  arrow as arrowMw,
  Placement,
} from "@floating-ui/react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";

export type TourStepDef = {
  target: string; // CSS selector (e.g., #rx-tour-exact-toggle)
  step: React.ReactNode; // Content for the step
  placement?: Placement; // Preferred placement
};

type TourContextValue = {
  isOpen: boolean;
  setOpen: (v: boolean) => void;
  index: number;
  setIndex: (i: number) => void;
  steps: TourStepDef[];
  targetAvailable: boolean;
  setTargetAvailable: (v: boolean) => void;
};

const TourCtx = React.createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = React.useContext(TourCtx);
  if (!ctx) throw new Error("useTour must be used within <Tour>");
  return ctx;
}

export function Tour({
  steps,
  children,
  isOpen: controlledOpen,
  onClose,
  initialIndex = 0,
  onIndexChange,
}: {
  steps: TourStepDef[];
  children: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
  initialIndex?: number;
  onIndexChange?: (i: number) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(
    controlledOpen ?? false
  );
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? !!controlledOpen : uncontrolledOpen;
  const setOpen = React.useCallback(
    (v: boolean) => {
      if (!isControlled) setUncontrolledOpen(v);
      if (!v) onClose?.();
    },
    [isControlled, onClose]
  );

  const [targetAvailable, setTargetAvailable] = useState<boolean>(false);

  const [index, _setIndex] = useState<number>(initialIndex);
  const setIndex = React.useCallback(
    (i: number) => {
      _setIndex(i);
      onIndexChange?.(i);
    },
    [onIndexChange]
  );
  const value = useMemo(
    () => ({
      isOpen,
      setOpen,
      index,
      setIndex,
      steps,
      targetAvailable,
      setTargetAvailable,
    }),
    [
      isOpen,
      setOpen,
      index,
      setIndex,
      steps,
      targetAvailable,
      setTargetAvailable,
    ]
  );

  // Reset index if steps or initialIndex changes
  useEffect(() => {
    _setIndex(initialIndex);
    onIndexChange?.(initialIndex);
  }, [initialIndex, steps.length, onIndexChange]);

  return <TourCtx.Provider value={value}>{children}</TourCtx.Provider>;
}

export function TourTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactNode;
}) {
  const Comp = asChild ? Slot : "button";
  const { setOpen } = useTour();
  return <Comp onClick={() => setOpen(true)}>{children}</Comp>;
}

export function TourOverlay({ className }: { className?: string }) {
  const { isOpen, setOpen, targetAvailable } = useTour();
  if (!isOpen || !targetAvailable) return null;
  return (
    <div
      className={cn(
        "fixed inset-0 z-60 bg-black/50 dark:bg-white/10",
        className
      )}
      onClick={() => setOpen(false)}
      aria-hidden="true"
    />
  );
}

export function TourContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { isOpen, steps, index, setTargetAvailable } = useTour();
  const targetSelector = steps[index]?.target;
  const arrowRef = useRef<HTMLDivElement | null>(null);

  const [referenceEl, setReferenceEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!isOpen || !targetSelector) {
      setTargetAvailable(false);
      setReferenceEl(null);
      return;
    }
    const resolve = () => {
      try {
        const el = document.querySelector<HTMLElement>(targetSelector);
        if (el) {
          setReferenceEl(el);
          setTargetAvailable(true);
        } else {
          setTargetAvailable(false);
        }
      } catch {
        // ignore
      }
    };
    resolve();
    if (referenceEl) return;
    const obs = new MutationObserver(() => resolve());
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      setTargetAvailable(false);
      obs.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetSelector]);

  const { refs, floatingStyles, middlewareData, placement } = useFloating({
    elements: { reference: referenceEl || undefined },
    placement: steps[index]?.placement || "bottom",
    strategy: "fixed",
    middleware: [
      offset(8),
      flip(),
      shift({ padding: 8 }),
      arrowMw({ element: arrowRef }),
    ],
    whileElementsMounted: referenceEl ? autoUpdate : undefined,
  });

  useEffect(() => {
    if (!isOpen || !referenceEl) return;
    try {
      referenceEl.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
    } catch {}
  }, [isOpen, referenceEl]);

  if (!isOpen || !referenceEl) return null;

  return (
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      role="dialog"
      aria-modal="true"
      className={cn(
        "bg-popover text-popover-foreground z-61 max-w-[320px] rounded-md border p-3 shadow-lg",
        "outline-hidden",
        className
      )}
    >
      {children}
      <TourArrow
        ref={arrowRef}
        placement={placement}
        middlewareData={middlewareData}
      />
    </div>
  );
}

export const TourStep = function TourStep() {
  const { steps, index } = useTour();
  return <div className="space-y-1 text-sm">{steps[index]?.step}</div>;
};

export function TourFooter({
  className,
  labels,
  onFinish,
}: {
  className?: string;
  labels?: Partial<{
    back: string;
    next: string;
    finish: string;
    gotIt: string;
  }>;
  onFinish?: () => void;
}) {
  const { steps, index, setIndex } = useTour();
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  const onBack = () => setIndex(Math.max(0, index - 1));
  const onNext = () => {
    if (isLast) {
      onFinish?.();
      return;
    }
    setIndex(index + 1);
  };

  const l = {
    back: labels?.back ?? "Back",
    next: labels?.next ?? "Got it!",
    finish: labels?.finish ?? "Finish!",
  };

  return (
    <div className={cn("mt-3 flex items-center justify-end gap-1", className)}>
      {!isFirst && (
        <Button size="xs" variant="outline" onClick={onBack}>
          {l.back}
        </Button>
      )}
      <Button size="xs" onClick={onNext}>
        {isLast ? l.finish : l.next}
      </Button>
    </div>
  );
}

type MiddlewareData = { arrow?: { x?: number; y?: number } };

export const TourArrow = React.forwardRef<
  HTMLDivElement,
  { placement?: Placement; middlewareData?: MiddlewareData; className?: string }
>(function TourArrow({ placement, middlewareData, className }, ref) {
  if (!middlewareData?.arrow) return null;
  const { x, y } = middlewareData.arrow;
  const staticSideMap: Record<"top" | "right" | "bottom" | "left", string> = {
    top: "bottom",
    right: "left",
    bottom: "top",
    left: "right",
  };
  const base = (placement?.split("-")[0] || "bottom") as
    | "top"
    | "right"
    | "bottom"
    | "left";
  const staticSide = staticSideMap[base];
  return (
    <div
      ref={ref}
      className={cn("bg-popover absolute size-2 rotate-45", className)}
      style={
        {
          left: x != null ? `${x}px` : "",
          top: y != null ? `${y}px` : "",
          [staticSide]: "-4px",
        } as React.CSSProperties
      }
    />
  );
});
