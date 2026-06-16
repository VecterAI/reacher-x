"use node";

import { action } from "./lib/functionBuilders";
import { sendWelcomeEmailArgsValidator } from "./validators";
import { Resend } from "resend";
import { WaitlistConfirmationEmail } from "../emails/WaitlistConfirmationEmail";
import { render } from "@react-email/render";
import { getWideEventLogger } from "./lib/wideEventLogger";

export const sendWelcomeEmail = action({
  args: sendWelcomeEmailArgsValidator,
  handler: async (ctx, { email }) => {
    const logEvent = getWideEventLogger(ctx);
    const resend = new Resend(process.env.RESEND_API_KEY);
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set in environment variables");
    }

    try {
      const recipientDomain = email.split("@")[1] ?? "unknown";
      logEvent?.set({
        email_delivery: {
          provider: "resend",
          recipient_domain: recipientDomain,
          template: "WaitlistConfirmationEmail",
        },
      });

      const html = await render(WaitlistConfirmationEmail());

      await resend.emails.send({
        from: "ReacherX <noreply@transactional.reacherx.com>",
        to: email,
        subject: "You're on the wait-list!",
        html: html,
      });
    } catch (error) {
      logEvent?.error(error, {
        email_delivery: {
          provider: "resend",
          template: "WaitlistConfirmationEmail",
        },
      });
      throw error;
    }
  },
});
