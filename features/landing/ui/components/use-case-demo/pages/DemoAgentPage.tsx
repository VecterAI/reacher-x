/**
 * DemoAgentPage
 * Faithful replica of the real /agent desktop page (app/(webapp)/agent/page.tsx
 * -> AgentPageShell -> AgentChat + HistoryPanel), composed from the same
 * presentational pieces and classes, fed entirely by local state:
 *
 * - Reused as-is (prop-driven, no Convex): ThreadCard, OutreachPlanCard,
 *   InlineProgressCard, AgentWorkspaceEmptyState, Message/MessageAvatar/
 *   MessageContent/MessageActions/MessageAction, Bubble/BubbleContent,
 *   MessageScroller family, Steps family, Marker family, InlineFeatureStrip,
 *   PageLayout/PageHeader/PageContent, Markdown, ScrollArea, Input, Button.
 * - Replicated exactly (real versions are Convex-wired): HistoryPanel
 *   (usePaginatedQuery/useAction/useMutation), ChatHeader, ChatMessage rows
 *   (user + assistant), ToolCallGroup/ToolCallMarker, the inline prospect
 *   profile card (InlineProspectProfileCard is not reusable: it requires
 *   ProfileProvider via useTwitterProfileNavigation and ProspectProfileHeader
 *   fires a real status mutation from its dropdown menu), and the composer
 *   (same Lexical ComposerEditor shell as AgentChat; upload/mention wiring is
 *   inert, send is a local echo).
 *
 * Omitted vs real: WorkspacePlanLimitAlert (Convex-wired), attachments,
 * mention picker behavior, plan action menu (its Edit/Delete handlers call
 * real mutations), right-side panels (plan/dynamic/profile), and the profile
 * card's dropdown menu (its items invoke mutations; trigger is rendered
 * inert).
 */
"use client";

