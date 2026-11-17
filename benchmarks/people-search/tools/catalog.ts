type ToolDefinition = Readonly<{
  id: string;
  label: string;
  transport: "convex" | "direct" | "treg";
  judgedTopK: 5 | 10;
  // ReacherX runs through the Convex driver; every other tool has an adapter in registry.ts.
  implementation: "convex-driver" | "adapter";
}>;

// Proposal section 2.2. Endpoint support is declared per adapter and confirmed in the smoke test.
export const toolCatalog = [
  {
    id: "reacherx",
    label: "ReacherX",
    transport: "convex",
    judgedTopK: 5,
    implementation: "convex-driver",
  },
  {
    id: "exa",
    label: "Exa",
    transport: "direct",
    judgedTopK: 10,
    implementation: "adapter",
  },
  {
    id: "apollo",
    label: "Apollo",
    transport: "treg",
    judgedTopK: 5,
    implementation: "adapter",
  },
  {
    id: "lusha",
    label: "Lusha",
    transport: "treg",
    judgedTopK: 5,
    implementation: "adapter",
  },
  {
    id: "treg",
    label: "Treg",
    transport: "treg",
    judgedTopK: 10,
    implementation: "adapter",
  },
  {
    id: "crustdata",
    label: "Crustdata (indexed)",
    transport: "treg",
    judgedTopK: 5,
    implementation: "adapter",
  },
  {
    id: "clay",
    label: "Clay",
    transport: "direct",
    judgedTopK: 5,
    implementation: "adapter",
  },
  {
    id: "context",
    label: "context.dev",
    transport: "direct",
    judgedTopK: 10,
    implementation: "adapter",
  },
  {
    id: "firecrawl",
    label: "Firecrawl",
    transport: "direct",
    judgedTopK: 10,
    implementation: "adapter",
  },
] as const satisfies readonly ToolDefinition[];

export type ToolId = (typeof toolCatalog)[number]["id"];
