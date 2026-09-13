import Link from "next/link";
import { buttonVariants } from "@/shared/ui/components/Button";
import {
  BLOG_NOT_FOUND_TITLE,
  BLOG_NOT_FOUND_DESCRIPTION,
} from "@/features/blog/lib/blogNotFound";
export default function BlogNotFound() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24">
      <p className="text-muted-foreground mb-4 text-sm">404</p>
      <h1 className="mb-4 text-4xl font-medium">{BLOG_NOT_FOUND_TITLE}</h1>
      <p className="text-muted-foreground mb-8">{BLOG_NOT_FOUND_DESCRIPTION}</p>
      <Link href="/blog" className={buttonVariants({ variant: "outline" })}>
        Back to blog
      </Link>
    </section>
  );
}
