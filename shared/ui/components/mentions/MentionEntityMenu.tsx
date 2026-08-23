"use client";

import * as React from "react";
import Image from "next/image";
import type {
  MentionEntityKind,
  MentionEntitySearchResult,
} from "@/shared/lib/mentions/mentionEntities";
import { cn } from "@/shared/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { AttachmentMedia } from "@/shared/ui/components/Attachment";
import { FileVisualIcon } from "@/shared/ui/components/FileVisualIcon";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/ui/components/ToggleGroup";
import {
  AccountCircleIcon,
  ChangeHistoryIcon,
  CheckBoxOutlineBlankIcon,
  ForumIcon,
  LinkedinIcon,
  NewReleasesIcon,
  TwitterIcon,
} from "@/shared/ui/components/icons";

export type MentionEntityFilter = "all" | MentionEntityKind;

const MENTION_ENTITY_GROUPS: ReadonlyArray<{
  value: MentionEntityFilter;
  label: string | null;
}> = [
  { value: "all", label: "All" },
  { value: "prospect", label: null },
  { value: "post", label: "Posts" },
  { value: "plan", label: "Plans" },
  { value: "task", label: "Tasks" },
  { value: "attachment", label: "Attachments" },
];

class MentionEntityMenuBoundary extends React.Component<
  {
    children: React.ReactNode;
    resetKey: string;
    fallback: React.ReactNode;
  },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(
      "[MentionEntityMenu] Failed to render mention results",
      error
    );
  }

  componentDidUpdate(
    prevProps: Readonly<{
      children: React.ReactNode;
      resetKey: string;
      fallback: React.ReactNode;
    }>
  ) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function getMentionEntityIcon(kind: MentionEntitySearchResult["kind"]) {
  switch (kind) {
    case "plan":
      return (
        <ChangeHistoryIcon className="size-4 fill-current" aria-hidden="true" />
      );
    case "task":
      return (
        <CheckBoxOutlineBlankIcon
          className="size-4 fill-current"
          aria-hidden="true"
        />
      );
    case "post":
      return <ForumIcon className="size-4 fill-current" aria-hidden="true" />;
    case "prospect":
    case "attachment":
    default:
      return (
        <AccountCircleIcon className="size-4 fill-current" aria-hidden="true" />
      );
  }
}

