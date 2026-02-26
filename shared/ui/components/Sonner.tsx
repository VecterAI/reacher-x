"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import {
  CheckCircleIcon,
  ErrorIcon,
  InfoIcon,
} from "@/shared/ui/components/icons";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CheckCircleIcon className="mt-0.5 shrink-0 self-start fill-current" />
        ),
        error: (
          <ErrorIcon className="mt-0.5 shrink-0 self-start fill-current" />
        ),
        info: <InfoIcon className="mt-0.5 shrink-0 self-start fill-current" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !items-start group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg [&>svg]:!mt-0.5 [&>svg]:!self-start [&>svg]:!shrink-0 [&_[data-icon]]:!mt-0.5 [&_[data-icon]]:!self-start [&_[data-icon]]:!shrink-0",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
