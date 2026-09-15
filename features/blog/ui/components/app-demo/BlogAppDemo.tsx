"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import { isRecord } from "@/convex/lib/typeGuards";
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
} from "@/features/blog/lib/blogDemoHelpers";
import { useDemoHostScroll } from "./useDemoHostScroll";
import { useDemoHostFocus } from "./useDemoHostFocus";
import { useDemoExpansion } from "./useDemoExpansion";
import "./blog-app-demo.css";
import { useTheme } from "next-themes";
import { getBlogDemoUrl } from "@/features/blog/lib/blogDemoUrl";

import { readDemoRect } from "@/features/blog/lib/blogDemoDomHelpers";

const IDLE_RESUME_MS = 4000;
const CINEMATIC_EASE = [0.22, 1, 0.36, 1] as const;
const subscribeToOrigin = () => () => {};
const readParentOrigin = () => window.location.origin;
const readServerOrigin = () => null;
type Playback = "playing" | "paused" | "interactive";

interface BlogAppDemoProps {
  scenario: BlogDemoId;
  title: string;
  caption: string;
  presentation?: "cinematic" | "fixed";
  /** Card interaction controls automatic playback; explicit controls remain available. */
  playbackActive?: boolean;
  /** Carousel previews reserve pointer gestures for dragging; expand to use the app. */
  interaction?: "inline" | "expanded";
  loading?: "lazy" | "eager";
}

export function BlogAppDemo(props: BlogAppDemoProps) {
  // A different story owns a fresh timeline, iframe, and measured cursor state.
  return <BlogAppDemoPlayer key={props.scenario} {...props} />;
}

