"use client";

import * as React from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/ui/components/Button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerClose,
  DrawerTitle,
} from "@/shared/ui/components/Drawer";
import { WaitlistForm } from "@/features/waitlist/ui/components/WaitlistForm";
import { AvatarStack } from "@/shared/ui/components/AvatarStack";
import { useWaitlistUsers } from "@/features/waitlist/hooks/useWaitlistUsers";
import Link from "next/link";
import { NavLink } from "../../../landing/ui/components/NavLink";
import { AvatarStackSkeleton } from "../../../landing/ui/components/AvatarStackSkeleton";
import {
  waitlistSchema,
  WaitlistFormValues,
} from "@/features/waitlist/lib/waitlistSchema";

import { toast } from "sonner";

export function WaitlistDrawer() {
  const { profiles, loading, totalCount, isCountLoading } = useWaitlistUsers();
  const [isOpen, setIsOpen] = React.useState(false);
  const [joined, setJoined] = React.useState(false);
  const waitlistUsersCount = totalCount + 39;

  const form = useForm<WaitlistFormValues>({
    resolver: zodResolver(
      waitlistSchema
    ) as unknown as Resolver<WaitlistFormValues>,
    defaultValues: {
      email: "",
      twitter: "",
      terms: true,
    },
  });

  const onError = (message: string) => {
    toast.error("Error!", {
      description: message,
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
                    You&apos;re on the wait-list!
                  </DrawerTitle>
                  <Link
                    href="https://discord.gg/76dF9NPH"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground mt-4 inline-block text-xl hover:underline"
                  >
                    Join Discord ↗
                  </Link>
                  <NavLink
                    href="/home/threads"
                    size="lg"
                    className="text-muted-foreground mt-4 mb-4 block font-normal md:mb-0"
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
                        <span className="text-muted-foreground inline-block animate-spin">
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
                        <AvatarStack
                          participants={profiles.map((user) => ({
                            name: user.name,
                            avatarUrl: user.profile_image_url_https,
                          }))}
                          maxVisible={4}
                          size="md"
                        />
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
