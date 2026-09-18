"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BLOG_DEMO_SHOTS,
  type BlogDemoId,
  type DemoTarget,
} from "@/features/blog/lib/blogDemoHelpers";
import {
  findDemoTarget,
  measureDemoTarget,
  measureDemoFocus,
  revealDemoTarget,
} from "@/features/blog/lib/blogDemoDomHelpers";
import { isRecord, getNumberProperty } from "@/convex/lib/typeGuards";
import { guardPlaybackKeyboard } from "./playbackInputHelpers";
import { performPlaybackAction } from "./playbackActions";
import { waitForPlaybackFrame as frame } from "./playbackTimingHelpers";
import { getBlogDemoInitialPath } from "@/features/blog/lib/blogDemoCatalog";
import { isDemoInitialLocation } from "./demoHistoryHelpers";

/** Playback drives the same DOM controls as a visitor; it never sets feature state. */
export function PlaybackBridge({
  scenario,
  reset,
  onTheme,
  onActivity,
}: {
  scenario: BlogDemoId;
  reset: () => number;
  onTheme: (theme: "light" | "dark") => void;
  onActivity: (active: boolean) => void;
}) {
  const router = useRouter();
  const [bridgeId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (window.parent === window) return;
    const parentOrigin = process.env.NEXT_PUBLIC_DEMO_PARENT_ORIGIN;
    if (!parentOrigin)
      throw new Error(
        "Set NEXT_PUBLIC_DEMO_PARENT_ORIGIN before building the embedded demo app."
      );
    const keyboard = guardPlaybackKeyboard(
      document,
      window.matchMedia("(any-pointer: coarse)")
    );
    let revision = -1;
    let activeIndex = 0;
    let actedRevision = -1;
    let generation = 0;
    let userHasFocused = false;
    let disposed = false;
    const initialInert = document.body.inert;
    // Preloaded apps must not autofocus before the host reports visibility.
    document.body.inert = true;
    const initialAmbient = document.documentElement.dataset.demoAmbient;
    document.documentElement.dataset.demoAmbient = "paused";
    const send = (type: string, extra = {}) =>
      window.parent.postMessage({ type, ...extra }, parentOrigin);
    const waitFor = async <T,>(
      read: () => T | undefined | false,
      token: number
    ): Promise<T> => {
      let elapsed = 0;
      let last = performance.now();
      while (!disposed && token === generation) {
        const value = read();
        if (value) return value;
        await frame();
        const now = performance.now();
        if (!document.hidden) elapsed += Math.min(now - last, 100);
        last = now;
        if (elapsed > 4000)
          throw new Error("Demo control did not become available");
      }
      throw new Error("Playback superseded");
    };
    const target = async (
      description: DemoTarget,
      token: number,
      interactive = true,
      reveal = true
    ) => {
      const element = await waitFor(() => {
        const match = findDemoTarget(document, description);
        return match &&
          (!interactive ||
            !match.matches(':disabled,[aria-disabled="true"],[data-disabled]'))
          ? match
          : undefined;
      }, token).catch((error: unknown) => {
        throw new Error(
          `Demo control unavailable: ${description.selector} ${description.text ?? description.containsText ?? ""}`,
          { cause: error }
        );
      });
      if (reveal) revealDemoTarget(element);
      return element;
    };
    const restore = async (index: number, token: number) => {
      const path = getBlogDemoInitialPath(scenario);
      // The real setup guard owns the canonical thread URL. Replacing it with
      // the bare path at the same time creates competing navigations.
      if (path !== "/agent/setup") {
        router.replace(path, { scroll: false });
        // Leave the old route before replacing its data. Otherwise its mounted
        // guards see a missing thread/plan and navigate over this replacement.
        await waitFor(
          () => isDemoInitialLocation(window.location, path),
          token
        );
        await frame();
        if (disposed || token !== generation) return;
      }
      const session = reset();
      await waitFor(
        () =>
          document.querySelector(`[data-demo-session="${session}"]`) &&
          // A same-path replacement can still be clearing an old thread or
          // profile query. Do not type into the editor that it is replacing.
          isDemoInitialLocation(window.location, path),
        token
      );
      await waitFor(() => document.querySelector("main h1"), token);
      // Setup bootstraps its canonical thread URL asynchronously. Its first
      // editor is replaced when that thread arrives; do not type into it early.
      if (path === "/agent/setup")
        await waitFor(
          () => new URLSearchParams(window.location.search).has("threadId"),
          token
        );
      // Seeking replays prior real interactions against fresh local data.
      for (const shot of BLOG_DEMO_SHOTS[scenario].slice(0, index)) {
        if (shot.waitFor) {
          await target(shot.waitFor, token, false, false);
          // Let the control's effects register before the next interaction.
          await frame();
          await frame();
        }
        if (!shot.action) continue;
        await performPlaybackAction(
          // Intermediate scrolls can dismiss autocomplete and open menus.
          // Reveal only the requested scene after the state has been rebuilt.
          await target(shot.action, token, true, false),
          shot.action,
          () => token === generation && !disposed
        );
        await frame();
        await frame();
      }
    };
    const prepare = async (
      index: number,
      nextRevision: number,
      shouldReset: boolean
    ) => {
      const token = ++generation;
      userHasFocused = false;
      keyboard.suppress();
      revision = nextRevision;
      activeIndex = index;
      const shot = BLOG_DEMO_SHOTS[scenario][index];
      try {
        if (shouldReset) await restore(index, token);
        if (shot.waitFor) await target(shot.waitFor, token, false);
        const focus = shot.focus
          ? await target(shot.focus, token, false)
          : undefined;
        const action = shot.action
          ? await target(shot.action, token)
          : undefined;
        await waitFor(() => document.querySelector("main h1"), token);
        let previous = "";
        let stableFrames = 0;
        await waitFor(() => {
          const measurement = JSON.stringify([
            focus && shot.focus && measureDemoFocus(document, shot.focus),
            action && measureDemoTarget(action),
          ]);
          stableFrames = measurement === previous ? stableFrames + 1 : 0;
          previous = measurement;
          return stableFrames >= 6;
        }, token);
        if (token !== generation) return;
        send("reacherx:prepared", {
          revision,
          focus:
            focus && shot.focus
              ? measureDemoFocus(document, shot.focus)
              : action
                ? measureDemoTarget(action)
                : undefined,
          target: action ? measureDemoTarget(action) : undefined,
        });
      } catch (error) {
        if (token === generation && !disposed) {
          console.error(
            "[DemoPlayback] Unable to prepare scene",
            shot.label,
            error
          );
          send("reacherx:error", {
            revision,
            message: "This scene could not finish. Replay to try again.",
          });
        }
      }
    };
    const message = async (event: MessageEvent<unknown>) => {
      if (
        event.source !== window.parent ||
        event.origin !== parentOrigin ||
        !isRecord(event.data)
      )
        return;
      if (event.data.type === "reacherx:ambient") {
        if (typeof event.data.active === "boolean") {
          document.documentElement.dataset.demoAmbient = event.data.active
            ? "active"
            : "paused";
          onActivity(event.data.active);
        }
        return;
      }
      if (event.data.type === "reacherx:theme") {
        if (event.data.theme === "light" || event.data.theme === "dark")
          onTheme(event.data.theme);
        return;
      }
      if (event.data.type === "reacherx:host-focus") {
        // The parent menu owns keyboard focus. Native inert prevents our real
        // Radix controls from stealing it; scripted DOM actions keep running.
        // This must be on the child body: inert on the iframe alone does not
        // prevent its document's programmatic focus from escaping to the host.
        if (typeof event.data.active === "boolean")
          document.body.inert = initialInert || event.data.active;
        return;
      }
      if (event.data.type === "reacherx:suspend") {
        generation += 1;
        return;
      }
      if (event.data.type === "reacherx:connect") {
        send("reacherx:ready", { bridgeId });
        return;
      }
      const index = getNumberProperty(event.data, "index");
      const nextRevision = getNumberProperty(event.data, "revision");
      if (
        index === undefined ||
        nextRevision === undefined ||
        !Number.isInteger(index) ||
        !Number.isInteger(nextRevision) ||
        !BLOG_DEMO_SHOTS[scenario][index]
      )
        return;
      if (event.data.type === "reacherx:prepare")
        void prepare(index, nextRevision, event.data.reset === true);
      if (
        event.data.type === "reacherx:act" &&
        revision === nextRevision &&
        activeIndex === index &&
        actedRevision !== revision
      ) {
        const action = BLOG_DEMO_SHOTS[scenario][index].action;
        const element = action && findDemoTarget(document, action);
        if (!element) {
          send("reacherx:error", {
            revision,
            message: "A demo control was unavailable.",
          });
          return;
        }
        const actionRevision = revision;
        const actionGeneration = generation;
        try {
          const rect = measureDemoTarget(element);
          actedRevision = revision;
          await performPlaybackAction(
            element,
            action!,
            () => actionGeneration === generation && !disposed
          );
          if (
            actionRevision !== revision ||
            actionGeneration !== generation ||
            disposed
          )
            return;
          send("reacherx:acted", { revision, rect });
        } catch {
          if (actionGeneration !== generation || disposed) return;
          send("reacherx:error", {
            revision,
            message: "A demo control was unavailable.",
          });
        }
      }
    };
    const interact = (event: Event) => {
      if (event.isTrusted) {
        keyboard.release(event);
        generation += 1;
        // A wheel gesture over an editor focused by the script is not editing.
        // Pointer/keyboard interaction can establish real editing ownership.
        if (event.type !== "wheel") userHasFocused = true;
        send("reacherx:interact");
        focus();
        if (event instanceof PointerEvent && event.pointerType === "touch")
          send("reacherx:touch");
      }
    };
    const release = (event: Event) => {
      if (event.isTrusted) send("reacherx:release");
    };
    const escape = (event: KeyboardEvent) => {
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
          userHasFocused &&
          active instanceof HTMLElement &&
          (active.isContentEditable || active.matches("input,textarea,select")),
      });
    };
    window.addEventListener("message", message);
    for (const type of ["pointerdown", "keydown", "wheel"])
      document.addEventListener(type, interact, {
        capture: true,
        passive: true,
      });
    document.addEventListener("click", release);
    document.addEventListener("keydown", escape, true);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", focus);
    send("reacherx:ready", { bridgeId });
    return () => {
      disposed = true;
      keyboard.dispose();
      document.body.inert = initialInert;
      if (initialAmbient === undefined)
        delete document.documentElement.dataset.demoAmbient;
      else document.documentElement.dataset.demoAmbient = initialAmbient;
      generation += 1;
      window.removeEventListener("message", message);
      for (const type of ["pointerdown", "keydown", "wheel"])
        document.removeEventListener(type, interact, true);
      document.removeEventListener("click", release);
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", focus);
    };
  }, [scenario, reset, router, onTheme, onActivity, bridgeId]);
  return null;
}
