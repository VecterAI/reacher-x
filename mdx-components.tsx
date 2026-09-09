import { BlogVideo } from "@/features/blog/ui/components/BlogVideo";
import { BlogGif } from "@/features/blog/ui/components/BlogGif";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";
import {
  BlogPre,
  BlogImage,
  BlogCallout,
  BlogAnchor,
  BlogInlineCode,
  BlogTable,
} from "@/features/blog/ui/components/BlogMdx";

function Heading({
  as: Tag,
  id,
  children,
  ...props
}: ComponentProps<"h2"> & { as: "h2" | "h3" | "h4" }) {
  return (
    <Tag id={id} {...props}>
      <a
        href={`#${id}`}
        className="no-underline hover:underline hover:underline-offset-4"
      >
        {children}
      </a>
    </Tag>
  );
}
const components: MDXComponents = {
  h2: (props) => <Heading as="h2" {...props} />,
  h3: (props) => <Heading as="h3" {...props} />,
  h4: (props) => <Heading as="h4" {...props} />,
  pre: BlogPre,
  code: BlogInlineCode,
  a: BlogAnchor,
  BlogImage,
  BlogVideo,
  BlogGif,
  BlogCallout,
  td: ({ style, ...props }) => (
    <td
      {...props}
      style={style}
      className={
        style?.textAlign === "right"
          ? "blog-table-number font-mono tabular-nums"
          : undefined
      }
    />
  ),
  th: (props) => <th scope="col" {...props} />,
  table: BlogTable,
};
export function useMDXComponents(): MDXComponents {
  return components;
}
