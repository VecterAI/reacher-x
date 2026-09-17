import { getBlogGradientStyle } from "../../lib/blogGradientHelpers";

export function BlogGradientCover({ slug }: { slug: string }) {
  return (
    <div
      aria-hidden="true"
      className="blog-gradient-cover relative isolate aspect-[1200/630] w-full overflow-hidden"
      style={getBlogGradientStyle(slug)}
    />
  );
}
