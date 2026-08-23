export interface ViewerReactionSummary {
  emoji: string;
  count: number;
  reactedByViewer?: boolean;
}

export function isViewerReactionSelected(
  reactions: ViewerReactionSummary[] | undefined,
  emoji: string
): boolean {
  return Boolean(
    reactions?.some(
      (reaction) =>
        reaction.emoji === emoji && reaction.reactedByViewer === true
    )
  );
}

export function applyLinkedInViewerReaction(
  reactions: ViewerReactionSummary[] | undefined,
  emoji: string
): ViewerReactionSummary[] {
  const next: ViewerReactionSummary[] = [];
  let targetFound = false;

  for (const reaction of reactions ?? []) {
    const isTarget = reaction.emoji === emoji;
    const shouldRemoveViewerReaction =
      reaction.reactedByViewer === true && !isTarget;
    const count = Math.max(
      0,
      reaction.count - (shouldRemoveViewerReaction ? 1 : 0)
    );

    if (isTarget) {
      targetFound = true;
      if (!reaction.reactedByViewer) {
        next.push({ ...reaction, count: count + 1, reactedByViewer: true });
      } else if (count > 0) {
        next.push({
          ...reaction,
          count,
          reactedByViewer: reaction.reactedByViewer,
        });
      }
      continue;
    }

    if (count > 0) {
      next.push({
        ...reaction,
        count,
        reactedByViewer: shouldRemoveViewerReaction
          ? false
          : reaction.reactedByViewer,
      });
    }
  }

  if (!targetFound) {
    next.push({ emoji, count: 1, reactedByViewer: true });
  }

  return next;
}