function MentionEntityVisual({
  entity,
}: {
  entity: MentionEntitySearchResult;
}) {
  if (entity.kind === "prospect") {
    return (
      <Avatar className="ring-border h-9 w-9 ring-1">
        {entity.avatarUrl ? (
          <AvatarImage src={entity.avatarUrl} alt="" />
        ) : null}
        <AvatarFallback>{getMentionEntityFallbackLabel(entity)}</AvatarFallback>
      </Avatar>
    );
  }

  if (entity.kind === "attachment") {
    const showsImagePreview =
      entity.attachmentMediaKind === "image" ||
      entity.attachmentMediaKind === "gif";

    return (
      <AttachmentMedia
        variant={showsImagePreview && entity.attachmentUrl ? "image" : "icon"}
        className="border-border size-9 w-9 rounded-lg border bg-transparent [&_img]:size-full [&_img]:object-cover"
        aria-hidden="true"
      >
        {showsImagePreview && entity.attachmentUrl ? (
          <Image
            src={entity.attachmentUrl}
            alt=""
            width={36}
            height={36}
            sizes="36px"
            loading="eager"
            unoptimized
          />
        ) : (
          <FileVisualIcon
            fileName={entity.label}
            mimeType={entity.attachmentMimeType}
            url={entity.attachmentUrl}
          />
        )}
      </AttachmentMedia>
    );
  }

  let icon = getMentionEntityIcon(entity.kind);
  if (entity.kind === "post" && entity.postPlatform === "twitter") {
    icon = <TwitterIcon className="size-4" aria-hidden="true" />;
  } else if (entity.kind === "post" && entity.postPlatform === "linkedin") {
    icon = <LinkedinIcon className="size-4 fill-current" aria-hidden="true" />;
  }

  return (
    <span
      className="border-border text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border bg-transparent"
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

function getMentionEntityFallbackLabel(entity: MentionEntitySearchResult) {
  if (entity.kind === "prospect") {
    return entity.label?.charAt(0).toUpperCase() || "?";
  }

  return getMentionEntityIcon(entity.kind);
}

export function MentionEntityMenu({
  results,
  loading = false,
  selectedIndex = -1,
  onSelect,
  onHover,
  emptyLabel = "No matches found.",
  className,
  bodyStyle,
  searchSlot,
  entityPluralLabel = "People",
  availableKinds,
  activeFilter = "all",
  onActiveFilterChange,
  listboxId,
  getOptionId,
}: {
  results: MentionEntitySearchResult[];
  loading?: boolean;
  selectedIndex?: number;
  onSelect: (item: MentionEntitySearchResult) => void;
  onHover?: (index: number) => void;
  emptyLabel?: string;
  className?: string;
  bodyStyle?: React.CSSProperties;
  searchSlot?: React.ReactNode;
  entityPluralLabel?: string;
  availableKinds?: MentionEntityKind[];
  activeFilter?: MentionEntityFilter;
  onActiveFilterChange?: (filter: MentionEntityFilter) => void;
  listboxId?: string;
  getOptionId?: (item: MentionEntitySearchResult, index: number) => string;
}) {
  const listboxRef = React.useRef<HTMLDivElement>(null);
  const selectedResultId = results[selectedIndex]?.id;
  const visibleGroups = MENTION_ENTITY_GROUPS.filter(
    (group) =>
      group.value === "all" || availableKinds?.includes(group.value) === true
  );
  const showGroups = visibleGroups.length > 2 && onActiveFilterChange;

  React.useEffect(() => {
    if (!selectedResultId) {
      return;
    }

    const selectedOption = listboxRef.current?.querySelector<HTMLElement>(
      '[role="option"][aria-selected="true"]'
    );
    selectedOption?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedResultId]);

  const menuBody = (
    <div
      ref={listboxRef}
      id={listboxId}
      role="listbox"
      className="scroll-fade-b max-h-72 overflow-auto p-1"
      style={bodyStyle}
    >
      {loading ? (
        Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`loading-${index}`}
            className="flex items-center gap-3 rounded-lg px-2 py-2"
          >
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))
      ) : results.length === 0 ? (
        <div className="text-muted-foreground px-2 py-2 text-sm">
          {emptyLabel}
        </div>
      ) : (
        results.map((item, index) => (
          <button
            key={item.id}
            id={getOptionId?.(item, index)}
            role="option"
            type="button"
            disabled={item.attachmentDisabled === true}
            className={cn(
              "hover:bg-muted flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
              selectedIndex === index && "bg-muted",
              item.attachmentDisabled &&
                "cursor-not-allowed opacity-50 hover:bg-transparent"
            )}
            aria-selected={selectedIndex === index}
            aria-disabled={item.attachmentDisabled === true}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover?.(index)}
            onClick={() => onSelect(item)}
          >
            <MentionEntityVisual entity={item} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-foreground truncate text-sm font-medium">
                  {item.label}
                </span>
                {item.verified ? (
                  <NewReleasesIcon
                    className="text-primary size-3 fill-current"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <div
                className="text-muted-foreground truncate text-xs"
                title={item.attachmentDisabledReason ?? undefined}
              >
                {item.attachmentDisabledReason ?? item.secondaryLabel}
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "bg-background max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border shadow-xl",
        className
      )}
    >
      {searchSlot ? <div className="border-b p-2">{searchSlot}</div> : null}
      {showGroups ? (
        <div className="scroll-fade-x scrollbar-none overflow-x-auto [overflow-y:clip] border-b px-2 py-2 [&::-webkit-scrollbar]:hidden">
          <ToggleGroup
            type="single"
            value={activeFilter}
            variant="outline"
            size="xs"
            className="w-max justify-start gap-1"
            aria-label="Filter mentions"
            onValueChange={(value) => {
              const group = visibleGroups.find((item) => item.value === value);
              if (group) {
                onActiveFilterChange(group.value);
              }
            }}
          >
            {visibleGroups.map((group) => (
              <ToggleGroupItem
                key={group.value}
                value={group.value}
                className="bg-background text-muted-foreground data-[state=on]:border-muted-foreground/30 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:hover:bg-accent data-[state=on]:hover:text-accent-foreground px-2.5"
                onPointerDown={(event) => {
                  event.preventDefault();
                  onActiveFilterChange(group.value);
                }}
              >
                {group.value === "prospect" ? entityPluralLabel : group.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}
      <MentionEntityMenuBoundary
        resetKey={`${loading}:${results.map((item) => item.id).join("|")}`}
        fallback={
          <div className="text-muted-foreground px-2 py-2 text-sm">
            Mention results are temporarily unavailable.
          </div>
        }
      >
        {menuBody}
      </MentionEntityMenuBoundary>
    </div>
  );
}
