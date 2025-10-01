/**
 * Keyword Sync Validation System
 *
 * Comprehensive testing and validation utilities for the keyword sync system.
 * Ensures data integrity, conflict resolution, and system robustness.
 */

import { UnifiedKeyword } from "./unifiedKeywordStore";
import {
  detectConflicts,
  resolveKeywordConflict,
  validateResolvedData,
} from "./keywordConflictResolver";
import { logger } from "../logger";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface SyncTestScenario {
  name: string;
  description: string;
  localData: UnifiedKeyword[];
  remoteData: UnifiedKeyword[];
  expectedConflicts: number;
  expectedResolution: string;
}

export interface PerformanceMetrics {
  syncTime: number;
  conflictResolutionTime: number;
  dataIntegrityScore: number;
  memoryUsage: number;
  errorRate: number;
}

/**
 * Validates the entire keyword sync system
 */
export function validateKeywordSyncSystem(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Test 1: Basic data validation
  const basicValidation = validateBasicDataIntegrity();
  if (!basicValidation.isValid) {
    errors.push(...basicValidation.errors);
  }
  warnings.push(...basicValidation.warnings);

  // Test 2: Conflict resolution scenarios
  const conflictValidation = validateConflictResolution();
  if (!conflictValidation.isValid) {
    errors.push(...conflictValidation.errors);
  }
  warnings.push(...conflictValidation.warnings);

  // Test 3: Performance benchmarks
  const performanceValidation = validatePerformance();
  if (!performanceValidation.isValid) {
    errors.push(...performanceValidation.errors);
  }
  warnings.push(...performanceValidation.warnings);

  // Test 4: Edge case handling
  const edgeCaseValidation = validateEdgeCases();
  if (!edgeCaseValidation.isValid) {
    errors.push(...edgeCaseValidation.errors);
  }
  warnings.push(...edgeCaseValidation.warnings);

  // Generate suggestions based on validation results
  if (errors.length === 0 && warnings.length === 0) {
    suggestions.push("✅ All validation tests passed successfully");
  } else {
    suggestions.push("🔧 Consider implementing additional error handling");
    suggestions.push("📊 Monitor sync performance in production");
    suggestions.push("🔄 Implement automated conflict resolution testing");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validates basic data integrity
 */
function validateBasicDataIntegrity(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Test data structure validation
  const testKeyword: UnifiedKeyword = {
    id: "test_kw_1",
    keyword: "test keyword",
    exactMatch: false,
    createdAt: Date.now() - 86400000, // 1 day ago
    lastUsedAt: Date.now(),
    searchCount: 5,
    isPinned: false,
    source: "user_created",
    status: "active",
    votes: [],
    decayedScore: 0,
    metadata: {},
  };

  const validation = validateResolvedData(testKeyword);
  if (!validation.isValid) {
    errors.push("Basic data structure validation failed");
    errors.push(...validation.errors);
  }

  // Test timestamp consistency
  if (testKeyword.createdAt > testKeyword.lastUsedAt) {
    errors.push("Created timestamp should not be after last used timestamp");
  }

  // Test search count validity
  if (testKeyword.searchCount < 0) {
    errors.push("Search count should not be negative");
  }

  // Test status validity
  const validStatuses = ["active", "high_value", "discarded"];
  if (!validStatuses.includes(testKeyword.status)) {
    errors.push("Status should be one of: " + validStatuses.join(", "));
  }

  // Test source validity
  const validSources = ["user_created", "ai_suggestion", "ai_reprompt"];
  if (!validSources.includes(testKeyword.source)) {
    errors.push("Source should be one of: " + validSources.join(", "));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions: [],
  };
}

/**
 * Validates conflict resolution scenarios
 */
function validateConflictResolution(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Test scenario 1: Timestamp conflict
  const now = Date.now();
  const localData: UnifiedKeyword[] = [
    {
      id: "kw_1",
      keyword: "test",
      exactMatch: false,
      createdAt: now - 3600000,
      lastUsedAt: now - 60000, // 1 minute ago
      searchCount: 3,
      isPinned: false,
      source: "user_created",
      status: "active",
      votes: [],
      decayedScore: 0,
      metadata: {},
    },
  ];

  const remoteData: UnifiedKeyword[] = [
    {
      id: "kw_1",
      keyword: "test",
      exactMatch: false,
      createdAt: now - 3600000,
      lastUsedAt: now - 120000, // 2 minutes ago
      searchCount: 5,
      isPinned: false,
      source: "user_created",
      status: "active",
      votes: [],
      decayedScore: 0,
      metadata: {},
    },
  ];

  const conflicts = detectConflicts(localData, remoteData);
  if (conflicts.length === 0) {
    errors.push("Expected conflicts not detected");
  }

  // Test conflict resolution
  if (conflicts.length > 0) {
    const resolution = resolveKeywordConflict(conflicts[0]);
    if (!resolution.resolved) {
      errors.push("Conflict resolution failed");
    }

    // Validate resolved data
    const resolvedValidation = validateResolvedData(resolution.resolvedData);
    if (!resolvedValidation.isValid) {
      errors.push("Resolved data validation failed");
      errors.push(...resolvedValidation.errors);
    }
  }

  // Test scenario 2: Pinned status conflict
  const pinnedConflict = {
    keyword: "pinned_test",
    exactMatch: false,
    localData: {
      ...localData[0],
      isPinned: true,
      pinnedAt: now,
    },
    remoteData: {
      ...remoteData[0],
      isPinned: false,
      pinnedAt: undefined,
    },
    conflictFields: ["isPinned"],
    timestamp: now,
  };

  const pinnedResolution = resolveKeywordConflict(pinnedConflict);
  if (!pinnedResolution.resolved) {
    errors.push("Pinned status conflict resolution failed");
  }

  // Test scenario 3: Vote merging
  const voteConflict = {
    keyword: "vote_test",
    exactMatch: false,
    localData: {
      ...localData[0],
      votes: [
        { vote: "up" as const, timestamp: now - 300000, tweetId: "tweet1" },
      ],
    },
    remoteData: {
      ...remoteData[0],
      votes: [
        { vote: "down" as const, timestamp: now - 200000, tweetId: "tweet2" },
      ],
    },
    conflictFields: ["votes"],
    timestamp: now,
  };

  const voteResolution = resolveKeywordConflict(voteConflict);
  if (!voteResolution.resolved) {
    errors.push("Vote conflict resolution failed");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions: [],
  };
}

/**
 * Validates performance characteristics
 */
function validatePerformance(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Test sync performance with large datasets
  const largeDataset = generateLargeDataset(1000);
  const startTime = performance.now();

  try {
    const detectedConflicts = detectConflicts(
      largeDataset.local,
      largeDataset.remote
    );
    const conflictResolutionTime = performance.now() - startTime;

    if (conflictResolutionTime > 1000) {
      // 1 second
      warnings.push(
        `Conflict detection took ${conflictResolutionTime}ms for 1000 items`
      );
    }

    // Log conflict count for debugging
    if (detectedConflicts.length > 0) {
      logger.debug(
        `Performance test detected ${detectedConflicts.length} conflicts`
      );
    }

    // Test memory usage
    const memoryUsage =
      (performance as Performance & { memory?: { usedJSHeapSize: number } })
        .memory?.usedJSHeapSize || 0;
    if (memoryUsage > 50 * 1024 * 1024) {
      // 50MB
      warnings.push("High memory usage detected during sync operations");
    }
  } catch (error) {
    errors.push(
      `Performance test failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions: [],
  };
}

/**
 * Validates edge case handling
 */
function validateEdgeCases(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Test 1: Empty datasets
  try {
    const emptyConflicts = detectConflicts([], []);
    if (emptyConflicts.length !== 0) {
      errors.push("Empty dataset should not produce conflicts");
    }
  } catch (error) {
    errors.push(
      `Empty dataset handling failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  // Test 2: Invalid data handling
  try {
    const invalidKeyword = {
      id: "invalid",
      keyword: "",
      exactMatch: false,
      createdAt: Date.now() + 86400000, // Future timestamp
      lastUsedAt: Date.now() - 86400000, // Past timestamp
      searchCount: -1,
      isPinned: true,
      pinnedAt: undefined, // Missing pinnedAt
      source: "invalid_source" as UnifiedKeyword["source"],
      status: "invalid_status" as UnifiedKeyword["status"],
      votes: [
        {
          vote: "invalid" as UnifiedKeyword["votes"][0]["vote"],
          timestamp: Date.now(),
        },
      ],
      decayedScore: NaN,
      metadata: undefined,
    };

    const validation = validateResolvedData(invalidKeyword);
    if (validation.isValid) {
      errors.push("Invalid data should not pass validation");
    }
  } catch {
    // Expected to throw or return invalid - error intentionally ignored
  }

  // Test 3: Concurrent modification simulation
  try {
    const concurrentData = generateConcurrentModificationData();
    const detectedConflicts = detectConflicts(
      concurrentData.local,
      concurrentData.remote
    );

    if (detectedConflicts.length === 0) {
      warnings.push("Concurrent modifications should produce conflicts");
    }

    // Test resolution
    for (const conflict of detectedConflicts) {
      const resolution = resolveKeywordConflict(conflict);
      if (!resolution.resolved) {
        errors.push("Concurrent modification conflict resolution failed");
      }
    }
  } catch (err) {
    errors.push(
      `Concurrent modification test failed: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions: [],
  };
}

/**
 * Generates test data for performance testing
 */
function generateLargeDataset(size: number): {
  local: UnifiedKeyword[];
  remote: UnifiedKeyword[];
} {
  const local: UnifiedKeyword[] = [];
  const remote: UnifiedKeyword[] = [];

  for (let i = 0; i < size; i++) {
    const baseTime = Date.now() - i * 60000; // 1 minute apart
    const hasConflict = Math.random() > 0.5;

    const baseKeyword: UnifiedKeyword = {
      id: `kw_${i}`,
      keyword: `keyword_${i}`,
      exactMatch: i % 2 === 0,
      createdAt: baseTime,
      lastUsedAt: baseTime + 30000,
      searchCount: i + 1,
      isPinned: i % 10 === 0,
      pinnedAt: i % 10 === 0 ? baseTime + 30000 : undefined,
      source: i % 3 === 0 ? "ai_suggestion" : "user_created",
      status: i % 5 === 0 ? "high_value" : "active",
      votes: [],
      decayedScore: i * 0.1,
      metadata: { test: true },
    };

    local.push(baseKeyword);

    if (hasConflict) {
      remote.push({
        ...baseKeyword,
        lastUsedAt: baseTime + 60000, // Different timestamp
        searchCount: baseKeyword.searchCount + Math.floor(Math.random() * 5),
        isPinned: !baseKeyword.isPinned, // Different pinned status
      });
    } else {
      remote.push({ ...baseKeyword });
    }
  }

  return { local, remote };
}

/**
 * Generates data simulating concurrent modifications
 */
function generateConcurrentModificationData(): {
  local: UnifiedKeyword[];
  remote: UnifiedKeyword[];
} {
  const baseTime = Date.now();

  const local: UnifiedKeyword[] = [
    {
      id: "concurrent_1",
      keyword: "concurrent test",
      exactMatch: false,
      createdAt: baseTime - 3600000,
      lastUsedAt: baseTime - 60000,
      searchCount: 5,
      isPinned: true,
      pinnedAt: baseTime - 300000,
      source: "user_created",
      status: "active",
      votes: [{ vote: "up", timestamp: baseTime - 300000, tweetId: "tweet1" }],
      decayedScore: 1.5,
      metadata: { local: true },
    },
  ];

  const remote: UnifiedKeyword[] = [
    {
      id: "concurrent_1",
      keyword: "concurrent test",
      exactMatch: false,
      createdAt: baseTime - 3600000,
      lastUsedAt: baseTime - 30000, // More recent
      searchCount: 8, // Higher count
      isPinned: false, // Different pinned status
      pinnedAt: undefined,
      source: "user_created",
      status: "high_value", // Different status
      votes: [
        { vote: "up", timestamp: baseTime - 300000, tweetId: "tweet1" },
        { vote: "down", timestamp: baseTime - 200000, tweetId: "tweet2" },
      ],
      decayedScore: 2.0, // Different score
      metadata: { remote: true, additional: "data" },
    },
  ];

  return { local, remote };
}

/**
 * Runs comprehensive test scenarios
 */
export function runTestScenarios(): {
  passed: number;
  failed: number;
  results: Array<{
    scenario: string;
    passed: boolean;
    error?: string;
    metrics?: PerformanceMetrics;
  }>;
} {
  const scenarios: SyncTestScenario[] = [
    {
      name: "basic_sync",
      description: "Basic keyword sync without conflicts",
      localData: generateTestData(5),
      remoteData: generateTestData(5),
      expectedConflicts: 0,
      expectedResolution: "no_conflicts",
    },
    {
      name: "timestamp_conflict",
      description: "Conflict in lastUsedAt timestamps",
      localData: generateTimestampConflictData().local,
      remoteData: generateTimestampConflictData().remote,
      expectedConflicts: 1,
      expectedResolution: "timestamp_based",
    },
    {
      name: "pinned_conflict",
      description: "Conflict in pinned status",
      localData: generatePinnedConflictData().local,
      remoteData: generatePinnedConflictData().remote,
      expectedConflicts: 1,
      expectedResolution: "user_intent",
    },
    {
      name: "vote_merge",
      description: "Merging votes from different sources",
      localData: generateVoteMergeData().local,
      remoteData: generateVoteMergeData().remote,
      expectedConflicts: 1,
      expectedResolution: "merge",
    },
  ];

  const results: Array<{
    scenario: string;
    passed: boolean;
    error?: string;
    metrics?: PerformanceMetrics;
  }> = [];

  let passed = 0;
  let failed = 0;

  for (const scenario of scenarios) {
    try {
      const startTime = performance.now();
      const conflicts = detectConflicts(
        scenario.localData,
        scenario.remoteData
      );
      const detectionTime = performance.now() - startTime;

      let resolutionTime = 0;
      let allResolved = true;

      for (const conflict of conflicts) {
        const resolutionStart = performance.now();
        const resolution = resolveKeywordConflict(conflict);
        resolutionTime += performance.now() - resolutionStart;

        if (!resolution.resolved) {
          allResolved = false;
        }
      }

      const totalTime = detectionTime + resolutionTime;
      const expectedConflicts = conflicts.length === scenario.expectedConflicts;
      const resolutionSuccess = allResolved;

      const passedScenario = expectedConflicts && resolutionSuccess;

      if (passedScenario) {
        passed++;
      } else {
        failed++;
      }

      results.push({
        scenario: scenario.name,
        passed: passedScenario,
        error: passedScenario
          ? undefined
          : `Expected ${scenario.expectedConflicts} conflicts, got ${conflicts.length}`,
        metrics: {
          syncTime: totalTime,
          conflictResolutionTime: resolutionTime,
          dataIntegrityScore: allResolved ? 1.0 : 0.0,
          memoryUsage:
            (
              performance as Performance & {
                memory?: { usedJSHeapSize: number };
              }
            ).memory?.usedJSHeapSize || 0,
          errorRate: passedScenario ? 0.0 : 1.0,
        },
      });
    } catch (error) {
      failed++;
      results.push({
        scenario: scenario.name,
        passed: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { passed, failed, results };
}

/**
 * Helper functions for generating test data
 */
function generateTestData(count: number): UnifiedKeyword[] {
  const data: UnifiedKeyword[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    data.push({
      id: `test_kw_${i}`,
      keyword: `test keyword ${i}`,
      exactMatch: i % 2 === 0,
      createdAt: now - i * 60000,
      lastUsedAt: now - i * 30000,
      searchCount: i + 1,
      isPinned: i % 5 === 0,
      pinnedAt: i % 5 === 0 ? now - i * 30000 : undefined,
      source: i % 3 === 0 ? "ai_suggestion" : "user_created",
      status: "active",
      votes: [],
      decayedScore: i * 0.1,
      metadata: {},
    });
  }

  return data;
}

function generateTimestampConflictData(): {
  local: UnifiedKeyword[];
  remote: UnifiedKeyword[];
} {
  const now = Date.now();
  const base: UnifiedKeyword = {
    id: "timestamp_test",
    keyword: "timestamp test",
    exactMatch: false,
    createdAt: now - 3600000,
    lastUsedAt: now - 60000,
    searchCount: 3,
    isPinned: false,
    source: "user_created",
    status: "active",
    votes: [],
    decayedScore: 0,
    metadata: {},
  };

  return {
    local: [{ ...base, lastUsedAt: now - 30000 }],
    remote: [{ ...base, lastUsedAt: now - 90000 }],
  };
}

function generatePinnedConflictData(): {
  local: UnifiedKeyword[];
  remote: UnifiedKeyword[];
} {
  const now = Date.now();
  const base: UnifiedKeyword = {
    id: "pinned_test",
    keyword: "pinned test",
    exactMatch: false,
    createdAt: now - 3600000,
    lastUsedAt: now - 60000,
    searchCount: 3,
    isPinned: false,
    source: "user_created",
    status: "active",
    votes: [],
    decayedScore: 0,
    metadata: {},
  };

  return {
    local: [{ ...base, isPinned: true, pinnedAt: now - 30000 }],
    remote: [{ ...base, isPinned: false, pinnedAt: undefined }],
  };
}

function generateVoteMergeData(): {
  local: UnifiedKeyword[];
  remote: UnifiedKeyword[];
} {
  const now = Date.now();
  const base: UnifiedKeyword = {
    id: "vote_test",
    keyword: "vote test",
    exactMatch: false,
    createdAt: now - 3600000,
    lastUsedAt: now - 60000,
    searchCount: 3,
    isPinned: false,
    source: "user_created",
    status: "active",
    votes: [],
    decayedScore: 0,
    metadata: {},
  };

  return {
    local: [
      {
        ...base,
        votes: [{ vote: "up", timestamp: now - 300000, tweetId: "tweet1" }],
      },
    ],
    remote: [
      {
        ...base,
        votes: [{ vote: "down", timestamp: now - 200000, tweetId: "tweet2" }],
      },
    ],
  };
}

/**
 * Logs validation results in a readable format
 */
export function logValidationResults(result: ValidationResult): void {
  // Developer diagnostics only; not included in production
  if (process.env.NODE_ENV !== "development") return;

  logger.debug("🔍 Keyword Sync Validation Results");

  logger.debug(
    result.isValid ? "✅ All validations passed" : "❌ Validation failed"
  );

  if (result.errors.length > 0) {
    logger.debug("🚨 Errors");
    result.errors.forEach((error) => logger.error(error));
  }

  if (result.warnings.length > 0) {
    logger.debug("⚠️ Warnings");
    result.warnings.forEach((warning) => logger.warn(warning));
  }

  if (result.suggestions.length > 0) {
    logger.debug("💡 Suggestions");
    result.suggestions.forEach((suggestion) => logger.debug(suggestion));
  }
}
