"use client";

const DATABASE_NAME = "reacherx-xchat-device-credentials";
const DATABASE_VERSION = 1;
const DEVICE_KEYS_STORE = "deviceKeys";
const CREDENTIALS_STORE = "credentials";
const DEVICE_KEY_ID = "xchat-pin-aes-gcm-v1";

type StoredCredential = {
  id: string;
  viewerUserId: string;
  signingKeyVersion: string;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
};

type XChatCredentialTarget = {
  viewerUserId: string;
  signingKeyVersion: string;
};

function normalizeTarget(target: XChatCredentialTarget) {
  const viewerUserId = target.viewerUserId.trim();
  const signingKeyVersion = target.signingKeyVersion.trim();
  if (!viewerUserId || !signingKeyVersion) {
    throw new Error("XChat credential target is incomplete.");
  }
  return {
    viewerUserId,
    signingKeyVersion,
    id: `${viewerUserId}:${signingKeyVersion}`,
  };
}

function getAdditionalData(target: ReturnType<typeof normalizeTarget>) {
  return new TextEncoder().encode(
    `reacherx:xchat-pin:v1:${target.viewerUserId}:${target.signingKeyVersion}`
  );
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener("error", () => reject(request.error), {
      once: true,
    });
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("IndexedDB aborted.")),
      { once: true }
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("IndexedDB failed.")),
      { once: true }
    );
  });
}

async function openCredentialDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined" || !globalThis.crypto?.subtle) {
    return null;
  }
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.addEventListener("upgradeneeded", () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(DEVICE_KEYS_STORE)) {
      database.createObjectStore(DEVICE_KEYS_STORE);
    }
    if (!database.objectStoreNames.contains(CREDENTIALS_STORE)) {
      database.createObjectStore(CREDENTIALS_STORE, { keyPath: "id" });
    }
  });
  return await requestResult(request);
}

async function readDeviceKey(database: IDBDatabase): Promise<CryptoKey | null> {
  const transaction = database.transaction(DEVICE_KEYS_STORE, "readonly");
  const key = await requestResult<CryptoKey | undefined>(
    transaction.objectStore(DEVICE_KEYS_STORE).get(DEVICE_KEY_ID)
  );
  await transactionComplete(transaction);
  return key ?? null;
}

async function getOrCreateDeviceKey(database: IDBDatabase): Promise<CryptoKey> {
  const existing = await readDeviceKey(database);
  if (existing) return existing;

  const generated = await globalThis.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  const transaction = database.transaction(DEVICE_KEYS_STORE, "readwrite");
  transaction.objectStore(DEVICE_KEYS_STORE).put(generated, DEVICE_KEY_ID);
  await transactionComplete(transaction);
  return generated;
}

async function deleteStaleViewerCredentials(
  database: IDBDatabase,
  target: ReturnType<typeof normalizeTarget>
): Promise<void> {
  const transaction = database.transaction(CREDENTIALS_STORE, "readwrite");
  const store = transaction.objectStore(CREDENTIALS_STORE);
  const credentials = await requestResult<StoredCredential[]>(store.getAll());
  for (const credential of credentials) {
    if (
      credential.viewerUserId === target.viewerUserId &&
      credential.signingKeyVersion !== target.signingKeyVersion
    ) {
      store.delete(credential.id);
    }
  }
  await transactionComplete(transaction);
}

/**
 * Persists an explicitly remembered PIN encrypted by a non-extractable,
 * origin-scoped browser key. PIN bytes never leave this browser.
 */
export async function rememberXChatPinOnDevice(
  target: XChatCredentialTarget & { pin: string }
): Promise<boolean> {
  const normalized = normalizeTarget(target);
  const pin = target.pin.trim();
  if (!/^\d{4}$/u.test(pin)) return false;

  const database = await openCredentialDatabase();
  if (!database) return false;
  try {
    await deleteStaleViewerCredentials(database, normalized);
    const key = await getOrCreateDeviceKey(database);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const pinBytes = new TextEncoder().encode(pin);
    let ciphertext: ArrayBuffer;
    try {
      ciphertext = await globalThis.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: getAdditionalData(normalized),
        },
        key,
        pinBytes
      );
    } finally {
      pinBytes.fill(0);
    }

    const transaction = database.transaction(CREDENTIALS_STORE, "readwrite");
    transaction.objectStore(CREDENTIALS_STORE).put({
      ...normalized,
      iv: iv.buffer,
      ciphertext,
    } satisfies StoredCredential);
    await transactionComplete(transaction);
    return true;
  } catch {
    return false;
  } finally {
    database.close();
  }
}

export async function readRememberedXChatPin(
  target: XChatCredentialTarget
): Promise<string | null> {
  const normalized = normalizeTarget(target);
  const database = await openCredentialDatabase();
  if (!database) return null;
  try {
    await deleteStaleViewerCredentials(database, normalized);
    const key = await readDeviceKey(database);
    if (!key) return null;
    const transaction = database.transaction(CREDENTIALS_STORE, "readonly");
    const credential = await requestResult<StoredCredential | undefined>(
      transaction.objectStore(CREDENTIALS_STORE).get(normalized.id)
    );
    await transactionComplete(transaction);
    if (
      !credential ||
      credential.viewerUserId !== normalized.viewerUserId ||
      credential.signingKeyVersion !== normalized.signingKeyVersion
    ) {
      return null;
    }
    const plaintext = await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: credential.iv,
        additionalData: getAdditionalData(normalized),
      },
      key,
      credential.ciphertext
    );
    const pinBytes = new Uint8Array(plaintext);
    try {
      const pin = new TextDecoder().decode(pinBytes);
      return /^\d{4}$/u.test(pin) ? pin : null;
    } finally {
      pinBytes.fill(0);
    }
  } catch {
    return null;
  } finally {
    database.close();
  }
}

/** Checks for encrypted PIN records without reading or decrypting a PIN. */
export async function hasRememberedXChatPins(): Promise<boolean> {
  const database = await openCredentialDatabase();
  if (!database) return false;
  try {
    const transaction = database.transaction(CREDENTIALS_STORE, "readonly");
    const count = await requestResult(
      transaction.objectStore(CREDENTIALS_STORE).count()
    );
    await transactionComplete(transaction);
    return count > 0;
  } catch {
    return false;
  } finally {
    database.close();
  }
}

export async function forgetRememberedXChatPin(
  target: XChatCredentialTarget
): Promise<void> {
  const normalized = normalizeTarget(target);
  const database = await openCredentialDatabase();
  if (!database) return;
  try {
    const transaction = database.transaction(CREDENTIALS_STORE, "readwrite");
    transaction.objectStore(CREDENTIALS_STORE).delete(normalized.id);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

/** Clears both encrypted PIN records and their non-extractable device key. */
export async function forgetAllRememberedXChatPins(): Promise<void> {
  const database = await openCredentialDatabase();
  if (!database) return;
  try {
    const transaction = database.transaction(
      [DEVICE_KEYS_STORE, CREDENTIALS_STORE],
      "readwrite"
    );
    transaction.objectStore(DEVICE_KEYS_STORE).clear();
    transaction.objectStore(CREDENTIALS_STORE).clear();
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}
