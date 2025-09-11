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

export interface SerializedMentionNode extends SerializedLexicalNode {
  mentionName: string;
  mentionId: string;
  type: "mention";
  version: 1;
}

export class MentionNode extends DecoratorNode<React.ReactElement> {
  __mentionName: string;
  __mentionId: string;

  static getType(): string {
    return "mention";
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__mentionName, node.__mentionId, node.__key);
  }

  constructor(mentionName: string, mentionId: string, key?: NodeKey) {
    super(key);
    this.__mentionName = mentionName;
    this.__mentionId = mentionId;
  }

  getMentionName(): string {
    return this.__mentionName;
  }

  getMentionId(): string {
    return this.__mentionId;
  }

  setMentionName(mentionName: string): void {
    const writable = this.getWritable();
    writable.__mentionName = mentionName;
  }

  setMentionId(mentionId: string): void {
    const writable = this.getWritable();
    writable.__mentionId = mentionId;
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "mention-node";
    span.setAttribute("data-mention-id", this.__mentionId);
    span.setAttribute("data-mention-name", this.__mentionName);
    span.setAttribute("contenteditable", "false");
    span.textContent = `@${this.__mentionName}`;
    return span;
  }

  updateDOM(prevNode: MentionNode, dom: HTMLElement): boolean {
    if (prevNode.__mentionName !== this.__mentionName) {
      dom.textContent = `@${this.__mentionName}`;
      dom.setAttribute("data-mention-name", this.__mentionName);
    }
    if (prevNode.__mentionId !== this.__mentionId) {
      dom.setAttribute("data-mention-id", this.__mentionId);
    }
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-mention-id")) {
          return null;
        }
        return {
          conversion: convertMentionElement,
          priority: 1,
        };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-mention-id", this.__mentionId);
    element.setAttribute("data-mention-name", this.__mentionName);
    element.textContent = `@${this.__mentionName}`;
    return { element };
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    const { mentionName, mentionId } = serializedNode;
    const node = $createMentionNode(mentionName, mentionId);
    return node;
  }

  exportJSON(): SerializedMentionNode {
    return {
      mentionName: this.__mentionName,
      mentionId: this.__mentionId,
      type: "mention",
      version: 1,
    };
  }

  decorate(): React.ReactElement {
    return React.createElement(
      "span",
      {
        className: "mention-node",
        "data-mention-id": this.__mentionId,
        "data-mention-name": this.__mentionName,
      },
      `@${this.__mentionName}`
    );
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  isInline(): boolean {
    return true;
  }
}

function convertMentionElement(domNode: HTMLElement): DOMConversionOutput {
  const mentionName = domNode.getAttribute("data-mention-name");
  const mentionId = domNode.getAttribute("data-mention-id");
  if (mentionName && mentionId) {
    const node = $createMentionNode(mentionName, mentionId);
    return { node };
  }
  return { node: null };
}

export function $createMentionNode(
  mentionName: string,
  mentionId: string
): MentionNode {
  const mentionNode = new MentionNode(mentionName, mentionId);
  return $applyNodeReplacement(mentionNode);
}

export function $isMentionNode(
  node: LexicalNode | null | undefined
): node is MentionNode {
  return node instanceof MentionNode;
}
