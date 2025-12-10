import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/components/Avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip"
import { cn } from "@/shared/lib/utils"
import { Markdown } from "@/shared/ui/components/Markdown"

export type MessageProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

const Message = ({ children, className, ...props }: MessageProps) => (
  <div className={cn("flex gap-3", className)} {...props}>
    {children}
  </div>
)

export type MessageAvatarProps = {
  src?: string
  alt: string
  fallback?: string
  delayMs?: number
  className?: string
}

const MessageAvatar = ({
  src,
  alt,
  fallback,
  delayMs,
  className,
}: MessageAvatarProps) => {
  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      {src && <AvatarImage src={src} alt={alt} />}
      {fallback && (
        <AvatarFallback delayMs={delayMs}>{fallback}</AvatarFallback>
      )}
    </Avatar>
  )
}

export type MessageContentProps = {
  children: React.ReactNode
  markdown?: boolean
  /** 
   * Styling variant: 
   * - "bubble" (default): rounded background with padding (for user messages)
   * - "plain": no background/padding (for agent messages)
   */
  variant?: "bubble" | "plain"
  /**
   * Font size:
   * - "sm" (default): 14px - for user messages
   * - "xs": 12px - for agent messages
   */
  textSize?: "sm" | "xs"
  className?: string
} & Omit<React.ComponentProps<typeof Markdown>, 'children'> &
  Omit<React.HTMLProps<HTMLDivElement>, 'children'>

const MessageContent = ({
  children,
  markdown = false,
  variant = "bubble",
  textSize = "sm",
  className,
  ...props
}: MessageContentProps) => {
  // Base styles for both markdown and non-markdown content
  const baseStyles = "text-foreground break-words whitespace-normal"
  
  // Font size based on textSize prop
  const sizeStyles = textSize === "xs" ? "text-xs" : "text-sm"
  
  // Bubble variant adds rounded background and padding
  const bubbleStyles = "rounded-lg p-2"
  
  // Prose styles for markdown - includes typography plugin classes for proper list/heading rendering
  const proseStyles = cn(
    "prose dark:prose-invert max-w-none",
    textSize === "xs" ? "prose-xs" : "prose-sm",
    // Customize prose element sizes
    "prose-p:my-2 prose-p:leading-relaxed",
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
  )

  const classNames = cn(
    baseStyles,
    sizeStyles,
    variant === "bubble" && bubbleStyles,
    markdown && proseStyles,
    className
  )

  return markdown ? (
    <Markdown className={classNames} {...props}>
      {children as string}
    </Markdown>
  ) : (
    <div className={classNames} {...props}>
      {children}
    </div>
  )
}

export type MessageActionsProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

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
)

export type MessageActionProps = {
  className?: string
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
} & React.ComponentProps<typeof Tooltip>

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
  )
}

export { Message, MessageAvatar, MessageContent, MessageActions, MessageAction }