import * as React from "react";
import { motion } from "motion/react";
import type { SerializedEditorState } from "lexical";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn, extractTextFromEditorState } from "@/shared/lib/utils";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { formatRelativeTime } from "@/shared/lib/utils";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageActions,
  MessageAction,
} from "@/shared/ui/components/Message";
import { Bubble, BubbleContent } from "@/shared/ui/components/Bubble";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/shared/ui/components/MessageScroller";
import {
  Steps,
  StepsTrigger,
  StepsContent,
  StepsItem,
} from "@/shared/ui/components/Steps";
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@/shared/ui/components/Marker";
import { Markdown } from "@/shared/ui/components/Markdown";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Badge } from "@/shared/ui/components/Badge";
import { Input } from "@/shared/ui/components/Input";
import { Button } from "@/shared/ui/components/Button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Separator } from "@/shared/ui/components/Separator";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/shared/ui/components/Attachment";
import {
  AddIcon,
  AlternateEmailIcon,
  ArrowUpwardIcon,
  AttachFileIcon,
  ChangeHistoryIcon,
  CheckIcon,
  CognitionIcon,
  ContentCopyIcon,
  MoreHorizIcon,
  OpenInNewIcon,
  SearchActivityIcon,
  SearchIcon,
} from "@/shared/ui/components/icons";
import {
  DESKTOP_PANEL_BORDER_CLASS_NAME,
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { OutreachPlanCard } from "@/features/prospects/ui/components/outreach-plan";
import type { OutreachPlanCardTask } from "@/features/prospects/ui/components/outreach-plan";
import {
  getOutreachPlanStatusLabel,
  PlanActionMenu,
} from "@/features/prospects/ui/components/outreach-plan";
import { ProspectPlatformAvatar } from "@/shared/ui/components/ProspectPlatformAvatar";
import {
  ThreadCard,
  type ThreadData,
} from "@/features/agent/ui/components/ThreadCard";
import { InlineProgressCard } from "@/features/agent/ui/components/InlineProgressCard";
import { AgentWorkspaceEmptyState } from "@/features/agent/ui/components/AgentWorkspaceEmptyState";
import { ComposerEditor } from "@/features/composer/lib/ComposerEditor";
import type { ComposerEditorAPI } from "@/features/composer/lib/ToolbarBridgePlugin";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
import {
  DM_COMPOSER_CONTENT_EDITABLE_CLASS,
  DM_COMPOSER_PLACEHOLDER_CLASS,
} from "@/features/composer/ui/dmComposerClasses";
import { DEMO_USER_AVATAR_URL, useDemoShell } from "../demoShellContext";
import {
  USE_CASE_DEMO_REFERENCE_TIME,
  USE_CASE_DEMO_DATASETS,
  type DemoOutreachPlan,
  type UseCaseDemoDataset,
} from "../useCaseDemoData";

// ============================================================================
// Constants mirrored from features/agent/ui/AgentChat.tsx
// ============================================================================

const AGENT_DISPLAY_NAME = "Agent";
const AGENT_AVATAR_FALLBACK = "△";
const AGENT_MESSAGE_AVATAR_SLOT_CLASSNAME =
  "self-start group-has-data-[slot=message-footer]/message:translate-y-0";
const AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME = "mx-auto w-full max-w-[48rem]";

const TOOL_LABELS: Record<string, string> = {
  getSocialContext: "Fetching social context",
  displayEntity: "Showing entity",
  searchProspects: "Finding prospects",
};

// ============================================================================
// Mock conversation model
// ============================================================================

type DemoMessageSegment = string | { mention: string };

interface DemoUserMessage {
  id: string;
  role: "user";
  segments: DemoMessageSegment[];
  /** Optional file chip rendered under the bubble (real Attachment UI). */
  attachmentName?: string;
}

type DemoAgentPart =
  | { type: "text"; text: string }
  | { type: "tools"; toolNames: string[] }
  | { type: "progress"; title: string; status: string }
  | { type: "profile"; prospect: Doc<"prospects"> }
  | { type: "memory"; title: string }
  | { type: "plan" };

interface DemoAgentMessage {
  id: string;
  role: "agent";
  parts: DemoAgentPart[];
}

type DemoMessage = DemoUserMessage | DemoAgentMessage;

interface DemoThread {
  id: string;
  firstMessage: string;
  createdAt: number;
  messages: DemoMessage[];
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const BASE_TIME = USE_CASE_DEMO_REFERENCE_TIME;

const SHOWCASE_THREAD_ID = "demo-thread-plan-update";

function firstName(displayName: string | undefined): string {
  return displayName?.split(" ")[0] ?? "there";
}

/** First sentence of the prospect's public signal, trimmed for chat copy. */
function signalSnippet(prospect: Doc<"prospects">): string {
  const intro = prospect.briefIntro ?? "";
  const firstSentence = intro.split(/(?<=\.)\s/)[0] ?? intro;
  return firstSentence.length > 110
    ? `${firstSentence.slice(0, 107).trimEnd()}...`
    : firstSentence;
}

function buildShowcasePlan(dataset: UseCaseDemoDataset): DemoOutreachPlan {
  const [p0, p1, p2] = dataset.prospects;
  const commentTask = (
    order: number,
    prospect: Doc<"prospects">
  ): OutreachPlanCardTask => ({
    _id: `demo-task-${order}`,
    order,
    type: "comment",
    description: `Comment on ${firstName(prospect.displayName)}'s signal post`,
    status: "pending",
    content: `This matches what we see too. "${signalSnippet(prospect)}" is exactly the kind of signal worth acting on while it is fresh.`,
  });

  return {
    status: "draft",
    rationale: `All three posted buying signals in the last few days. Warm up each thread with a substantive comment that references their exact post, then send one DM to ${firstName(p0.displayName)} only, since their post asks for recommendations directly.`,
    tasks: [
      commentTask(1, p0),
      commentTask(2, p1),
      commentTask(3, p2),
      {
        _id: "demo-task-4",
        order: 4,
        type: "dm",
        description: `DM ${firstName(p0.displayName)} with a specific opener`,
        status: "pending",
        content: `Hi ${firstName(p0.displayName)}, saw your post: "${signalSnippet(p0)}" We help teams reach the people who are already asking for what they sell. Happy to show you what that looks like for you.`,
      },
    ],
    outreachProgress: undefined,
  };
}

function buildDemoThreads(
  dataset: UseCaseDemoDataset,
  entityPluralLower: string
): DemoThread[] {
  const [p0, p1, p2] = dataset.prospects;
  const p0Name = p0.displayName ?? "this prospect";
  const inRange = dataset.prospects.filter((prospect) => {
    const score = prospect.qualificationScore ?? 0;
    return score >= 70 && score <= 79;
  });
  const bulkCount = Math.max(inRange.length, 1);
  const bulkSkipped = Math.max(dataset.prospects.length - bulkCount, 0);

  return [
    {
      id: SHOWCASE_THREAD_ID,
      firstMessage: `What did @${p0Name} post about? Is it worth outreach?`,
      createdAt: BASE_TIME - 2 * HOUR_MS,
      messages: [
        {
          id: "demo-msg-1",
          role: "user",
          segments: [
            "What did ",
            { mention: p0Name },
            " post about? Is it worth outreach?",
          ],
        },
        {
          id: "demo-msg-2",
          role: "agent",
          parts: [
            {
              type: "text",
              text: `${p0Name} posted recently: "${signalSnippet(p0)}" ${p0.title ? `${p0.title}. ` : ""}Fit score ${p0.qualificationScore ?? "?"}, one of the strongest matches right now. I pulled the latest context below.`,
            },
            {
              type: "progress",
              title: "Profile research",
              status: "Reviewed 1 of 1 profiles",
            },
            { type: "profile", prospect: p0 },
          ],
        },
        {
          id: "demo-msg-3",
          role: "user",
          segments: [
            { mention: p1.displayName ?? "" },
            " and ",
            { mention: p2.displayName ?? "" },
            ` too. Build one plan for all three: comment on each signal post first, and only DM ${firstName(p0.displayName)}.`,
          ],
        },
        {
          id: "demo-msg-4",
          role: "agent",
          parts: [
            {
              type: "text",
              text: `Done. I pulled the latest context on all three and drafted a single plan. Comments go first so every touchpoint lands in public context; only ${firstName(p0.displayName)} gets a DM, since their post asks for recommendations directly. Review and approve it below, or open the full plan.`,
            },
            { type: "tools", toolNames: ["getSocialContext", "displayEntity"] },
            { type: "plan" },
          ],
        },
      ],
    },
    {
      id: "demo-thread-preferences",
      firstMessage: "Rules for all outreach from now on",
      createdAt: BASE_TIME - DAY_MS,
      messages: [
        {
          id: "demo-msg-5",
          role: "user",
          segments: [
            "Rules for all outreach from now on: never use em dashes in the copy, and when it genuinely helps, include my short tutorial video https://youtu.be/CD4lxrfZZzE.",
          ],
        },
        {
          id: "demo-msg-6",
          role: "agent",
          parts: [
            { type: "memory", title: "Never use em dashes in outreach copy" },
            {
              type: "memory",
              title: "Use the tutorial video when it adds concrete value",
            },
            {
              type: "text",
              text: "Saved. I will apply both to every future plan: no em dashes in any copy, and the tutorial only when it gives the prospect a genuinely useful next step, not as a link in every message.",
            },
          ],
        },
      ],
    },
    {
      id: "demo-thread-attachment",
      firstMessage: "Use my short demo video in outreach",
      createdAt: BASE_TIME - 2 * DAY_MS,
      messages: [
        {
          id: "demo-msg-7",
          role: "user",
          segments: [
            "I recorded a 3 minute product demo. Attach it and use it in outreach where it can add value.",
          ],
          attachmentName: "demo-short.mp4",
        },
        {
          id: "demo-msg-8",
          role: "agent",
          parts: [
            {
              type: "text",
              text: "Got it. I will use the demo selectively, only for prospects where a short walkthrough clearly helps, never attached to every message. I saved this as a preference.",
            },
            {
              type: "memory",
              title: "Use the short demo video when it adds concrete value",
            },
          ],
        },
      ],
    },
    {
      id: "demo-thread-bulk-plans",
      firstMessage: "Create plans for fit scores between 70 and 79",
      createdAt: BASE_TIME - 3 * DAY_MS,
      messages: [
        {
          id: "demo-msg-9",
          role: "user",
          segments: [
            `Create plans for qualified ${entityPluralLower} with a fit score between 70 and 79.`,
          ],
        },
        {
          id: "demo-msg-10",
          role: "agent",
          parts: [
            {
              type: "text",
              text: `I found ${bulkCount} qualified ${entityPluralLower} in that fit range. I will create a tailored plan for each, following your saved rules. Confirm and I will start.`,
            },
          ],
        },
        {
          id: "demo-msg-11",
          role: "user",
          segments: ["yes go ahead"],
        },
        {
          id: "demo-msg-12",
          role: "agent",
          parts: [
            { type: "tools", toolNames: ["searchProspects"] },
            {
              type: "progress",
              title: `${bulkCount} outreach plans are ready`,
              status: `${bulkCount} plans created. ${bulkSkipped} plans were not created`,
            },
            {
              type: "text",
              text: `Done. ${bulkCount} tailored plans are ready for review. Each follows your copy rules and uses the tutorial only where it adds clear value.`,
            },
          ],
        },
      ],
    },
    {
      id: "demo-thread-review",
      firstMessage: "Give me a weekly review of my pipeline",
      createdAt: BASE_TIME - 5 * DAY_MS,
      messages: [
        {
          id: "demo-msg-13",
          role: "user",
          segments: ["Give me a weekly review of my pipeline."],
        },
        {
          id: "demo-msg-14",
          role: "agent",
          parts: [
            {
              type: "text",
              text: `Here is your week:\n\n- **128** new ${entityPluralLower} discovered\n- **46** qualified against your profile\n- **12** contacted, **5** replies\n\nReply rate is up from last week. ${firstName(p0.displayName)}, ${firstName(p1.displayName)}, and ${firstName(p2.displayName)} are the warmest open threads.`,
            },
          ],
        },
      ],
    },
  ];
}

const CANNED_REPLY =
  "This demo runs on example data, so I cannot start real work here. In the product, I would act on that right away and show the result inline in this thread.";

// ============================================================================
// Replicated AgentChat helpers (identical classes to the real components)
// ============================================================================

function getUserMessageText(segments: DemoMessageSegment[]): string {
  return segments
    .map((segment) =>
      typeof segment === "string" ? segment : `@${segment.mention}`
    )
    .join("");
}

function getAgentMessageText(parts: DemoAgentPart[]): string {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { type: "text"; text: string }).text)
    .join("\n\n");
}

