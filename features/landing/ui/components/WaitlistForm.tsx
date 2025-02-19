"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";

import { Checkbox } from "@/shared/ui/components/Checkbox";
import { Button } from "@/shared/ui/components/Button";
import { Input } from "@/shared/ui/components/Input";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/Form";

// Updated Zod schema
const waitlistSchema = z.object({
  email: z
    .string()
    .email({ message: "Please enter a valid email address." })
    .nonempty({ message: "Email is required." })
    .transform((val) => val.toLowerCase()), // Ensure case-insensitive email handling
  twitter: z
    .string()
    .transform((val) => (val === "" ? undefined : val)) // Empty string becomes undefined
    .optional(),
  terms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms.",
  }),
});

type WaitlistFormValues = z.infer<typeof waitlistSchema>;

export function WaitlistForm() {
  const form = useForm<WaitlistFormValues>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      email: "",
      twitter: "",
      terms: false,
    },
  });

  const joinWaitlistMutation = useMutation(api.waitlist.joinWaitlist);

  const onSubmit = async (data: WaitlistFormValues) => {
    try {
      await joinWaitlistMutation({
        email: data.email,
        twitter: data.twitter,
      });
      console.log("Waitlist entry added or updated successfully!");
    } catch (error) {
      console.error("Error joining waitlist:", error);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        <fieldset>
          <legend className="sr-only">Contact Information</legend>
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="email">
                    Email <span className="text-muted-foreground">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder="e.g., reacherxfounder@example.com"
                      aria-required="true"
                      aria-invalid={!!form.formState.errors.email}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="twitter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="twitter">
                    X/Twitter username{" "}
                    <span className="text-muted-foreground">(Optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="twitter"
                      placeholder="e.g., ReacherXfounder"
                      aria-required="false"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend className="sr-only">Agreement</legend>
          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem>
                <div className="flex gap-2">
                  <Checkbox
                    className="mt-[2px]"
                    id="terms"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-required="true"
                    aria-invalid={!!form.formState.errors.terms}
                  />
                  <FormLabel htmlFor="terms" className="text-sm font-medium">
                    I agree to the terms and conditions and consent to receive
                    emails about product updates and promotions.
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>
        <Button
          type="submit"
          disabled={!form.watch("terms")}
          className="w-full"
        >
          Join wait-list
        </Button>
      </form>
    </Form>
  );
}
