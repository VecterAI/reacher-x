"use client";

import { useCallback, useRef, useState } from "react";
import {
  getUrlFromWholeValue,
  normalizeUrl,
} from "@/shared/lib/urls/urlParsing";
import { cacheGet, cacheSet } from "@/shared/lib/utils";

type SetText = (
  text: string,
  opts?: { validate?: boolean; dirty?: boolean }
) => void;

export function useUrlDescription(options: {
  setText: SetText;
  onSourceUrlChange?: (url: string | null) => void;
  onReadingChange?: (reading: boolean) => void;
  debounceMs?: number;
}) {
  const {
    setText,
    onSourceUrlChange,
    onReadingChange,
    debounceMs = 700,
  } = options;

  const [isReadingUrl, setIsReadingUrl] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [currentSourceUrl, setCurrentSourceUrl] = useState<string | null>(null);

  const readAbortRef = useRef<AbortController | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  const setReading = useCallback(
    (reading: boolean) => {
      setIsReadingUrl(reading);
      if (onReadingChange) onReadingChange(reading);
    },
    [onReadingChange]
  );

  const beginRead = useCallback(
    async (url: string) => {
      setReading(true);
      setReadError(null);
      const norm = normalizeUrl(url);
      if (!norm) {
        setReadError("Please enter a valid URL.");
        setReading(false);
        return;
      }
      const cached = cacheGet(norm);
      if (cached) {
        setText(cached, { validate: true, dirty: true });
        setReading(false);
        setCurrentSourceUrl(norm);
        onSourceUrlChange?.(norm);
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
          setReading(false);
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
          setText(buf, { validate: true });
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
                setText(j.text, { validate: true });
                cacheSet(norm, j.text);
                setCurrentSourceUrl(norm);
                onSourceUrlChange?.(norm);
                return;
              }
            }
          } catch {}
        } else {
          // Ensure the textarea shows the fully trimmed text
          const trimmed = finalText.replace(/^\s+/, "");
          setText(trimmed, { validate: true });
          cacheSet(norm, trimmed);
          setCurrentSourceUrl(norm);
          onSourceUrlChange?.(norm);
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
        setReading(false);
        readAbortRef.current = null;
      }
    },
    [onSourceUrlChange, setText, setReading]
  );

  const scheduleReadIfValid = useCallback(
    (value: string) => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      typingTimerRef.current = window.setTimeout(() => {
        const possible = getUrlFromWholeValue(value);
        if (possible && !isReadingUrl) {
          void beginRead(possible);
        }
      }, debounceMs);
    },
    [beginRead, debounceMs, isReadingUrl]
  );

  const cancelRead = useCallback(() => {
    readAbortRef.current?.abort();
    setReading(false);
    setReadError(null);
  }, [setReading]);

  return {
    isReadingUrl,
    readError,
    currentSourceUrl,
    scheduleReadIfValid,
    beginRead,
    cancelRead,
  };
}
