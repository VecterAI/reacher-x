"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LANDING_VARIANTS,
  resolveLandingVariantId,
} from "@/features/landing/lib/landingVariants";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/components/Button";

const STORAGE_KEY = "reacherx:landing-variant-bar";

type BarMode = "open" | "collapsed" | "hidden";

/**
 * Floating landing-iteration switcher. Development only — mount from the
 * landing layout behind a NODE_ENV gate. Reads LANDING_VARIANTS so new
 * iterations appear automatically when added to the registry.
 */
export function VariantSwitcher({ className }: { className?: string }) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return <VariantSwitcherBar className={className} />;
}

function VariantSwitcherBar({ className }: { className?: string }) {
  const pathname = usePathname();
  const active = resolveLandingVariantId(pathname);
  const [mode, setMode] = useState<BarMode>("collapsed");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored === "open" || stored === "collapsed" || stored === "hidden") {
        setMode(stored);
      }
    } catch {
      // Ignore storage failures.
    }
    setReady(true);
  }, []);

  const persist = (next: BarMode) => {
    setMode(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures.
    }
  };

  if (!ready) {
    return null;
  }

  const activeLabel =
    LANDING_VARIANTS.find((variant) => variant.id === active)?.label ?? "V";

  if (mode === "hidden") {
    return (
      <div className={cn("fixed right-3 bottom-3 z-50", className)}>
        <button
          type="button"
          onClick={() => persist("collapsed")}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "rounded-full font-mono text-xs"
          )}
          aria-label="Show landing variants"
        >
          V
        </button>
      </div>
    );
  }

  if (mode === "collapsed") {
    return (
      <div className={cn("fixed right-3 bottom-3 z-50", className)}>
        <div className="border-border bg-background flex items-center gap-1 rounded-full border p-1">
          <button
            type="button"
            onClick={() => persist("open")}
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "rounded-full font-mono text-xs"
            )}
            aria-expanded={false}
          >
            {activeLabel}
          </button>
          <button
            type="button"
            onClick={() => persist("hidden")}
            className="text-muted-foreground hover:text-foreground px-2 text-xs"
            aria-label="Hide landing variants"
          >
            Hide
          </button>
        </div>
      </div>
    );
  }

  return (
    <nav
      aria-label="Landing page variants"
      className={cn(
        "border-border bg-background fixed right-3 bottom-3 z-50 max-h-[min(70vh,28rem)] max-w-[min(100vw-1.5rem,20rem)] overflow-y-auto rounded-xl border p-2",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-muted-foreground font-mono text-[10px] tracking-wider">
          Variants
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => persist("collapsed")}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Min
          </button>
          <button
            type="button"
            onClick={() => persist("hidden")}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Hide
          </button>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-1">
        {LANDING_VARIANTS.map((variant) => {
          const isActive = active === variant.id;
          return (
            <li key={variant.href}>
              <Link
                href={variant.href}
                className={cn(
                  "flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="font-mono text-xs">{variant.label}</span>
                <span className="text-[11px] leading-tight opacity-80">
                  {variant.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
