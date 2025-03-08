"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/shared/ui/components/Button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerClose,
} from "@/shared/ui/components/Drawer";
import { WaitlistForm } from "@/features/landing/ui/components/WaitlistForm";
import { AvatarStack } from "./AvatarStack";
import { useWaitlistUsers } from "@/features/landing/hooks/useWaitlistUsers";
import Link from "next/link";
import { NavLink } from "./NavLink";

const waitlistSchema = z.object({
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

type WaitlistFormValues = z.infer<typeof waitlistSchema>;

export function WaitlistDrawer() {
  const { profiles, loading } = useWaitlistUsers();
  const [isOpen, setIsOpen] = React.useState(false);
  const [joined, setJoined] = React.useState(false);

  // Initialize the form in the parent component
  const form = useForm<WaitlistFormValues>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      email: "",
      twitter: "",
      terms: false,
    },
  });

  if (loading) {
    return <div>Loading waitlist users...</div>;
  }

  return (
    <>
      <Button className="mt-4" onClick={() => setIsOpen(true)}>
        Join wait-list
      </Button>

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent>
          <aside aria-label="Waitlist Registration Form">
            <header>
              <DrawerHeader className="flex items-center justify-end p-4">
                <DrawerClose asChild>
                  <Button variant="ghost" aria-label="Close waitlist form">
                    Close
                  </Button>
                </DrawerClose>
              </DrawerHeader>
            </header>

            <main className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 pb-4 duration-300 md:px-28 md:pb-12">
              {joined ? (
                <div>
                  <h2 className="text-3xl font-medium">
                    You’re on the wait-list!
                  </h2>
                  <Link
                    href="https://discord.gg/76dF9NPH"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-xl text-muted-foreground hover:underline"
                  >
                    Join Discord ↗
                  </Link>
                  <NavLink
                    href="/threads"
                    size="lg"
                    className="mb-4 mt-4 block font-normal text-muted-foreground md:mb-0"
                    activeClassName="underline font-medium text-primary"
                  >
                    Threads ↗
                  </NavLink>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-12">
                  <section>
                    <h2 className="text-3xl font-medium">
                      Join over {profiles.length} people already on the
                      wait-list!
                    </h2>
                    <div className="mt-4">
                      <AvatarStack users={profiles} />
                    </div>
                  </section>
                  <WaitlistForm form={form} onSuccess={() => setJoined(true)} />
                </div>
              )}
            </main>
          </aside>
        </DrawerContent>
      </Drawer>
    </>
  );
}
