"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  PauseCircleIcon as Pause,
  PlayCircleIcon as Play,
  OpenInNewIcon as Expand,
  CloseIcon as Close,
  RefreshIcon as Replay,
} from "@/shared/ui/components/icons";
import { isRecord, getNumberProperty } from "@/convex/lib/typeGuards";
import {
  DEMO_DESIGN_WIDTH,
  DEMO_DESIGN_HEIGHT,
} from "@/features/landing/ui/components/use-case-demo/demoPresentationHelpers";
import {
  BLOG_DEMO_SHOTS,
  advanceBlogDemoWait,
  getBlogDemoRecoveryAction,
  DEMO_WIDE_CAMERA,
  getBlogDemoFrame,
  getBlogDemoPlacement,
  getBlogDemoCursorPlacement,
  getDemoTargetCamera,
  type BlogDemoId,
  type DemoCamera,
  type DemoRect,
} from "@/features/blog/lib/blogDemoHelpers";
import { useDemoHostScroll } from "./useDemoHostScroll";
import { useDemoExpansion } from "./useDemoExpansion";
import "./blog-app-demo.css";

const IDLE_RESUME_MS = 4000;
const CINEMATIC_EASE = [0.22, 1, 0.36, 1] as const;
type Playback = "playing" | "paused" | "interactive";
function readRect(value: unknown): DemoRect | undefined {
  if (!isRecord(value)) return;
  const x = getNumberProperty(value, "x"),
    y = getNumberProperty(value, "y"),
    width = getNumberProperty(value, "width"),
    height = getNumberProperty(value, "height");
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    ![x, y, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  )
    return;
  return { x, y, width, height };
}

interface BlogAppDemoProps {
  scenario: BlogDemoId;
  title: string;
  caption: string;
}

export function BlogAppDemo(props: BlogAppDemoProps) {
  // A different story owns a fresh timeline, iframe, and measured cursor state.
  return <BlogAppDemoPlayer key={props.scenario} {...props} />;
}

