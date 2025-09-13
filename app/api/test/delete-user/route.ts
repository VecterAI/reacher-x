import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { workosUserId } = await request.json();

    if (!workosUserId) {
      return NextResponse.json(
        { success: false, error: "workosUserId is required" },
        { status: 400 }
      );
    }

    // Delete user by WorkOS ID
    const result = await convex.mutation(api.events.deleteUserByWorkosId, {
      workosUserId,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
