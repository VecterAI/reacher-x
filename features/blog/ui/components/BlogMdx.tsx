import Image from "next/image";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { codeToHtml, bundledLanguages } from "shiki";
import { InlineCode } from "@/shared/ui/components/InlineCode";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockMetaIcon,
  CodeBlockTitle,
} from "@/shared/ui/components/CodeBlock";
import { getCodeBlockMeta } from "@/shared/ui/lib/codeBlockMeta";
import { neutralShikiThemes } from "@/shared/ui/components/shikiNeutralTheme";

export async function BlogPre({ children }: { children?: ReactNode }) {
  if (
    !isValidElement<{
      children?: string;
      className?: string;
      "data-filename"?: string;
    }>(children)
  )
    return <pre>{children}</pre>;
  const code = String(children.props.children ?? "").replace(/\n$/, "");
  const requestedLanguage =
    children.props.className?.replace("language-", "") ?? "text";
  const language =
    requestedLanguage in bundledLanguages
      ? (requestedLanguage as keyof typeof bundledLanguages)
      : "text";
  const html = await highlightBlogCode(code, language);
  const { title, icon } = getCodeBlockMeta(
    requestedLanguage,
    children.props["data-filename"]
  );
  return (
    <CodeBlock className="my-8">
      {title ? (
        <CodeBlockHeader>
          <CodeBlockTitle>
            <CodeBlockMetaIcon kind={icon} />
            {title}
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton value={code} />
          </CodeBlockActions>
        </CodeBlockHeader>
      ) : (
        <CodeBlockActions>
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      )}
      <div
        className="blog-code scroll-fade-x overflow-x-auto text-sm [&_pre]:m-0 [&_pre]:bg-transparent! [&_pre]:px-3 [&_pre]:py-3"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </CodeBlock>
  );
}

// Shiki initializes WASM using timing APIs. Cache the HTML string, rather than
// the component tree, so highlighting stays compatible with prerendering.
// Highlighting is deterministic per code block, so cache it for as long as
// possible; fresh deploys repopulate the cache anyway.
async function highlightBlogCode(code: string, language: string) {
  "use cache";
  cacheLife("max");
  return codeToHtml(code, {
    lang: language,
    themes: neutralShikiThemes,
  });
}

export function BlogImage({
  src,
  alt,
  width = 1200,
  height = 750,
  caption,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  caption?: string;
}) {
  return (
    <figure className="not-prose my-8">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes="(max-width: 768px) 100vw, 768px"
        className="border-border h-auto w-full rounded-md border"
        unoptimized={/\.gif$/i.test(src)}
      />
      {caption && (
        <figcaption className="text-muted-foreground mt-3 text-center text-sm leading-5">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function BlogMediaPlaceholder({
  title,
  caption,
}: {
  title: string;
  caption: string;
}) {
  return (
    <figure className="not-prose my-8" data-media-placeholder>
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-amber-600/60 bg-amber-100 px-6 py-10 text-center text-amber-950 dark:border-amber-400/60 dark:bg-amber-950 dark:text-amber-100">
        <span className="text-xs font-semibold tracking-widest uppercase">
          Media placeholder
        </span>
        <p className="max-w-lg text-lg leading-7 font-medium">{title}</p>
      </div>
      <figcaption className="text-muted-foreground mt-3 text-sm leading-5">
        {caption}
      </figcaption>
    </figure>
  );
}

export function BlogCallout({
  children,
  title = "Good to know",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <aside className="not-prose border-border my-8 border-l-2 pl-5 text-base leading-6">
      <p className="text-foreground mb-2 font-medium">{title}</p>
      <div className="text-muted-foreground space-y-3">{children}</div>
    </aside>
  );
}

export function BlogAnchor({
  href = "",
  children,
  ...props
}: ComponentProps<"a">) {
  return href.startsWith("/") && !href.startsWith("//") ? (
    <Link href={href} {...props}>
      {children}
    </Link>
  ) : (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
export function BlogInlineCode(props: ComponentProps<"code">) {
  return <InlineCode variant="markdown" {...props} />;
}

export function BlogTable(props: ComponentProps<"table">) {
  return (
    <div
      role="region"
      aria-label="Scrollable table"
      tabIndex={0}
      className="border-border focus-visible:outline-ring my-8 overflow-x-auto overscroll-x-contain rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <table {...props} />
    </div>
  );
}
