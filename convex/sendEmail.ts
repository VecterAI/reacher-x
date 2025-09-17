import { action } from "./_generated/server";
import { sendWelcomeEmailArgsValidator } from "./validators";
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
      console.log(html);

      await resend.emails.send({
        from: "ReacherX <noreply@transactional.reacherx.com>",
        to: email,
        subject: "You're on the wait-list!",
        html: html,
      });
      console.log(`Email sent successfully to ${email}`);
    } catch (error) {
      console.error("Failed to send email:", error);
    }
  },
});
