import { waitForPlaybackFrame } from "./playbackTimingHelpers";
import { activateDemoTarget } from "@/features/blog/lib/blogDemoDomHelpers";
import type { DemoAction } from "@/features/blog/lib/blogDemoHelpers";

export function createPlaybackPasteEvent(text: string) {
  const data = new DataTransfer();
  data.setData("text/plain", text);
  const paste = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData: data,
  });
  // Firefox creates its own empty transfer for synthetic clipboard events.
  // Populate the event's transfer too, so the real editor receives the text.
  paste.clipboardData?.setData("text/plain", text);
  return paste;
}

/** Input travels through the real editor's DOM events, never private React/Lexical state. */
export async function performPlaybackAction(
  element: HTMLElement,
  action: DemoAction,
  isCurrent: () => boolean = () => true
) {
  if (!isCurrent() || !element.isConnected) return;
  if (action.input !== undefined) {
    if (
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLInputElement
    ) {
      const prototype =
        element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(
        element,
        action.inputMode === "append"
          ? element.value + action.input
          : action.input
      );
      element.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if (!element.isContentEditable)
      throw new Error("The demo input is not editable");
    // The editor needs its normal focus contract unless the host menu owns focus.
    if (!document.body.inert) element.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(element);
    if (action.inputMode === "append") range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await waitForPlaybackFrame();
    if (!isCurrent() || !element.isConnected) return;
    element.dispatchEvent(createPlaybackPasteEvent(action.input));
    return;
  }
  if (action.key !== undefined) {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: action.key,
        keyCode:
          action.key === "Tab" ? 9 : action.key === "Escape" ? 27 : undefined,
        bubbles: true,
        cancelable: true,
      })
    );
    element.dispatchEvent(
      new KeyboardEvent("keyup", { key: action.key, bubbles: true })
    );
    return;
  }
  activateDemoTarget(element);
  if (element.matches('button[role="option"]')) {
    // MentionsPlugin suppresses reopening for 250 ms after a selection.
    // Honor that real control's close interval during rapid seek/replay too.
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
  }
}
