import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import {
  readDemoUpload,
  isDemoUploadMimeType,
} from "../../../runtime/uploadHelpers";

// Local experiment storage only. Never mounted by the production Next app.
const uploads = new Map<
  string,
  { blob: Blob; expiresAt: number; sessionId: string }
>();
const MAX_BYTES = 15 * 1024 * 1024;
const RETENTION_MS = 10 * 60 * 1000;
const SESSION_COOKIE = "reacherx_demo_upload_session";
const MAX_SESSION_UPLOADS = 20;
const MAX_TOTAL_UPLOADS = 200;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const declaredSize = request.headers.get("content-length");
  if (declaredSize !== null) {
    const size = Number(declaredSize);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES)
      return new Response("Invalid upload size", { status: 413 });
  }
  const blob = await readDemoUpload(request, MAX_BYTES);
  if (!blob) return new Response("Invalid upload size", { status: 413 });
  if (!blob.size || blob.size > MAX_BYTES || !isDemoUploadMimeType(blob.type)) {
    return new Response("Unsupported demo attachment", { status: 400 });
  }
  const now = getCurrentUTCTimestamp();
  for (const [key, entry] of uploads) {
    if (entry.expiresAt <= now) uploads.delete(key);
  }
  const entries = [...uploads.values()];
  const requestedSession = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionId =
    requestedSession &&
    entries.some((entry) => entry.sessionId === requestedSession)
      ? requestedSession
      : randomUUID();
  if (
    entries.filter((entry) => entry.sessionId === sessionId).length >=
    MAX_SESSION_UPLOADS
  )
    return new Response("Demo session storage full", { status: 429 });
  if (
    uploads.size >= MAX_TOTAL_UPLOADS ||
    entries.reduce((bytes, entry) => bytes + entry.blob.size, blob.size) >
      MAX_TOTAL_BYTES
  )
    return new Response("Demo storage temporarily full", { status: 503 });
  const storageId = randomUUID();
  const entry = { blob, expiresAt: now + RETENTION_MS, sessionId };
  uploads.set(storageId, entry);
  setTimeout(() => {
    if (uploads.get(storageId) === entry) uploads.delete(storageId);
  }, RETENTION_MS).unref();
  const response = NextResponse.json({ storageId });
  const secure = request.nextUrl.protocol === "https:";
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    partitioned: secure,
    path: "/api/upload",
    maxAge: RETENTION_MS / 1000,
  });
  return response;
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const entry = uploads.get(id);
  if (!entry || entry.expiresAt <= getCurrentUTCTimestamp()) {
    uploads.delete(id);
    return new Response("Upload expired", { status: 404 });
  }
  return new Response(entry.blob, {
    headers: {
      "Content-Type": entry.blob.type,
      "Content-Length": String(entry.blob.size),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
