import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import GithubSlugger from "github-slugger";
import { blogMetadataSchema, type BlogHeading } from "./blogHelpers";

// One syntax tree supplies heading IDs and reading text, including headings
// containing inline code and repeated headings. rehype-slug uses the same slugger.
const parser = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkGfm)
  .use(remarkStringify);
type ContentNode = {
  type: string;
  value?: string;
  depth?: number;
  children?: ContentNode[];
};
function nodeText(node: ContentNode): string {
  if (
    node.type === "mdxjsEsm" ||
    node.type === "mdxFlowExpression" ||
    node.type === "mdxTextExpression"
  )
    return "";
  return node.value ?? node.children?.map(nodeText).join("") ?? "";
}

export function parseBlogPost(source: string, slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error(`Invalid blog slug: ${slug}`);
  // Dates must be quoted strings; the schema rejects YAML timestamp objects.
  const { data, content } = matter(source);
  const metadata = blogMetadataSchema.parse(data);
  const tree = parser.parse(content);
  const headings: BlogHeading[] = [];
  const slugger = new GithubSlugger();
  function visit(node: ContentNode) {
    if (node.type === "heading") {
      if (node.depth === 1)
        throw new Error(
          `${slug}: the article title is the only H1; use ## in the body`
        );
      const text = nodeText(node);
      const id = slugger.slug(text);
      if (node.depth === 2 || node.depth === 3)
        headings.push({ id, text, depth: node.depth });
    }
    node.children?.forEach(visit);
  }
  visit(tree);
  const words = tree.children
    .map(nodeText)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return {
    ...metadata,
    slug,
    readingMinutes: Math.max(1, Math.ceil(words / 200)),
    headings,
    content,
  };
}

export function publicBlogPosts<
  T extends { draft: boolean; date: string; slug: string },
>(posts: T[], today: string): T[] {
  return posts
    .filter((post) => !post.draft && post.date <= today)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)
    );
}

// Render supported MDX components as ordinary Markdown for search agents.
// Expressions/imports are authoring code and never become executable output.
export function blogBodyMarkdown(content: string): string {
  const tree = parser.parse(content);
  type Node = (typeof tree.children)[number];
  function clean(nodes: Node[]): Node[] {
    return nodes.flatMap((node): Node[] => {
      if (
        node.type === "mdxjsEsm" ||
        node.type === "mdxFlowExpression" ||
        node.type === "mdxTextExpression"
      )
        return [];
      if (
        node.type === "mdxJsxFlowElement" ||
        node.type === "mdxJsxTextElement"
      ) {
        const attribute = (name: string) => {
          const attr = node.attributes.find(
            (item) => item.type === "mdxJsxAttribute" && item.name === name
          );
          return attr && "value" in attr && typeof attr.value === "string"
            ? attr.value
            : "";
        };
        if (
          node.name === "BlogImage" ||
          node.name === "BlogVideo" ||
          node.name === "BlogGif"
        ) {
          const url = attribute("src");
          const label = attribute("alt") || attribute("title");
          return [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  url,
                  children: [{ type: "text", value: label || "Media" }],
                },
              ],
            },
            ...(attribute("caption")
              ? [
                  {
                    type: "paragraph" as const,
                    children: [
                      { type: "text" as const, value: attribute("caption") },
                    ],
                  },
                ]
              : []),
          ];
        }
        const children = clean(node.children as Node[]);
        if (node.name === "BlogCallout") {
          return [
            {
              type: "paragraph",
              children: [
                {
                  type: "strong",
                  children: [
                    {
                      type: "text",
                      value: attribute("title") || "Good to know",
                    },
                  ],
                },
              ],
            },
            ...children,
          ];
        }
        return children;
      }
      if ("children" in node) {
        // Children retain their original Markdown structure after removing JSX.
        return [{ ...node, children: clean(node.children as Node[]) } as Node];
      }
      return [node];
    });
  }
  tree.children = clean(tree.children);
  return parser.stringify(tree);
}
