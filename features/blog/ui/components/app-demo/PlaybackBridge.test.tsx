// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { PlaybackBridge } from "../../../../../demos/app/runtime/PlaybackBridge";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

test("only the configured host can resume ambient animations; unmount restores the document", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubEnv("NEXT_PUBLIC_DEMO_PARENT_ORIGIN", "https://www.reacherx.com");
  const onActivity = vi.fn();
  const parent = { postMessage: vi.fn() } as unknown as Window;
  const parentGetter = vi
    .spyOn(window, "parent", "get")
    .mockReturnValue(parent);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const message = (origin: string, source: Window, active: unknown) =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin,
        source,
        data: { type: "reacherx:ambient", active },
      })
    );
  try {
    await act(async () =>
      root.render(
        <PlaybackBridge
          scenario="workspaces-explained"
          reset={() => 1}
          onTheme={() => {}}
          onActivity={onActivity}
        />
      )
    );
    expect(document.documentElement.dataset.demoAmbient).toBe("paused");
    message("https://untrusted.example", parent, true);
    message("https://www.reacherx.com", window, true);
    message("https://www.reacherx.com", parent, "true");
    expect(document.documentElement.dataset.demoAmbient).toBe("paused");
    message("https://www.reacherx.com", parent, true);
    expect(document.documentElement.dataset.demoAmbient).toBe("active");
    expect(onActivity).toHaveBeenCalledExactlyOnceWith(true);
    message("https://www.reacherx.com", parent, false);
    expect(document.documentElement.dataset.demoAmbient).toBe("paused");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    parentGetter.mockRestore();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
  expect(document.documentElement.dataset.demoAmbient).toBeUndefined();
});
