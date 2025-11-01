"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import CharacterCounter from "@/shared/ui/components/CharacterCounter";
import { Button } from "@/shared/ui/components/Button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/shared/ui/components/Form";
import { Textarea } from "@/shared/ui/components/TextArea";
import { cn } from "@/shared/lib/utils/utils";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  onboardingSchema,
  type OnboardingFormValues,
} from "@/shared/lib/schemas/validation";
import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils/validation";
import {
  storeWorkspaceDescription,
  storeWorkspaceName,
} from "@/shared/lib/utils/localStorage";
import { storeWorkspaceSourceUrl } from "@/shared/lib/utils/localStorage";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { PageLayout, PageContent } from "@/features/webapp/ui/components";
import { logger } from "@/shared/lib/logger";
import { useKeywordSuggestions } from "@/features/keywords/hooks/useKeywordSuggestions";
import { useEffect, useRef, useState } from "react";
import { useKeywordSync } from "@/shared/hooks/useKeywordSync";
import { useOptimisticSearch } from "@/features/search/hooks/useOptimisticSearch";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";

const MIN_CHARS = DESCRIPTION_CONSTRAINTS.MIN_LENGTH;
const MAX_CHARS = DESCRIPTION_CONSTRAINTS.MAX_LENGTH;
const SEED_REDIRECT_COUNTDOWN_SECONDS = 5;

type UrlCache = Record<string, string>;

function getHelpText(charCount: number): {
  text: string;
  variant: "default" | "warning" | "error";
} {
  if (charCount === 0) {
    return {
      text: "↳ Required for keyword suggestions and filtering.",
      variant: "default",
    };
  }
  if (charCount < MIN_CHARS) {
    return { text: "↳ Describe more.", variant: "warning" };
  }
  if (charCount >= MAX_CHARS) {
    return { text: "↳ Character limit reached.", variant: "error" };
  }
  return {
    text: "↳ Keywords will be suggested based on this description.",
    variant: "default",
  };
}

// Small, self-contained spinner built with braille unicode frames.
// Renders a fixed-width spinner followed by the provided text.
const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;

function AsciiSpinnerText({
  text,
  intervalMs = 40,
  className,
}: {
  text: string;
  intervalMs?: number;
  className?: string;
}) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return (
    <span role="status" aria-live="polite" className={className} title={text}>
      <span className="inline-block w-[1em] select-none" aria-hidden>
        {SPINNER_FRAMES[frame]}
      </span>{" "}
      <span>{text}</span>
    </span>
  );
}

