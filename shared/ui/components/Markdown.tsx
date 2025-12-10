import { cn } from "@/shared/lib/utils"
import { memo } from "react"
import ReactMarkdown, { Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { CodeBlock, CodeBlockCode } from "./CodeBlock"

export type MarkdownProps = {
  children: string
  id?: string
  className?: string
  components?: Partial<Components>
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "plaintext"
}

/**
 * Default components for markdown rendering.
 * Custom styling for code blocks, lists, links, etc.
 */
const INITIAL_COMPONENTS: Partial<Components> = {
  // Code blocks and inline code
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <code
          className={cn(
            "bg-muted rounded px-1.5 py-0.5 font-mono text-sm",
            className
          )}
          {...props}
        >
          {children}
        </code>
      )
    }

    const language = extractLanguage(className)

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    )
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
  // Links with mono font and muted foreground
  a: function AComponent({ children, href, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-muted-foreground hover:underline"
        {...props}
      >
        {children}
      </a>
    )
  },
  // Ordered list with proper styling
  ol: function OlComponent({ children, ...props }) {
    return (
      <ol className="my-2 ml-4 list-decimal space-y-1" {...props}>
        {children}
      </ol>
    )
  },
  // Unordered list with proper styling
  ul: function UlComponent({ children, ...props }) {
    return (
      <ul className="my-2 ml-4 list-disc space-y-1" {...props}>
        {children}
      </ul>
    )
  },
  // List items
  li: function LiComponent({ children, ...props }) {
    return (
      <li className="pl-1" {...props}>
        {children}
      </li>
    )
  },
  // Paragraphs with proper spacing
  p: function PComponent({ children, ...props }) {
    return (
      <p className="my-2 leading-relaxed" {...props}>
        {children}
      </p>
    )
  },
  // Strong/bold text
  strong: function StrongComponent({ children, ...props }) {
    return (
      <strong className="font-semibold" {...props}>
        {children}
      </strong>
    )
  },
}

/**
 * Markdown component - renders markdown content with proper formatting.
 * 
 * Uses react-markdown with remark-gfm for GitHub Flavored Markdown.
 * Does NOT split content into blocks to preserve list structure.
 */
function MarkdownComponent({
  children,
  className,
  components,
}: MarkdownProps) {
  // Merge custom components with defaults
  const mergedComponents = {
    ...INITIAL_COMPONENTS,
    ...components,
  }

  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={mergedComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
