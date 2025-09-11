import { useMemo, useRef } from "react";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HashtagPlugin } from "@lexical/react/LexicalHashtagPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { MentionsPlugin } from "@/features/composer/ui/components/mentions/MentionsPlugin";
import { MediaPastePlugin } from "@/features/composer/ui/components/MediaPastePlugin";

const URL_REGEX =
  /((https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-._~:?#\[\]@!$&'()*+,;=%]*)?)/i;
const EMAIL_REGEX = /[^\s]+@[^\s]+\.[^\s]+/i;

import { ContentEditable } from "@/components/editor/editor-ui/content-editable";

export function Plugins() {
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
                <ContentEditable placeholder={"Start typing ..."} />
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
        <MediaPastePlugin />
        {/* editor plugins */}
      </div>
      {/* actions plugins */}
    </div>
  );
}
