import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  dedupeProspectListResults,
  shouldShowProspectFeedSkeleton,
} from "../features/prospects/lib/prospectListResults";
import type { Doc } from "../convex/_generated/dataModel";
import { isTerminalStableFeedBuffer } from "../convex/lib/prospectListFeedUtils";

const INFINITE_SCROLL_FILE = "shared/ui/components/InfiniteScrollTrigger.tsx";
const SCROLL_AREA_FILE = "shared/ui/components/ScrollArea.tsx";
const FEED_FILES = [
  "app/(webapp)/page.tsx",
  "app/(webapp)/archives/page.tsx",
  "features/webapp/ui/pages/UseCaseSuccessPage.tsx",
] as const;

test("infinite scroll observes the shared ScrollArea viewport", () => {
  const triggerSource = readFileSync(INFINITE_SCROLL_FILE, "utf8");
  const scrollAreaSource = readFileSync(SCROLL_AREA_FILE, "utf8");

  assert.match(triggerSource, /useScrollAreaViewportRef\(\)/);
  assert.match(
    triggerSource,
    /const root = scrollAreaViewportRef\?\.current \?\? null/
  );
  assert.match(triggerSource, /\{\s*root,\s*rootMargin:/);
  assert.match(triggerSource, /rootMargin/);
  assert.match(triggerSource, /addEventListener\("scroll"/);
  assert.match(triggerSource, /passive: true/);
  assert.match(triggerSource, /resultCount/);
  assert.match(triggerSource, /!hasMore \|\| isLoading \|\| loadMoreError/);
  assert.match(scrollAreaSource, /viewportRef: React\.RefObject/);
  assert.match(scrollAreaSource, /useScrollAreaViewportRef/);
});

test("prospect feeds use the shared infinite-scroll trigger", () => {
  for (const file of FEED_FILES) {
    const source = readFileSync(file, "utf8");

    assert.match(source, /<InfiniteScrollTrigger/);
    assert.match(source, /aria-busy=\{isLoadingMore\}/);
    assert.doesNotMatch(source, />\s*Load more\s*</);
  }
});

test("infinite scroll keeps keyboard and failure fallbacks", () => {
  const source = readFileSync(INFINITE_SCROLL_FILE, "utf8");

  assert.match(source, /IntersectionObserver === "undefined"/);
  assert.match(source, /Retry loading more/);
  assert.match(source, /Load more results/);
  assert.match(source, /focus:not-sr-only/);
});

test("normal loading and exhaustion keep a stable footer height", () => {
  const source = readFileSync(INFINITE_SCROLL_FILE, "utf8");

  assert.match(source, /"relative h-px w-full"/);
  assert.match(source, /data-state=/);
  assert.match(source, /Loading more results/);
  assert.match(source, /<Spinner/);
  assert.match(source, /variant="circle"/);
  assert.doesNotMatch(source, /AsciiSpinnerText/);
});

test("infinite scroll supports loading earlier results from the top", () => {
  const source = readFileSync(INFINITE_SCROLL_FILE, "utf8");

  assert.match(source, /direction\?: "start" \| "end"/);
  assert.match(source, /direction === "start"/);
  assert.match(source, /root\.scrollTop/);
  assert.match(source, /loadingLabel/);
  assert.match(source, /loadMoreLabel/);
  assert.match(source, /retryLabel/);
});

test("overlapping reactive pages do not render duplicate prospects", () => {
  const first = {
    _id: "summary-1",
    prospectId: "prospect-1",
  } as Doc<"prospectSummaries">;
  const second = {
    _id: "summary-2",
    prospectId: "prospect-2",
  } as Doc<"prospectSummaries">;

  assert.deepEqual(
    dedupeProspectListResults([first, second, first]).map(
      (prospect) => prospect._id
    ),
    ["summary-1", "summary-2"]
  );
});

test("a drained stable-feed source finishes its remaining buffer", () => {
  assert.equal(
    isTerminalStableFeedBuffer({
      sourceCursor: null,
      bufferedSummaryCount: 8,
    }),
    true
  );
  assert.equal(
    isTerminalStableFeedBuffer({
      sourceCursor: null,
      bufferedSummaryCount: 0,
    }),
    false
  );
  assert.equal(
    isTerminalStableFeedBuffer({
      sourceCursor: "next-page",
      bufferedSummaryCount: 8,
    }),
    false
  );
});

test("the main feed does not show an empty state before results resolve", () => {
  assert.equal(
    shouldShowProspectFeedSkeleton({
      browseMode: true,
      firstPageLoading: false,
      countsPending: true,
      displayedResultCount: 0,
    }),
    true
  );
  assert.equal(
    shouldShowProspectFeedSkeleton({
      browseMode: true,
      firstPageLoading: false,
      countsPending: false,
      expectedResultCount: 4,
      displayedResultCount: 0,
    }),
    true
  );
  assert.equal(
    shouldShowProspectFeedSkeleton({
      browseMode: true,
      firstPageLoading: false,
      countsPending: false,
      expectedResultCount: 0,
      displayedResultCount: 0,
    }),
    false
  );
});
