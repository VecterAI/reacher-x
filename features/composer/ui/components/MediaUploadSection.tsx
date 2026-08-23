"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { Textarea } from "@/shared/ui/components/TextArea";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import CharacterCounter from "@/shared/ui/components/CharacterCounter";
import Image from "next/image";
import { Spinner } from "@/shared/ui/components/Spinner";
import AnimatedPercent from "@/shared/ui/components/AnimatedPercent";
import { MediaUpload } from "../../types";
import {
  AddIcon,
  AutorenewIcon,
  CloseIcon,
  DescriptionIcon,
  EditIcon,
  PictureAsPdfIcon,
} from "@/shared/ui/components/icons";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/shared/ui/components/Attachment";

interface MediaUploadSectionProps {
  uploads: MediaUpload[];
  onRemove?: (id: string) => void;
  onAddDescription?: (id: string, description: string) => void;
  /** When false, hide alt/description controls (e.g. DM composers). Default true. */
  showDescription?: boolean;
  className?: string;
}

export function MediaUploadSection({
  uploads,
  onRemove,
  onAddDescription,
  showDescription = true,
  className,
}: MediaUploadSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [aspectById, setAspectById] = useState<Record<string, string>>({});

  const MAX_DESCRIPTION = 1000;

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const measuredAspectIdsRef = useRef<Set<string> | null>(null);
  const pendingAspectIdsRef = useRef<Set<string> | null>(null);
  if (!measuredAspectIdsRef.current) {
    measuredAspectIdsRef.current = new Set<string>();
  }
  if (!pendingAspectIdsRef.current) {
    pendingAspectIdsRef.current = new Set<string>();
  }

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    autoResize();
  }, [draft, editingId]);

  const formatIntrinsicAspect = useCallback((width: number, height: number) => {
    return width > 0 && height > 0 ? `${width} / ${height}` : "16 / 9";
  }, []);

  // Precompute aspect ratios even before upload.url is available
  useEffect(() => {
    const measuredAspectIds = measuredAspectIdsRef.current!;
    const pendingAspectIds = pendingAspectIdsRef.current!;
    const activeUploadIds = new Set(uploads.map((upload) => upload.id));
    const cleanupFns: Array<() => void> = [];

    for (const trackedId of measuredAspectIds) {
      if (!activeUploadIds.has(trackedId)) {
        measuredAspectIds.delete(trackedId);
      }
    }

    for (const trackedId of pendingAspectIds) {
      if (!activeUploadIds.has(trackedId)) {
        pendingAspectIds.delete(trackedId);
      }
    }

    uploads.forEach((upload) => {
      if (measuredAspectIds.has(upload.id) || pendingAspectIds.has(upload.id)) {
        return;
      }

      const file = upload.file;
      if (!file) return;
      if (upload.type === "file") {
        measuredAspectIds.add(upload.id);
        return;
      }

      try {
        pendingAspectIds.add(upload.id);
        const objectUrl = URL.createObjectURL(file);
        let revoked = false;

        const revokeObjectUrl = () => {
          if (revoked) return;
          revoked = true;
          pendingAspectIds.delete(upload.id);
          URL.revokeObjectURL(objectUrl);
        };

        cleanupFns.push(revokeObjectUrl);

        if (upload.type === "image") {
          const img = new window.Image();
          img.onload = () => {
            measuredAspectIds.add(upload.id);
            setAspectById((prev) =>
              prev[upload.id]
                ? prev
                : {
                    ...prev,
                    [upload.id]: formatIntrinsicAspect(
                      img.naturalWidth,
                      img.naturalHeight
                    ),
                  }
            );
            revokeObjectUrl();
          };
          img.onerror = revokeObjectUrl;
          cleanupFns.push(() => {
            img.onload = null;
            img.onerror = null;
          });
          img.src = objectUrl;
          return;
        }

        if (upload.type === "video") {
          const video = document.createElement("video");
          video.onloadedmetadata = () => {
            measuredAspectIds.add(upload.id);
            setAspectById((prev) =>
              prev[upload.id]
                ? prev
                : {
                    ...prev,
                    [upload.id]: formatIntrinsicAspect(
                      video.videoWidth,
                      video.videoHeight
                    ),
                  }
            );
            revokeObjectUrl();
          };
          video.onerror = revokeObjectUrl;
          cleanupFns.push(() => {
            video.onloadedmetadata = null;
            video.onerror = null;
          });
          video.src = objectUrl;
        }
      } catch {
        pendingAspectIds.delete(upload.id);
      }
    });

    return () => {
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, [formatIntrinsicAspect, uploads]);

  const handleDescriptionChange = (id: string, description: string) => {
    onAddDescription?.(id, description);
  };

  if (uploads.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {uploads.map((upload) => (
        <div key={upload.id}>
          {upload.status !== "error" && (
            <>
              {upload.type === "file" ? (
                <Attachment
                  className="w-full"
                  state={upload.status === "uploading" ? "uploading" : "done"}
                >
                  <AttachmentMedia>
                    {upload.file.type.toLowerCase() === "application/pdf" ? (
                      <PictureAsPdfIcon className="fill-current" />
                    ) : (
                      <DescriptionIcon className="size-4 fill-current" />
                    )}
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{upload.file.name}</AttachmentTitle>
                    <AttachmentDescription>
                      {upload.file.type.toLowerCase() === "application/pdf"
                        ? "PDF"
                        : "Document"}
                    </AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      type="button"
                      onClick={() => onRemove?.(upload.id)}
                      aria-label={`Remove ${upload.file.name}`}
                    >
                      <CloseIcon className="fill-current" />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              ) : (
                <div
                  className="border-border relative w-full overflow-hidden rounded-md border"
                  style={{
                    aspectRatio:
                      aspectById[upload.id] ??
                      (upload.width && upload.height
                        ? `${upload.width} / ${upload.height}`
                        : "16 / 9"),
                  }}
                >
                  {upload.type === "image" && upload.url ? (
                    upload.url.startsWith("blob:") ? (
                      <Image
                        src={upload.url}
                        alt="Uploaded media"
                        fill
                        className="object-cover"
                        sizes="100vw"
                        onLoad={() => {
                          // next/image doesn't expose natural size in event target; precomputed aspect used
                        }}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={upload.url}
                        alt="Uploaded media"
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : null}
                  {upload.type === "video" && upload.url && (
                    <video
                      src={upload.url}
                      className="h-full w-full object-cover"
                      controls
                      aria-label="Uploaded video preview"
                      onLoadedMetadata={(e) => {
                        const video = e.currentTarget as HTMLVideoElement;
                        setAspectById((prev) => ({
                          ...prev,
                          [upload.id]: formatIntrinsicAspect(
                            video.videoWidth,
                            video.videoHeight
                          ),
                        }));
                      }}
                    />
                  )}
                  {!upload.url && (
                    <Skeleton className="absolute inset-0 h-full w-full" />
                  )}

                  {/* Remove Button */}
                  <Button
                    variant="outline"
                    size="xsIcon"
                    type="button"
                    onClick={() => onRemove?.(upload.id)}
                    className="absolute top-2 right-2"
                    aria-label="Remove media"
                  >
                    <CloseIcon className="fill-current" />
                  </Button>
                </div>
              )}

              {/* Status + optional description (posts/replies); DMs omit description */}
              {(upload.status === "uploading" || showDescription) && (
                <div className="mt-2 flex items-center gap-4">
                  {upload.status === "uploading" && (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Spinner
                        variant="circle"
                        className="h-4 w-4"
                        style={{ animationDuration: "400ms" }}
                      />
                      <span className="flex items-baseline gap-1">
                        Uploading ·
                        <AnimatedPercent value={upload.progress} />
                      </span>
                    </div>
                  )}

                  {showDescription ? (
                    <div className="flex-1">
                      {editingId !== upload.id ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          type="button"
                          onClick={() => {
                            setEditingId(upload.id);
                            setDraft(upload.description ?? "");
                          }}
                        >
                          {upload.description ? (
                            <EditIcon className="fill-current" />
                          ) : (
                            <AddIcon className="fill-current" />
                          )}
                          {upload.description
                            ? "Edit description"
                            : "Add description"}
                        </Button>
                      ) : (
                        <div>
                          <Textarea
                            ref={textareaRef}
                            value={draft}
                            onChange={(e) =>
                              setDraft(e.target.value.slice(0, MAX_DESCRIPTION))
                            }
                            placeholder="Type here."
                            className="h-auto min-h-0 resize-none overflow-hidden rounded-none border-0 p-0 focus-visible:ring-0"
                            rows={1}
                          />
                          <div className="mt-2 flex items-center justify-between gap-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                const name = upload.file?.name?.replace(
                                  /\.[^.]+$/,
                                  ""
                                );
                                const label =
                                  upload.type === "video" ? "Video" : "Media";
                                const auto = name ? `${label}: ${name}` : label;
                                setDraft(auto.slice(0, MAX_DESCRIPTION));
                              }}
                              className="flex items-center gap-2"
                            >
                              <AutorenewIcon className="fill-current" />{" "}
                              Auto-fill
                            </Button>
                            <div className="flex items-center gap-1">
                              <CharacterCounter
                                current={draft.length}
                                max={MAX_DESCRIPTION}
                              />
                              <span className="text-muted-foreground">
                                &nbsp;&nbsp;·
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  setEditingId(null);
                                  setDraft("");
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                onClick={() => {
                                  handleDescriptionChange(
                                    upload.id,
                                    draft.trim()
                                  );
                                  setEditingId(null);
                                }}
                                disabled={draft.trim().length === 0}
                              >
                                Done
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
          {/* Error State */}
          {upload.status === "error" && (
            <span className="text-sm text-red-500">
              {upload.error || "Upload failed"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
