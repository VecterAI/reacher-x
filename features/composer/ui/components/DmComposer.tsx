"use client";

import type { ComponentProps, ReactNode } from "react";
import { BaseComposer } from "./BaseComposer";
import {
  DM_COMPOSER_CONTENT_EDITABLE_CLASS,
  DM_COMPOSER_PLACEHOLDER_CLASS,
} from "../dmComposerClasses";

/** Keep the DM editor's appearance identical across live and local adapters. */
export function DmComposer(props: ComponentProps<typeof BaseComposer>) {
  return (
    <BaseComposer
      placeholder="Type here."
      characterCountMode="raw"
      submitButtonText="Send"
      submitButtonVariant="icon"
      submitOnEnter
      submitMode="optimistic"
      toolbarPlacement="bottom"
      showIdentityHeader={false}
      showMediaDescription={false}
      showMediaUpload
      toolbarConfig={{
        showBold: false,
        showItalic: false,
        showEmoji: true,
        showMedia: true,
      }}
      showAvatar={false}
      editorAreaClassName="min-h-10 text-sm"
      contentEditableClassName={DM_COMPOSER_CONTENT_EDITABLE_CLASS}
      composerPlaceholderClassName={DM_COMPOSER_PLACEHOLDER_CLASS}
      className="rounded-xl border p-2"
      {...props}
    />
  );
}

export function DmComposerFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
      {children}
    </div>
  );
}
