"use client";

import * as React from "react";
import type { VoiceNoteRecorderController } from "@/features/composer/hooks/useVoiceNoteRecorder";
import { Button } from "@/shared/ui/components/Button";
import { Spinner } from "@/shared/ui/components/Spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";
import { Waveform } from "@/shared/ui/components/Waveform";
import {
  ArrowUpwardIcon,
  CloseIcon,
  DeleteIcon,
  MicIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  RefreshIcon,
  StopIcon,
} from "@/shared/ui/components/icons";
import { VoiceNoteTime } from "./VoiceNoteTime";

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function VoiceNoteIconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="xsIcon"
          variant="ghost"
          aria-label={label}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function VoiceNoteTrigger({
  disabled,
  onStart,
}: {
  disabled: boolean;
  onStart: () => void;
}) {
  return (
    <Button
      type="button"
      size="xsIcon"
      variant="ghost"
      disabled={disabled}
      aria-label="Record voice note"
      title="Record voice note"
      onClick={onStart}
    >
      <MicIcon className="fill-current" aria-hidden="true" />
    </Button>
  );
}

export function VoiceNoteComposer({
  controller,
  sending,
  onDelete,
  onSend,
}: {
  controller: VoiceNoteRecorderController;
  sending: boolean;
  onDelete: () => void;
  onSend: () => void;
}) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const objectUrlRef = React.useRef<string | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const durationSeconds = Math.max(
    (controller.recording?.durationMs ?? controller.elapsedMs) / 1000,
    0.001
  );

  React.useEffect(() => {
    const file = controller.recording?.file;
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    if (audioRef.current) audioRef.current.src = objectUrl;
    return () => {
      URL.revokeObjectURL(objectUrl);
      if (objectUrlRef.current === objectUrl) objectUrlRef.current = null;
    };
  }, [controller.recording?.file]);

  const isRecording = controller.status === "recording";
  const isRequesting = controller.status === "requesting";
  const isReview = controller.status === "review";
  const isError = controller.status === "error";
  const progress = isReview ? currentTime / durationSeconds : 1;
  const shownDurationMs = isReview ? currentTime * 1_000 : controller.elapsedMs;
  const totalDurationMs = isReview
    ? (controller.recording?.durationMs ?? controller.elapsedMs)
    : controller.maximumDurationMs;

  const togglePlayback = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <section
        className="bg-muted/40 flex min-h-10 min-w-0 items-center gap-1 overflow-hidden rounded-md px-1.5 py-1"
        aria-label="Voice note"
        aria-busy={isRequesting || sending}
      >
        <audio
          ref={audioRef}
          preload="metadata"
          onTimeUpdate={(event) =>
            setCurrentTime(event.currentTarget.currentTime)
          }
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrentTime(0);
          }}
        />

        <VoiceNoteIconButton
          label={isReview ? "Delete voice note" : "Cancel recording"}
          disabled={sending}
          onClick={isReview ? onDelete : controller.cancel}
        >
          {isReview ? (
            <DeleteIcon className="fill-current" aria-hidden="true" />
          ) : (
            <CloseIcon className="fill-current" aria-hidden="true" />
          )}
        </VoiceNoteIconButton>

        {isRequesting ? (
          <Spinner className="mx-1 size-4 shrink-0" />
        ) : isReview ? (
          <VoiceNoteIconButton
            label={playing ? "Pause voice note" : "Play voice note"}
            disabled={sending}
            onClick={togglePlayback}
          >
            {playing ? (
              <PauseCircleIcon className="fill-current" aria-hidden="true" />
            ) : (
              <PlayCircleIcon className="fill-current" aria-hidden="true" />
            )}
          </VoiceNoteIconButton>
        ) : null}

        {isError ? (
          <p
            className="text-destructive min-w-0 flex-1 truncate text-xs"
            role="alert"
          >
            {controller.error}
          </p>
        ) : (
          <Waveform
            data={controller.waveform}
            progress={progress}
            height={24}
            barWidth={2}
            barGap={2}
            minimumBarHeight={2}
            interactive={isReview && !sending}
            onProgressChange={(nextProgress) => {
              const audio = audioRef.current;
              if (!audio) return;
              const nextTime = nextProgress * durationSeconds;
              audio.currentTime = nextTime;
              setCurrentTime(nextTime);
            }}
            className="min-w-8 flex-1"
          />
        )}

        {!isError ? (
          <VoiceNoteTime
            elapsedMs={shownDurationMs}
            totalMs={totalDurationMs}
          />
        ) : null}

        {isReview ? (
          <VoiceNoteIconButton
            label="Record again"
            disabled={sending}
            onClick={() => {
              onDelete();
              void controller.start();
            }}
          >
            <RefreshIcon className="fill-current" aria-hidden="true" />
          </VoiceNoteIconButton>
        ) : null}

        {isRecording ? (
          <VoiceNoteIconButton label="Stop recording" onClick={controller.stop}>
            <StopIcon className="fill-current" aria-hidden="true" />
          </VoiceNoteIconButton>
        ) : isReview ? (
          <VoiceNoteIconButton
            label="Send voice note"
            variant="default"
            disabled={sending}
            onClick={onSend}
          >
            {sending ? (
              <Spinner className="size-4" />
            ) : (
              <ArrowUpwardIcon className="fill-current" aria-hidden="true" />
            )}
          </VoiceNoteIconButton>
        ) : isError ? (
          <VoiceNoteIconButton
            label="Try recording again"
            onClick={() => void controller.start()}
          >
            <RefreshIcon className="fill-current" aria-hidden="true" />
          </VoiceNoteIconButton>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {isRecording
            ? `Recording voice note, ${formatDuration(controller.elapsedMs)} elapsed.`
            : isReview
              ? "Voice note ready to review."
              : isRequesting
                ? "Requesting microphone access."
                : controller.error}
        </p>
      </section>
    </TooltipProvider>
  );
}
