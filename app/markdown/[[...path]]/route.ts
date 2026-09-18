import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { PlanOffer } from "@/shared/lib/billing/planOfferHelpers";
import { getBlogPosts } from "@/features/blog/lib/blogPosts";
import { publicPageMarkdown } from "@/features/landing/lib/agentReadinessCore";
import { publicMarkdownHref } from "@/features/landing/lib/agentReadinessHelpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const pathname = `/${((await params).path ?? []).join("/")}`;
  const query = new URL(request.url).searchParams.get("q") ?? "";
  let offers: PlanOffer[] = [];
  if (pathname === "/pricing") {
    try {
      offers = await fetchQuery(api.billing.getAvailableOffers);
    } catch {
      return new Response(
        "Plans are temporarily unavailable. Please try again shortly.\n",
        {
          status: 503,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "no-store",
            Vary: "Accept",
          },
        }
      );
    }
  }
  const body = publicMarkdownHref(pathname)
    ? publicPageMarkdown(
        pathname,
        pathname.startsWith("/blog") ? await getBlogPosts() : [],
        query,
        offers
      )
    : null;
  return new Response(
    body ?? "Page not found. Read /llms.txt for public pages.\n",
    {
      status: body === null ? 404 : 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control":
          body === null || pathname === "/pricing"
            ? "no-store"
            : "public, max-age=0, s-maxage=3600",
        Vary: "Accept",
        ...(body === null || query
          ? { "X-Robots-Tag": "noindex, follow" }
          : {}),
      },
    }
  );
}
