export function buildAgentOpsMemoryHref(memoryId: string): string {
  const params = new URLSearchParams();
  params.set("tab", "memory");
  params.set("panel", "memory");
  params.set("memoryId", memoryId);
  return `/agent-ops?${params.toString()}`;
}
