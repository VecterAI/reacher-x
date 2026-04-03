// features/webapp/ui/components/tweet/TweetHeader.tsx
"use client";

import { useRef } from "react";
import { useProfile } from "@/features/profile/contexts/TwitterProfileContext";
import { cn } from "@/shared/lib/utils";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import { User } from "@/features/threads/types";

interface TweetHeaderProps {
  children?: React.ReactNode;
  staticUser?: User;
  readOnly?: boolean;
}

export function TweetHeader({
  children,
  staticUser,
  readOnly = false,
}: TweetHeaderProps) {
  const { openProfile, prefetchProfile } = useProfile();
  const nameClass = cn("text-sm");

  const newReleasesIconClass = cn("size-3");

  const screenNameClass = cn("text-sm");

  // Debounced hover prefetch — purpose: warms cache so clicking is instant.
  const hoverTimerRef = useRef<number | null>(null);
  const schedulePrefetch = (username?: string | null) => {
    if (!username) return;
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoverTimerRef.current = window.setTimeout(() => {
      prefetchProfile(username).catch(() => {});
      hoverTimerRef.current = null;
    }, 150);
  };
  const cancelPrefetch = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const user = staticUser;

  return (
    <>
      {user && (
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
          <address className="flex min-w-0 shrink items-center gap-0.5 overflow-hidden not-italic">
            {user.name &&
              (readOnly ? (
                <span
                  className={cn(
                    nameClass,
                    "mr-0 block max-w-24 min-w-0 truncate font-medium md:max-w-56"
                  )}
                  title={user.name}
                >
                  {user.name}
                </span>
              ) : (
                <button
                  className={cn(
                    nameClass,
                    "ease-[cubic-bezier(0.25, 1, 0.5, 1)] mr-0 block max-w-24 min-w-0 truncate font-medium duration-300 hover:underline md:max-w-56"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (user.screen_name)
                      openProfile({
                        username: user.screen_name,
                        seedProfile: user,
                      });
                  }}
                  onMouseEnter={() => schedulePrefetch(user.screen_name)}
                  onMouseLeave={cancelPrefetch}
                  onFocus={() => schedulePrefetch(user.screen_name)}
                  aria-label={`View ${user.name}'s profile`}
                  title={user.name}
                >
                  {user.name}
                </button>
              ))}
            {user.verified && (
              <NewReleasesIcon
                className={cn(
                  newReleasesIconClass,
                  "ease-[cubic-bezier(0.25, 1, 0.5, 1)] mr-0.5 shrink-0 fill-current duration-300"
                )}
                aria-hidden="true"
                data-testid="verified-badge"
              />
            )}
            {user.screen_name &&
              (readOnly ? (
                <span
                  className={cn(
                    screenNameClass,
                    "text-muted-foreground block max-w-16 min-w-0 shrink grow-0 truncate font-mono font-medium"
                  )}
                  title={`@${user.screen_name}`}
                >
                  @{user.screen_name}
                </span>
              ) : (
                <button
                  className={cn(
                    screenNameClass,
                    "ease-[cubic-bezier(0.25, 1, 0.5, 1)] md:max-w-auto text-muted-foreground block max-w-16 min-w-0 shrink grow-0 truncate font-mono font-medium duration-300 hover:underline"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    openProfile({
                      username: user.screen_name!,
                      seedProfile: user,
                    });
                  }}
                  onMouseEnter={() => schedulePrefetch(user.screen_name)}
                  onMouseLeave={cancelPrefetch}
                  onFocus={() => schedulePrefetch(user.screen_name)}
                  aria-label={`View @${user.screen_name}'s profile`}
                  title={`@${user.screen_name}`}
                >
                  @{user.screen_name}
                </button>
              ))}
          </address>
          {children ? <div className="shrink-0">{children}</div> : null}
        </div>
      )}
    </>
  );
}
