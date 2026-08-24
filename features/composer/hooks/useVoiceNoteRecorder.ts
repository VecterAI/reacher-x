"use client";

import * as React from "react";
import { createLinkedInVoiceNoteFile } from "@/shared/lib/utils/media/linkedinVoiceNote";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";

export type VoiceNotePlatform = "linkedin" | "twitter";
export type VoiceNoteRecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "review"
  | "error";

export interface VoiceNoteRecording {
  file: File;
  durationMs: number;
  waveform: number[];
}

export interface VoiceNoteRecorderController {
  status: VoiceNoteRecorderStatus;
  elapsedMs: number;
  maximumDurationMs: number;
  waveform: number[];
  recording: VoiceNoteRecording | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
  reset: () => void;
}

const MAXIMUM_DURATION_MS = 60_000;
const RECORDING_STOP_HEADROOM_MS = 250;
const WAVEFORM_SAMPLE_INTERVAL_MS = 50;
const MAXIMUM_WAVEFORM_SAMPLES = 1_200;

const LINKEDIN_RECORDER_MIME_TYPES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
] as const;

const X_RECORDER_MIME_TYPES = [
  ...LINKEDIN_RECORDER_MIME_TYPES,
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
] as const;

function getRecorderMimeType(platform: VoiceNotePlatform): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates =
    platform === "linkedin"
      ? LINKEDIN_RECORDER_MIME_TYPES
      : X_RECORDER_MIME_TYPES;
  return (
    candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ??
    null
  );
}

function getXVoiceNoteExtension(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  return "m4a";
}

async function createVoiceNoteFile(args: {
  blob: Blob;
  platform: VoiceNotePlatform;
}): Promise<File> {
  const timestamp = getCurrentUTCTimestamp();
  if (args.platform === "linkedin") {
    return await createLinkedInVoiceNoteFile(
      args.blob,
      `voice-note-${timestamp}.m4a`
    );
  }
  const extension = getXVoiceNoteExtension(args.blob.type);
  return new File([args.blob], `voice-note-${timestamp}.${extension}`, {
    type: args.blob.type,
  });
}

function getMicrophoneError(
  error: unknown,
  platform: VoiceNotePlatform
): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Allow microphone access in your browser, then try again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "Connect a microphone, then try again.";
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return platform === "linkedin"
    ? "This browser cannot record LinkedIn-compatible audio."
    : "Voice recording is unavailable in this browser.";
}

function getVoiceNoteFileError(
  error: unknown,
  platform: VoiceNotePlatform
): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return platform === "linkedin"
    ? "Could not prepare this recording as LinkedIn-compatible M4A audio."
    : "Could not prepare this voice recording for upload.";
}

