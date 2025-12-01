/**
 * UTF-8 safe Base64URL utilities
 *
 * Uses TextEncoder/TextDecoder to correctly handle Unicode (e.g., emojis),
 * then encodes to URL-safe Base64 (RFC 4648 §5) without padding.
 */

/**
 * Encode a string as Base64URL using UTF-8 bytes. No padding.
 */
export function base64UrlEncodeUtf8(input: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decode a Base64URL (no padding) string to a UTF-8 string.
 */
export function base64UrlDecodeUtf8(input: string): string {
  // Convert base64url to base64
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  // Pad to length multiple of 4
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

