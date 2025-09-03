"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils/utils";
import { Button } from "@/shared/ui/components/Button";
import { Textarea } from "@/shared/ui/components/TextArea";
import Image from "next/image";
import { Spinner } from "@/components/ui/shadcn-io/spinner";
import { X, Plus, Upload, RefreshCw, Pencil } from "lucide-react";
import { MediaUpload } from "../../types";

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
          {/* Media Preview */}
          <div
            className="relative w-full overflow-hidden rounded-md bg-muted"
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
              <div className="flex h-full items-center justify-center">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
            )}

            {/* Remove Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove?.(upload.id)}
              className="absolute right-2 top-2 h-6 w-6 bg-background/80 p-0 hover:bg-background"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Status + Description Row (16px gap) */}
          <div className="mt-2 flex items-start gap-4">
            {upload.status === "uploading" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner
                  variant="circle"
                  className="h-4 w-4"
                  style={{ animationDuration: "400ms" }}
                />
                <span>Uploading · {upload.progress}%</span>
              </div>
            )}

            {/* Error State */}
            {upload.status === "error" && (
              <div className="mt-2 text-sm text-destructive">
                {upload.error || "Upload failed"}
              </div>
            )}

            {/* Description Input */}
            <div className="flex-1">
              {editingId !== upload.id ? (
                <button
                  onClick={() => {
                    setEditingId(upload.id);
                    setDraft(descriptions[upload.id] ?? "");
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {descriptions[upload.id] ? (
                    <Pencil className="h-3 w-3" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  {descriptions[upload.id]
                    ? "Edit description"
                    : "Add description"}
                </button>
              ) : (
                <div>
                  <Textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) =>
                      setDraft(e.target.value.slice(0, MAX_DESCRIPTION))
                    }
                    placeholder="Type here."
                    className="h-auto min-h-0 resize-none overflow-hidden border-0 p-0 focus-visible:ring-0"
                    rows={1}
                  />
                  <div className="mt-2 flex items-center gap-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        const name = upload.file?.name?.replace(/\.[^.]+$/, "");
                        const auto = name ? `Photo: ${name}` : "Photo";
                        setDraft(auto.slice(0, MAX_DESCRIPTION));
                      }}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" /> Auto-fill
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {draft.length}/{MAX_DESCRIPTION}
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
                        handleDescriptionChange(upload.id, draft.trim());
                        setEditingId(null);
                      }}
                      disabled={draft.trim().length === 0}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}
              {descriptions[upload.id] && editingId !== upload.id && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {descriptions[upload.id]}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
