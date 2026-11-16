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
  mentionEntity?: string;
  type: "MentionNode";
  version: 1;
}

export class MentionNode extends DecoratorNode<React.ReactElement> {
  __mentionName: string;
  __mentionId: string;
  /** JSON of the picked entity, so a cut chip can be tagged again on paste. */
  __mentionEntity?: string;

  static getType(): string {
    return "MentionNode";
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(
      node.__mentionName,
      node.__mentionId,
      node.__mentionEntity,
      node.__key
    );
  }

  constructor(
    mentionName: string,
    mentionId: string,
    mentionEntity?: string,
    key?: NodeKey
  ) {
    super(key);
    this.__mentionName = mentionName;
    this.__mentionId = mentionId;
    this.__mentionEntity = mentionEntity;
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
    span.className = "font-mono text-muted-foreground";
    span.setAttribute("data-mention-id", this.__mentionId);
    span.setAttribute("data-mention-name", this.__mentionName);
    span.setAttribute("contenteditable", "false");
    // Don't set textContent here - let the decorate() method handle rendering
    return span;
  }

  updateDOM(prevNode: MentionNode, dom: HTMLElement): boolean {
    if (prevNode.__mentionName !== this.__mentionName) {
      // Don't set textContent here - let the decorate() method handle rendering
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
    if (this.__mentionEntity) {
      element.setAttribute("data-mention-entity", this.__mentionEntity);
    }
    element.textContent = `@${this.__mentionName}`;
    return { element };
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    const { mentionName, mentionId, mentionEntity } = serializedNode;
    return $createMentionNode(mentionName, mentionId, mentionEntity);
  }

  exportJSON(): SerializedMentionNode {
    return {
      mentionName: this.__mentionName,
      mentionId: this.__mentionId,
      ...(this.__mentionEntity ? { mentionEntity: this.__mentionEntity } : {}),
      type: "MentionNode",
      version: 1,
    };
  }

  decorate(): React.ReactElement {
    return React.createElement(
      "span",
      {
        className: "font-mono text-muted-foreground",
        "data-mention-id": this.__mentionId,
        "data-mention-name": this.__mentionName,
      },
      `@${this.__mentionName}`
    );
  }

  getTextContent(): string {
    return `@${this.__mentionName}`;
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
    const mentionEntity =
      domNode.getAttribute("data-mention-entity") ?? undefined;
    return { node: $createMentionNode(mentionName, mentionId, mentionEntity) };
  }
  return { node: null };
}

export function $createMentionNode(
  mentionName: string,
  mentionId: string,
  mentionEntity?: string
): MentionNode {
  const mentionNode = new MentionNode(mentionName, mentionId, mentionEntity);
  return $applyNodeReplacement(mentionNode);
}

export function $isMentionNode(
  node: LexicalNode | null | undefined
): node is MentionNode {
  return node instanceof MentionNode;
}
