function areJsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (left === undefined || right === undefined) {
    return left === right;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildChangedPatch(
  existing: Record<string, unknown>,
  next: Record<string, unknown>
): Record<string, unknown> | null {
  const changedEntries = Object.entries(next).filter(([key, value]) => {
    if (key === "updatedAt") {
      return false;
    }
    return !areJsonValuesEqual(existing[key], value);
  });

  return changedEntries.length > 0 ? Object.fromEntries(changedEntries) : null;
}

export function buildChangedPatchWithUpdatedAt(
  existing: Record<string, unknown>,
  next: Record<string, unknown>,
  updatedAt: number
): Record<string, unknown> | null {
  const changedPatch = buildChangedPatch(existing, next);
  if (!changedPatch) {
    return null;
  }

  return {
    ...changedPatch,
    updatedAt,
  };
}
