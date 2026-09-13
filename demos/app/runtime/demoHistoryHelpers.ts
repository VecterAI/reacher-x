/** Embedded app navigation must never add entries to the reader's Back stack. */
export function isDemoInitialLocation(
  location: Pick<Location, "pathname" | "search">,
  path: string
) {
  return (
    location.pathname === path &&
    (path === "/agent/setup" ||
      [...new URLSearchParams(location.search).keys()].every(
        (key) => key === "scenario"
      ))
  );
}

export function installDemoHistory(target: Window) {
  if (target.parent === target) return () => {};
  const history = target.history;
  const original = history.pushState;
  const replace: History["pushState"] = (data, unused, url) => {
    // Read the current method so Next's URL synchronization still runs.
    history.replaceState(data, unused, url);
  };
  history.pushState = replace;
  return () => {
    if (history.pushState === replace) history.pushState = original;
  };
}
