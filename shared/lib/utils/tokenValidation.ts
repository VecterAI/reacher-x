/**
 * Token validation utilities
 *
 * Provides functions to validate OAuth token expiration and refresh requirements.
 * Helps ensure tokens are valid before making API calls.
 *
 * Security considerations:
 * - Validates token expiration with buffer time
 * - Handles edge cases for missing expiration data
 * - Provides clear validation results
 *
 * References:
 * - OAuth 2.0 Token Expiration: https://tools.ietf.org/html/rfc6749#section-4.2.2
 * - Token Refresh Best Practices: https://tools.ietf.org/html/draft-ietf-oauth-security-topics
 */

export interface TokenValidationResult {
  isValid: boolean;
  needsRefresh: boolean;
  expiresIn: number | null;
  timeUntilExpiry: number | null;
  reason?: string;
}

/**
 * Validates if a token is still valid and not expired
 * @param expiresAt - Token expiration timestamp (milliseconds)
 * @param bufferMs - Buffer time in milliseconds before expiry (default: 60 seconds)
 * @returns Token validation result
 */
export function validateTokenExpiration(
  expiresAt?: number,
  bufferMs: number = 60_000 // 1 minute buffer
): TokenValidationResult {
  // If no expiration time is provided, assume token is valid
  if (!expiresAt) {
    return {
      isValid: true,
      needsRefresh: false,
      expiresIn: null,
      timeUntilExpiry: null,
    };
  }

  const now = Date.now();
  const timeUntilExpiry = expiresAt - now;
  const needsRefresh = timeUntilExpiry <= bufferMs;
  const isValid = timeUntilExpiry > 0;

  return {
    isValid,
    needsRefresh,
    expiresIn: expiresAt,
    timeUntilExpiry: timeUntilExpiry > 0 ? timeUntilExpiry : 0,
    reason: !isValid
      ? "Token has expired"
      : needsRefresh
        ? "Token expires soon"
        : undefined,
  };
}

/**
 * Checks if a token needs refresh based on expiration time
 * @param expiresAt - Token expiration timestamp (milliseconds)
 * @param bufferMs - Buffer time in milliseconds before expiry (default: 60 seconds)
 * @returns True if token needs refresh
 */
export function needsTokenRefresh(
  expiresAt?: number,
  bufferMs: number = 60_000
): boolean {
  return validateTokenExpiration(expiresAt, bufferMs).needsRefresh;
}

/**
 * Gets time until token expires in a human-readable format
 * @param expiresAt - Token expiration timestamp (milliseconds)
 * @returns Human-readable time until expiry
 */
export function getTimeUntilExpiry(expiresAt?: number): string {
  if (!expiresAt) {
    return "No expiration set";
  }

  const now = Date.now();
  const timeUntilExpiry = expiresAt - now;

  if (timeUntilExpiry <= 0) {
    return "Expired";
  }

  const minutes = Math.floor(timeUntilExpiry / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  } else {
    return "Less than a minute";
  }
}

/**
 * Validates token data structure
 * @param tokenData - Token data object
 * @returns True if token data is valid
 */
export function validateTokenData(tokenData: any): boolean {
  if (!tokenData || typeof tokenData !== "object") {
    return false;
  }

  // Check required fields
  if (!tokenData.accessToken || typeof tokenData.accessToken !== "string") {
    return false;
  }

  // Check optional fields have correct types
  if (tokenData.refreshToken && typeof tokenData.refreshToken !== "string") {
    return false;
  }

  if (tokenData.expiresAt && typeof tokenData.expiresAt !== "number") {
    return false;
  }

  if (tokenData.tokenType && typeof tokenData.tokenType !== "string") {
    return false;
  }

  if (tokenData.scope && typeof tokenData.scope !== "string") {
    return false;
  }

  return true;
}

/**
 * Feature flag: Disable LLM filtering for testing
 * Reads NEXT_PUBLIC_DISABLE_LLM_FILTER from env and normalizes common truthy values
 */
export function isLlmFilterDisabled(): boolean {
  try {
    const raw = process.env.NEXT_PUBLIC_DISABLE_LLM_FILTER;
    if (!raw) return false;
    const value = String(raw).trim().toLowerCase();
    return (
      value === "1" || value === "true" || value === "yes" || value === "on"
    );
  } catch {
    return false;
  }
}
