"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { WaitlistForm, WaitlistFormValues } from "./WaitlistForm";
import { waitlistSchema } from "@/features/waitlist/lib/waitlistSchema";
import { toast } from "sonner";

export function WaitlistFormWrapper({ className }: { className?: string }) {
  const form = useForm<WaitlistFormValues>({
    resolver: zodResolver(
      waitlistSchema
    ) as unknown as Resolver<WaitlistFormValues>,
    defaultValues: {
      email: "",
      twitter: "",
      terms: true, // Checkbox checked by default
    },
  });

  const onSuccess = () => {
    toast.success("Joined!", {
      description: "You are on the wait-list!",
    });
    form.reset({
      email: "",
      twitter: "",
      terms: true, // Reset keeps terms checked
    });
  };

  const onError = (message: string) => {
    toast.error("Error!", {
      description: message,
    });
    // Form state is preserved automatically since we don’t reset on error
  };

  return (
    <WaitlistForm
      form={form}
      onSuccess={onSuccess}
      onError={onError}
      className={className}
    />
  );
}
