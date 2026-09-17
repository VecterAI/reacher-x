import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import AnimatedNumber from "./AnimatedNumber";
import { AnimationActivityProvider } from "@/shared/contexts/AnimationActivityProvider";

test("inactive initial numbers show their value even when mount animation is requested", () => {
  const html = renderToStaticMarkup(
    h(AnimationActivityProvider, {
      active: false,
      children: h(AnimatedNumber, { value: 42, animateOnMount: true }),
    })
  );
  expect(html).toContain(">42<");
  expect(html).not.toContain(">0<");
});
test("the normal active surface retains its requested mount animation start", () => {
  const html = renderToStaticMarkup(
    h(AnimatedNumber, { value: 42, animateOnMount: true })
  );
  expect(html).toContain(">0<");
});
