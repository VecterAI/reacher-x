"use client";

import { useEffect, useState } from "react";

const ROTATION_INTERVAL_MS = 5000;

export type RotationSnapshot = { index: number; phase: 0 | 1 };

/**
 * One shared timer drives every rotating hero element (headline word and
 * composer placeholder) so they always show the aligned pair.
 */
let snapshot: RotationSnapshot = { index: 0, phase: 0 };
const listeners = new Set<() => void>();
let timer: number | null = null;
let refCount = 0;

function start() {
  timer = window.setInterval(() => {
    snapshot = {
      index: snapshot.index + 1,
      phase: snapshot.phase === 0 ? 1 : 0,
    };
    listeners.forEach((listener) => listener());
  }, ROTATION_INTERVAL_MS);
}

function stop() {
  if (timer != null) window.clearInterval(timer);
  timer = null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  refCount += 1;
  if (timer == null) start();
  return () => {
    listeners.delete(listener);
    refCount -= 1;
    if (refCount === 0) stop();
  };
}

function getSnapshot(): RotationSnapshot {
  return snapshot;
}

/** Static snapshot used for SSR and before subscription. */
export const IDLE_ROTATION: RotationSnapshot = { index: 0, phase: 0 };

/**
 * Subscribes to the shared rotation only while enabled, so pages without
 * rotating elements never start the timer. Consumers read the aligned pair
 * for their step with `items[rotation.index % items.length]`.
 */
export function useHeroRotation(enabled: boolean): RotationSnapshot {
  const [current, setCurrent] = useState<RotationSnapshot>(IDLE_ROTATION);

  useEffect(() => {
    if (!enabled) return;
    setCurrent(getSnapshot());
    return subscribe(() => setCurrent(getSnapshot()));
  }, [enabled]);

  return current;
}
