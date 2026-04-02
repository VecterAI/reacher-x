"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/components/Button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { ProspectPlatformAvatar } from "@/shared/ui/components/ProspectPlatformAvatar";
import { MessageBubble } from "@/shared/ui/components/MessageBubble";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils";
import { useProspectDmPanel } from "@/features/prospects/hooks/useProspectDmPanel";
import { OpenInNewIcon } from "@/shared/ui/components/icons";

export interface InlineDmPreviewCardProps {
  prospectId: string;
  actionRequestId: string;
  onOpenPanel: () => void;
  className?: string;
}

export function InlineDmPreviewCard({
  prospectId,
  actionRequestId,
  onOpenPanel,
  className,
}: InlineDmPreviewCardProps) {
  const { data, loading, error, send, cancel } = useProspectDmPanel({
    prospectId,
    actionRequestId,
    enabled: Boolean(prospectId && actionRequestId),
  });

  async function handleSend() {
    if (!data?.draftText?.trim()) {
      return;
    }
    try {
      await send(
        data.draftText ?? "",
        data.draftAttachments
          ?.map((attachment) => attachment.url)
          .filter((url): url is string => typeof url === "string"),
        data.draftAttachments?.map((attachment) => attachment.altText ?? "")
      );
      toast.success("DM sent on X");
    } catch (err) {
      toast.error("Failed to send DM", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  async function handleCancel() {
    await cancel();
    toast.success("Draft cancelled");
  }

  if (loading) {
    return (
      <div className={cn("space-y-3 rounded-[24px] border p-3", className)}>
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-[20px]" />
        <Skeleton className="h-32 w-full rounded-[20px]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={cn("rounded-[24px] border p-3 text-sm", className)}>
        <p className="font-medium">Could not load DM draft</p>
        <p className="text-muted-foreground mt-1">
          {error ?? "Please try again."}
        </p>
      </div>
    );
  }

  const previewMessages = data.messages.slice(-2);

  return (
    <div className={cn("space-y-3 rounded-[24px] border p-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProspectPlatformAvatar platform="twitter" badgeSize="md">
            <Avatar className="size-10">
              <AvatarImage
                src={data.prospect.avatarUrl}
                alt={data.prospect.displayName}
              />
              <AvatarFallback>
                {data.prospect.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </ProspectPlatformAvatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {data.prospect.displayName}
            </div>
            {data.prospect.title ? (
              <div className="text-muted-foreground truncate text-sm">
                {data.prospect.title}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {previewMessages.length > 0 ? (
        <div className="space-y-2">
          {previewMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.direction === "sent" ? "justify-end" : "justify-start"
              )}
            >
              <MessageBubble
                variant={message.direction}
                className="max-w-[90%]"
              >
                {message.text}
              </MessageBubble>
            </div>
          ))}
        </div>
      ) : null}

      {data.warning ? (
        <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          <p className="font-medium">Limited live sync</p>
          <p className="text-muted-foreground mt-1">{data.warning.message}</p>
        </div>
      ) : null}

      <div className="rounded-[20px] border p-3">
        {data.draftAttachments?.length ? (
          <div className="mb-3 grid gap-2">
            {data.draftAttachments.map((attachment, index) => (
              <div
                key={`${attachment.url ?? "draft-media"}-${index}`}
                className="bg-muted/30 overflow-hidden rounded-2xl border"
              >
                {attachment.previewUrl || attachment.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachment.previewUrl ?? attachment.url}
                    alt={attachment.altText ?? "Draft DM attachment"}
                    className="h-auto w-full object-cover"
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        <div className="text-muted-foreground line-clamp-4 min-h-24 text-[15px] leading-6">
          {data.draftText || "No draft content"}
        </div>
        <div className="text-muted-foreground mt-3 flex items-center gap-3 text-sm opacity-60">
          <span>[img disabled]</span>
          <span>[video disabled]</span>
          <span>[emoji disabled]</span>
          <span className="ml-auto">{(data.draftText ?? "").length}/10000</span>
        </div>
      </div>

      {!data.eligibility.enabled ? (
        <div className="rounded-[20px] border px-3 py-2 text-sm">
          <p className="font-medium">DM unavailable</p>
          <p className="text-muted-foreground mt-1">
            {data.eligibility.reasonLabel}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 rounded-[20px] border px-3 py-2">
        <Button variant="ghost" size="xs" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          size="xs"
          onClick={handleSend}
          disabled={!data.eligibility.enabled}
        >
          Send
        </Button>
        <Button variant="outline" size="xsIcon" onClick={onOpenPanel}>
          <OpenInNewIcon className="fill-current" />
        </Button>
      </div>
    </div>
  );
}
