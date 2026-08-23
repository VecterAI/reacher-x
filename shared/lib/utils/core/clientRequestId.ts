export function createClientRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("This browser cannot safely identify this request.");
  }
  return globalThis.crypto.randomUUID();
}
