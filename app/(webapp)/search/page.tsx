// app/(webapp)/search/page.tsx
import type { SearchParams } from "nuqs/server";
import { searchParamsCache } from "@/shared/lib/searchParams";
import { Suspense } from "react";

type PageProps = {
  searchParams:
    | Promise<SearchParams>
    | Record<string, string | string[] | undefined>;
};

export default async function Page({ searchParams }: PageProps) {
  const sp =
    typeof (searchParams as Promise<SearchParams>).then === "function"
      ? await (searchParams as Promise<SearchParams>)
      : (searchParams as Record<string, string | string[] | undefined>);

  await searchParamsCache.parse(sp);

  const SearchClient = (await import("./pageClient")).default;
  return (
    <Suspense>
      <SearchClient />
    </Suspense>
  );
}
