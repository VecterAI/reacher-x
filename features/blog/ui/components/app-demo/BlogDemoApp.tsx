"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UseCaseDemoApp } from "@/features/landing/ui/components/use-case-demo/UseCaseDemo";
import {
  BLOG_DEMO_SHOTS,
  advanceBlogDemoWait,
  type BlogDemoId,
} from "@/features/blog/lib/blogDemoHelpers";
import {
  activateDemoTarget,
  findDemoTarget,
  measureDemoTarget,
  revealDemoTarget,
} from "@/features/blog/lib/blogDemoDomHelpers";
import { isRecord, getNumberProperty } from "@/convex/lib/typeGuards";

function DemoSession({
  scenario,
  initialIndex,
}: {
  scenario: BlogDemoId;
  initialIndex: number;
}) {
  // A checkpoint is mounted only on seek/replay/takeover recovery, never at ordinary scene boundaries.
  const [initialPresentation] = useState(
    () => BLOG_DEMO_SHOTS[scenario][initialIndex].app
  );
  return (
    <UseCaseDemoApp
      presentation={initialPresentation}
      mixedWorkspaces
      editorialScenario={
        scenario === "workspaces-explained" ? "workspaces" : "hiring"
      }
    />
  );
}

export function BlogDemoApp({ scenario }: { scenario: BlogDemoId }) {
  const [request, setRequest] = useState({
    index: 0,
    revision: 0,
    resetKey: 0,
    initialIndex: 0,
  });
  const current = useRef(request);
  const performed = useRef(-1);
  const send = useCallback(
    (type: string, extra = {}) =>
      window.parent.postMessage({ type, ...extra }, window.location.origin),
    []
  );

  useEffect(() => {
    const message = (event: MessageEvent<unknown>) => {
      if (
        event.source !== window.parent ||
        event.origin !== window.location.origin ||
        !isRecord(event.data)
      )
        return;
      const index = getNumberProperty(event.data, "index"),
        revision = getNumberProperty(event.data, "revision");
      if (
        index === undefined ||
        revision === undefined ||
        !Number.isInteger(index) ||
        !Number.isInteger(revision) ||
        !BLOG_DEMO_SHOTS[scenario][index]
      )
        return;
      if (event.data.type === "reacherx:prepare") {
        const next = {
          index,
          revision,
          resetKey:
            event.data.reset === true ? revision : current.current.resetKey,
          initialIndex:
            event.data.reset === true ? index : current.current.initialIndex,
        };
        current.current = next;
        setRequest(next);
      }
      if (
        event.data.type === "reacherx:act" &&
        current.current.revision === revision &&
        current.current.index === index &&
        performed.current !== revision
      ) {
        const action = BLOG_DEMO_SHOTS[scenario][index].action;
        const target = action && findDemoTarget(document, action);
        if (!target) {
          send("reacherx:error", {
            revision,
            message: "A demo control could not be found. Replay to try again.",
          });
          return;
        }
        try {
          const rect = measureDemoTarget(target);
          activateDemoTarget(target);
          performed.current = revision;
          send("reacherx:acted", { revision, rect });
        } catch {
          send("reacherx:error", {
            revision,
            message: "A demo control is unavailable. Replay to try again.",
          });
        }
      }
    };
    const interact = (event: Event) => {
      if (event.isTrusted) {
        send("reacherx:interact");
        if (event instanceof PointerEvent && event.pointerType === "touch")
          send("reacherx:touch");
      }
    };
    const release = (event: Event) => {
      if (event.isTrusted) send("reacherx:release");
    };
    const escape = (event: KeyboardEvent) => {
      // Let menus consume their first Escape; a second Escape exits the expanded presentation.
      if (
        event.key === "Escape" &&
        !document.querySelector(
          '[role="menu"], [role="listbox"], [role="dialog"]'
        )
      )
        send("reacherx:escape");
    };
    const focus = () => {
      const active = document.activeElement;
      send("reacherx:editing", {
        editing:
          active instanceof HTMLElement &&
          (active.isContentEditable || active.matches("input,textarea,select")),
      });
    };
    window.addEventListener("message", message);
    document.addEventListener("pointerdown", interact, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", interact, {
      capture: true,
      passive: true,
    });
    document.addEventListener("wheel", interact, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", escape, true);
    document.addEventListener("click", release);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", focus);
    send("reacherx:ready");
    return () => {
      window.removeEventListener("message", message);
      document.removeEventListener("pointerdown", interact, true);
      document.removeEventListener("keydown", interact, true);
      document.removeEventListener("wheel", interact, true);
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("click", release);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", focus);
    };
  }, [scenario, send]);

  useEffect(() => {
    if (!request.revision) return;
    const shot = BLOG_DEMO_SHOTS[scenario][request.index];
    let previous = performance.now(),
      elapsed = 0;
    let frame = 0,
      positioned = false;
    let measurement = "",
      stableSince = 0;
    const prepare = () => {
      const now = performance.now();
      elapsed = advanceBlogDemoWait(elapsed, now - previous, !document.hidden);
      previous = now;
      // Count active frames, not time spent in a suspended/background tab.
      if (elapsed >= 3000) {
        send("reacherx:error", {
          revision: request.revision,
          message: `Could not show “${shot.label}”. Replay to try again.`,
        });
        return;
      }
      const focus = shot.focus && findDemoTarget(document, shot.focus);
      const target = shot.action && findDemoTarget(document, shot.action);
      if ((shot.focus && !focus) || (shot.action && !target)) {
        frame = requestAnimationFrame(prepare);
        return;
      }
      if (!positioned) {
        if (focus) revealDemoTarget(focus);
        if (target) revealDemoTarget(target);
        positioned = true;
        // Let Radix finish portal placement and scroll layout before measuring.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(prepare);
        });
        return;
      }
      const focusRect = focus
        ? measureDemoTarget(focus)
        : target
          ? measureDemoTarget(target)
          : undefined;
      const targetRect = target ? measureDemoTarget(target) : undefined;
      const nextMeasurement = JSON.stringify([focusRect, targetRect]);
      if (nextMeasurement !== measurement) {
        measurement = nextMeasurement;
        stableSince = elapsed;
      }
      // Radix portals animate their scale after placement. Two frames are not
      // enough: measure only after the rendered bounds have stopped moving.
      if (elapsed - stableSince < 100) {
        frame = requestAnimationFrame(prepare);
        return;
      }
      send("reacherx:prepared", {
        revision: request.revision,
        focus: focusRect,
        target: targetRect,
      });
    };
    frame = requestAnimationFrame(prepare);
    return () => cancelAnimationFrame(frame);
  }, [request, scenario, send]);

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      data-demo-shot={request.index}
    >
      <DemoSession
        key={request.resetKey}
        scenario={scenario}
        initialIndex={request.initialIndex}
      />
    </div>
  );
}
