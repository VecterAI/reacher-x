// features/analytics/ui/components/index.ts

export { StatCard, type StatCardProps } from "./StatCard";
export {
  StatCardSkeleton,
  type StatCardSkeletonProps,
} from "./StatCardSkeleton";
export {
  StatsOverview,
  StatsOverviewSkeleton,
  type StatsOverviewProps,
  type StatMetricData,
} from "./StatsOverview";
export {
  ChartCard,
  ChartCardSkeleton,
  type ChartCardProps,
  type ChartCardSkeletonProps,
} from "./ChartCard";
export {
  DateRangeSelector,
  type DateRangeSelectorProps,
} from "./DateRangeSelector";
export { DateRangeInputPicker } from "./DateRangeInputPicker";
export {
  PipelineFunnelChart,
  type PipelineFunnelChartProps,
} from "./PipelineFunnelChart";
export {
  ProspectsTrendChart,
  type ProspectsTrendChartProps,
} from "./ProspectsTrendChart";
export {
  FitDistributionChart,
  type FitDistributionChartProps,
} from "./FitDistributionChart";
export {
  PlatformDistributionChart,
  type PlatformDistributionChartProps,
} from "./PlatformDistributionChart";

// Legacy exports (deprecated - kept for backward compatibility)
export {
  ResponseTimeChart,
  type ResponseTimeChartProps,
} from "./ResponseTimeChart";
