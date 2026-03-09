"use node";

import { action } from "./lib/functionBuilders";
import { sendWelcomeEmailArgsValidator } from "./validators";
import { logger } from "../shared/lib/logger";
import { Resend } from "resend";
import { WaitlistConfirmationEmail } from "../emails/WaitlistConfirmationEmail";
import { render } from "@react-email/render";

export const sendWelcomeEmail = action({
  args: sendWelcomeEmailArgsValidator,
  handler: async (ctx, { email }) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set in environment variables");
    }

    try {
      const html = await render(WaitlistConfirmationEmail());
      logger.info("[EMAIL] Rendered WaitlistConfirmationEmail HTML");

      await resend.emails.send({
        from: "ReacherX <noreply@transactional.reacherx.com>",
        to: email,
        subject: "You're on the wait-list!",
        html: html,
      });
      logger.info(`[EMAIL] Email sent successfully to ${email}`);
    } catch (error) {
      logger.error("Failed to send email:", error);
    }
  },
});
