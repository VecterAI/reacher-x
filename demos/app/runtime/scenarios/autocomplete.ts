import { api } from "@/convex/_generated/api";
import {
  AUTOCOMPLETE_PREFIX,
  AUTOCOMPLETE_EDITED,
  AUTOCOMPLETE_SUGGESTION,
} from "@/features/blog/lib/conversationDemoCopy";
import type { LocalClient } from "../LocalClient";
import type { createAppFixtures } from "../appFixtures";

export function registerAutocompleteStory(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>
) {
  if (state.scenario !== "write-with-autocomplete") return;
  client.register(api.autocompleteControl.isEnabled, () => true);
  client.register(
    api.autocomplete.getInlineSuggestion,
    ({ beforeCursor, workspaceId }) => ({
      suggestion:
        beforeCursor.trim() === AUTOCOMPLETE_PREFIX
          ? AUTOCOMPLETE_SUGGESTION
          : beforeCursor.trim() === AUTOCOMPLETE_EDITED
            ? "it every day"
            : "",
      latencyMs: 0,
      model: "local-scenario",
      workspaceId,
      styleProfileApplied: false,
    })
  );
  client.register(api.autocompleteControl.cancelThreadHelperRequests, () => ({
    cancellationVersion: 0,
  }));
}
