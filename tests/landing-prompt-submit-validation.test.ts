import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const LANDING_PROMPT_CTA_FILE =
  "features/landing/ui/components/LandingPromptCta.tsx";

test("landing prompt requires meaningful text before submitting", () => {
  const source = readFileSync(LANDING_PROMPT_CTA_FILE, "utf8");

  assert.match(
    source,
    /const canSubmitPrompt = text\.trim\(\)\.length > 0 && !composerBusy;/
  );
  assert.match(
    source,
    /const handleSend = useCallback\(\(\) => \{\s*if \(!canSubmitPrompt\) return;/
  );
  assert.match(
    source,
    /aria-label="Reach people"\s*title="Reach people"\s*disabled=\{!canSubmitPrompt\}/
  );
});
