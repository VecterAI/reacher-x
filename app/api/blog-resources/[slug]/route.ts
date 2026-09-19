import { NextResponse } from "next/server";
import { getBlogPost, summarizeBlogPost } from "@/features/blog/lib/blogPosts";
import { getBlogAuthor } from "@/features/blog/lib/getBlogAuthor";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const post = await getBlogPost((await params).slug);
  if (!post) {
    return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
  }

  const author = await getBlogAuthor();

  return NextResponse.json(
    {
      post: summarizeBlogPost(post),
      author,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    }
  );
}
