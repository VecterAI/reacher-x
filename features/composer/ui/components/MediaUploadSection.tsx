"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/utils/utils";
import { Button } from "@/shared/ui/components/Button";
import { X, Plus, Upload } from "lucide-react";
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
        <div
          key={upload.id}
          className="relative rounded-lg border bg-muted/50 p-3"
        >
          {/* Media Preview */}
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
            {upload.type === "image" && upload.url && (
              <img
                src={upload.url}
                alt="Uploaded media"
                className="h-full w-full object-cover"
              />
            )}
            {upload.type === "video" && upload.url && (
              <video
                src={upload.url}
                className="h-full w-full object-cover"
                controls
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

          {/* Upload Progress */}
          {upload.status === "uploading" && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Uploading · {upload.progress}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error State */}
          {upload.status === "error" && (
            <div className="mt-2 text-sm text-destructive">
              {upload.error || "Upload failed"}
            </div>
          )}

          {/* Description Input */}
          <div className="mt-2">
            <button
              onClick={() => {
                const description = prompt("Add description:");
                if (description !== null) {
                  handleDescriptionChange(upload.id, description);
                }
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Add description
            </button>
            {descriptions[upload.id] && (
              <p className="mt-1 text-xs text-muted-foreground">
                {descriptions[upload.id]}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
