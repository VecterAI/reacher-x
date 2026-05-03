import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const RETURN_TO_COOKIE = "x_oauth_return_to";
const DEFAULT_RETURN_TO = "/settings/connected-accounts";

function decodeReturnTo(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveSafeReturnTo(request: NextRequest, returnTo?: string): URL {
  const defaultTarget = new URL(DEFAULT_RETURN_TO, request.nextUrl.origin);
  if (!returnTo) {
    return defaultTarget;
  }

  const decodedReturnTo = decodeReturnTo(returnTo);

  try {
    const candidate = new URL(decodedReturnTo, request.nextUrl.origin);
    if (candidate.origin !== request.nextUrl.origin) {
      return defaultTarget;
    }
    return candidate;
  } catch {
    return defaultTarget;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const cookieStore = await cookies();
  const returnTo = cookieStore.get(RETURN_TO_COOKIE)?.value;

  const target = resolveSafeReturnTo(request, returnTo);
  if (code) target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  if (error) target.searchParams.set("error", error);
  if (errorDescription) {
    target.searchParams.set("error_description", errorDescription);
  }

  const response = NextResponse.redirect(target);
  response.cookies.delete(RETURN_TO_COOKIE);
  return response;
}
