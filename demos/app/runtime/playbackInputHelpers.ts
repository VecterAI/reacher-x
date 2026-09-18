const EDITABLE_SELECTOR =
  'input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

/** Scripted editing still uses the real editor, but never requests a touch keyboard. */
export function guardPlaybackKeyboard(
  document: Document,
  touch: MediaQueryList
) {
  const originalModes = new Map<HTMLElement, string | null>();
  let scripted = true;
  const restore = () => {
    for (const [element, mode] of originalModes) {
      if (mode === null) element.removeAttribute("inputmode");
      else element.setAttribute("inputmode", mode);
    }
    originalModes.clear();
  };
  const sync = () => {
    if (!scripted || !touch.matches) {
      restore();
      return;
    }
    for (const [element, mode] of originalModes) {
      if (element.isConnected) continue;
      if (mode === null) element.removeAttribute("inputmode");
      else element.setAttribute("inputmode", mode);
      originalModes.delete(element);
    }
    for (const element of document.querySelectorAll<HTMLElement>(
      EDITABLE_SELECTOR
    )) {
      if (!originalModes.has(element))
        originalModes.set(element, element.getAttribute("inputmode"));
      element.setAttribute("inputmode", "none");
    }
  };
  const observer = new MutationObserver(sync);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["contenteditable"],
  });
  touch.addEventListener("change", sync);
  sync();
  return {
    suppress() {
      scripted = true;
      sync();
    },
    release(event: Event) {
      if (!event.isTrusted || event.type === "wheel") return;
      // A real tap must run the browser's focus behavior even when playback
      // already focused this editor with its keyboard suppressed.
      const active = document.activeElement;
      const refocus =
        event.type === "pointerdown" &&
        active instanceof HTMLElement &&
        originalModes.has(active);
      scripted = false;
      restore();
      if (refocus && active instanceof HTMLElement) active.blur();
    },
    dispose() {
      observer.disconnect();
      touch.removeEventListener("change", sync);
      restore();
    },
  };
}
