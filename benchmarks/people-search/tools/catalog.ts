type ToolDefinition = Readonly<{
  id: string;
  label: string;
  transport: "convex" | "direct" | "treg";
  judgedTopK: 5 | 10;
  implementation: "pending";
}>;

// Proposal section 2.2. This is a build list, not a claim of endpoint support or working adapters.
export const toolCatalog = [
  {
    id: "reacherx",
    label: "ReacherX",
    transport: "convex",
    judgedTopK: 5,
    implementation: "pending",
  },
  {
    id: "exa",
    label: "Exa",
    transport: "direct",
    judgedTopK: 10,
    implementation: "pending",
  },
  {
    id: "apollo",
    label: "Apollo",
    transport: "treg",
    judgedTopK: 5,
    implementation: "pending",
  },
  {
    id: "lusha",
    label: "Lusha",
    transport: "treg",
    judgedTopK: 5,
    implementation: "pending",
  },
  {
    id: "treg",
    label: "Treg",
    transport: "treg",
    judgedTopK: 10,
    implementation: "pending",
  },
  {
    id: "crustdata",
    label: "Crustdata (indexed)",
    transport: "treg",
    judgedTopK: 5,
    implementation: "pending",
  },
  {
    id: "clay",
    label: "Clay",
    transport: "direct",
    judgedTopK: 5,
    implementation: "pending",
  },
  {
    id: "context",
    label: "context.dev",
    transport: "direct",
    judgedTopK: 10,
    implementation: "pending",
  },
  {
    id: "firecrawl",
    label: "Firecrawl",
    transport: "direct",
    judgedTopK: 10,
    implementation: "pending",
  },
] as const satisfies readonly ToolDefinition[];

export type ToolId = (typeof toolCatalog)[number]["id"];
