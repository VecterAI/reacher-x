"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/shared/lib/utils";
import { useTouchPrimary } from "@/shared/ui/hooks/use-has-primary-touch";

const ScrollAreaContext = React.createContext<boolean>(false);

type Mask = {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
};

type ScrollAreaProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Root
> & {
  viewportClassName?: string;
  viewportOverscrollClassName?: string;
  scrollbar?: "vertical" | "horizontal" | "both" | "none";
  /**
   * Height/width of the scroll mask fade in pixels.
   * Pass `0` to disable the mask.
   * @default 30
   */
  maskHeight?: number;
  maskClassName?: string;
};

const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(
  (
    {
      className,
      children,
      scrollHideDelay = 0,
      viewportClassName,
      viewportOverscrollClassName,
      scrollbar = "vertical",
      maskClassName,
      maskHeight = 30,
      ...props
    },
    ref
  ) => {
    const resolvedOverscrollClassName =
      viewportOverscrollClassName ??
      (scrollbar === "horizontal"
        ? "overscroll-x-contain overscroll-y-auto"
        : "overscroll-contain");
    const [showMask, setShowMask] = React.useState<Mask>({
      top: false,
      bottom: false,
      left: false,
      right: false,
    });
    const viewportRef = React.useRef<HTMLDivElement>(null);
    const isTouch = useTouchPrimary();

    const checkScrollability = React.useCallback(() => {
      const element = viewportRef.current;
      if (!element) return;

      const {
        scrollTop,
        scrollLeft,
        scrollWidth,
        clientWidth,
        scrollHeight,
        clientHeight,
      } = element;
      setShowMask((prev) => ({
        ...prev,
        top: scrollTop > 0,
        bottom: scrollTop + clientHeight < scrollHeight - 1,
        left: scrollLeft > 0,
        right: scrollLeft + clientWidth < scrollWidth - 1,
      }));
    }, []);

    React.useEffect(() => {
      if (typeof window === "undefined") return;

      const element = viewportRef.current;
      if (!element) return;

      const controller = new AbortController();
      const { signal } = controller;

      const resizeObserver = new ResizeObserver(checkScrollability);
      resizeObserver.observe(element);

      element.addEventListener("scroll", checkScrollability, { signal });
      window.addEventListener("resize", checkScrollability, { signal });

      checkScrollability();

      return () => {
        controller.abort();
        resizeObserver.disconnect();
      };
    }, [checkScrollability, isTouch]);

    if (isTouch) {
      return (
        <ScrollAreaContext.Provider value={isTouch}>
          <div
            ref={ref}
            role="group"
            data-slot="scroll-area"
            aria-roledescription="scroll area"
            className={cn("relative overflow-hidden", className)}
            {...props}
          >
            <div
              ref={viewportRef}
              data-slot="scroll-area-viewport"
              className={cn(
                "size-full min-w-0 overflow-auto rounded-[inherit]",
                resolvedOverscrollClassName,
                viewportClassName
              )}
              tabIndex={0}
            >
              {children}
            </div>

            {maskHeight > 0 && (
              <ScrollMask
                showMask={showMask}
                className={maskClassName}
                maskHeight={maskHeight}
              />
            )}
          </div>
        </ScrollAreaContext.Provider>
      );
    }

    return (
      <ScrollAreaContext.Provider value={isTouch}>
        <ScrollAreaPrimitive.Root
          ref={ref}
          data-slot="scroll-area"
          scrollHideDelay={scrollHideDelay}
          className={cn("relative overflow-hidden", className)}
          {...props}
        >
          <ScrollAreaPrimitive.Viewport
            ref={viewportRef}
            data-slot="scroll-area-viewport"
            className={cn(
              "size-full min-w-0 rounded-[inherit]",
              resolvedOverscrollClassName,
              viewportClassName
            )}
          >
            {children}
          </ScrollAreaPrimitive.Viewport>

          {maskHeight > 0 && (
            <ScrollMask
              showMask={showMask}
              className={maskClassName}
              maskHeight={maskHeight}
            />
          )}
          {scrollbar !== "none" &&
            (scrollbar === "vertical" || scrollbar === "both") && <ScrollBar />}
          {scrollbar !== "none" &&
            (scrollbar === "horizontal" || scrollbar === "both") && (
              <ScrollBar orientation="horizontal" />
            )}
          <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>
      </ScrollAreaContext.Provider>
    );
  }
);

ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => {
  const isTouch = React.useContext(ScrollAreaContext);

  if (isTouch) return null;

  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      data-slot="scroll-area-scrollbar"
      className={cn(
        "hover:bg-muted dark:hover:bg-muted/50 data-[state=visible]:fade-in-0 data-[state=hidden]:fade-out-0 data-[state=visible]:animate-in data-[state=hidden]:animate-out flex touch-none p-px transition-[colors] duration-150 select-none",
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent px-1 pr-1.25",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className={cn(
          "bg-border relative flex-1 origin-center rounded-full transition-[scale]",
          orientation === "vertical" && "my-1 active:scale-y-95",
          orientation === "horizontal" && "active:scale-x-98"
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
});

ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

function ScrollMask({
  showMask,
  maskHeight,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  showMask: Mask;
  maskHeight: number;
}) {
  return (
    <>
      <div
        {...props}
        aria-hidden="true"
        style={
          {
            "--top-fade-height": showMask.top ? `${maskHeight}px` : "0px",
            "--bottom-fade-height": showMask.bottom ? `${maskHeight}px` : "0px",
          } as React.CSSProperties
        }
        className={cn(
          "pointer-events-none absolute inset-0 z-10",
          "before:absolute before:inset-x-0 before:top-0 before:transition-[height,opacity] before:duration-300 before:content-['']",
          "after:absolute after:inset-x-0 after:bottom-0 after:transition-[height,opacity] after:duration-300 after:content-['']",
          "before:h-(--top-fade-height) after:h-(--bottom-fade-height)",
          showMask.top ? "before:opacity-100" : "before:opacity-0",
          showMask.bottom ? "after:opacity-100" : "after:opacity-0",
          "before:from-background before:bg-gradient-to-b before:to-transparent",
          "after:from-background after:bg-gradient-to-t after:to-transparent",
          className
        )}
      />
      <div
        {...props}
        aria-hidden="true"
        style={
          {
            "--left-fade-width": showMask.left ? `${maskHeight}px` : "0px",
            "--right-fade-width": showMask.right ? `${maskHeight}px` : "0px",
          } as React.CSSProperties
        }
        className={cn(
          "pointer-events-none absolute inset-0 z-10",
          "before:absolute before:inset-y-0 before:left-0 before:transition-[width,opacity] before:duration-300 before:content-['']",
          "after:absolute after:inset-y-0 after:right-0 after:transition-[width,opacity] after:duration-300 after:content-['']",
          "before:w-(--left-fade-width) after:w-(--right-fade-width)",
          showMask.left ? "before:opacity-100" : "before:opacity-0",
          showMask.right ? "after:opacity-100" : "after:opacity-0",
          "before:from-background before:bg-gradient-to-r before:to-transparent",
          "after:from-background after:bg-gradient-to-l after:to-transparent",
          className
        )}
      />
    </>
  );
}

export { ScrollArea, ScrollBar };
