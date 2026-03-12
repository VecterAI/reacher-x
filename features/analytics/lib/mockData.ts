// features/analytics/lib/mockData.ts
// Static mock data for development/testing. Use getMockAnalyticsForRange() for
// time-range-aware mock data.

import type { AnalyticsData } from "./types";

export const MOCK_ANALYTICS: AnalyticsData = {
  // New primary metrics
  newProspects: {
    value: 47,
    change: 12,
    changePercent: 34.2,
    trend: "up",
  },
  responseRate: {
    value: 24.5,
    change: 2.3,
    changePercent: 10.3,
    trend: "up",
    contacted: 156,
  },
  pendingApprovals: {
    value: 3,
    change: -1,
    changePercent: -25.0,
    trend: "down",
    plans: 2,
    tasks: 1,
  },
  issues: {
    value: 2,
    change: 0,
    changePercent: 0,
    trend: "down",
    paused: 1,
    failed: 1,
  },

  // Chart data
  pipelineFunnel: [
    {
      stage: "new",
      count: 47,
      conversionRate: null,
      fill: "hsl(var(--chart-1))",
    },
    {
      stage: "contacted",
      count: 32,
      conversionRate: 68.1,
      fill: "hsl(var(--chart-2))",
    },
    {
      stage: "in_progress",
      count: 12,
      conversionRate: 37.5,
      fill: "hsl(var(--chart-3))",
    },
    {
      stage: "converted",
      count: 5,
      conversionRate: 41.7,
      fill: "hsl(var(--chart-4))",
    },
  ],
  trendsOverTime: [
    { date: "Mon", prospects: 8, contacted: 5 },
    { date: "Tue", prospects: 12, contacted: 7 },
    { date: "Wed", prospects: 6, contacted: 4 },
    { date: "Thu", prospects: 9, contacted: 6 },
    { date: "Fri", prospects: 7, contacted: 5 },
    { date: "Sat", prospects: 3, contacted: 3 },
    { date: "Sun", prospects: 2, contacted: 2 },
  ],
  fitDistribution: [
    { range: "0-49", count: 12 },
    { range: "50-69", count: 18 },
    { range: "70-79", count: 11 },
    { range: "80-100", count: 6 },
  ],
  platformDistribution: [
    { platform: "Twitter/X", count: 47 },
    { platform: "LinkedIn", count: 0 },
    { platform: "Reddit", count: 0 },
    { platform: "Threads", count: 0 },
    { platform: "Bluesky", count: 0 },
  ],
};
