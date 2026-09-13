"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type {
  VoiceNotePlatform,
  VoiceNoteRecorderController,
} from "../../../features/composer/hooks/useVoiceNoteRecorder";
import { readBrowserMediaMetadata } from "@/features/composer/lib/browserMediaMetadata";
import { SampleVoiceRecorder } from "./sampleVoiceRecorderCore";
export type {
  VoiceNotePlatform,
  VoiceNoteRecorderController,
  VoiceNoteRecording,
  VoiceNoteRecorderStatus,
} from "../../../features/composer/hooks/useVoiceNoteRecorder";

async function loadSample(signal: AbortSignal) {
  const response = await fetch("/media/voice-sample.m4a", { signal });
  if (!response.ok) throw new Error("Sample audio could not load. Try again.");
  const file = new File([await response.blob()], "voice-note.m4a", {
    type: "audio/mp4",
  });
  const metadata = await readBrowserMediaMetadata(file, "file");
  if (!metadata.durationMs || metadata.durationMs > 60_000)
    throw new Error("Sample audio is unavailable. Try again.");
  return { file, durationMs: metadata.durationMs, waveform: [] };
}

/** Demo build replacement: identical controller contract, real composer UI. */
export function useVoiceNoteRecorder(
  platform: VoiceNotePlatform | undefined
): VoiceNoteRecorderController {
  const [recorder] = useState(() => new SampleVoiceRecorder(loadSample));
  const state = useSyncExternalStore(
    recorder.subscribe,
    recorder.getSnapshot,
    recorder.getSnapshot
  );
  useEffect(() => recorder.reset, [recorder, platform]);
  return {
    ...state,
    start: async () => {
      if (platform) await recorder.start();
    },
    stop: recorder.stop,
    cancel: recorder.cancel,
    reset: recorder.reset,
  };
}
