import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const LANDING_PROMPT_CTA_FILE =
  "features/landing/ui/components/LandingPromptCta.tsx";
const COMPOSER_EDITOR_FILE = "features/composer/lib/ComposerEditor.tsx";
const EDITOR_FILE = "features/composer/ui/components/Editor.tsx";
const PLUGINS_FILE = "features/composer/ui/components/Plugins.tsx";
const CONTENT_EDITABLE_FILE = "shared/ui/components/editor/ContentEditable.tsx";

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

test("authenticated landing handoff resolves an existing draft before delivery", () => {
  const source = readFileSync(LANDING_PROMPT_CTA_FILE, "utf8");
  const continueIndex = source.indexOf('if (kind === "continued")');
  const continueNavigateIndex = source.indexOf(
    "navigateDocumentIntentionally(",
    continueIndex
  );
  const submitIndex = source.indexOf(
    "await submitLandingSetupHandoffToThread(",
    continueIndex
  );
  const persistIndex = source.indexOf(
    "persistPromptHandoff(submittedHandoff)",
    submitIndex
  );
  const selectIndex = source.indexOf(
    'setPreferredShellContext("setup_session")',
    persistIndex
  );
  const navigateIndex = source.indexOf(
    "navigateDocumentIntentionally(",
    selectIndex
  );

  assert.ok(continueIndex >= 0);
  assert.ok(continueNavigateIndex > continueIndex);
  assert.ok(submitIndex > continueNavigateIndex);
  assert.ok(persistIndex > submitIndex);
  assert.ok(selectIndex > persistIndex);
  assert.ok(navigateIndex > selectIndex);
});

test("anonymous landing prompts require a draft decision and keep exact text", () => {
  const source = readFileSync(LANDING_PROMPT_CTA_FILE, "utf8");

  assert.match(source, /requiresNewWorkspaceDecision: true/);
  assert.match(source, /const prompt = text;/);
  assert.doesNotMatch(source, /const prompt = text\.trim\(\);/);
});

test("at-limit landing composers stay inert and keep upgrade guidance visible", () => {
  const source = readFileSync(LANDING_PROMPT_CTA_FILE, "utf8");

  assert.doesNotMatch(source, /hasActiveNewWorkspaceDraft/);
  assert.match(source, /disabled=\{composerBusy\}/);
  assert.match(
    source,
    /if \(composerBusy\) \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*return;/
  );
  assert.match(source, /<AlertTitle>Workspace limit reached<\/AlertTitle>/);
  assert.match(
    source,
    /isHighestTierAtCapacity\s+\? "Request custom limit"\s+: "Upgrade plan"/
  );
});

test("landing prompt explicitly left-aligns and labels Lexical's textbox", () => {
  const landingSource = readFileSync(LANDING_PROMPT_CTA_FILE, "utf8");
  const composerEditorSource = readFileSync(COMPOSER_EDITOR_FILE, "utf8");
  const editorSource = readFileSync(EDITOR_FILE, "utf8");
  const pluginsSource = readFileSync(PLUGINS_FILE, "utf8");
  const contentEditableSource = readFileSync(CONTENT_EDITABLE_FILE, "utf8");

  assert.match(landingSource, /max-w-2xl min-w-0 text-left/);
  assert.match(
    landingSource,
    /overflow-x-hidden overflow-y-auto text-left wrap-anywhere/
  );
  assert.match(landingSource, /const contentEditableId = useId\(\);/);
  assert.match(landingSource, /htmlFor=\{contentEditableId\}/);
  assert.match(landingSource, /contentEditableId=\{contentEditableId\}/);
  assert.match(composerEditorSource, /contentEditableId=\{contentEditableId\}/);
  assert.match(editorSource, /contentEditableId=\{contentEditableId\}/);
  assert.match(pluginsSource, /id=\{contentEditableId\}/);
  assert.match(contentEditableSource, /<LexicalContentEditable\s+id=\{id\}/);
});
