import { useRef } from "react";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";

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
        {/* editor plugins */}
      </div>
      {/* actions plugins */}
    </div>
  );
}
