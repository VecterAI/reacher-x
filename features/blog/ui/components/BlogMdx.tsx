import Image from "next/image";
import Link from "next/link";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { codeToHtml, bundledLanguages } from "shiki";
import { InlineCode } from "@/shared/ui/components/InlineCode";
import { BlogCopyButton } from "./BlogCopyButton";

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
  const html = await codeToHtml(code, {
    lang: language,
    themes: { light: "github-light", dark: "github-dark" },
  });
  return (
    <div className="not-prose border-border my-8 overflow-hidden rounded-md border">
      <div className="border-border flex items-center justify-between border-b px-4 py-2 text-xs">
        <span className="text-muted-foreground font-mono">
          {children.props["data-filename"] ?? requestedLanguage}
        </span>
        <BlogCopyButton text={code} label="Copy code" />
      </div>
      <div
        className="blog-code overflow-x-auto text-sm [&_pre]:m-0 [&_pre]:p-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
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
