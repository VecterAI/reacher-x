// features/analytics/lib/mockData.ts

import type { AnalyticsData } from "./types";

export const MOCK_ANALYTICS: AnalyticsData = {
  prospects: {
    value: 89935,
    change: 10.2,
    changePercent: 1.01,
    trend: "up",
  },
  contacted: {
    value: 23283,
    change: 3.1,
    changePercent: 0.49,
    trend: "up",
  },
  responseRate: {
    value: 46.8,
    change: -2.56,
    changePercent: -0.91,
    trend: "down",
  },
  conversions: {
    value: 124854,
    change: 7.2,
    changePercent: 1.51,
    trend: "up",
  },
  trendsOverTime: [
    { date: "Jan", prospects: 186, contacted: 80 },
    { date: "Feb", prospects: 305, contacted: 200 },
    { date: "Mar", prospects: 237, contacted: 120 },
    { date: "Apr", prospects: 73, contacted: 190 },
    { date: "May", prospects: 209, contacted: 130 },
    { date: "Jun", prospects: 214, contacted: 140 },
    { date: "Jul", prospects: 280, contacted: 180 },
    { date: "Aug", prospects: 320, contacted: 210 },
    { date: "Sep", prospects: 295, contacted: 195 },
    { date: "Oct", prospects: 340, contacted: 220 },
    { date: "Nov", prospects: 380, contacted: 250 },
    { date: "Dec", prospects: 420, contacted: 280 },
  ],
  fitDistribution: [
    { range: "0-49", count: 1200 },
    { range: "50-69", count: 3400 },
    { range: "70-79", count: 2800 },
    { range: "80-100", count: 1800 },
  ],
  responseTime: [
    { bucket: "<1h", count: 450 },
    { bucket: "1-6h", count: 820 },
    { bucket: "6-24h", count: 650 },
    { bucket: "1-3d", count: 380 },
    { bucket: ">3d", count: 290 },
    { bucket: ">1w", count: 180 },
  ],
  platformDistribution: [
    { platform: "Twitter/X", count: 8500 },
    { platform: "LinkedIn", count: 0 },
    { platform: "Reddit", count: 0 },
    { platform: "Threads", count: 0 },
    { platform: "Bluesky", count: 0 },
  ],
};