function BlogAppDemoPlayer({ scenario, title, caption }: BlogAppDemoProps) {
  const root = useRef<HTMLElement>(null),
    iframe = useRef<HTMLIFrameElement>(null),
    progress = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false),
    [ready, setReady] = useState(false),
    [shotIndex, setShotIndex] = useState(0);
  const [playback, setPlayback] = useState<Playback>("playing"),
    [error, setError] = useState<string | null>(null),
    [touchControls, setTouchControls] = useState(false);
  const [camera, setCamera] = useState<DemoCamera>(DEMO_WIDE_CAMERA);
  const [size, setSize] = useState({ width: 800, height: 450 });
  const [click, setClick] = useState<{
    x: number;
    y: number;
    key: number;
  } | null>(null);
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0),
    y = useMotionValue(0),
    scale = useMotionValue(0.4);
  const cursorX = useMotionValue(640),
    cursorY = useMotionValue(425);
  const cursorPosition = useTransform(() =>
    getBlogDemoCursorPlacement(
      size.width,
      size.height,
      { x: x.get(), y: y.get(), scale: scale.get() },
      { x: cursorX.get(), y: cursorY.get() }
    )
  );
  const screenCursorX = useTransform(cursorPosition, (point) => point.x);
  const screenCursorY = useTransform(cursorPosition, (point) => point.y);
  const backgroundX = useMotionValue(0),
    backgroundY = useMotionValue(0),
    backgroundScale = useMotionValue(1.04);
  const runtime = useRef({
    time: 0,
    index: 0,
    revision: 0,
    prepared: false,
    actionSent: false,
    manual: false,
    ready: false,
    visible: false,
    playback: "playing" as Playback,
    editing: false,
    lastInteraction: 0,
    waitingTime: 0,
    retries: 0,
    visibleSince: 0,
  });
  const shot = BLOG_DEMO_SHOTS[scenario][shotIndex];
  const duration = getBlogDemoFrame(scenario, 0).duration;
  useDemoExpansion(root, expanded, setExpanded);
  const {
    capture: captureScroll,
    restore: restoreScroll,
    cancel: cancelScroll,
  } = useDemoHostScroll();

  const changePlayback = useCallback((state: Playback) => {
    runtime.current.playback = state;
    setPlayback(state);
  }, []);
  const send = useCallback(
    (type: string, extra = {}) =>
      iframe.current?.contentWindow?.postMessage(
        {
          type,
          index: runtime.current.index,
          revision: runtime.current.revision,
          ...extra,
        },
        window.location.origin
      ),
    []
  );
  const prepare = useCallback(
    (index: number, reset: boolean) => {
      const r = runtime.current;
      if (r.index !== index) r.retries = 0;
      r.index = index;
      r.revision += 1;
      r.prepared = false;
      r.actionSent = false;
      r.waitingTime = 0;
      setShotIndex(index);
      captureScroll();
      send("reacherx:prepare", { reset });
    },
    [send, captureScroll]
  );
  const resume = useCallback(() => {
    const r = runtime.current;
    r.retries = 0;
    if (r.manual || r.playback === "paused") {
      const frame = getBlogDemoFrame(scenario, r.time);
      r.time = frame.start;
      r.manual = false;
      r.editing = false;
      prepare(frame.index, true);
    }
    changePlayback("playing");
  }, [scenario, prepare, changePlayback]);
  const restart = useCallback(() => {
    const r = runtime.current;
    r.time = 0;
    r.retries = 0;
    r.manual = false;
    r.editing = false;
    setError(null);
    setClick(null);
    if (!r.ready && iframe.current) {
      r.visibleSince = performance.now();
      iframe.current.src = `/home/demo/${scenario}`;
    }
    prepare(0, true);
    changePlayback(reducedMotion ? "paused" : "playing");
  }, [prepare, changePlayback, reducedMotion, scenario]);

  const pause = useCallback(() => {
    // Moving focus to player controls can dismiss an iframe's Radix menu.
    // Resume from this step's checkpoint instead of using stale menu state.
    runtime.current.manual = true;
    changePlayback("paused");
  }, [changePlayback]);

  const recover = useCallback(
    (message: string) => {
      const r = runtime.current;
      r.prepared = false;
      const action = getBlogDemoRecoveryAction(r.playback, r.manual, r.retries);
      if (action === "defer") {
        r.manual = true;
        return;
      }
      console.warn(`[BlogAppDemo] ${message}`);
      if (action === "retry") {
        r.retries += 1;
        r.time = getBlogDemoFrame(scenario, r.time).start;
        prepare(r.index, true);
        return;
      }
      r.manual = true;
      setError(message);
      changePlayback("paused");
    },
    [scenario, prepare, changePlayback]
  );

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const resize = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    const visibility = new IntersectionObserver(
      ([entry]) => {
        runtime.current.visible = entry.isIntersecting;
        if (entry.isIntersecting && !runtime.current.visibleSince)
          runtime.current.visibleSince = performance.now();
      },
      { threshold: 0.15 }
    );
    resize.observe(node);
    visibility.observe(node);
    return () => {
      resize.disconnect();
      visibility.disconnect();
    };
  }, []);
  useEffect(() => {
    if (reducedMotion) changePlayback("paused");
  }, [reducedMotion, changePlayback]);
  useEffect(() => {
    const placement = getBlogDemoPlacement(size.width, size.height, camera);
    const options = {
      duration: reducedMotion ? 0 : 1.15,
      ease: CINEMATIC_EASE,
    };
    const animations = [
      animate(x, placement.x, options),
      animate(y, placement.y, options),
      animate(scale, placement.scale, options),
      animate(backgroundX, (640 - camera.x) * 0.018, options),
      animate(backgroundY, (425 - camera.y) * 0.012, options),
      animate(backgroundScale, 1.04 + (camera.zoom - 1) * 0.025, options),
    ];
    return () => animations.forEach((animation) => animation.stop());
  }, [
    camera,
    size,
    reducedMotion,
    x,
    y,
    scale,
    backgroundX,
    backgroundY,
    backgroundScale,
  ]);
  useEffect(() => {
    if (!touchControls) return;
    const timer = setTimeout(() => setTouchControls(false), 3000);
    return () => clearTimeout(timer);
  }, [touchControls]);

  useEffect(() => {
    const message = (event: MessageEvent<unknown>) => {
      if (
        event.source !== iframe.current?.contentWindow ||
        event.origin !== window.location.origin ||
        !isRecord(event.data)
      )
        return;
      const r = runtime.current;
      if (event.data.type === "reacherx:ready") {
        r.ready = true;
        setReady(true);
        prepare(getBlogDemoFrame(scenario, r.time).index, true);
      }
      if (event.data.type === "reacherx:interact") {
        cancelScroll();
        r.lastInteraction = performance.now();
        r.manual = true;
        cursorX.stop();
        cursorY.stop();
        x.stop();
        y.stop();
        scale.stop();
        backgroundX.stop();
        backgroundY.stop();
        backgroundScale.stop();
        if (r.playback !== "paused") changePlayback("interactive");
      }
      if (event.data.type === "reacherx:release" && r.manual)
        setCamera(DEMO_WIDE_CAMERA);
      if (event.data.type === "reacherx:touch") setTouchControls(true);
      if (event.data.type === "reacherx:editing") {
        r.editing = event.data.editing === true;
        r.lastInteraction = performance.now();
      }
      if (event.data.type === "reacherx:escape") setExpanded(false);
      if (event.data.revision !== r.revision) return;
      if (event.data.type === "reacherx:error") {
        recover(
          typeof event.data.message === "string"
            ? event.data.message
            : "The demo could not continue."
        );
      }
      if (event.data.type === "reacherx:prepared") {
        restoreScroll();
        r.prepared = true;
        if (r.manual) return;
        const currentShot = BLOG_DEMO_SHOTS[scenario][r.index];
        setCamera(
          getDemoTargetCamera(currentShot.camera, readRect(event.data.focus))
        );
        const target = readRect(event.data.target);
        if (target) {
          const options = {
            duration: reducedMotion ? 0 : 0.85,
            delay: reducedMotion ? 0 : 0.2,
            ease: CINEMATIC_EASE,
          };
          animate(cursorX, target.x + target.width / 2, options);
          animate(cursorY, target.y + target.height / 2, options);
        }
      }
      if (event.data.type === "reacherx:acted") {
        restoreScroll();
        const rect = readRect(event.data.rect);
        if (rect && !r.manual)
          setClick({
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            key: r.revision,
          });
      }
    };
    window.addEventListener("message", message);
    return () => window.removeEventListener("message", message);
  }, [
    scenario,
    prepare,
    changePlayback,
    reducedMotion,
    cursorX,
    cursorY,
    x,
    y,
    scale,
    backgroundX,
    backgroundY,
    backgroundScale,
    restoreScroll,
    cancelScroll,
    recover,
  ]);

  useEffect(() => {
    let animation = 0,
      previous = 0;
    const tick = (now: number) => {
      const delta = previous ? Math.min(now - previous, 100) : 0;
      previous = now;
      const r = runtime.current;
      if (
        !r.ready &&
        r.visible &&
        r.visibleSince &&
        now - r.visibleSince > 15000
      ) {
        setError("The demo could not load. Reload the page to try again.");
        r.visibleSince = 0;
        changePlayback("paused");
      }
      if (r.ready && r.visible && !document.hidden && r.playback !== "paused") {
        if (r.playback === "interactive") {
          if (!r.editing && now - r.lastInteraction >= IDLE_RESUME_MS) resume();
        } else if (r.prepared) {
          r.time += delta;
          let frame = getBlogDemoFrame(scenario, r.time);
          if (frame.index !== r.index) {
            prepare(frame.index, frame.index === 0);
          } else if (
            frame.shot.action &&
            !r.actionSent &&
            frame.localTime >= frame.actionAt
          ) {
            r.actionSent = true;
            captureScroll();
            send("reacherx:act");
          }
          if (progress.current) progress.current.value = String(frame.index);
        } else {
          r.waitingTime = advanceBlogDemoWait(r.waitingTime, delta, true);
          if (r.waitingTime > 8000)
            recover("The demo step did not become ready.");
        }
      }
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [scenario, prepare, send, resume, changePlayback, captureScroll, recover]);

  return (
    <figure
      className="blog-app-demo-figure not-prose"
      aria-label={`${title}. Interactive demonstration with fictional data.`}
    >
      <section
        ref={root}
        tabIndex={-1}
        aria-label={title}
        role={expanded ? "dialog" : "region"}
        aria-modal={expanded || undefined}
        className={`blog-app-demo ${expanded ? "blog-app-demo-expanded" : ""}`}
        data-demo-duration={duration}
        data-demo-ready={ready}
        data-demo-scenario={scenario}
        data-demo-state={playback}
        data-demo-error={error || undefined}
        data-demo-shot={shotIndex}
        data-touch-controls={touchControls}
        onPointerDown={(event) => {
          if (event.pointerType === "touch") setTouchControls(true);
        }}
      >
        <motion.div
          aria-hidden="true"
          className="blog-app-demo-background"
          style={{ x: backgroundX, y: backgroundY, scale: backgroundScale }}
        />
        <motion.div
          className="blog-app-demo-window"
          style={{
            width: DEMO_DESIGN_WIDTH,
            height: DEMO_DESIGN_HEIGHT,
            x,
            y,
            scale,
          }}
        >
          <iframe
            ref={iframe}
            src={`/home/demo/${scenario}`}
            title={`${title} — interactive app`}
            loading="lazy"
            width={DEMO_DESIGN_WIDTH}
            height={DEMO_DESIGN_HEIGHT}
            sandbox="allow-scripts allow-same-origin"
          />
          {click && !reducedMotion ? (
            <span
              key={click.key}
              aria-hidden="true"
              className="blog-app-demo-click"
              style={{ left: click.x, top: click.y }}
              onAnimationEnd={() => setClick(null)}
            />
          ) : null}
        </motion.div>
        <motion.div
          aria-hidden="true"
          className="blog-app-demo-cursor"
          style={{
            x: screenCursorX,
            y: screenCursorY,
          }}
        >
          <svg width="28" height="34" viewBox="0 0 28 34">
            <path
              d="M3 2v26l7-7 5 11 5-2-5-10h10Z"
              fill="white"
              stroke="#111"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
        <div
          role="group"
          className="blog-app-demo-controls"
          aria-label="Demo playback controls"
        >
          <button
            type="button"
            aria-label={playback === "playing" ? "Pause demo" : "Play demo"}
            onClick={() =>
              playback === "playing" ? pause() : error ? restart() : resume()
            }
          >
            {playback === "playing" ? <Pause /> : <Play />}
          </button>
          <input
            ref={progress}
            type="range"
            aria-label="Demo progress"
            aria-valuetext={shot.label}
            min={0}
            max={BLOG_DEMO_SHOTS[scenario].length - 1}
            step={1}
            defaultValue={0}
            onChange={(event) => {
              const r = runtime.current;
              const frame = getBlogDemoFrame(
                scenario,
                BLOG_DEMO_SHOTS[scenario]
                  .slice(0, event.currentTarget.valueAsNumber)
                  .reduce((time, scene) => time + scene.duration, 0)
              );
              // Seek to the scene checkpoint, before its action. The slider never fabricates later state.
              r.time = frame.start;
              r.retries = 0;
              r.manual = false;
              r.editing = false;
              setError(null);
              setClick(null);
              changePlayback("paused");
              prepare(frame.index, true);
              event.currentTarget.value = String(frame.index);
            }}
          />
          <button type="button" aria-label="Replay demo" onClick={restart}>
            <Replay />
          </button>
          <button
            type="button"
            aria-label={expanded ? "Exit fullscreen demo" : "Expand demo"}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <Close /> : <Expand />}
          </button>
        </div>
      </section>
      <figcaption className="blog-app-demo-caption">
        {caption}
        <span className="sr-only">
          {" "}
          Interactive demo with fictional data. Interact to pause; playback
          resumes after four seconds of inactivity, except while editing.
          Changes stay in the demo.
        </span>
      </figcaption>
    </figure>
  );
}
