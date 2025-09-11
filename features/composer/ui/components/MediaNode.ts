import {
  $applyNodeReplacement,
  DecoratorNode,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
} from "lexical";
import React from "react";

export interface SerializedMediaNode extends SerializedLexicalNode {
  mediaId: string;
  type: "media";
  version: 1;
}

export class MediaNode extends DecoratorNode<React.ReactElement> {
  __mediaId: string;

  static getType(): string {
    return "media";
  }

  static clone(node: MediaNode): MediaNode {
    return new MediaNode(node.__mediaId, node.__key);
  }

  constructor(mediaId: string, key?: NodeKey) {
    super(key);
    this.__mediaId = mediaId;
  }

  getMediaId(): string {
    return this.__mediaId;
  }

  setMediaId(mediaId: string): void {
    const writable = this.getWritable();
    writable.__mediaId = mediaId;
  }

  createDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "media-node-placeholder";
    div.setAttribute("data-lexical-media", "true");
    div.setAttribute("data-media-id", this.__mediaId);
    return div;
  }

  updateDOM(prevNode: MediaNode, dom: HTMLDivElement): boolean {
    if (prevNode.__mediaId !== this.__mediaId) {
      dom.setAttribute("data-media-id", this.__mediaId);
    }
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (domNode.hasAttribute("data-lexical-media")) {
          return {
            conversion: convertMediaElement,
            priority: 0,
          };
        }
        return null;
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.className = "media-node-placeholder";
    element.setAttribute("data-lexical-media", "true");
    element.setAttribute("data-media-id", this.__mediaId);
    return { element };
  }

  static importJSON(serializedNode: SerializedMediaNode): MediaNode {
    const { mediaId } = serializedNode;
    const node = $createMediaNode(mediaId);
    return node;
  }

  exportJSON(): SerializedMediaNode {
    return {
      mediaId: this.__mediaId,
      type: "media",
      version: 1,
    };
  }

  decorate(): React.ReactElement {
    // This will be rendered by the MediaRenderPlugin
    return React.createElement("div", {
      className: "media-node-placeholder",
      "data-lexical-media": "true",
      "data-media-id": this.__mediaId,
    });
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  isInline(): boolean {
    return false;
  }
}

function convertMediaElement(domNode: HTMLElement): DOMConversionOutput {
  const mediaId = domNode.getAttribute("data-media-id");
  if (mediaId) {
    const node = $createMediaNode(mediaId);
    return { node };
  }
  return { node: null };
}

export function $createMediaNode(mediaId: string): MediaNode {
  const mediaNode = new MediaNode(mediaId);
  return $applyNodeReplacement(mediaNode);
}

export function $isMediaNode(
  node: LexicalNode | null | undefined
): node is MediaNode {
  return node instanceof MediaNode;
}
