import { serializeBlogJson } from "@/features/blog/lib/blogHelpers";
import { marketingStructuredData } from "@/features/landing/lib/agentReadinessHelpers";

export function MarketingStructuredData({ pathname }: { pathname: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeBlogJson(marketingStructuredData(pathname)),
      }}
    />
  );
}
