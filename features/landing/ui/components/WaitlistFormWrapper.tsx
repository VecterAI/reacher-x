"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { WaitlistForm, WaitlistFormValues } from "./WaitlistForm";
import { waitlistSchema } from "@/lib/waitlistSchema";
import { useToast } from "@/shared/ui/hooks/useToast";

export function WaitlistFormWrapper({ className }: { className?: string }) {
  const { toast } = useToast();

  const form = useForm<WaitlistFormValues>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      email: "",
      twitter: "",
      terms: true, // Checkbox checked by default
    },
  });

  const onSuccess = () => {
    toast({
      title: "☑︎ Joined!",
      description: "You are on the wait-list!",
    });
    form.reset({
      email: "",
      twitter: "",
      terms: true, // Reset keeps terms checked
    });
  };

  const onError = (message: string) => {
    toast({
      title: "☒ Error!",
      description: message,
      variant: "destructive",
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
