import Image from "next/image";
import { BLOG_AUTHOR } from "../../lib/blogHelpers";

export function BlogAuthor() {
  return (
    <span className="text-foreground flex items-center gap-2 text-sm leading-5">
      <Image
        src={BLOG_AUTHOR.image}
        width={16}
        height={16}
        alt=""
        className="size-4 shrink-0 rounded-full object-cover"
      />
      <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span>{BLOG_AUTHOR.name}</span>
        <span className="text-muted-foreground inline-flex items-center gap-2">
          <span aria-hidden="true">·</span>
          <span>{BLOG_AUTHOR.role}</span>
        </span>
      </span>
    </span>
  );
}