/** Replica of CopyButton in AgentChat (local clipboard only). */
function DemoCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is unavailable in some embeds; stay silent like the demo shell.
    }
  }, [text]);

  return (
    <MessageAction tooltip={copied ? "Copied!" : "Copy"}>
      <Button
        variant="ghost"
        size="xsIcon"
        onClick={handleCopy}
        className="text-muted-foreground hover:text-foreground"
      >
        {copied ? (
          <CheckIcon className="h-3 w-3 fill-current" />
        ) : (
          <ContentCopyIcon className="h-3 w-3 fill-current" />
        )}
      </Button>
    </MessageAction>
  );
}

/** Replica of UserBubble in AgentChat. */
function DemoUserBubble({ children }: { children: React.ReactNode }) {
  return (
    <Bubble align="end" variant="default" className="max-w-full">
      <BubbleContent className="bg-primary text-primary-foreground w-auto max-w-full rounded-lg border-transparent p-2 break-words whitespace-pre-wrap">
        {children}
      </BubbleContent>
    </Bubble>
  );
}

/** Replica of UserMessageContextContent/HighlightTaggedText output. */
function DemoUserMessageBody({ segments }: { segments: DemoMessageSegment[] }) {
  return (
    <div className="whitespace-pre-wrap">
      {segments.map((segment, index) =>
        typeof segment === "string" ? (
          <React.Fragment key={index}>{segment}</React.Fragment>
        ) : (
          <span key={index} className="text-primary-foreground/70 font-mono">
            @{segment.mention}
          </span>
        )
      )}
    </div>
  );
}

