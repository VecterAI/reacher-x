import * as React from "react";

import { cn } from "@/shared/lib/utils";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  autoResize?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoResize, onInput, style, ...props }, ref) => {
    const onInputHandler = onInput as
      | React.FormEventHandler<HTMLTextAreaElement>
      | undefined;
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    // Merge forwarded ref and local ref
    React.useImperativeHandle(
      ref,
      () => innerRef.current as HTMLTextAreaElement
    );

    const adjustHeight = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      // Reset height to compute the correct scrollHeight
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, []);

    React.useLayoutEffect(() => {
      if (autoResize) {
        adjustHeight();
      }
    }, [autoResize, adjustHeight, props.value]);

    const handleInput: React.FormEventHandler<HTMLTextAreaElement> = (e) => {
      if (autoResize) {
        adjustHeight();
      }
      onInputHandler?.(e);
    };

    return (
      <textarea
        className={cn(
          "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={innerRef}
        onInput={handleInput}
        style={style}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
