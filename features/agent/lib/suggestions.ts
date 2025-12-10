/**
 * Suggestion generation based on conversation phase.
 * 
 * Suggestions appear above the input box and change based on where
 * the user is in the conversation flow.
 */

export type SuggestionPhase =
  | "greeting" // Initial state
  | "awaiting_url" // Waiting for URL or manual choice
  | "awaiting_description" // Waiting for manual description
  | "awaiting_approval" // ICPs generated, waiting for approval
  | "existing_user_choice" // v3 user choosing update vs use existing
  | "workspace_ready" // Setup complete, offer prospecting
  | "prospecting" // During prospect search
  | "results_ready"; // Prospects found

/**
 * Returns contextual suggestions based on the current conversation phase.
 * These are displayed as clickable chips above the input box.
 */
export function getSuggestions(phase: SuggestionPhase): string[] {
  switch (phase) {
    case "greeting":
    case "awaiting_url":
      return [
        "Here's my website URL",
        "I'll describe my business manually",
      ];

    case "awaiting_description":
      return [
        "Let me paste my description",
        "Actually, I have a website URL",
      ];

    case "awaiting_approval":
      return [
        "Looks good, create my workspace!",
        "I want to update the description",
        "I want to change the ICPs",
      ];

    case "existing_user_choice":
      return [
        "Use my existing details",
        "I want to update my business info",
        "Let me provide a new URL",
      ];

    case "workspace_ready":
      return [
        "Find me prospects on Twitter",
        "Search LinkedIn for leads",
        "Search both platforms",
      ];

    case "prospecting":
      return []; // No suggestions during search

    case "results_ready":
      return [
        "Show me the best matches",
        "Search for more prospects",
        "Update my search criteria",
      ];

    default:
      return [];
  }
}
