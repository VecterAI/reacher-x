/**
 * ProspectDetailsCard
 * Displays prospect details: Fit, Status, Company, Website, Email, Finance, Location.
 * Features animated fit bar and show more/less toggle.
 */
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import AnimatedPercent from "@/shared/ui/components/AnimatedPercent";
import Link from "next/link";
import {
  HandshakeIcon,
  MailIcon,
  LocationOnIcon,
  AppBadgingIcon,
  StoreIcon,
  GlobeIcon,
  PaidIcon,
  Flag2Icon,
  SearchActivityIcon,
} from "@/shared/ui/components/icons";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  QUALIFICATION_UI_LABELS,
  resolveQualificationPresentation,
} from "@/features/prospects/lib/qualificationUi";

export interface ProspectDetailsCardProps {
  qualificationStatus?: Doc<"prospects">["qualificationStatus"];
  /** Qualification score (0-100) */
  qualificationScore?: number;
  /** Prospect status */
  status?: "new" | "contacted" | "in_progress" | "converted" | "archived";
  /** Company name */
  company?: string;
  /** Website URL */
  websiteUrl?: string;
  /** Email address */
  email?: string;
  /** Finance display value (e.g., "$9000-$14000") */
  finance?: string;
  /** Location */
  location?: string;
  /** How the prospect was discovered */
  foundViaLabel?: string;
  /** Handler for finance click (opens evidence panel) */
  onFinanceClick?: () => void;
  /** Additional className */
  className?: string;
}

/**
 * Animated ASCII progress bar
 * Uses filled blocks (█) and empty blocks (░) to show percentage
 * Animates on mount with ease-out timing for smooth feel
 */
/** Animated ASCII bar (█/░) — shared with Plans usage and other surfaces. */
export function AnimatedFitBar({
  percentage,
  className,
}: {
  percentage: number;
  className?: string;
}) {
  const totalBlocks = 12;
  const targetBlocks = Math.floor((percentage / 100) * totalBlocks);
  const [filledBlocks, setFilledBlocks] = React.useState(0);
  const animationRef = React.useRef<NodeJS.Timeout | null>(null);

  // Animate the blocks with ease-out timing (starts fast, slows down at end)
  React.useEffect(() => {
    if (animationRef.current) clearTimeout(animationRef.current);

    let current = 0;
    const baseInterval = 25;
    const maxInterval = 80;

    const animateStep = () => {
      if (current < targetBlocks) {
        current++;
        setFilledBlocks(current);

        // Ease-out: intervals get progressively longer
        const progress = current / targetBlocks;
        const easedInterval =
          baseInterval + (maxInterval - baseInterval) * progress * progress;

        animationRef.current = setTimeout(animateStep, easedInterval);
      }
    };

    // Start animation after brief delay
    animationRef.current = setTimeout(animateStep, 100);

    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [percentage, targetBlocks]);

  const emptyBlocks = totalBlocks - filledBlocks;
  const bar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);

  return (
    <span
      className={cn("font-mono text-xs tracking-tight", className)}
      aria-label={`${percentage}% fit`}
    >
      {bar}
    </span>
  );
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Optional className for value container - defaults to text-muted-foreground */
  valueClassName?: string;
}

function DetailRow({
  icon,
  label,
  children,
  className,
  valueClassName,
}: DetailRowProps) {
  return (
    <div className={cn("flex items-center gap-3 py-1.5 text-sm", className)}>
      <div className="text-foreground flex w-28 shrink-0 items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 truncate",
          valueClassName ?? "text-muted-foreground"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ProspectDetailsCard({
  qualificationStatus,
  qualificationScore = 0,
  status = "new",
  company,
  websiteUrl,
  email,
  finance,
  location,
  foundViaLabel,
  onFinanceClick,
  className,
}: ProspectDetailsCardProps) {
  const { entitySingular, stageLabels } = useActiveUseCaseLabels();
  const qualificationPresentation =
    resolveQualificationPresentation(qualificationStatus);
  const [showMore, setShowMore] = React.useState(false);

  // Determine which fields are visible
  const hasHiddenFields = Boolean(email || finance || location);

  return (
    <div className={cn("space-y-1", className)}>
      <DetailRow
        icon={<Flag2Icon className="fill-current" />}
        label={QUALIFICATION_UI_LABELS.flaggedRowLabel}
        valueClassName={qualificationPresentation.profileValueClassName}
      >
        {qualificationPresentation.profileValueText}
      </DetailRow>

      {/* Fit (always visible) */}
      <DetailRow
        icon={<HandshakeIcon className="fill-current" />}
        label="Fit"
        valueClassName="text-foreground"
      >
        <div className="flex items-center gap-2">
          <AnimatedFitBar percentage={qualificationScore} />
          <AnimatedPercent
            value={qualificationScore}
            srLabel={`${entitySingular} fit score`}
          />
        </div>
      </DetailRow>

      {/* Status (always visible) */}
      <DetailRow
        icon={<AppBadgingIcon className="fill-current" />}
        label="Status"
      >
        <Badge variant="secondary" className="text-xs">
          {stageLabels[status]}
        </Badge>
      </DetailRow>

      {foundViaLabel ? (
        <DetailRow
          icon={<SearchActivityIcon className="fill-current" />}
          label="Found via"
        >
          {foundViaLabel}
        </DetailRow>
      ) : null}

      {/* Company (always visible if present) */}
      {company && (
        <DetailRow
          icon={<StoreIcon className="fill-current" />}
          label="Company"
        >
          {company}
        </DetailRow>
      )}

      {/* Website URL (always visible if present) */}
      {websiteUrl && (
        <DetailRow
          icon={<GlobeIcon className="fill-current" />}
          label="Website Url"
        >
          <Link
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate hover:underline"
          >
            {websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </Link>
        </DetailRow>
      )}

      {/* Hidden fields (Email, Finance, Location) - shown when expanded */}
      {showMore && (
        <>
          {email && (
            <DetailRow
              icon={<MailIcon className="fill-current" />}
              label="Email"
            >
              {email}
            </DetailRow>
          )}

          {finance && (
            <DetailRow
              icon={<PaidIcon className="fill-current" />}
              label="Finance"
            >
              <button
                type="button"
                onClick={onFinanceClick}
                className="truncate hover:underline"
              >
                {finance}
              </button>
            </DetailRow>
          )}

          {location && (
            <DetailRow
              icon={<LocationOnIcon className="fill-current" />}
              label="Location"
            >
              {location}
            </DetailRow>
          )}
        </>
      )}

      {/* Show more/less toggle */}
      {hasHiddenFields && (
        <Button
          variant="outline"
          size="xs"
          onClick={() => setShowMore((prev) => !prev)}
          className="mt-2"
        >
          {showMore ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}
