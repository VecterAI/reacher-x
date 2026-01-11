"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { UseFormReturn } from "react-hook-form";

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

export type WaitlistFormValues = {
  email: string;
  twitter?: string | undefined;
  terms: boolean;
};

export function WaitlistForm({
  form,
  onSuccess,
  onError,
  className,
}: {
  form: UseFormReturn<WaitlistFormValues>;
  onSuccess: () => void;
  onError: (message: string) => void;
  className?: string;
}) {
  const joinWaitlistMutation = useMutation(api.waitlist.joinWaitlist);

  const onSubmit = async (data: WaitlistFormValues) => {
    try {
      await joinWaitlistMutation({
        email: data.email,
        twitter: data.twitter,
      });
      onSuccess();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unknown error occurred";
      onError(message);
    }
  };

  return (
    <div className={className}>
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
                    <FormLabel
                      htmlFor="terms"
                      className="text-primary text-sm font-medium"
                    >
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
    </div>
  );
}
