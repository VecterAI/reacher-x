"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Configuration
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * Derives a cryptographic key from a password using scrypt
 */
async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
}

/**
 * Encrypts a string using AES-256-GCM
 */
async function encrypt(text: string, password: string): Promise<string> {
  try {
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive key from password and salt
    const key = await deriveKey(password, salt);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(salt); // Use salt as additional authenticated data

    // Encrypt the text
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get the authentication tag
    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, "hex"),
    ]);

    return combined.toString("base64");
  } catch (error) {
    throw new Error(
      "Encryption failed: " +
        (error instanceof Error ? error.message : "Unknown error")
    );
  }
}

/**
 * Decrypts a string that was encrypted with encrypt()
 */
async function decrypt(
  encryptedData: string,
  password: string
): Promise<string> {
  try {
    // First, try to decrypt with the current format (base64(salt+iv+tag+cipher))
    try {
      const combined = Buffer.from(encryptedData, "base64");
      // Minimal length check to avoid throwing on obviously non-base64 payloads
      if (combined.length >= SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1) {
        const salt = combined.subarray(0, SALT_LENGTH);
        const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const tag = combined.subarray(
          SALT_LENGTH + IV_LENGTH,
          SALT_LENGTH + IV_LENGTH + TAG_LENGTH
        );
        const encrypted = combined.subarray(
          SALT_LENGTH + IV_LENGTH + TAG_LENGTH
        );

        const key = await deriveKey(password, salt);

        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAAD(salt);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted, undefined, "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
      }
      // Fall through to legacy attempt if buffer too small
    } catch {
      // Intentionally swallow to try legacy format next
    }

    // Legacy format fallback: "ivHex:authTagHex:cipherHex" using AES-256-GCM
    // with a 32-byte key derived by padding/truncating ENCRYPTION_PASSWORD directly
    const parts = encryptedData.split(":");
    if (parts.length === 3) {
      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const cipherHex = parts[2];

      if (iv.length === IV_LENGTH && authTag.length === TAG_LENGTH) {
        const keyBytes = Buffer.from(
          password.length >= KEY_LENGTH
            ? password.slice(0, KEY_LENGTH)
            : password.padEnd(KEY_LENGTH, "0"),
          "utf8"
        );

        const legacyDecipher = createDecipheriv(ALGORITHM, keyBytes, iv);
        legacyDecipher.setAuthTag(authTag);

        let legacyDecrypted = legacyDecipher.update(cipherHex, "hex", "utf8");
        legacyDecrypted += legacyDecipher.final("utf8");
        return legacyDecrypted;
      }
    }

    // If both strategies failed, throw a standard error
    throw new Error("Unsupported ciphertext format");
  } catch (error) {
    throw new Error(
      "Decryption failed: " +
        (error instanceof Error ? error.message : "Unknown error")
    );
  }
}

/**
 * Gets the encryption password from environment variables
 */
function getEncryptionPassword(): string {
  const password = process.env.ENCRYPTION_PASSWORD;
  if (!password) {
    throw new Error("ENCRYPTION_PASSWORD environment variable is not set");
  }
  if (password.length < 32) {
    throw new Error("ENCRYPTION_PASSWORD must be at least 32 characters long");
  }
  return password;
}

/**
 * Encrypts a token using the configured encryption password
 */
export const encryptToken = action({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const password = getEncryptionPassword();
    return encrypt(args.token, password);
  },
});

/**
 * Decrypts a token using the configured encryption password
 */
export const decryptToken = action({
  args: { encryptedToken: v.string() },
  handler: async (ctx, args) => {
    const password = getEncryptionPassword();
    return decrypt(args.encryptedToken, password);
  },
});
