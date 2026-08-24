"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Slider } from "@/shared/ui/components/Slider";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import {
  PauseCircleIcon,
  PlayCircleIcon,
} from "@/shared/ui/components/icons/index";
import { ConversationUnavailableAttachment } from "./ConversationUnavailableAttachment";

function formatDuration(seconds: number): string {
  const normalized = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(normalized / 60);
  const remainingSeconds = Math.floor(normalized % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

interface ConversationVoiceNoteProps {
  url: string;
  direction: "sent" | "received";
  durationMs?: number;
  platform: "linkedin" | "twitter";
}

export function ConversationVoiceNote({
  url,
  direction,
  durationMs,
  platform,
}: ConversationVoiceNoteProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState((durationMs ?? 0) / 1000);
  const [unavailable, setUnavailable] = React.useState(false);
  const hasDuration = duration > 0;
  const sliderMaximum = Math.max(duration, 1);
  const sliderValue = Math.min(currentTime, sliderMaximum);
  const displayedSeconds = playing || currentTime > 0 ? currentTime : duration;
  const displayedMinutes = Math.floor(Math.max(0, displayedSeconds) / 60);
  const displayedRemainingSeconds = Math.floor(
    Math.max(0, displayedSeconds) % 60
  );

  React.useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration((durationMs ?? 0) / 1000);
    setUnavailable(false);
  }, [durationMs, url]);

  const togglePlayback = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, []);

  const handleSeek = React.useCallback(
    (values: number[]) => {
      const nextTime = Math.min(Math.max(values[0] ?? 0, 0), duration);
      setCurrentTime(nextTime);
      if (audioRef.current) {
        audioRef.current.currentTime = nextTime;
      }
    },
    [duration]
  );

  if (unavailable) {
    return (
      <ConversationUnavailableAttachment kind="audio" platform={platform} />
    );
  }

  return (
    <div
      className={cn(
        "flex w-full max-w-sm min-w-0 items-center gap-2.5 rounded-[18px] px-3 py-2.5 text-sm",
        direction === "sent"
          ? "bg-foreground text-background self-end"
          : "bg-muted text-foreground self-start"
      )}
    >
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) {
            setDuration(event.currentTarget.duration);
          }
        }}
        onTimeUpdate={(event) =>
          setCurrentTime(event.currentTarget.currentTime)
        }
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => setUnavailable(true)}
      />
      <button
        type="button"
        onClick={togglePlayback}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2",
          direction === "sent"
            ? "text-background hover:bg-background/10 focus-visible:ring-background/60"
            : "text-foreground hover:bg-foreground/8 focus-visible:ring-foreground/35"
        )}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {playing ? (
          <PauseCircleIcon
            className="size-[1.125rem] fill-current"
            aria-hidden="true"
          />
        ) : (
          <PlayCircleIcon
            className="size-[1.125rem] fill-current"
            aria-hidden="true"
          />
        )}
      </button>
      <Slider
        min={0}
        max={sliderMaximum}
        step={0.1}
        value={[sliderValue]}
        onValueChange={handleSeek}
        disabled={!hasDuration}
        className={cn(
          "h-8 min-w-0 flex-1 cursor-pointer touch-none data-disabled:cursor-default",
          "[&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:rounded-full",
          "[&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:shadow-none",
          direction === "sent"
            ? "[&_[data-slot=slider-track]]:bg-background/25 [&_[data-slot=slider-range]]:bg-background [&_[data-slot=slider-thumb]]:bg-background [&_[data-slot=slider-thumb]]:focus-visible:ring-background/60"
            : "[&_[data-slot=slider-track]]:bg-foreground/15 [&_[data-slot=slider-range]]:bg-foreground [&_[data-slot=slider-thumb]]:bg-foreground [&_[data-slot=slider-thumb]]:focus-visible:ring-foreground/35"
        )}
        aria-label="Voice note position"
        aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
      />
      <time
        className="flex shrink-0 items-baseline text-xs opacity-75"
        dateTime={`PT${Math.floor(Math.max(0, displayedSeconds))}S`}
      >
        <AnimatedNumber value={displayedMinutes} />
        <span>:</span>
        <AnimatedNumber
          value={displayedRemainingSeconds}
          format={{ minimumIntegerDigits: 2 }}
        />
      </time>
    </div>
  );
}
