// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import {
  buildLoginHref,
  NEW_WORKSPACE_SETUP_AUTH_RETURN_TO,
} from "@/shared/lib/urls/authRoutes";
import { LandingPrimaryCta } from "./LandingPrimaryCta";

const auth = vi.hoisted(() => ({
  user: null as null | { id: string },
  loading: false,
}));
vi.mock("@workos-inc/authkit-nextjs/components", () => ({
  useAuth: () => auth,
}));
vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));
vi.mock("./LandingAuthLink", () => ({
  LandingAuthLink: (props: ComponentProps<"a">) => <a {...props} />,
}));

const container = document.createElement("div");
let root = createRoot(container);

afterEach(async () => {
  await act(() => root.unmount());
  root = createRoot(container);
  auth.user = null;
  auth.loading = false;
  vi.unstubAllGlobals();
});

async function render(props: ComponentProps<typeof LandingPrimaryCta> = {}) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await act(() => root.render(<LandingPrimaryCta {...props} />));
}

test("anonymous Get started preserves the setup auth destination and triangle", async () => {
  await render();
  const link = container.querySelector("a")!;
  expect(link.textContent).toBe("Get started");
  expect(link.getAttribute("href")).toBe(
    buildLoginHref(NEW_WORKSPACE_SETUP_AUTH_RETURN_TO)
  );
  expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
});

test("signed-in Dashboard opens the existing dashboard and supports header styling", async () => {
  auth.user = { id: "test-user" };
  const onClick = vi.fn();
  await render({ variant: "outline", className: "flex-1", onClick });
  const link = container.querySelector("a")!;
  expect(link.textContent).toBe("Dashboard");
  expect(link.getAttribute("href")).toBe("/");
  expect(link.querySelector("svg")).not.toBeNull();
  expect(link.classList.contains("flex-1")).toBe(true);
  await act(() => link.click());
  expect(onClick).toHaveBeenCalledOnce();
});

test("unresolved auth exposes no navigation target", async () => {
  auth.loading = true;
  await render();
  expect(container.querySelector("a")).toBeNull();
  expect(
    container.querySelector('[aria-busy="true"][aria-disabled="true"]')
  ).not.toBeNull();
});
