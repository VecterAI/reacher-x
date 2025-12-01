"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  EditIcon,
} from "@/shared/ui/components/icons";

interface MediaUploadSectionProps {
  uploads: MediaUpload[];
  onRemove?: (id: string) => void;
  onAddDescription?: (id: string, description: string) => void;
  className?: string;
}

export function MediaUploadSection({
  uploads,
  onRemove,
  onAddDescription,
  className,
}: MediaUploadSectionProps) {
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [aspectById, setAspectById] = useState<Record<string, string>>({});

  const MAX_DESCRIPTION = 1000;

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    autoResize();
  }, [draft, editingId]);

  const allowedAspects = useMemo(
    () =>
      [
        [16, 9],
        [4, 3],
        [1, 1],
        [3, 4],
      ] as Array<[number, number]>,
    []
  );

  const chooseNearestAspect = (width: number, height: number) => {
    const ratio = width / height;
    let best: [number, number] = allowedAspects[0];
    let bestDiff = Math.abs(best[0] / best[1] - ratio);
    for (const [w, h] of allowedAspects) {
      const diff = Math.abs(w / h - ratio);
      if (diff < bestDiff) {
        best = [w, h];
        bestDiff = diff;
      }
    }
    return `${best[0]} / ${best[1]}`;
  };

  // Precompute aspect ratios even before upload.url is available
  useEffect(() => {
    uploads.forEach((u) => {
      if (aspectById[u.id]) return;
      const file = u.file;
      if (!file) return;
      try {
        const objectUrl = URL.createObjectURL(file);
        if (u.type === "image") {
          const img = new window.Image();
          img.onload = () => {
            setAspectById((prev) => ({
              ...prev,
              [u.id]: chooseNearestAspect(img.naturalWidth, img.naturalHeight),
            }));
            URL.revokeObjectURL(objectUrl);
          };
          img.src = objectUrl;
        } else if (u.type === "video") {
          const video = document.createElement("video");
          video.onloadedmetadata = () => {
            setAspectById((prev) => ({
              ...prev,
              [u.id]: chooseNearestAspect(video.videoWidth, video.videoHeight),
            }));
            URL.revokeObjectURL(objectUrl);
          };
          video.src = objectUrl;
        }
      } catch {}
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploads]);

  const handleDescriptionChange = (id: string, description: string) => {
    setDescriptions((prev) => ({ ...prev, [id]: description }));
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
              {/* Media Preview */}
              <div
                className="relative w-full overflow-hidden rounded-md"
                style={{ aspectRatio: aspectById[upload.id] ?? "16 / 9" }}
              >
                {upload.type === "image" && upload.url && (
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
                )}
                {upload.type === "video" && upload.url && (
                  <video
                    src={upload.url}
                    className="h-full w-full object-cover"
                    controls
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget as HTMLVideoElement;
                      setAspectById((prev) => ({
                        ...prev,
                        [upload.id]: chooseNearestAspect(
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
                  onClick={() => onRemove?.(upload.id)}
                  className="absolute right-2 top-2"
                >
                  <CloseIcon className="fill-current" />
                </Button>
              </div>

              {/* Status + Description Row (16px gap) */}
              <div className="mt-2 flex items-center gap-4">
                {upload.status === "uploading" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
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

                {/* Description Input (images/GIFs only) */}
                <div className="flex-1">
                  {upload.type === "image" &&
                    (editingId !== upload.id ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setEditingId(upload.id);
                          setDraft(descriptions[upload.id] ?? "");
                        }}
                      >
                        {descriptions[upload.id] ? (
                          <EditIcon className="fill-current" />
                        ) : (
                          <AddIcon className="fill-current" />
                        )}
                        {descriptions[upload.id]
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
                              const auto = name ? `Photo: ${name}` : "Photo";
                              setDraft(auto.slice(0, MAX_DESCRIPTION));
                            }}
                            className="flex items-center gap-2"
                          >
                            <AutorenewIcon className="fill-current" /> Auto-fill
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
                    ))}
                </div>
              </div>
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
