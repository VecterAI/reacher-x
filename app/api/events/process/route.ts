import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { WorkOS } from "@workos-inc/node";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const workos = new WorkOS(process.env.WORKOS_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("workos-signature");

    if (!signature) {
      console.error("Missing WorkOS signature");
      return NextResponse.json(
        { success: false, error: "Missing signature" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    try {
      const webhook = await workos.webhooks.constructEvent({
        payload: body,
        sigHeader: signature,
        secret: process.env.WORKOS_WEBHOOK_SECRET!,
      });

      console.log(`Processing WorkOS webhook event: ${webhook.event}`);

      // Process the webhook event
      const result = await convex.mutation(api.events.processWebhookEvent, {
        event: {
          id: webhook.id,
          type: webhook.event,
          data: webhook.data,
          created_at: webhook.createdAt,
        },
      });

      return NextResponse.json(result);
    } catch (verificationError) {
      console.error(
        "Webhook signature verification failed:",
        verificationError
      );
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Failed to process webhook:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get event processing status
    const status = await convex.query(api.events.getEventProcessingStatus, {});

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error("Failed to get event status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
