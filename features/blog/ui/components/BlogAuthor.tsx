import { Suspense } from "react";
import { getBlogAuthor } from "../../lib/getBlogAuthor";
import { BlogAuthorDetails } from "./BlogAuthorDetails";

async function CurrentBlogAuthor() {
  const profile = await getBlogAuthor();
  return <BlogAuthorDetails profile={profile} />;
}

export function BlogAuthor() {
  return (
    <Suspense fallback={<BlogAuthorDetails />}>
      <CurrentBlogAuthor />
    </Suspense>
  );
}
