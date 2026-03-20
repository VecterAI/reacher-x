"use node";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_VERSION = "v1";

function getEncryptionKey(): Buffer {
  const secret = process.env.X_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error(
      "X_TOKEN_ENCRYPTION_KEY is not set. Configure it before using X account storage."
    );
  }

  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptXSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptXSecret(value: string): string {
  const [version, ivBase64, authTagBase64, encryptedBase64] = value.split(":");
  if (
    version !== ENCRYPTION_VERSION ||
    !ivBase64 ||
    !authTagBase64 ||
    !encryptedBase64
  ) {
    throw new Error("Invalid encrypted X secret payload.");
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivBase64, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
