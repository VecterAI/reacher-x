"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/ui/components/Button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerClose,
  DrawerTitle,
} from "@/shared/ui/components/Drawer";
import { WaitlistForm } from "@/features/landing/ui/components/WaitlistForm";
import { AvatarStack } from "./AvatarStack";
import { useWaitlistUsers } from "@/features/landing/hooks/useWaitlistUsers";
import Link from "next/link";
import { NavLink } from "./NavLink";
import { AvatarStackSkeleton } from "./AvatarStackSkeleton";
import { waitlistSchema, WaitlistFormValues } from "@/lib/waitlistSchema";
import { useToast } from "@/shared/ui/hooks/useToast";

export function WaitlistDrawer() {
  const { profiles, loading, totalCount, isCountLoading } = useWaitlistUsers();
  const [isOpen, setIsOpen] = React.useState(false);
  const [joined, setJoined] = React.useState(false);
  const waitlistUsersCount = totalCount + 39;

  const { toast } = useToast();

  const form = useForm<WaitlistFormValues>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      email: "",
      twitter: "",
      terms: true,
    },
  });

  const onError = (message: string) => {
    toast({
      title: "☒ Error!",
      description: message,
      variant: "destructive",
    });
  };

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
                  <DrawerTitle className="text-3xl font-medium">
                    You’re on the wait-list!
                  </DrawerTitle>
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
                    <DrawerTitle className="text-3xl font-medium">
                      Join over{" "}
                      {isCountLoading ? (
                        <span className="inline-block animate-spin text-muted-foreground">
                          ⟳
                        </span>
                      ) : (
                        waitlistUsersCount
                      )}{" "}
                      people already on the wait-list!
                    </DrawerTitle>

                    <div className="mt-4">
                      {loading ? (
                        <AvatarStackSkeleton />
                      ) : (
                        <AvatarStack users={profiles} totalCount={totalCount} />
                      )}
                    </div>
                  </section>
                  <WaitlistForm
                    form={form}
                    onSuccess={() => setJoined(true)}
                    onError={onError}
                  />
                </div>
              )}
            </main>
          </aside>
        </DrawerContent>
      </Drawer>
    </>
  );
}
