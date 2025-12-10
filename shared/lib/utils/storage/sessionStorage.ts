/**
 * Secure session storage for OAuth tokens
 *
 * Provides temporary storage for sensitive OAuth data during the authentication flow.
 * Uses encrypted cookies for persistence across serverless environments.
 *
 * Security considerations:
 * - Tokens are stored securely with encryption
 * - Automatic cleanup after use or timeout
 * - Session IDs are cryptographically secure
 * - No sensitive data in URLs or logs
 * - Works reliably in serverless environments
 *
 * References:
 * - OAuth 2.0 Security Best Practices: https://tools.ietf.org/html/draft-ietf-oauth-security-topics
 * - Session Management Security: https://owasp.org/www-project-cheat-sheets/cheatsheets/Session_Management_Cheat_Sheet.html
 */

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { cookies } from "next/headers";
import { logger } from "../../logger";

interface SessionData {
  sessionId: string; // Session ID for validation
  data: Record<string, unknown>;
  expiresAt: number;
  createdAt: number;
}

// Session configuration
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const SESSION_COOKIE_NAME = "oauth_session";

// Encryption configuration
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_PASSWORD ||
  "default-key-for-development-only-32-chars";
const ALGORITHM = "aes-256-gcm";

// Ensure the key is the right length for AES-256
const getEncryptionKey = () => {
  const key = ENCRYPTION_KEY;
  if (key.length >= 32) {
    return key.substring(0, 32);
  }
  return key.padEnd(32, "0");
};

/**
 * Encrypts data using AES-256-GCM
 */
function encrypt(data: string): string {
  const iv = randomBytes(16);
  const key = Buffer.from(getEncryptionKey(), "utf8");
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

/**
 * Decrypts data using AES-256-GCM
 */
function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  const key = Buffer.from(getEncryptionKey(), "utf8");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generates a cryptographically secure session ID
 * @returns A secure session ID
 */
function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Stores data in a secure session using encrypted cookies
 * @param data - The data to store
 * @param ttl - Time to live in milliseconds (default: 10 minutes)
 * @returns The session ID
 */
export async function createSession(
  data: Record<string, unknown>,
  ttl: number = SESSION_TIMEOUT
): Promise<string> {
  const sessionId = generateSessionId();
  const now = Date.now();

  // Create session data with sessionId for validation
  const sessionData: SessionData = {
    sessionId, // Store sessionId for later validation
    data,
    expiresAt: now + ttl,
    createdAt: now,
  };

  // Encrypt the entire session data
  const encryptedData = encrypt(JSON.stringify(sessionData));

  // Store in cookie
  const cookieStore = await cookies();
  const isDevelopment = process.env.NODE_ENV === "development";

  cookieStore.set(SESSION_COOKIE_NAME, encryptedData, {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ttl / 1000), // Convert to seconds
  });

  return sessionId;
}

/**
 * Retrieves data from a session using encrypted cookies
 * @param sessionId - The session ID to validate (required for security)
 * @returns The stored data or null if not found/expired/invalid
 */
export async function getSession(
  sessionId: string
): Promise<Record<string, unknown> | null> {
  try {
    const cookieStore = await cookies();
    const encryptedData = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!encryptedData) {
      return null;
    }

    // Decrypt the session data
    const decryptedData = decrypt(encryptedData);
    const sessionData: SessionData = JSON.parse(decryptedData);

    // Validate sessionId matches - prevents unauthorized access
    if (sessionData.sessionId !== sessionId) {
      logger.warn("Session ID mismatch - possible unauthorized access attempt");
      return null;
    }

    // Check if session has expired
    if (Date.now() > sessionData.expiresAt) {
      // Clear the expired session
      await deleteSession();
      return null;
    }

    return sessionData.data;
  } catch (error) {
    logger.error("Failed to decrypt session data:", error);
    // Clear the corrupted session
    await deleteSession();
    return null;
  }
}

/**
 * Deletes a session by clearing the cookie
 * @param sessionId - The session ID to delete (for compatibility)
 */
export async function deleteSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (error) {
    logger.error("Failed to delete session:", error);
  }
}

/**
 * Gets session statistics for monitoring (cookie-based approach)
 * @returns Session statistics
 */
export async function getSessionStats(): Promise<{
  hasActiveSession: boolean;
  sessionExpiresAt: number | null;
}> {
  try {
    const cookieStore = await cookies();
    const encryptedData = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!encryptedData) {
      return {
        hasActiveSession: false,
        sessionExpiresAt: null,
      };
    }

    const decryptedData = decrypt(encryptedData);
    const sessionData: SessionData = JSON.parse(decryptedData);

    return {
      hasActiveSession: Date.now() <= sessionData.expiresAt,
      sessionExpiresAt: sessionData.expiresAt,
    };
  } catch (error) {
    logger.error("Failed to get session stats:", error);
    return {
      hasActiveSession: false,
      sessionExpiresAt: null,
    };
  }
}

