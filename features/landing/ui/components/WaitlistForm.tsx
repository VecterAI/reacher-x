"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Checkbox } from "@/shared/ui/components/Checkbox";
import { Button } from "@/shared/ui/components/Button";
import { Input } from "@/shared/ui/components/Input";

// Import the shadcn/ui form primitives
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/Form";

// 1. Define the Zod schema
const subscriptionSchema = z.object({
  email: z
    .string()
    .email({ message: "Please enter a valid email address." })
    .nonempty({ message: "Email is required." }),
  twitter: z.string().optional(),
  terms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms.",
  }),
});

// 2. Infer the TypeScript type from the schema
type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;

export function SubscriptionForm() {
  // 3. Initialize react-hook-form
  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      email: "",
      twitter: "",
      terms: false,
    },
  });

  // 4. Submit handler
  const onSubmit = (data: SubscriptionFormValues) => {
    // Replace this with your fetch() call or server action
    // that saves to Supabase or calls your Next.js API route.
    console.log("Form Submitted:", data);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-md space-y-6"
      >
        {/* Email Field */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormDescription>
                We will send updates and promotions to this address.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Twitter Username Field (Optional) */}
        <FormField
          control={form.control}
          name="twitter"
          render={({ field }) => (
            <FormItem>
              <FormLabel>X/Twitter username</FormLabel>
              <FormControl>
                <Input placeholder="@yourhandle" {...field} />
              </FormControl>
              <FormDescription>
                Optional. We might reach out via DM for early previews.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Terms Checkbox */}
        <FormField
          control={form.control}
          name="terms"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <Checkbox
                  // The Radix <Checkbox> is either `true`, `false`, or "indeterminate".
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="terms"
                />
                <FormLabel htmlFor="terms" className="text-sm font-normal">
                  I agree to the terms and conditions and consent to receive
                  emails about product updates and promotions.
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button - disabled if checkbox not checked */}
        <Button
          type="submit"
          disabled={!form.watch("terms")} // watch the "terms" field
          className="w-full"
        >
          Sign Up
        </Button>
      </form>
    </Form>
  );
}
