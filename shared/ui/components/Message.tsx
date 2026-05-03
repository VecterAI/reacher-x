import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";
import { cn } from "@/shared/lib/utils";
import { Markdown } from "@/shared/ui/components/Markdown";

export type MessageProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

const Message = ({ children, className, ...props }: MessageProps) => (
  <div className={cn("flex gap-3", className)} {...props}>
    {children}
  </div>
);

export type MessageAvatarProps = {
  src?: string;
  alt: string;
  fallback?: string;
  delayMs?: number;
  /** Class applied to AvatarFallback (bg/text colors) */
  className?: string;
  /** Class applied to Avatar container (for shape override like rounded-md) */
  avatarClassName?: string;
};

const MessageAvatar = ({
  src,
  alt,
  fallback,
  delayMs,
  className,
  avatarClassName,
}: MessageAvatarProps) => {
  return (
    <Avatar className={cn("h-6 w-6 shrink-0", avatarClassName)}>
      {src && <AvatarImage src={src} alt={alt} />}
      {fallback && (
        <AvatarFallback delayMs={delayMs} className={className}>
          {fallback}
        </AvatarFallback>
      )}
    </Avatar>
  );
};

/**
 * MessageContent props with type-safe markdown handling.
 * When markdown={true}, children MUST be a string for proper rendering.
 */
export type MessageContentProps = {
  /**
   * Styling variant:
   * - "bubble" (default): rounded background with padding (for user messages)
   * - "plain": no background/padding (for agent messages)
   */
  variant?: "bubble" | "plain";
  /**
   * Font size:
   * - "sm" (default): 14px - for user messages
   * - "xs": 12px - for agent messages
   */
  textSize?: "sm" | "xs";
  className?: string;
} & (
  | { markdown: true; children: string }
  | { markdown?: false; children: React.ReactNode }
) &
  Omit<React.ComponentProps<typeof Markdown>, "children"> &
  Omit<React.HTMLProps<HTMLDivElement>, "children">;

const MessageContent = ({
  children,
  markdown,
  variant = "bubble",
  textSize = "sm",
  className,
  ...props
}: MessageContentProps) => {
  // Plain text: preserve user line breaks; markdown: default prose flow (lists, paragraphs)
  const baseStyles = cn(
    "text-foreground break-words",
    markdown ? "whitespace-normal" : "whitespace-pre-wrap"
  );

  // Font size based on textSize prop
  const sizeStyles = textSize === "xs" ? "text-xs" : "text-sm";

  // Bubble variant adds rounded background and padding
  const bubbleStyles = "rounded-lg p-2";

  // Prose styles for markdown - includes typography plugin classes for proper list/heading rendering
  const proseStyles = cn(
    "prose dark:prose-invert max-w-none",
    textSize === "xs" ? "prose-xs" : "prose-sm",
    // Customize prose element sizes
    "prose-p:my-2 prose-p:leading-relaxed prose-p:first:mt-0",
    // List styling
    "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
    // Heading sizes
    "prose-h1:text-xl prose-h1:font-bold prose-h1:my-3",
    "prose-h2:text-lg prose-h2:font-semibold prose-h2:my-2",
    "prose-h3:text-base prose-h3:font-semibold prose-h3:my-2",
    "prose-h4:text-sm prose-h4:font-medium",
    // Code styling
    "prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:rounded",
    // Strong/bold
    "prose-strong:font-semibold"
  );

  const classNames = cn(
    baseStyles,
    sizeStyles,
    variant === "bubble" && bubbleStyles,
    markdown && proseStyles,
    className
  );

  return markdown ? (
    <Markdown className={classNames} {...props}>
      {children as string}
    </Markdown>
  ) : (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
};

export type MessageActionsProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

const MessageActions = ({
  children,
  className,
  ...props
}: MessageActionsProps) => (
  <div
    className={cn("text-muted-foreground flex items-center gap-2", className)}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionProps = {
  className?: string;
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
} & React.ComponentProps<typeof Tooltip>;

const MessageAction = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: MessageActionProps) => {
  return (
    <TooltipProvider>
      <Tooltip {...props}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className={className}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export {
  Message,
  MessageAvatar,
  MessageContent,
  MessageActions,
  MessageAction,
};
