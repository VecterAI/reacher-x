export type XChatTargetGeneration = {
  targetKey: string;
  generation: number;
};

export function createXChatTargetGeneration(
  targetKey: string
): XChatTargetGeneration {
  return { targetKey, generation: 0 };
}

export function advanceXChatTargetGeneration(
  current: XChatTargetGeneration,
  targetKey: string
): XChatTargetGeneration {
  if (current.targetKey === targetKey) return current;
  return { targetKey, generation: current.generation + 1 };
}

export function isCurrentXChatTargetGeneration(
  current: XChatTargetGeneration,
  request: XChatTargetGeneration
): boolean {
  return (
    current.targetKey === request.targetKey &&
    current.generation === request.generation
  );
}