export default function OnboardingClient() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const createDefaultWorkspace = useMutation(
    api.workspaces.createDefaultWorkspace
  );
  const setOnboardingCompleted = useMutation(api.users.setOnboardingCompleted);
  const { generateSeedKeyword } = useKeywordSuggestions();
  const { addOrUseKeyword } = useKeywordSync();
  const { startOptimisticSearch } = useOptimisticSearch();

  const [isGeneratingSeed, setIsGeneratingSeed] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(
    null
  );
  const [countdownFinished, setCountdownFinished] = useState(false);

  // URL reading & streaming state
  const [isReadingUrl, setIsReadingUrl] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const readAbortRef = useRef<AbortController | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const typingTimerRef = useRef<number | null>(null);
  const [currentSourceUrl, setCurrentSourceUrl] = useState<string | null>(null);

  const LS_KEY = "RX_DESC_BY_URL_V1";
  const getCache = (): UrlCache => {
    try {
      const raw = window.localStorage.getItem(LS_KEY) || "{}";
      return JSON.parse(raw) as UrlCache;
    } catch {
      return {};
    }
  };
  const setCache = (k: string, v: string) => {
    try {
      const cur = getCache();
      cur[k] = v;
      window.localStorage.setItem(LS_KEY, JSON.stringify(cur));
    } catch {}
  };

  const normalizeUrl = (input: string): string | null => {
    const s = input.trim();
    if (!s) return null;
    try {
      const url = new URL(s.startsWith("http") ? s : `https://${s}`);
      url.hash = "";
      return url.toString();
    } catch {
      return null;
    }
  };

  // Only treat the entire field as a URL (no extra text), not a substring.
  const getUrlFromWholeValue = (s: string): string | null => {
    const trimmed = s.trim();
    if (!trimmed) return null;
    // Reject if contains spaces (indicates multiple tokens)
    if (trimmed.includes(" ")) return null;
    // Must be either http(s) URL or a domain with a TLD
    const hasScheme = /^https?:\/\//i.test(trimmed);
    const candidate = hasScheme ? trimmed : `https://${trimmed}`;
    const endsWithDot = /\.$/.test(trimmed);
    if (endsWithDot) return null; // incomplete domain like "acme."
    try {
      const u = new URL(candidate);
      // Require a dot in hostname to avoid single tokens like "localhost"
      if (!u.hostname.includes(".")) return null;
      // Validate TLD: only letters and at least 2 characters (avoid partial like ".i")
      const parts = u.hostname.split(".");
      const tld = parts[parts.length - 1];
      if (!/^[a-zA-Z]{2,63}$/.test(tld)) return null;
      // Disallow trailing unmatched parentheses/brackets (common when copying)
      if (/[\(\[]$/.test(trimmed)) return null;
      return u.toString();
    } catch {
      return null;
    }
  };

  const scheduleReadIfValid = (value: string) => {
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    // Debounce to avoid triggering while user is mid-typing
    typingTimerRef.current = window.setTimeout(() => {
      const possible = getUrlFromWholeValue(value);
      if (possible && !isReadingUrl) {
        void beginRead(possible);
      }
    }, 700);
  };

  const beginRead = async (url: string) => {
    // Enter read mode: lock the textarea but keep the user's URL visible
    // until we actually receive the first non-whitespace token from the stream.
    setIsReadingUrl(true);
    setReadError(null);

    const norm = normalizeUrl(url)!;
    const cachedMem = urlCacheRef.current.get(norm);
    const cachedLs = getCache()[norm];
    const cached = cachedMem || cachedLs;
    if (cached) {
      form.setValue("description", cached, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setIsReadingUrl(false);
      try {
        storeWorkspaceSourceUrl(norm);
      } catch {}
      setCurrentSourceUrl(norm);
      return;
    }

    const ctrl = new AbortController();
    readAbortRef.current = ctrl;
    try {
      const res = await fetch("/api/describe-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: norm }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        let msg = "Failed to read URL.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error as string;
        } catch {}
        setReadError(msg);
        setIsReadingUrl(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let hasStarted = false; // flips once we see the first non-whitespace char
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        if (!hasStarted) {
          const idx = buf.search(/\S/);
          if (idx === -1) {
            // still only whitespace → keep showing the URL; do not mutate field yet
            continue;
          }
          buf = buf.slice(idx); // drop all leading whitespace once
          hasStarted = true;
        }
        // Now stream tokens as they arrive
        form.setValue("description", buf, { shouldValidate: true });
      }
      // Flush any remaining bytes from the decoder buffer
      const tail = decoder.decode();
      if (tail) {
        buf += tail;
      }
      // Remove any leading whitespace that may have arrived in the very last decode
      let finalText = buf;
      if (!hasStarted) {
        // Never received a non-whitespace character while streaming
        finalText = finalText.replace(/^\s+/, "");
      }

      // Fallback: if stream produced nothing, retry in JSON (non-streaming) mode
      if (!finalText || finalText.trim().length === 0) {
        try {
          const jres = await fetch("/api/describe-url?mode=json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: norm }),
            signal: ctrl.signal,
          });
          if (jres.ok) {
            const j = (await jres.json()) as { text?: string };
            if (j?.text && j.text.trim().length > 0) {
              form.setValue("description", j.text, { shouldValidate: true });
              urlCacheRef.current.set(norm, j.text);
              setCache(norm, j.text);
              try {
                storeWorkspaceSourceUrl(norm);
              } catch {}
              setCurrentSourceUrl(norm);
              return;
            }
          }
        } catch {}
      } else {
        // Ensure the textarea shows the fully trimmed text
        const trimmed = finalText.replace(/^\s+/, "");
        form.setValue("description", trimmed, { shouldValidate: true });
        urlCacheRef.current.set(norm, trimmed);
        setCache(norm, trimmed);
        try {
          storeWorkspaceSourceUrl(norm);
        } catch {}
        setCurrentSourceUrl(norm);
      }
    } catch (e) {
      const isAbort =
        (e instanceof DOMException && e.name === "AbortError") ||
        // some environments throw generic Error with message including AbortError
        (e instanceof Error && /AbortError/i.test(e.name + e.message));
      if (!isAbort) {
        setReadError(
          "We couldn't read that URL. You can edit manually or try again."
        );
      }
    } finally {
      setIsReadingUrl(false);
      readAbortRef.current = null;
    }
  };

  const cancelRead = () => {
    readAbortRef.current?.abort();
    setIsReadingUrl(false);
    setReadError(null);
  };

  // Start a short countdown while generating the seed. Cleans up on unmount or when cancelled.
  useEffect(() => {
    if (!isGeneratingSeed) {
      setRedirectCountdown(null);
      setCountdownFinished(false);
      return;
    }

    const startAt = Date.now();
    const deadline = startAt + SEED_REDIRECT_COUNTDOWN_SECONDS * 1000;
    setRedirectCountdown(SEED_REDIRECT_COUNTDOWN_SECONDS);
    setCountdownFinished(false);

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const remainingMs = Math.max(0, deadline - now);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      setRedirectCountdown(remainingSeconds);
      if (remainingMs === 0) {
        setCountdownFinished(true);
        window.clearInterval(intervalId);
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isGeneratingSeed]);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { description: "" },
    mode: "onChange",
  });

  const description = form.watch("description");
  const charCount = description.length;
  const isFormValid = form.formState.isValid && charCount >= MIN_CHARS;
  const helpText = getHelpText(charCount);

  const onSubmit = async (data: OnboardingFormValues) => {
    try {
      setIsGeneratingSeed(true);

      // Kick off lightweight tasks immediately and in parallel
      // 1) Ensure local workspace data is saved for unauthenticated users
      if (!isAuthenticated) {
        storeWorkspaceDescription(data.description);
        storeWorkspaceName("Default workspace");
        if (currentSourceUrl) {
          storeWorkspaceSourceUrl(currentSourceUrl);
        }
        try {
          window.localStorage.setItem(
            "RX_ONBOARDING_COMPLETED",
            String(Date.now())
          );
        } catch {}
      }

      // 2) Set onboarding cookie early to avoid middleware round-trip
      const cookiePromise = fetch("/api/onboarding/complete", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        keepalive: true,
      }).catch(() => {});

      // 3) Fire Convex mutations without blocking navigation
      if (isAuthenticated) {
        void Promise.allSettled([
          createDefaultWorkspace({
            description: data.description,
            name: "Default workspace",
            descriptionSource: currentSourceUrl ? "url" : "manual",
            sourceUrl: currentSourceUrl || undefined,
            lastGeneratedAt: currentSourceUrl ? Date.now() : undefined,
          }),
          setOnboardingCompleted({}),
        ]);
      }

      logger.info("[ONBOARDING] Generating seed keyword for instant search");

      // Generate seed keyword with explicit description to avoid hydration race
      const abortRef = new AbortController();
      // Cancel on unmount/navigation
      const cancel = () => abortRef.abort();
      window.addEventListener("beforeunload", cancel);
      try {
        // Attempt with light client-side retry to smooth transient failures
        const getSeedWithRetry = async (desc: string) => {
          for (let attempt = 1; attempt <= 3; attempt++) {
            const r = await generateSeedKeyword(desc);
            if (r) return r;
            await new Promise((res) => setTimeout(res, attempt * 500));
          }
          return null;
        };

        const seedResult = await getSeedWithRetry(data.description);
        if (seedResult) {
          logger.info(
            "[ONBOARDING] Seed keyword generated, routing to search:",
            {
              keyword: seedResult.keyword,
              exactMatch: seedResult.exactMatch,
            }
          );

          // Ensure onboarding cookie exists before navigating to avoid middleware status fetch
          try {
            await cookiePromise;
          } catch {}

          // For authenticated users, ensure server flag is set before navigation to satisfy middleware status checks
          if (isAuthenticated) {
            try {
              await setOnboardingCompleted({});
            } catch {}
          }

          // Warm optimistic results to mirror manual search UX
          try {
            startOptimisticSearch(seedResult.keyword, seedResult.exactMatch);
          } catch {}

          // Create/use keyword to obtain a stable keywordId for progress subscription
          let keywordId = "";
          try {
            keywordId = await addOrUseKeyword(
              seedResult.keyword,
              "ai_suggestion",
              seedResult.exactMatch
            );
          } catch {}

          const searchParams = new URLSearchParams();
          searchParams.set("q", seedResult.keyword);
          if (seedResult.exactMatch) {
            searchParams.set("exact", "true");
          }
          if (keywordId) {
            searchParams.set("keywordId", keywordId);
          }
          searchParams.set("tour", "starter");
          router.push(`/search?${searchParams.toString()}`);
        } else {
          logger.warn("[ONBOARDING] No seed keyword generated");
          throw new Error("Seed generation returned null");
        }
      } finally {
        window.removeEventListener("beforeunload", cancel);
      }
    } catch (error) {
      logger.error("Failed to submit onboarding:", error);
      // Ensure cookie is set to avoid middleware gating on subsequent attempts
      try {
        await fetch("/api/onboarding/complete", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          keepalive: true,
        });
      } catch {}
    } finally {
      // Ensure the button is re-enabled in all paths (no spinner UI used)
      setIsGeneratingSeed(false);
    }
  };

  if (authLoading) {
    return (
      <PageLayout className="mx-auto md:border-r-0">
        <PageContent className="mx-4 mt-12 pb-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-32 w-full" />
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="mx-auto md:border-r-0">
      <PageContent className="mx-4 mt-12 pb-4">
        <h1 className="mb-4 text-center text-2xl font-medium tracking-tight">
          How will you help?
        </h1>

        {process.env.NODE_ENV === "development" && (
          <Alert className="mb-6">
            <AlertTitle>Debug - Onboarding Status</AlertTitle>
            <AlertDescription className="font-mono text-xs">
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="font-semibold text-blue-600">
                    Authentication Status:
                  </div>
                  <div>
                    Status:{" "}
                    {isAuthenticated ? "Authenticated" : "Not Authenticated"}
                  </div>
                  <div>Loading: {authLoading ? "Yes" : "No"}</div>
                  <div>
                    Data Strategy:{" "}
                    {isAuthenticated
                      ? "Save to Convex account"
                      : "Save locally, sync on signup"}
                  </div>
                </div>
                <div className="space-y-1 border-t pt-1">
                  <div className="font-semibold text-green-600">
                    Form State:
                  </div>
                  <div>Character Count: {charCount}</div>
                  <div>Min Required: {MIN_CHARS}</div>
                  <div>Max Allowed: {MAX_CHARS}</div>
                  <div>Form Valid: {isFormValid ? "Yes" : "No"}</div>
                  <div>
                    Submitting: {form.formState.isSubmitting ? "Yes" : "No"}
                  </div>
                  <div>Help Text: {helpText.text}</div>
                  <div>Help Variant: {helpText.variant}</div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="description" className="sr-only">
                    Description
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      id="description"
                      placeholder="Enter your product, service, or portfolio link to auto-fill or fill manually..."
                      className={cn(
                        "max-h-fit min-h-[120px] resize-y",
                        charCount > MAX_CHARS && "border-destructive"
                      )}
                      {...field}
                      readOnly={isReadingUrl}
                      disabled={isReadingUrl}
                      onChange={(e) => {
                        if (isReadingUrl) return;
                        const val = e.target.value;
                        field.onChange(e);
                        scheduleReadIfValid(val);
                      }}
                      onPaste={(e) => {
                        if (isReadingUrl) return;
                        const pasted = e.clipboardData.getData("text");
                        const possible = getUrlFromWholeValue(pasted);
                        if (possible) {
                          e.preventDefault();
                          form.setValue("description", possible, {
                            shouldValidate: false,
                          });
                          void beginRead(possible);
                        }
                      }}
                      onBlur={(e) => {
                        if (isReadingUrl) return;
                        const val = e.target.value;
                        const possible = getUrlFromWholeValue(val);
                        if (possible) {
                          void beginRead(possible);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (isReadingUrl) return;
                        const target = e.currentTarget as HTMLTextAreaElement;
                        const possible = getUrlFromWholeValue(target.value);
                        // Begin read immediately on Enter (no Shift)
                        if (e.key === "Enter" && !e.shiftKey && possible) {
                          e.preventDefault();
                          void beginRead(possible);
                          return;
                        }
                      }}
                      maxLength={MAX_CHARS + 50}
                      aria-required="true"
                    />
                  </FormControl>
                  <div
                    className={cn(
                      "text-sm transition-colors",
                      helpText.variant === "error"
                        ? "text-red-500 focus-visible:ring-red-500"
                        : helpText.variant === "warning"
                          ? "text-primary dark:text-primary"
                          : "text-muted-foreground"
                    )}
                  >
                    {isReadingUrl ? (
                      <AsciiSpinnerText text="Auto-filling description from your link..." />
                    ) : (
                      helpText.text
                    )}
                  </div>

                  {readError && (
                    <Alert className="mt-2">
                      <AlertTitle>Couldn&apos;t read the URL</AlertTitle>
                      <AlertDescription>
                        {readError} You can paste another URL. You can also
                        write a manual description.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="flex items-center justify-between">
                    <CharacterCounter current={charCount} max={MAX_CHARS} />
                    <div className="flex items-center gap-2">
                      {isReadingUrl && (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={cancelRead}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        type="submit"
                        size="xs"
                        disabled={
                          isReadingUrl ||
                          !isFormValid ||
                          form.formState.isSubmitting ||
                          isGeneratingSeed
                        }
                      >
                        {(() => {
                          if (isReadingUrl) return "Auto-filling...";
                          if (isGeneratingSeed) {
                            if (
                              redirectCountdown !== null &&
                              redirectCountdown > 0
                            ) {
                              return (
                                <>
                                  <span>Redirecting in</span>{" "}
                                  <AnimatedNumber value={redirectCountdown} />
                                </>
                              );
                            }
                            return countdownFinished
                              ? "Searching..."
                              : "Generating...";
                          }
                          return form.formState.isSubmitting
                            ? "..."
                            : "Continue";
                        })()}
                      </Button>
                    </div>
                  </div>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </PageContent>
    </PageLayout>
  );
}
