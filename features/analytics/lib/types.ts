// features/analytics/lib/types.ts

import type * as React from "react";

export type DateRangePreset = "today" | "1d" | "7d" | "30d" | "custom";

// ============================================================================
// Base Stat Metric Types
// ============================================================================

export interface StatMetric {
  value: number;
  change: number;
  changePercent: number;
  trend: "up" | "down";
}

/**
 * Extended StatMetric with display metadata for UI rendering.
 * Used by StatsOverview component.
 */
export interface StatMetricData extends StatMetric {
  id: string;
  title: string;
  icon?: React.ReactNode;
  format?: "number" | "percent" | "decimal";
  /**
   * Context line displayed below the value.
   * For percentages: "of X contacted"
   * For counts with breakdown: "2 plans · 1 task"
   */
  context?: string;
  /**
   * Semantic color for the card value.
   * - "default": Standard text color
   * - "destructive": Red for issues/errors (down is good)
   */
  semantic?: "default" | "destructive";
}

// ============================================================================
// Chart Data Types
// ============================================================================

export interface TrendDataPoint {
  date: string;
  prospects: number;
  contacted: number;
}

export interface FitDistributionDataPoint {
  range: string;
  count: number;
}

export interface PlatformDistributionDataPoint {
  platform: string;
  count: number;
}

/**
 * Pipeline funnel data point representing a stage in the prospect lifecycle.
 */
export interface PipelineFunnelDataPoint {
  /** Stage name: New, Contacted, In Progress, Converted */
  stage: string;
  /** Number of prospects in this stage */
  count: number;
  /** Conversion rate from previous stage (0-100) */
  conversionRate: number | null;
  /** Fill color for the funnel segment */
  fill: string;
}

// ============================================================================
// Aggregated Metric Types
// ============================================================================

/**
 * Pending approvals breakdown for the dashboard.
 */
export interface PendingApprovalsMetric extends StatMetric {
  /** Number of plans pending approval */
  plans: number;
  /** Number of tasks pending approval */
  tasks: number;
}

/**
 * Issues breakdown for the dashboard (paused + failed).
 */
export interface IssuesMetric extends StatMetric {
  /** Number of paused plans */
  paused: number;
  /** Number of failed plans or tasks */
  failed: number;
}

// ============================================================================
// Main Analytics Data Structure
// ============================================================================

export interface AnalyticsData {
  // Top-level stats (4 cards)
  newProspects: StatMetric;
  responseRate: StatMetric & { contacted: number };
  pendingApprovals: PendingApprovalsMetric;
  issues: IssuesMetric;

  // Chart data
  pipelineFunnel: PipelineFunnelDataPoint[];
  trendsOverTime: TrendDataPoint[];
  fitDistribution: FitDistributionDataPoint[];
  platformDistribution: PlatformDistributionDataPoint[];
}