export function useVoiceNoteRecorder(
  platform: VoiceNotePlatform | undefined
): VoiceNoteRecorderController {
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const waveformRef = React.useRef<number[]>([]);
  const startedAtRef = React.useRef<number | null>(null);
  const discardRef = React.useRef(false);
  const stopTimeoutRef = React.useRef<number | null>(null);
  const sampleIntervalRef = React.useRef<number | null>(null);
  const elapsedIntervalRef = React.useRef<number | null>(null);
  const requestGenerationRef = React.useRef(0);
  const [status, setStatus] = React.useState<VoiceNoteRecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [waveform, setWaveform] = React.useState<number[]>([]);
  const [recording, setRecording] = React.useState<VoiceNoteRecording | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);

  const clearTimers = React.useCallback(() => {
    if (stopTimeoutRef.current !== null) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (sampleIntervalRef.current !== null) {
      window.clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }
    if (elapsedIntervalRef.current !== null) {
      window.clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
  }, []);

  const releaseResources = React.useCallback(() => {
    clearTimers();
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close();
    }
  }, [clearTimers]);

  const stop = React.useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }, []);

  const reset = React.useCallback(() => {
    requestGenerationRef.current += 1;
    discardRef.current = true;
    stop();
    releaseResources();
    recorderRef.current = null;
    chunksRef.current = [];
    waveformRef.current = [];
    startedAtRef.current = null;
    setElapsedMs(0);
    setWaveform([]);
    setRecording(null);
    setError(null);
    setStatus("idle");
  }, [releaseResources, stop]);

  const cancel = React.useCallback(() => {
    discardRef.current = true;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      return;
    }
    reset();
  }, [reset]);

  const start = React.useCallback(async () => {
    if (!platform || status === "requesting" || status === "recording") return;
    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;
    setError(null);
    setRecording(null);
    setElapsedMs(0);
    setWaveform([]);
    setStatus("requesting");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Voice recording is unavailable in this browser.");
      }
      const mimeType = getRecorderMimeType(platform);
      if (!mimeType) {
        throw new Error(
          platform === "linkedin"
            ? "This browser cannot record LinkedIn-compatible M4A audio."
            : "This browser cannot record a supported voice-note format."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (requestGenerationRef.current !== requestGeneration) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);

      recorderRef.current = recorder;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      chunksRef.current = [];
      waveformRef.current = [];
      discardRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        const measuredDurationMs = Math.min(
          MAXIMUM_DURATION_MS,
          Math.max(
            1,
            startedAtRef.current === null
              ? 1
              : getCurrentUTCTimestamp() - startedAtRef.current
          )
        );
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType,
        });
        const savedWaveform = [...waveformRef.current];
        recorderRef.current = null;
        chunksRef.current = [];
        startedAtRef.current = null;
        releaseResources();

        if (discardRef.current) {
          discardRef.current = false;
          setStatus("idle");
          setElapsedMs(0);
          setWaveform([]);
          return;
        }
        if (blob.size === 0) {
          setError("No audio was recorded. Try again.");
          setStatus("error");
          return;
        }

        void createVoiceNoteFile({ blob, platform })
          .then((file) => {
            const nextRecording = {
              file,
              durationMs: measuredDurationMs,
              waveform: savedWaveform,
            };
            setRecording(nextRecording);
            setElapsedMs(measuredDurationMs);
            setWaveform(savedWaveform);
            setStatus("review");
          })
          .catch((createError) => {
            setError(getVoiceNoteFileError(createError, platform));
            setStatus("error");
          });
      };

      const sampleBuffer = new Uint8Array(analyser.frequencyBinCount);
      sampleIntervalRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(sampleBuffer);
        let energy = 0;
        for (const sample of sampleBuffer) {
          const centered = (sample - 128) / 128;
          energy += centered * centered;
        }
        const amplitude = Math.min(
          1,
          Math.max(0.045, Math.sqrt(energy / sampleBuffer.length) * 3.2)
        );
        waveformRef.current = [
          ...waveformRef.current.slice(-(MAXIMUM_WAVEFORM_SAMPLES - 1)),
          amplitude,
        ];
        setWaveform([...waveformRef.current]);
      }, WAVEFORM_SAMPLE_INTERVAL_MS);

      const startedAt = getCurrentUTCTimestamp();
      startedAtRef.current = startedAt;
      elapsedIntervalRef.current = window.setInterval(() => {
        setElapsedMs(
          Math.min(MAXIMUM_DURATION_MS, getCurrentUTCTimestamp() - startedAt)
        );
      }, 100);
      stopTimeoutRef.current = window.setTimeout(
        stop,
        MAXIMUM_DURATION_MS - RECORDING_STOP_HEADROOM_MS
      );
      recorder.start(250);
      setStatus("recording");
    } catch (startError) {
      if (requestGenerationRef.current !== requestGeneration) return;
      releaseResources();
      setError(getMicrophoneError(startError, platform));
      setStatus("error");
    }
  }, [platform, releaseResources, status, stop]);

  React.useEffect(
    () => () => {
      requestGenerationRef.current += 1;
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
      }
      stop();
      releaseResources();
    },
    [releaseResources, stop]
  );

  return {
    status,
    elapsedMs,
    maximumDurationMs: MAXIMUM_DURATION_MS,
    waveform,
    recording,
    error,
    start,
    stop,
    cancel,
    reset,
  };
}
