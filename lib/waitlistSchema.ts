import { z } from "zod";

export const waitlistSchema = z.object({
  email: z
    .string()
    .email({ message: "Please enter a valid email address." })
    .nonempty({ message: "Email is required." })
    .transform((val) => val.toLowerCase()),
  twitter: z
    .string()
    .trim()
    .refine((val) => val === "" || /^[a-zA-Z0-9_]{1,15}$/.test(val), {
      message:
        "Invalid Twitter handle. It should be 1-15 characters long and contain only letters, numbers, and underscores.",
    })
    .transform((val) => (val === "" ? undefined : val))
    .optional(),
  terms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms.",
  }),
});

export type WaitlistFormValues = z.infer<typeof waitlistSchema>;
