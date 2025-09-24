// app/(webapp)/page.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/shared/hooks/useAuth";
import { useDataMigrationEffect } from "@/shared/hooks/useDataMigrationEffect";
import { Separator } from "@/shared/ui/components/Separator";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { KeywordSuggestions } from "@/features/keywords/ui/components/KeywordSuggestions";
import { RecentKeywords } from "@/features/keywords/ui/components/RecentKeywords";
import { SimilarKeywords } from "@/features/keywords/ui/components/SimilarKeywords";
import { useSearchHistory } from "@/features/search/hooks/useSearchHistory";
import { useKeywordSuggestions } from "@/features/keywords/hooks/useKeywordSuggestions";
import { useKeywordRePrompt } from "@/shared/hooks/useKeywordRePrompt";
// Local store still used inside hook; no direct import needed here
import { useKeywordSync } from "@/shared/hooks/useKeywordSync";
import { useOptimisticSearch } from "@/features/search/hooks/useOptimisticSearch";
import { startNavigation } from "@/shared/lib/utils/performance";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";

export default function WebAppPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useWorkosAuth();
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const {
    isAuthenticated: unifiedAuth,
    isLoading: unifiedLoading,
    user: unifiedUser,
    userId,
  } = useAuth();

  // Handle data migration from localStorage to Convex when user authenticates
  useDataMigrationEffect();

  const [currentQuery, setCurrentQuery] = useState("");
  const { history: historyKeywords, isLoaded } = useSearchHistory();

  // Debug authentication state
  useEffect(() => {
    console.log("Authentication Debug:", {
      workosUser: user,
      workosLoading: authLoading,
      convexAuthenticated: isAuthenticated,
      convexLoading: convexLoading,
      unifiedAuth: unifiedAuth,
      unifiedLoading: unifiedLoading,
      unifiedUser: unifiedUser,
      userId: userId,
      userDetails: user
        ? {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePictureUrl: user.profilePictureUrl,
          }
        : null,
    });

    // Additional debugging for token issues
    if (user && !isAuthenticated) {
      console.warn(
        "WorkOS user exists but Convex auth failed - check JWT aud claim in WorkOS Dashboard"
      );
    }

    // Debug unified auth state
    if (isAuthenticated && !unifiedAuth && !unifiedLoading) {
      console.warn("Convex authenticated but unified auth not ready yet");
    }
  }, [
    user,
    authLoading,
    isAuthenticated,
    convexLoading,
    unifiedAuth,
    unifiedLoading,
    unifiedUser,
    userId,
  ]);

  // Use the keyword suggestions hook
  const {
    suggestions,
    loading: suggestionsLoading,
    error: suggestionsError,
    hasValidDescription,
    recordKeywordUsage,
    userDescription,
    fromCache,
    cacheAge,
    generationMetadata,
    totalTrackedKeywords,
    highValueKeywords,
  } = useKeywordSuggestions();

  // Use the keyword re-prompt hook for automatic improvement
  const { isRePrompting, getFlaggedKeywordsCount, insights } =
    useKeywordRePrompt();

  // Use optimistic search for instant results
  const { startOptimisticSearch } = useOptimisticSearch();

  // Unified keyword sync (local first, Convex when authenticated)
  const { addOrUseKeyword } = useKeywordSync();

  // Get flagged keywords count for status display
  const flaggedCount = getFlaggedKeywordsCount();

  // Twitter/X account status (Convex)
  const xAccount = useQuery(
    api.socialAccountsMutations.getXAccount,
    isAuthenticated ? {} : "skip"
  );

  const xLoading = isAuthenticated && xAccount === undefined;
  const xConnected = !!xAccount;
  const xHandle = xAccount?.screenName
    ? `@${xAccount.screenName}`
    : xAccount?.providerAccountId
      ? `@${xAccount.providerAccountId}`
      : "N/A";
  const xExpiresAt = xAccount?.expiresAt as number | undefined;
  const xExpiresDisplay = xExpiresAt
    ? new Date(xExpiresAt).toLocaleString()
    : "Unknown";
  const xExpired = xExpiresAt !== undefined ? Date.now() >= xExpiresAt : false;
  const xHasRefresh = Boolean(xAccount?.refreshToken);
  const xScopesRaw = xAccount?.scope || "";
  const xScopeSet = new Set(
    xScopesRaw
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const xHasTweetWrite = xScopeSet.has("tweet.write");
  const xHasMediaWrite = xScopeSet.has("media.write");
  const xHasUsersRead = xScopeSet.has("users.read");
  const xHasOffline = xScopeSet.has("offline.access");
  const xProfileHydrated = Boolean(
    xAccount?.name || xAccount?.profileImageUrl || xAccount?.screenName
  );
  const xConnectedAtDisplay = xAccount?._creationTime
    ? new Date(xAccount._creationTime).toLocaleString()
    : undefined;

  // Prefetch the search route for instant navigation
  useEffect(() => {
    router.prefetch("/search");
  }, [router]);

  const handleSearch = useCallback(
    async (query: string, exactMatch: boolean) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;

      // Start performance monitoring
      startNavigation(trimmedQuery);

      // Start optimistic search immediately
      startOptimisticSearch(trimmedQuery, exactMatch);

      // Add keyword to store (local + Convex if authenticated) and get the ID
      const keywordId = await addOrUseKeyword(
        trimmedQuery,
        "user_created",
        exactMatch
      );

      const params = new URLSearchParams();
      params.set("q", trimmedQuery);
      if (exactMatch) params.set("exact", "true");
      params.set("keywordId", keywordId);

      // Use replace instead of push for faster navigation
      // This avoids adding to browser history for search operations
      router.replace(`/search?${params.toString()}`);
    },
    [router, startOptimisticSearch, addOrUseKeyword]
  );

  const handleKeywordClick = useCallback(
    async (item: KeywordItem) => {
      // Start performance monitoring
      startNavigation(item.keyword);

      // Start optimistic search immediately with the stored exact match setting
      startOptimisticSearch(item.keyword, item.exactMatch ?? false);

      // Add keyword to store (local + Convex if authenticated) and get the ID
      const keywordId = await addOrUseKeyword(
        item.keyword,
        "ai_suggestion",
        item.exactMatch ?? false, // Use the stored exact match setting
        item.metadata
      );
      recordKeywordUsage(item.id, item.keyword); // This hook might still be useful for other analytics

      const params = new URLSearchParams();
      params.set("q", item.keyword);
      if (item.exactMatch) {
        params.set("exact", "true");
      }
      params.set("keywordId", keywordId);

      // Use replace for faster navigation
      router.replace(`/search?${params.toString()}`);
    },
    [router, recordKeywordUsage, startOptimisticSearch, addOrUseKeyword]
  );

  const handleQueryChange = useCallback((query: string) => {
    setCurrentQuery(query);
  }, []);

  // Get recent keywords (limit to 5 for homepage)
  const recentKeywords = historyKeywords.slice(0, 5);

  return (
    <div className="mx-auto mt-12 max-w-lg px-4">
      <h1 className="mb-4 text-center text-2xl font-medium">
        Who will you{" "}
        <span className="text-muted-foreground line-through">sell</span> help?
      </h1>

      <SearchInput
        onSearch={handleSearch}
        onQueryChange={handleQueryChange}
        placeholder="Type keywords..."
        className="mb-4"
      />

      {/* Comprehensive Debug Information */}
      {process.env.NODE_ENV === "development" && (
        <Alert className="mb-4">
          <AlertTitle>Debug - System Status & Sync</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            <div className="space-y-2">
              {/* Authentication Status */}
              <div className="space-y-1">
                <div className="font-semibold text-blue-600">
                  Authentication Status:
                </div>
                <div>
                  WorkOS User: {user ? "Authenticated" : "Not Authenticated"}
                </div>
                <div>WorkOS Loading: {authLoading ? "Yes" : "No"}</div>
                <div>
                  Convex Authenticated: {isAuthenticated ? "Yes" : "No"}
                </div>
                <div>Convex Loading: {convexLoading ? "Yes" : "No"}</div>
                <div>Unified Auth: {unifiedAuth ? "Yes" : "No"}</div>
                <div>Unified Loading: {unifiedLoading ? "Yes" : "No"}</div>
                <div>User ID: {userId || "None"}</div>
                {user && (
                  <div className="text-xs opacity-75">
                    Email: {user.email} | Name: {user.firstName} {user.lastName}
                  </div>
                )}

                {/* Twitter/X Account Status */}
                <div className="mt-1 space-y-1">
                  <div className="font-semibold text-sky-600">
                    Twitter Account:
                  </div>
                  <div>
                    Status:{" "}
                    {xLoading
                      ? "Loading"
                      : xConnected
                        ? "Connected"
                        : "Not Connected"}
                  </div>
                  {xConnected && (
                    <>
                      <div>Handle: {xHandle}</div>
                      <div>
                        Token Expiry: {xExpiresDisplay}{" "}
                        {xExpiresAt !== undefined && (
                          <span
                            className={
                              xExpired ? "text-red-600" : "text-green-600"
                            }
                          >
                            ({xExpired ? "Expired" : "Valid"})
                          </span>
                        )}
                      </div>
                      <div>
                        Refresh Token Present: {xHasRefresh ? "Yes" : "No"}
                      </div>
                      <div>Scopes: {xScopesRaw || "None"}</div>
                      <div>
                        Required Scopes: tweet.write[
                        {xHasTweetWrite ? "✓" : "✗"}], media.write[
                        {xHasMediaWrite ? "✓" : "✗"}], users.read[
                        {xHasUsersRead ? "✓" : "✗"}], offline.access[
                        {xHasOffline ? "✓" : "✗"}]
                      </div>
                      <div>
                        Profile Hydrated: {xProfileHydrated ? "Yes" : "No"}
                      </div>
                      {xConnectedAtDisplay && (
                        <div>Connected At: {xConnectedAtDisplay}</div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Data Sync Status */}
              <div className="space-y-1 border-t pt-1">
                <div className="font-semibold text-green-600">
                  Data Sync Status:
                </div>
                <div>
                  Sync Strategy:{" "}
                  {isAuthenticated ? "Convex + Local" : "Local Only"}
                </div>
                <div>
                  Migration Status: {isAuthenticated ? "Completed" : "Pending"}
                </div>
                <div>Local Keywords: {recentKeywords.length}</div>
                <div>Total Tracked: {totalTrackedKeywords}</div>
                <div>High Value Keywords: {highValueKeywords}</div>
                <div>Flagged Keywords: {flaggedCount}</div>
                <div>History Loaded: {isLoaded ? "Yes" : "No"}</div>
              </div>

              {/* Query & Suggestions State */}
              <div className="space-y-1 border-t pt-1">
                <div className="font-semibold text-purple-600">
                  Query & Suggestions:
                </div>
                <div>Current Query: &quot;{currentQuery}&quot;</div>
                <div>Suggestions Count: {suggestions.length}</div>
                <div>Loading: {suggestionsLoading ? "Yes" : "No"}</div>
                <div>Is Re-prompting: {isRePrompting ? "Yes" : "No"}</div>
                <div>From Cache: {fromCache ? "Yes" : "No"}</div>
                <div>
                  Cache Age:{" "}
                  {cacheAge
                    ? `${Math.round((Date.now() - cacheAge) / 1000)}s ago`
                    : "N/A"}
                </div>
                <div>
                  User Description:{" "}
                  {userDescription ? `${userDescription.length} chars` : "None"}
                </div>
                <div>
                  Has Valid Description: {hasValidDescription ? "Yes" : "No"}
                </div>
              </div>

              {/* Error States */}
              {suggestionsError && (
                <div className="space-y-1 border-t pt-1">
                  <div className="font-semibold text-red-600">
                    Error States:
                  </div>
                  <div className="text-destructive">
                    Suggestions Error: {suggestionsError}
                  </div>
                  <div>Error Time: {new Date().toLocaleTimeString()}</div>
                </div>
              )}

              {/* Generation Metadata */}
              {generationMetadata.requestId && (
                <div className="space-y-1 border-t pt-1">
                  <div className="font-semibold text-orange-600">
                    Generation Metadata:
                  </div>
                  <div>• Request ID: {generationMetadata.requestId}</div>
                  {generationMetadata.processingTimeMs && (
                    <div>
                      • Processing: {generationMetadata.processingTimeMs}ms
                    </div>
                  )}
                  {generationMetadata.llmProcessingTimeMs && (
                    <div>
                      • LLM Time: {generationMetadata.llmProcessingTimeMs}ms
                    </div>
                  )}
                  {generationMetadata.modelUsed && (
                    <div>• Model: {generationMetadata.modelUsed}</div>
                  )}
                  {generationMetadata.usedFallback && (
                    <div>• Used Fallback: Yes</div>
                  )}
                  {generationMetadata.confidenceStats && (
                    <div>
                      • Confidence:{" "}
                      {generationMetadata.confidenceStats.min.toFixed(2)}-
                      {generationMetadata.confidenceStats.max.toFixed(2)} (avg:{" "}
                      {generationMetadata.confidenceStats.avg.toFixed(2)})
                    </div>
                  )}
                </div>
              )}

              {/* Performance Insights */}
              {insights && (
                <div className="space-y-1 border-t pt-1">
                  <div className="font-semibold text-cyan-600">
                    Performance Insights:
                  </div>
                  <div>
                    • High Performing:{" "}
                    {insights.highPerformingPatterns.join(", ")}
                  </div>
                  {insights.recommendedAdjustments.length > 0 && (
                    <div>
                      • Adjustments:{" "}
                      {insights.recommendedAdjustments.join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {!suggestionsError && (
          <KeywordSuggestions
            suggestions={suggestions}
            onSuggestionClick={handleKeywordClick}
            loading={suggestionsLoading}
            currentQuery={currentQuery}
          />
        )}

        {/* Simple inline error text for any suggestion error */}
        {suggestionsError && (
          <p className="px-3.5 text-sm text-red-500" role="alert">
            {suggestionsError}
          </p>
        )}

        <Separator />

        {/* Show similar keywords if user has typed something */}
        {currentQuery.trim() && (
          <>
            <SimilarKeywords
              currentQuery={currentQuery}
              onKeywordClick={handleKeywordClick}
              loading={!isLoaded}
              maxResults={5}
              threshold={0.3}
            />
            <Separator />
          </>
        )}

        <RecentKeywords
          currentQuery={currentQuery}
          onKeywordClick={handleKeywordClick}
          loading={!isLoaded}
          maxResults={5}
        />
      </div>
    </div>
  );
}
