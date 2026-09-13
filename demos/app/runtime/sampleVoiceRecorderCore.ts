import type {
  VoiceNoteRecording,
  VoiceNoteRecorderController,
} from "../../../features/composer/hooks/useVoiceNoteRecorder";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";

type Snapshot = Pick<
  VoiceNoteRecorderController,
  | "status"
  | "elapsedMs"
  | "maximumDurationMs"
  | "waveform"
  | "recording"
  | "error"
>;
const idle: Snapshot = {
  status: "idle",
  elapsedMs: 0,
  maximumDurationMs: 60_000,
  waveform: [],
  recording: null,
  error: null,
};
const peaks = [
  0.12, 0.3, 0.58, 0.81, 0.45, 0.23, 0.62, 0.95, 0.42, 0.18, 0.38, 0.7,
];

/** A per-composer sample recording session, with no device or encoding APIs. */
export class SampleVoiceRecorder {
  private snapshot = idle;
  private listeners = new Set<() => void>();
  private request: AbortController | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sample: VoiceNoteRecording | null = null;
  constructor(
    private load: (signal: AbortSignal) => Promise<VoiceNoteRecording>
  ) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(snapshot: Snapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
  private cleanup() {
    this.request?.abort();
    this.request = null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
  start = async () => {
    if (["requesting", "recording"].includes(this.snapshot.status)) return;
    this.cleanup();
    this.sample = null;
    const request = new AbortController();
    this.request = request;
    this.update({ ...idle, status: "requesting" });
    try {
      const sample = await this.load(request.signal);
      if (request.signal.aborted) return;
      this.sample = sample;
      const startedAt = getCurrentUTCTimestamp();
      this.update({ ...idle, status: "recording" });
      this.timer = setInterval(() => {
        const elapsedMs = Math.min(
          idle.maximumDurationMs,
          getCurrentUTCTimestamp() - startedAt
        );
        const count = Math.min(1200, Math.max(1, Math.floor(elapsedMs / 50)));
        this.update({
          ...this.snapshot,
          elapsedMs,
          waveform: Array.from(
            { length: count },
            (_, i) => peaks[i % peaks.length]
          ),
        });
        if (elapsedMs >= idle.maximumDurationMs) this.stop();
      }, 100);
    } catch (error) {
      if (!request.signal.aborted) {
        this.cleanup();
        this.update({
          ...idle,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Sample audio could not load. Try again.",
        });
      }
    }
  };
  stop = () => {
    if (this.snapshot.status !== "recording" || !this.sample) return;
    this.cleanup();
    const recording = {
      ...this.sample,
      waveform: this.snapshot.waveform.length ? this.snapshot.waveform : peaks,
    };
    this.update({
      ...this.snapshot,
      status: "review",
      recording,
      elapsedMs: recording.durationMs,
      waveform: recording.waveform,
    });
  };
  reset = () => {
    this.cleanup();
    this.sample = null;
    this.update(idle);
  };
  cancel = this.reset;
}
