import { useMemo, useRef } from "react";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HashtagPlugin } from "@lexical/react/LexicalHashtagPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { MentionsPlugin } from "@/features/composer/ui/components/mentions/MentionsPlugin";
import { MediaPastePlugin } from "@/features/composer/ui/components/MediaPastePlugin";
import { InlineAutocompletePlugin } from "@/features/composer/ui/components/InlineAutocompletePlugin";
import type { InlineAutocompleteContext } from "@/shared/lib/autocomplete/inlineAutocomplete";

const URL_REGEX =
  /((https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-._~:?#[\]@!$&'()*+,;=%]*)?)/i;
const EMAIL_REGEX = /[^\s]+@[^\s]+\.[^\s]+/i;

import { ContentEditable } from "@/shared/ui/components/editor/ContentEditable";
import { cn } from "@/shared/lib/utils";

const DEFAULT_CONTENT_EDITABLE_CLASS =
  "ContentEditable__root relative block overflow-auto px-0 py-2 text-sm leading-5 wrap-break-word whitespace-pre-wrap focus:outline-hidden";

const DEFAULT_PLACEHOLDER_CLASS =
  "text-muted-foreground pointer-events-none absolute top-0 left-0 overflow-hidden px-0 py-2 text-sm leading-5 text-ellipsis select-none";

export function Plugins({
  placeholder = "Start typing ...",
  contentEditableClassName,
  composerPlaceholderClassName,
  inlineAutocompleteContext,
  editable = true,
}: {
  placeholder?: string;
  contentEditableClassName?: string;
  composerPlaceholderClassName?: string;
  inlineAutocompleteContext?: InlineAutocompleteContext;
  editable?: boolean;
}) {
  const floatingAnchorElemRef = useRef<HTMLDivElement | null>(null);

  const onRef = (_floatingAnchorElem: HTMLDivElement | null) => {
    // Avoid state updates in ref callbacks; just store a ref when it actually changes
    if (floatingAnchorElemRef.current !== _floatingAnchorElem) {
      floatingAnchorElemRef.current = _floatingAnchorElem;
    }
  };

  return (
    <div className="relative">
      {/* toolbar plugins */}
      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <div className="">
              <div className="" ref={onRef}>
                <ContentEditable
                  placeholder={placeholder}
                  className={cn(
                    contentEditableClassName ?? DEFAULT_CONTENT_EDITABLE_CLASS
                  )}
                  placeholderClassName={cn(
                    composerPlaceholderClassName ?? DEFAULT_PLACEHOLDER_CLASS
                  )}
                />
              </div>
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HashtagPlugin />
        <LinkPlugin />
        <AutoLinkPlugin
          matchers={useMemo(
            () => [
              (text: string) => {
                const match = text.match(URL_REGEX);
                if (match) {
                  const url = match[0];
                  return {
                    index: match.index || 0,
                    length: url.length,
                    text: url,
                    url: url.startsWith("http") ? url : `https://${url}`,
                  };
                }
                return null;
              },
              (text: string) => {
                const match = text.match(EMAIL_REGEX);
                if (match) {
                  const email = match[0];
                  return {
                    index: match.index || 0,
                    length: email.length,
                    text: email,
                    url: `mailto:${email}`,
                  };
                }
                return null;
              },
            ],
            []
          )}
        />
        <MentionsPlugin />
        <InlineAutocompletePlugin
          inlineAutocompleteContext={inlineAutocompleteContext}
          editable={editable}
        />
        <MediaPastePlugin />
        {/* editor plugins */}
      </div>
      {/* actions plugins */}
    </div>
  );
}
