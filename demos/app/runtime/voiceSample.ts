/** Scripted playback stays silent; a visitor's Play click can play aloud. */
export function installVoiceSample() {
  const playback = (event: MouseEvent) => {
    const button =
      event.target instanceof Element
        ? event.target.closest('button[aria-label="Play voice note"]')
        : null;
    const audio = button?.closest("section,article")?.querySelector("audio");
    if (audio) audio.muted = !event.isTrusted;
  };
  document.addEventListener("click", playback, true);
  return () => document.removeEventListener("click", playback, true);
}
