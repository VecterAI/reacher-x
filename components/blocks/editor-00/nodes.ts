import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ParagraphNode, TextNode } from "lexical";
import { HashtagNode } from "@lexical/hashtag";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { MentionNode } from "@/features/composer/ui/components/mentions/MentionNode";
import { MediaNode } from "@/features/composer/ui/components/MediaNode";

// Use a more flexible typing approach to avoid TypeScript stack depth issues
export const nodes = [
  HeadingNode,
  ParagraphNode,
  TextNode,
  QuoteNode,
  HashtagNode,
  LinkNode,
  AutoLinkNode,
  MentionNode,
  MediaNode,
] as const;