function getAssistantMarkdownClassName() {
  return cn(
    "markdown-content text-foreground break-words whitespace-normal text-sm text-pretty",
    "prose dark:prose-invert max-w-none prose-sm",
    "[&>:first-child]:mt-0 [&>:last-child]:mb-0",
    "prose-p:my-3 prose-p:leading-6",
    "prose-ul:my-3 prose-ol:my-3 prose-li:my-0 prose-li:leading-6 prose-li:marker:text-muted-foreground",
    "prose-h1:mt-6 prose-h1:mb-3 prose-h1:text-xl prose-h1:font-bold",
    "prose-h2:mt-5 prose-h2:mb-2 prose-h2:text-lg prose-h2:font-semibold",
    "prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-base prose-h3:font-semibold",
    "prose-h4:mt-3 prose-h4:mb-1.5 prose-h4:text-sm prose-h4:font-medium",
    "prose-blockquote:border-border prose-blockquote:my-4 prose-blockquote:pl-4 prose-blockquote:not-italic",
    "prose-hr:border-border/80 prose-hr:my-6",
    "prose-table:my-0",
    "prose-code:border prose-code:bg-transparent prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-medium prose-code:text-sm prose-code:text-inherit prose-code:before:content-none prose-code:after:content-none",
    "prose-strong:font-semibold"
  );
}

/** Replica of AssistantMessageBody in AgentChat. */
function DemoAssistantMessageBody({ text }: { text: string }) {
  return (
    <div className="min-w-0">
      <Markdown className={getAssistantMarkdownClassName()}>{text}</Markdown>
    </div>
  );
}

/** Replica of ToolCallMarker in AgentChat, completed state. */
function DemoToolCallMarker({ label }: { label: string }) {
  return (
    <Marker role="status" className="w-full gap-2 py-0.5 text-xs">
      <MarkerIcon className="border-border bg-background text-primary flex size-5 items-center justify-center rounded-md border">
        <ChangeHistoryIcon className="text-primary size-3.5 fill-current" />
      </MarkerIcon>
      <MarkerContent className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-muted-foreground truncate text-xs leading-none font-medium">
          {label}
        </span>
      </MarkerContent>
    </Marker>
  );
}

/** Replica of ToolCallGroup in AgentChat, completed state. */
function DemoToolCallGroup({ toolNames }: { toolNames: string[] }) {
  const triggerLabel =
    toolNames.length === 1 ? "1 tool used" : `${toolNames.length} tools used`;

  return (
    <Steps defaultOpen={false} className="w-full">
      <StepsTrigger
        className="text-xs font-medium"
        leftIcon={
          <ChangeHistoryIcon className="text-primary size-3.5 fill-current" />
        }
      >
        {triggerLabel}
      </StepsTrigger>
      <StepsContent className="mt-0">
        {toolNames.map((toolName) => (
          <StepsItem key={toolName}>
            <DemoToolCallMarker label={TOOL_LABELS[toolName] ?? toolName} />
          </StepsItem>
        ))}
      </StepsContent>
    </Steps>
  );
}

/**
 * Replica of InlineProspectProfileCard (features/agent/ui/components) and the
 * inline_card surface of ProspectProfileHeader, with identical classes.
 * The real card is not reusable here: it requires ProfileProvider and its
 * header menu fires real status mutations, so the menu trigger renders inert.
 */
