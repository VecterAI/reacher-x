"use client";

import { cn } from "@/shared/lib/utils";
import React, { memo } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useHighlightedCode } from "@/shared/ui/hooks/useHighlightedCode";
import { getCodeBlockMeta } from "@/shared/ui/lib/codeBlockMeta";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockMetaIcon,
  CodeBlockTitle,
} from "./CodeBlock";
import { InlineCode } from "./InlineCode";

export type MarkdownProps = {
  children: string;
  id?: string;
  className?: string;
  components?: Partial<Components>;
};

function extractLanguage(className?: string): string {
  if (!className) return "plaintext";
  const match = className.match(/language-([\w-]+)/);
  return match ? match[1] : "plaintext";
}

function MarkdownCodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const normalizedCode = code.replace(/\n$/, "");
  const lines = useHighlightedCode(normalizedCode, language);
  const { title, icon } = getCodeBlockMeta(language);

  return (
    <CodeBlock className="my-3">
      {title ? (
        <CodeBlockHeader>
          <CodeBlockTitle>
            <CodeBlockMetaIcon kind={icon} />
            {title}
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton value={normalizedCode} />
          </CodeBlockActions>
        </CodeBlockHeader>
      ) : (
        <CodeBlockActions>
          <CodeBlockCopyButton value={normalizedCode} />
        </CodeBlockActions>
      )}
      <CodeBlockContent className="text-[13px]">
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}

const INLINE_AT_MENTION_PATTERN =
  /(^|[\s(])(@[A-Za-z0-9][A-Za-z0-9:_-]*(?: [A-Za-z0-9][A-Za-z0-9:_-]*)*)(?=$|[\s),.!?:;\]])/g;

function highlightInlineAtMentions(text: string) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_AT_MENTION_PATTERN.exec(text)) !== null) {
    const prefix = match[1] ?? "";
    const token = match[2] ?? "";
    const matchStart = match.index;
    const tokenStart = matchStart + prefix.length;

    if (matchStart > lastIndex) {
      parts.push(text.slice(lastIndex, matchStart));
    }

    if (prefix) {
      parts.push(prefix);
    }

    parts.push(
      <span
        key={`${tokenStart}-${token}`}
        className="font-pixel-square text-muted-foreground font-bold"
      >
        {token}
      </span>
    );

    lastIndex = tokenStart + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function renderMentionStyledChildren(
  children: React.ReactNode
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      return highlightInlineAtMentions(child);
    }

    if (typeof child === "number" || child == null) {
      return child;
    }

    if (Array.isArray(child)) {
      return renderMentionStyledChildren(child);
    }

    if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
      return React.cloneElement(child, {
        children: renderMentionStyledChildren(child.props.children),
      });
    }

    return child;
  });
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
      props.node?.position?.start.line === props.node?.position?.end.line;

    if (isInline) {
      return (
        <InlineCode variant="markdown" className={className} {...props}>
          {children}
        </InlineCode>
      );
    }

    const language = extractLanguage(className);
    const codeText =
      typeof children === "string"
        ? children
        : Array.isArray(children)
          ? children.join("")
          : String(children ?? "");

    return <MarkdownCodeBlock code={codeText} language={language} />;
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>;
  },
  // Links with pixel font and muted foreground
  a: function AComponent({ children, href, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-pixel-square text-muted-foreground font-bold hover:underline"
        {...props}
      >
        {renderMentionStyledChildren(children)}
      </a>
    );
  },
  // Ordered list with proper styling
  ol: function OlComponent({ children, ...props }) {
    return (
      <ol className="my-3 ml-5 list-decimal space-y-2" {...props}>
        {children}
      </ol>
    );
  },
  // Unordered list with proper styling
  ul: function UlComponent({ children, ...props }) {
    return (
      <ul className="my-3 ml-5 list-disc space-y-2" {...props}>
        {children}
      </ul>
    );
  },
  // List items
  li: function LiComponent({ children, ...props }) {
    return (
      <li className="pl-1 leading-6" {...props}>
        {renderMentionStyledChildren(children)}
      </li>
    );
  },
  // Paragraphs with proper spacing
  p: function PComponent({ children, ...props }) {
    return (
      <p className="my-3 leading-6" {...props}>
        {renderMentionStyledChildren(children)}
      </p>
    );
  },
  // Strong/bold text
  strong: function StrongComponent({ children, ...props }) {
    return (
      <strong className="font-semibold" {...props}>
        {renderMentionStyledChildren(children)}
      </strong>
    );
  },
  hr: function HrComponent(props) {
    return (
      <hr className="border-border/80 my-4 border-0 border-t" {...props} />
    );
  },
  table: function TableComponent({ children, ...props }) {
    return (
      <div className="border-border/80 max-w-full scrollbar-none overflow-x-auto [overflow-y:clip] rounded-xl border [&::-webkit-scrollbar]:hidden">
        <table
          className="m-0 w-max min-w-full border-separate border-spacing-0 text-sm"
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },
  thead: function TheadComponent({ children, ...props }) {
    return (
      <thead className="bg-muted/30 border-border/80 border-b" {...props}>
        {children}
      </thead>
    );
  },
  tbody: function TbodyComponent({ children, ...props }) {
    return <tbody {...props}>{children}</tbody>;
  },
  tr: function TrComponent({ children, ...props }) {
    return (
      <tr className="border-border/80 border-b last:border-b-0" {...props}>
        {children}
      </tr>
    );
  },
  th: function ThComponent({ children, ...props }) {
    return (
      <th
        className="border-border/80 text-foreground min-w-36 border-r border-b px-3 py-2 text-left align-top font-semibold whitespace-nowrap last:border-r-0"
        {...props}
      >
        {renderMentionStyledChildren(children)}
      </th>
    );
  },
  td: function TdComponent({ children, ...props }) {
    return (
      <td
        className="border-border/80 min-w-36 border-r border-b px-3 py-2 align-top break-words whitespace-normal last:border-r-0 [tr:last-child_&]:border-b-0"
        {...props}
      >
        {renderMentionStyledChildren(children)}
      </td>
    );
  },
};

/**
 * Markdown component - renders markdown content with proper formatting.
 *
 * Uses react-markdown with remark-gfm for GitHub Flavored Markdown.
 * Does NOT split content into blocks to preserve list structure.
 */
function MarkdownComponent({ children, className, components }: MarkdownProps) {
  // Merge custom components with defaults
  const mergedComponents = {
    ...INITIAL_COMPONENTS,
    ...components,
  };

  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mergedComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

const Markdown = memo(MarkdownComponent);
Markdown.displayName = "Markdown";

export { Markdown };
