"use client";

import { toast } from "sonner";
import { Button } from "@/shared/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import {
  ContentCopyIcon,
  MarkdownIcon,
  MoreHorizIcon,
} from "@/shared/ui/components/icons";

export function BlogPostMenu({ markdownHref }: { markdownHref?: string }) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link. Copy it from your address bar.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="xsIcon" variant="outline" aria-label="Post options">
          <MoreHorizIcon className="fill-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void copyLink()}>
          <ContentCopyIcon className="fill-current" aria-hidden />
          Copy link
        </DropdownMenuItem>
        {markdownHref && (
          <DropdownMenuItem asChild>
            <a href={markdownHref}>
              <MarkdownIcon aria-hidden />
              Markdown
            </a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