function DemoInlineProspectProfileCard({
  prospect,
}: {
  prospect: Doc<"prospects">;
}) {
  const name = prospect.displayName ?? "Unknown";
  const title = prospect.title;
  const briefIntro = prospect.briefIntro;
  const platform = prospect.platform === "linkedin" ? "linkedin" : "twitter";
  const timestampIso = new Date(prospect._creationTime).toISOString();

  return (
    <div className="space-y-3">
      <article className="border-border bg-background overflow-hidden rounded-xl border">
        {/* ProspectProfileHeader replica (surface="inline_card") */}
        <header className="flex flex-wrap items-start gap-3 px-4 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ProspectPlatformAvatar platform={platform} badgeSize="lg">
              <Avatar className="ring-border size-12 shrink-0 rounded-full ring-1">
                <AvatarImage
                  src={undefined}
                  alt={`Avatar of ${name}`}
                  className={undefined}
                />
                <AvatarFallback>
                  {name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </ProspectPlatformAvatar>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-0.5 overflow-hidden">
                <div className="flex min-w-0 shrink items-center gap-0.5 overflow-hidden">
                  <span className="truncate text-sm font-medium" title={name}>
                    {name}
                  </span>
                </div>
                <div className="shrink-0">
                  <time
                    className="text-muted-foreground shrink-0 text-sm"
                    dateTime={timestampIso}
                    title={new Date(timestampIso).toLocaleString()}
                    suppressHydrationWarning
                  >
                    · {formatRelativeTime(timestampIso)}
                  </time>
                </div>
              </div>
              {title && (
                <span className="text-muted-foreground block truncate text-sm">
                  {title}
                </span>
              )}
            </div>
          </div>

          <div className="flex w-full shrink-0 items-center gap-1 sm:w-auto">
            <Button
              variant="outline"
              size="xsIcon"
              aria-label="Profile menu"
              title="Profile actions are disabled in this demo"
            >
              <MoreHorizIcon className="fill-current" />
            </Button>
          </div>
        </header>

        {briefIntro ? (
          <div className="my-0">
            <Separator orientation="horizontal" />
          </div>
        ) : null}

        {briefIntro ? (
          <section className="space-y-2 px-4 py-4">
            <h3 className="text-sm font-medium">Brief intro</h3>
            <div className="text-foreground [&_a]:text-muted-foreground text-sm whitespace-pre-line [&_a]:hover:underline">
              {briefIntro}
            </div>
          </section>
        ) : null}
      </article>

      <InlineFeatureStrip
        leading={
          <>
            <div className="border-border rounded-md border p-1">
              <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
            </div>
            <span className="truncate text-sm font-medium">Profile →</span>
          </>
        }
        trailing={
          <>
            <Button size="xs" disabled>
              View
            </Button>
            <Button size="xsIcon" variant="outline" disabled>
              <OpenInNewIcon className="fill-current" />
            </Button>
          </>
        }
      />
    </div>
  );
}

// ============================================================================
// Message rows (replica of ChatMessage in AgentChat)
// ============================================================================

function DemoUserMessageRow({ message }: { message: DemoUserMessage }) {
  return (
    <Message align="end" className="items-start">
      <MessageAvatar
        alt="You"
        src={DEMO_USER_AVATAR_URL}
        fallback="U"
        className="bg-primary text-primary-foreground"
        avatarClassName="size-6"
      />
      <MessageContent className="max-w-[80%] items-end gap-1">
        <DemoUserBubble>
          <DemoUserMessageBody segments={message.segments} />
        </DemoUserBubble>
        {message.attachmentName ? (
          <Attachment>
            <AttachmentMedia>
              <AttachFileIcon className="size-3.5 fill-current" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle title={message.attachmentName}>
                {message.attachmentName}
              </AttachmentTitle>
              <AttachmentDescription className="text-muted-foreground">
                Attachment
              </AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        ) : null}
        <MessageActions>
          <DemoCopyButton text={getUserMessageText(message.segments)} />
        </MessageActions>
      </MessageContent>
    </Message>
  );
}

/**
 * Replica of MemoryArtifactCard in AgentArtifactRenderer: tool-call Marker
 * row with cognition icon, memory title, and open-in-agent-ops affordance.
 */
function DemoMemoryCard({ title }: { title: string }) {
  return (
    <Marker role="status" className="w-full gap-2 py-0.5 text-xs">
      <MarkerIcon className="border-border bg-background text-primary flex size-5 items-center justify-center rounded-md border">
        <CognitionIcon className="text-primary size-3.5 fill-current" />
      </MarkerIcon>
      <MarkerContent className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="text-muted-foreground truncate text-xs leading-none font-medium">
          {title}
        </span>
        <span
          className="text-muted-foreground flex size-5 shrink-0 items-center justify-center"
          aria-hidden="true"
          title="Open in Agent observability"
        >
          <OpenInNewIcon className="size-3.5 fill-current" />
        </span>
      </MarkerContent>
    </Marker>
  );
}

function DemoAgentMessageRow({
  message,
  plan,
  planStatus,
  onApprovePlan,
  onShowPlan,
}: {
  message: DemoAgentMessage;
  plan: DemoOutreachPlan;
  planStatus: string;
  onApprovePlan: () => void;
  onShowPlan: () => void;
}) {
  return (
    <Message align="start" className="items-start">
      <MessageAvatar
        alt={AGENT_DISPLAY_NAME}
        fallback={AGENT_AVATAR_FALLBACK}
        className="bg-background text-foreground"
        avatarClassName="size-6 rounded-md"
        slotClassName={AGENT_MESSAGE_AVATAR_SLOT_CLASSNAME}
      />
      <MessageContent className="max-w-[85%] gap-2">
        {message.parts.map((part, index) => {
          switch (part.type) {
            case "text":
              return <DemoAssistantMessageBody key={index} text={part.text} />;
            case "tools":
              return (
                <DemoToolCallGroup key={index} toolNames={part.toolNames} />
              );
            case "progress":
              return (
                <InlineProgressCard
                  key={index}
                  title={part.title}
                  progress={100}
                  status={part.status}
                />
              );
            case "profile":
              return (
                <DemoInlineProspectProfileCard
                  key={index}
                  prospect={part.prospect}
                />
              );
            case "memory":
              return <DemoMemoryCard key={index} title={part.title} />;
            case "plan":
              return (
                <OutreachPlanCard
                  key={index}
                  variant="preview"
                  status={planStatus}
                  rationale={plan.rationale}
                  tasks={plan.tasks}
                  onApprove={planStatus === "draft" ? onApprovePlan : undefined}
                  footerAction={{
                    label: "Show plan",
                    onClick: onShowPlan,
                  }}
                />
              );
            default:
              return null;
          }
        })}
        <MessageActions>
          <DemoCopyButton text={getAgentMessageText(message.parts)} />
        </MessageActions>
      </MessageContent>
    </Message>
  );
}

// ============================================================================
// ChatHeader replica (AgentChat ChatHeader, workspace scope, setup complete)
// ============================================================================

function DemoChatHeader({
  onHistoryClick,
  onNewThread,
}: {
  onHistoryClick: () => void;
  onNewThread: () => void;
}) {
  return (
    <header className="bg-background sticky top-0 right-0 left-0 z-10 flex h-10 shrink-0 items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-1">
        <h1 className="text-sm font-medium">{AGENT_DISPLAY_NAME}</h1>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="xs"
          onClick={onHistoryClick}
          type="button"
          title="History"
        >
          <SearchActivityIcon className="fill-current" />
          History
        </Button>
        <Button
          variant="secondary"
          size="xs"
          onClick={onNewThread}
          type="button"
          title="New thread"
        >
          <AddIcon className="fill-current" />
          New
        </Button>
      </div>
    </header>
  );
}

// ============================================================================
// HistoryPanel replica (workspace scope) using the real ThreadCard
// ============================================================================

function DemoHistoryPanel({
  threads,
  currentThreadId,
  onClose,
  onSelectThread,
  onNewThread,
  onDeleteThread,
}: {
  threads: DemoThread[];
  currentThreadId: string | null;
  onClose: () => void;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onDeleteThread: (threadId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const displayedThreads = trimmedQuery
    ? threads.filter((thread) =>
        thread.firstMessage.toLowerCase().includes(trimmedQuery)
      )
    : threads;

  return (
    <aside
      className={cn(
        "flex h-full w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        DESKTOP_PANEL_BORDER_CLASS_NAME
      )}
    >
      <PageLayout className="flex flex-col">
        <PageHeader
          title="Workspace agent history"
          onBack={onClose}
          actions={
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="xs" onClick={onNewThread} variant="ghost">
                      <AddIcon className="fill-current" />
                      New
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Start a new thread</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          }
        />
        <PageContent className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1" viewportClassName="pb-8">
            {/* Search */}
            <div className="mt-4 mb-0 px-4">
              <div className="relative">
                <SearchIcon className="fill-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  placeholder="Search threads..."
                  size="sm"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {displayedThreads.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {trimmedQuery ? "No matching threads" : "No threads yet"}
              </p>
            ) : (
              <div>
                {displayedThreads.map((thread) => {
                  const threadData: ThreadData = {
                    _id: thread.id,
                    _creationTime: thread.createdAt,
                    status: "active",
                  };
                  return (
                    <ThreadCard
                      key={thread.id}
                      thread={threadData}
                      isActive={thread.id === currentThreadId}
                      firstMessage={thread.firstMessage}
                      onSelect={() => onSelectThread(thread.id)}
                      onDelete={() => onDeleteThread(thread.id)}
                    />
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PageContent>
      </PageLayout>
    </aside>
  );
}

// ============================================================================
// DemoAgentPage
// ============================================================================

export function DemoAgentPage() {
  const { useCaseKey, labels } = useDemoShell();
  const dataset =
    USE_CASE_DEMO_DATASETS.find((entry) => entry.key === useCaseKey) ??
    USE_CASE_DEMO_DATASETS[0];
  const entityPluralLower = labels.entityPlural.toLowerCase();
  const showcasePlan = React.useMemo(
    () => buildShowcasePlan(dataset),
    [dataset]
  );
  const [threads, setThreads] = React.useState<DemoThread[]>(() =>
    buildDemoThreads(dataset, entityPluralLower)
  );
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(
    SHOWCASE_THREAD_ID
  );
  const [historyOpen, setHistoryOpen] = React.useState(true);
  const [planPanelOpen, setPlanPanelOpen] = React.useState(false);
  const [planStatus, setPlanStatus] = React.useState("draft");
  const [input, setInput] = React.useState("");
  const editorApiRef = React.useRef<ComposerEditorAPI | null>(null);
  const nextIdRef = React.useRef(100);

  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) ?? null;
  const messages = activeThread?.messages ?? [];
  const isEmpty = messages.length === 0;

  const handleNewThread = React.useCallback(() => {
    setActiveThreadId(null);
    setHistoryOpen(false);
  }, []);

  const handleSelectThread = React.useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    setHistoryOpen(false);
  }, []);

  const handleDeleteThread = React.useCallback(
    (threadId: string) => {
      setThreads((current) =>
        current.filter((thread) => thread.id !== threadId)
      );
      if (threadId === activeThreadId) {
        setActiveThreadId(null);
      }
    },
    [activeThreadId]
  );

  const handleComposerContentChange = React.useCallback(
    (next: SerializedEditorState) => {
      setInput(extractTextFromEditorState(next));
    },
    []
  );

  const handleComposerBridgeReady = React.useCallback(
    (api: ComposerEditorAPI) => {
      editorApiRef.current = api;
    },
    []
  );

  const handleSend = React.useCallback(() => {
    const text = input.trim();
    if (!text) {
      return;
    }

    const userMessage: DemoUserMessage = {
      id: `demo-msg-${nextIdRef.current++}`,
      role: "user",
      segments: [text],
    };
    const agentMessage: DemoAgentMessage = {
      id: `demo-msg-${nextIdRef.current++}`,
      role: "agent",
      parts: [{ type: "text", text: CANNED_REPLY }],
    };

    if (activeThreadId === null) {
      const newThread: DemoThread = {
        id: `demo-thread-${nextIdRef.current++}`,
        firstMessage: text,
        createdAt: getCurrentUTCTimestamp(),
        messages: [userMessage, agentMessage],
      };
      setThreads((current) => [newThread, ...current]);
      setActiveThreadId(newThread.id);
    } else {
      setThreads((current) =>
        current.map((thread) =>
          thread.id === activeThreadId
            ? {
                ...thread,
                messages: [...thread.messages, userMessage, agentMessage],
              }
            : thread
        )
      );
    }
    setInput("");
    editorApiRef.current?.replaceContent(undefined);
  }, [activeThreadId, input]);

  // Composer: same Lexical shell/classes as AgentChat (and MockSetupThreadPreview).
  // Upload/mentions stay inert; send is a local echo.
  const composerContent = (
    <div
      className={cn(
        AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME,
        "border-input bg-background ring-offset-background focus-within:ring-ring cursor-text rounded-xl border p-2 transition-shadow focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-hidden"
      )}
      onClick={(event) => {
        event.currentTarget
          .querySelector<HTMLElement>("[contenteditable='true']")
          ?.focus();
      }}
    >
      <ComposerEditor
        className="min-h-10 text-sm"
        initialContent={buildSerializedTextState("")}
        placeholder={
          messages.length > 0
            ? "Type here..."
            : `Type and hit ↵ to chat with ${AGENT_DISPLAY_NAME}.`
        }
        maxLength={10000}
        characterCountMode="raw"
        showCharacterCount={false}
        contentEditableClassName={cn(
          DM_COMPOSER_CONTENT_EDITABLE_CLASS,
          "max-h-60"
        )}
        composerPlaceholderClassName={DM_COMPOSER_PLACEHOLDER_CLASS}
        onContentChange={handleComposerContentChange}
        onBridgeReady={handleComposerBridgeReady}
        submitOnEnter
        onSubmitShortcut={handleSend}
      />
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xsIcon"
            type="button"
            aria-label="Attach media"
            title="Attach media for the △ Agent to use"
          >
            <AttachFileIcon className="fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="xsIcon"
            type="button"
            aria-label="Tag people, plans, tasks, posts, or attachments"
            title="Tag people, plans, tasks, posts, or attachments"
          >
            <AlternateEmailIcon className="fill-current" />
          </Button>
        </div>

        <MessageAction tooltip="Send message">
          <Button
            type="button"
            variant="default"
            size="xsIcon"
            onClick={handleSend}
            aria-label="Send message"
            title="Send message"
            disabled={!input.trim()}
          >
            <ArrowUpwardIcon className="fill-current" />
          </Button>
        </MessageAction>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0">
      <PageLayout className="h-full w-full max-w-none flex-1 basis-0 border-none">
        <PageContent className="h-full p-0">
          <div className="flex h-full w-full flex-col">
            <DemoChatHeader
              onHistoryClick={() => {
                setPlanPanelOpen(false);
                setHistoryOpen(true);
              }}
              onNewThread={handleNewThread}
            />

            <div className="flex min-h-0 flex-1 flex-col">
              {/* Chat Messages Area - scrollable container */}
              <div className="relative min-h-0 flex-1">
                <MessageScrollerProvider autoScroll defaultScrollPosition="end">
                  <MessageScroller className="relative h-full min-h-0">
                    <MessageScrollerViewport>
                      <MessageScrollerContent
                        className={cn(
                          AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME,
                          "gap-0 px-4 pt-4 pb-16",
                          isEmpty && "flex min-h-full flex-col justify-center"
                        )}
                      >
                        {messages.map((message) => (
                          <MessageScrollerItem
                            key={message.id}
                            messageId={message.id}
                            className="mb-6"
                          >
                            <motion.div
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: 0.25,
                                ease: [0.25, 0.1, 0.25, 1],
                              }}
                            >
                              {message.role === "user" ? (
                                <DemoUserMessageRow message={message} />
                              ) : (
                                <DemoAgentMessageRow
                                  message={message}
                                  plan={showcasePlan}
                                  planStatus={planStatus}
                                  onApprovePlan={() =>
                                    setPlanStatus("approved")
                                  }
                                  onShowPlan={() => {
                                    setHistoryOpen(false);
                                    setPlanPanelOpen(true);
                                  }}
                                />
                              )}
                            </motion.div>
                          </MessageScrollerItem>
                        ))}

                        {isEmpty && (
                          <MessageScrollerItem
                            messageId="chat-empty"
                            className="mb-6"
                          >
                            <AgentWorkspaceEmptyState isResolving={false}>
                              {composerContent}
                            </AgentWorkspaceEmptyState>
                          </MessageScrollerItem>
                        )}
                      </MessageScrollerContent>
                    </MessageScrollerViewport>
                    <MessageScrollerButton
                      variant="outline"
                      className="shadow-sm"
                    />
                  </MessageScroller>
                </MessageScrollerProvider>
              </div>

              {!isEmpty && (
                <div className="bg-background shrink-0 px-4 pb-4 backdrop-blur-xl">
                  {composerContent}
                </div>
              )}
            </div>
          </div>
        </PageContent>
      </PageLayout>

      {planPanelOpen ? (
        <aside
          className={cn(
            "flex h-full w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
            DESKTOP_PANEL_BORDER_CLASS_NAME
          )}
        >
          <PageLayout className="flex flex-col border-none md:w-full">
            <PageHeader
              title="Outreach plan"
              onBack={() => setPlanPanelOpen(false)}
              titleSuffix={
                <Badge variant="outline" className="text-xs font-normal">
                  {getOutreachPlanStatusLabel(planStatus)}
                </Badge>
              }
              actions={
                <div className="flex items-center gap-1">
                  {planStatus === "draft" ? (
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => setPlanStatus("executing")}
                    >
                      Approve
                    </Button>
                  ) : null}
                  {planStatus === "executing" ? (
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => setPlanStatus("paused")}
                    >
                      Pause
                    </Button>
                  ) : null}
                  {planStatus === "paused" ? (
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => setPlanStatus("executing")}
                    >
                      Resume
                    </Button>
                  ) : null}
                  <PlanActionMenu
                    onEdit={() => {}}
                    onDelete={() => setPlanPanelOpen(false)}
                    ariaLabel="Outreach plan actions"
                  />
                </div>
              }
            />
            <ScrollArea className="min-h-0 flex-1" viewportClassName="pb-8">
              <PageContent className="py-0">
                <OutreachPlanCard
                  variant="panel"
                  showHeader={false}
                  status={planStatus}
                  rationale={showcasePlan.rationale}
                  strategyLabel="Strategy"
                  tasksLabel="Tasks"
                  tasks={showcasePlan.tasks}
                  prospectId={dataset.prospects[0]._id}
                  className="mt-4 rounded-none border-none"
                />
              </PageContent>
            </ScrollArea>
          </PageLayout>
        </aside>
      ) : null}

      {historyOpen && (
        <DemoHistoryPanel
          threads={threads}
          currentThreadId={activeThreadId}
          onClose={() => setHistoryOpen(false)}
          onSelectThread={handleSelectThread}
          onNewThread={handleNewThread}
          onDeleteThread={handleDeleteThread}
        />
      )}
    </div>
  );
}
