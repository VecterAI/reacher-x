// shared/lib/utils/performance.ts
import { logger } from "../logger";

interface PerformanceMetrics {
  navigationStart: number;
  searchStart: number;
  searchEnd: number;
  resultsDisplayed: number;
  totalTime: number;
  searchTime: number;
  navigationTime: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();

  startNavigation(query: string): void {
    const startTime = performance.now();
    this.metrics.set(query, {
      navigationStart: startTime,
      searchStart: 0,
      searchEnd: 0,
      resultsDisplayed: 0,
      totalTime: 0,
      searchTime: 0,
      navigationTime: 0,
    });

    // Dev-only performance insight
    logger.debug(`[PERFORMANCE] Navigation started for: "${query}"`, {
      timestamp: new Date().toISOString(),
      startTime,
    });
  }

  startSearch(query: string): void {
    const metrics = this.metrics.get(query);
    if (metrics) {
      metrics.searchStart = performance.now();
      logger.debug(`[PERFORMANCE] Search started for: "${query}"`, {
        timestamp: new Date().toISOString(),
        searchStart: metrics.searchStart,
        navigationTime: metrics.searchStart - metrics.navigationStart,
      });
    }
  }

  endSearch(query: string, resultCount: number): void {
    const metrics = this.metrics.get(query);
    if (metrics) {
      metrics.searchEnd = performance.now();
      metrics.resultsDisplayed = resultCount;
      metrics.searchTime = metrics.searchEnd - metrics.searchStart;
      metrics.totalTime = metrics.searchEnd - metrics.navigationStart;
      metrics.navigationTime = metrics.searchStart - metrics.navigationStart;

      logger.debug(`[PERFORMANCE] Search completed for: "${query}"`, {
        timestamp: new Date().toISOString(),
        resultCount,
        searchTime: `${metrics.searchTime.toFixed(2)}ms`,
        navigationTime: `${metrics.navigationTime.toFixed(2)}ms`,
        totalTime: `${metrics.totalTime.toFixed(2)}ms`,
      });

      // Log performance insights
      this.logPerformanceInsights(metrics);
    }
  }

  private logPerformanceInsights(metrics: PerformanceMetrics): void {
    const insights = [] as string[];

    if (metrics.navigationTime < 100) {
      insights.push("✅ Fast navigation");
    } else if (metrics.navigationTime < 300) {
      insights.push("⚠️ Moderate navigation time");
    } else {
      insights.push("❌ Slow navigation");
    }

    if (metrics.searchTime < 1000) {
      insights.push("✅ Fast search");
    } else if (metrics.searchTime < 3000) {
      insights.push("⚠️ Moderate search time");
    } else {
      insights.push("❌ Slow search");
    }

    if (metrics.totalTime < 1500) {
      insights.push("✅ Excellent overall performance");
    } else if (metrics.totalTime < 3500) {
      insights.push("⚠️ Moderate overall performance");
    } else {
      insights.push("❌ Poor overall performance");
    }

    logger.debug(`[PERFORMANCE] Insights: ${insights.join(", ")}`);
  }

  getMetrics(query: string): PerformanceMetrics | undefined {
    return this.metrics.get(query);
  }

  clearMetrics(): void {
    this.metrics.clear();
  }

  getAllMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions for easy usage
export const startNavigation = (query: string) =>
  performanceMonitor.startNavigation(query);
export const startSearch = (query: string) =>
  performanceMonitor.startSearch(query);
export const endSearch = (query: string, resultCount: number) =>
  performanceMonitor.endSearch(query, resultCount);
export const getMetrics = (query: string) =>
  performanceMonitor.getMetrics(query);