function BlogAppDemoPlayer({
  scenario,
  title,
  caption,
  presentation = "cinematic",
  playbackActive,
  interaction = "inline",
  loading = "lazy",
}: BlogAppDemoProps) {
  const { resolvedTheme } = useTheme();
  const parentOrigin = useSyncExternalStore(
    subscribeToOrigin,
    readParentOrigin,
    readServerOrigin
  );
  const demoUrl = getBlogDemoUrl(
    scenario,
    undefined,
    parentOrigin ?? undefined
  );
  const demoOrigin = new URL(demoUrl).origin;
  const root = useRef<HTMLElement>(null),
    iframe = useRef<HTMLIFrameElement>(null),
    progress = useRef<HTMLInputElement>(null);
  const [rootNode, setRootNode] = useState<HTMLElement | null>(null);
  const attachRoot = useCallback((node: HTMLElement | null) => {
    root.current = node;
    setRootNode(node);
  }, []);
  const [expanded, setExpanded] = useState(false),
    [ready, setReady] = useState(false),
    [prepared, setPrepared] = useState(false),
    [shotIndex, setShotIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [documentActive, setDocumentActive] = useState(true);
  const [playback, setPlayback] = useState<Playback>(
      playbackActive === undefined ? "playing" : "paused"
    ),
    [error, setError] = useState<string | null>(null),
    [touchControls, setTouchControls] = useState(false);
  const [camera, setCamera] = useState<DemoCamera>(DEMO_WIDE_CAMERA);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const placementSize = useRef(size);
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
    initialized: false,
    bridgeId: undefined as string | undefined,
    visible: false,
    playback: (playbackActive === undefined ? "playing" : "paused") as Playback,
    editing: false,
    lastInteraction: 0,
    waitingTime: 0,
    retries: 0,
    visibleSince: 0,
    lastConnect: 0,
  });
  const explicitPause = useRef(false);
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
        demoOrigin
      ),
    [demoOrigin]
  );
  const syncHostFocus = useDemoHostFocus(
    root,
    send,
    interaction === "expanded" && !expanded
  );
  useEffect(() => {
    if (ready)
      send("reacherx:ambient", {
        active: visible && documentActive && playback !== "paused",
      });
  }, [ready, visible, documentActive, playback, send]);
  useEffect(() => {
    if (ready && (resolvedTheme === "light" || resolvedTheme === "dark"))
      send("reacherx:theme", { theme: resolvedTheme });
  }, [ready, resolvedTheme, send]);
  const prepare = useCallback(
    (index: number, reset: boolean) => {
      const r = runtime.current;
      if (r.index !== index) r.retries = 0;
      r.index = index;
      r.initialized = true;
      r.revision += 1;
      r.prepared = false;
      setPrepared(false);
      r.actionSent = false;
      r.waitingTime = 0;
      setShotIndex(index);
      captureScroll();
      send("reacherx:prepare", { reset });
    },
    [send, captureScroll]
  );
  const resume = useCallback(() => {
    explicitPause.current = false;
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
  useEffect(() => {
    if (playbackActive === undefined) return;
    if (
      (playbackActive || expanded) &&
      !reducedMotion &&
      !explicitPause.current
    ) {
      if (runtime.current.manual) resume();
      else changePlayback("playing");
    } else changePlayback("paused");
  }, [playbackActive, expanded, reducedMotion, resume, changePlayback]);

  const restart = useCallback(() => {
    explicitPause.current = false;
    const r = runtime.current;
    r.time = 0;
    r.retries = 0;
    r.manual = false;
    r.editing = false;
    setError(null);
    setClick(null);
    setCamera(DEMO_WIDE_CAMERA);
    if (!r.ready && iframe.current) {
      r.visibleSince = performance.now();
      iframe.current.contentWindow?.location.replace(demoUrl);
    }
    prepare(0, true);
    changePlayback(reducedMotion ? "paused" : "playing");
  }, [prepare, changePlayback, reducedMotion, demoUrl]);

  const pause = useCallback(() => {
    // Moving focus to player controls can dismiss an iframe's Radix menu.
    // Resume from this step's checkpoint instead of using stale menu state.
    explicitPause.current = true;
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

  useLayoutEffect(() => {
    const node = rootNode;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    const resize = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    // Fullscreen is visibly present even if an intersection notification from
    // the prior inline layout arrives late. Reobserve when that layout changes.
    if (expanded) runtime.current.visible = true;
    const visibility = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (!entry) return;
        const r = runtime.current;
        const nextVisible = expanded || entry.isIntersecting;
        if (!nextVisible) cancelScroll();
        if (r.visible && !nextVisible && r.ready && r.playback === "playing") {
          // Cancel work before offscreen Radix/editor focus can move the page.
          send("reacherx:suspend");
          r.initialized = false;
          r.prepared = false;
          setPrepared(false);
        }
        r.visible = nextVisible;
        setVisible(nextVisible);
        if (runtime.current.visible && !runtime.current.visibleSince)
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
  }, [rootNode, expanded, send, cancelScroll]);
  useEffect(() => {
    if (reducedMotion) changePlayback("paused");
  }, [reducedMotion, changePlayback]);
  useLayoutEffect(() => {
    if (!size.width || !size.height) return;
    const resized =
      placementSize.current.width !== size.width ||
      placementSize.current.height !== size.height;
    placementSize.current = size;
    const placement = getBlogDemoPlacement(
      size.width,
      size.height,
      camera,
      presentation
    );
    if (presentation === "fixed" || resized) {
      x.set(placement.x);
      y.set(placement.y);
      scale.set(placement.scale);
      return;
    }
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
    presentation,
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
        event.origin !== demoOrigin ||
        !isRecord(event.data)
      )
        return;
      const r = runtime.current;
      if (event.data.type === "reacherx:ready") {
        syncHostFocus(true);
        send("reacherx:ambient", {
          active: r.visible && !document.hidden && r.playback !== "paused",
        });
        if (resolvedTheme === "light" || resolvedTheme === "dark")
          send("reacherx:theme", { theme: resolvedTheme });
        const bridgeId =
          typeof event.data.bridgeId === "string"
            ? event.data.bridgeId
            : undefined;
        if (r.ready && r.bridgeId === bridgeId) return;
        // A setup navigation may replace the embedded document. Restore the
        // current scene for that new bridge, while ignoring heartbeat replies.
        r.bridgeId = bridgeId;
        r.ready = true;
        setReady(true);
        r.initialized = false;
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
        if (r.visible) restoreScroll();
        r.prepared = true;
        setPrepared(true);
        if (r.manual) return;
        const currentShot = BLOG_DEMO_SHOTS[scenario][r.index];
        setCamera(
          getDemoTargetCamera(
            currentShot.camera,
            readDemoRect(event.data.focus)
          )
        );
        const target = readDemoRect(event.data.target);
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
        if (r.visible) restoreScroll();
        const rect = readDemoRect(event.data.rect);
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
    resolvedTheme,
    send,
    syncHostFocus,
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
    demoOrigin,
  ]);

  useEffect(() => {
    const update = () => setDocumentActive(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (ready || !visible || !documentActive || error) return;
    // A paused card still connects and renders its initial app. It does not
    // prepare or replay any timeline checkpoints until playback starts.
    const connect = () => send("reacherx:connect");
    connect();
    const handshake = setInterval(connect, 500);
    const timeout = setTimeout(() => {
      setError("The demo could not load.");
      changePlayback("paused");
    }, 15000);
    return () => {
      clearInterval(handshake);
      clearTimeout(timeout);
    };
  }, [ready, visible, documentActive, error, send, changePlayback]);

  useEffect(() => {
    if (!ready || !visible || !documentActive || playback === "paused") return;
    let animation = 0,
      previous = 0;
    const tick = (now: number) => {
      const delta = previous ? Math.min(now - previous, 100) : 0;
      previous = now;
      const r = runtime.current;
      if (r.ready && r.visible && !document.hidden && r.playback !== "paused") {
        if (!r.initialized && r.playback === "playing") {
          const frame = getBlogDemoFrame(scenario, r.time);
          r.time = frame.start;
          prepare(frame.index, true);
        }
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
  }, [
    ready,
    visible,
    documentActive,
    playback,
    scenario,
    presentation,
    prepare,
    send,
    resume,
    changePlayback,
    captureScroll,
    recover,
  ]);

  return (
    <figure
      className={`blog-app-demo-figure not-prose ${presentation === "fixed" ? "marketing-app-demo" : ""}`}
      aria-label={`${title}. Interactive demonstration with fictional data.`}
    >
      <section
        ref={attachRoot}
        popover={expanded ? "manual" : undefined}
        tabIndex={-1}
        aria-label={title}
        role={expanded ? "dialog" : "region"}
        aria-modal={expanded || undefined}
        className={`blog-app-demo ${expanded ? "blog-app-demo-expanded" : ""}`}
        data-demo-presentation={presentation}
        data-demo-interaction={interaction}
        data-demo-duration={duration}
        data-demo-visible={visible}
        data-demo-ready={ready}
        data-demo-prepared={prepared}
        data-demo-scenario={scenario}
        data-demo-state={playback}
        data-demo-error={error || undefined}
        data-demo-shot={shotIndex}
        data-touch-controls={touchControls}
        onPointerDown={(event) => {
          if (event.pointerType === "touch") setTouchControls(true);
        }}
      >
        {presentation === "cinematic" && (
          <motion.div
            aria-hidden="true"
            className="blog-app-demo-background"
            style={{ x: backgroundX, y: backgroundY, scale: backgroundScale }}
          />
        )}
        <motion.div
          className="blog-app-demo-window"
          style={{
            width: DEMO_DESIGN_WIDTH,
            height: DEMO_DESIGN_HEIGHT,
            visibility: ready && size.width > 0 ? "visible" : "hidden",
            x,
            y,
            scale,
          }}
        >
          <div className="blog-app-demo-clip">
            {parentOrigin && (
              <iframe
                ref={iframe}
                name={`reacherx-demo:${scenario}`}
                src={demoUrl}
                title={`${title} — interactive app`}
                loading={loading}
                tabIndex={
                  interaction === "expanded" && !expanded ? -1 : undefined
                }
                inert={interaction === "expanded" && !expanded}
                width={DEMO_DESIGN_WIDTH}
                height={DEMO_DESIGN_HEIGHT}
                sandbox="allow-scripts allow-same-origin"
                allow="autoplay; microphone"
              />
            )}
            {click && !reducedMotion ? (
              <span
                key={click.key}
                aria-hidden="true"
                className="blog-app-demo-click"
                style={{ left: click.x, top: click.y }}
                onAnimationEnd={() => setClick(null)}
              />
            ) : null}
          </div>
        </motion.div>
        <motion.div
          aria-hidden="true"
          className="blog-app-demo-cursor"
          hidden={!ready || playback !== "playing"}
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
        {error && (
          <p role="status" className="blog-app-demo-error">
            {error}
            <span className="sr-only"> Use Play demo to try again.</span>
          </p>
        )}
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
              explicitPause.current = true;
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
          <>
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
          </>
        </div>
      </section>
      <figcaption
        className={
          presentation === "fixed" ? "sr-only" : "blog-app-demo-caption"
        }
      >
        {caption}
        <span className="sr-only">
          {" "}
          {presentation === "fixed"
            ? "Interactive demo with fictional data. Interact to explore; playback resumes after four seconds of inactivity, except while editing. Use Pause demo to keep it paused. Changes stay in the demo."
            : "Interactive demo with fictional data. Interact to pause; playback resumes after four seconds of inactivity, except while editing. Changes stay in the demo."}
        </span>
      </figcaption>
    </figure>
  );
}
