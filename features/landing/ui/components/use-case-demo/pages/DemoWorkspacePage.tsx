/**
 * DemoWorkspacePage
 * Landing-demo replica of the real /workspace route
 * (features/webapp/workspace/WorkspacePage.tsx) with static data.
 *
 * Fidelity notes:
 * - Reuses the same shared UI primitives (PageLayout/PageHeader/PageContent/
 *   PageScrollArea, Tabs, DropdownMenu, AlertDialog, Form fields) and the
 *   prop-driven WorkspaceUseCaseCombobox, WorkspaceIcpPainPointsField and
 *   IdealCustomerProfileCard with the same classes and copy.
 * - Convex-backed pieces are replaced with local React state: the workspace
 *   document, agent autonomy setting, plan tier ("free"), and dialogs.
 * - WorkspacePlanLimitAlert is Convex-wired, so its free-tier "Upgrade plan"
 *   output is replicated statically with inert buttons.
 * - WorkspaceRefinePanel (Convex agent session) cannot run anonymously; the
 *   Refine button renders but is inert.
 */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  PageHeader,
  PageLayout,
  PageContent,
  PageScrollArea,
} from "@/features/webapp/ui/components";
import { Button } from "@/shared/ui/components/Button";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { CharacterCounter } from "@/shared/ui/components/CharacterCounter";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/Form";
import { Input } from "@/shared/ui/components/Input";
import { Switch } from "@/shared/ui/components/Switch";
import { Textarea } from "@/shared/ui/components/TextArea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/components/Tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/components/AlertDialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import {
  workspacePageFormSchema,
  type WorkspacePageFormValues,
  ICP_SHORT_DESCRIPTION_MAX,
} from "@/shared/lib/schemas/validation";
import {
  IdealCustomerProfileCard,
  IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME,
} from "@/features/prospects";
import {
  AddIcon,
  ChangeHistoryIcon,
  DeleteIcon,
  EditIcon,
  MoreHorizIcon,
} from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";
import { WorkspaceUseCaseCombobox } from "@/features/webapp/workspace/WorkspaceUseCaseCombobox";
import { WorkspaceIcpPainPointsField } from "@/features/webapp/workspace/WorkspaceIcpPainPointsField";
import {
  getWorkspaceUseCase,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";
import type { UseCaseDemoKey } from "../useCaseDemoData";
import { useDemoShell } from "../demoShellContext";

const workspacePageShellClassName =
  "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col md:flex-row md:items-stretch";
const workspaceMainColumnClassName =
  "max-w-none border-r-0 md:min-w-0 md:flex-1 md:basis-0 md:border-r-0 flex min-h-0 flex-col overflow-hidden";
const workspaceBodyColumnClassName =
  "w-full min-w-0 md:w-[min(32rem,100%)] md:max-w-lg";

const DEMO_WORKSPACE_UPDATED_AT = "2026-01-12T00:00:00.000Z";
const DEMO_DRAFT_PLAN_COUNT = 3;

interface DemoWorkspaceProfile {
  useCaseKey: WorkspaceUseCaseKey;
  seedDescription: string;
  improvedDescription: string;
  sourceUrl: string;
  icps: WorkspacePageFormValues["icps"];
}

/**
 * Workspace setup content per demo use case. Same company (Northstar
 * Analytics) seen through each goal, so every field on the page reflects
 * the active use case instead of a generic B2B SaaS story.
 */
const DEMO_WORKSPACE_PROFILES: Record<UseCaseDemoKey, DemoWorkspaceProfile> = {
  customers: {
    useCaseKey: "customer_prospecting",
    seedDescription:
      "Northstar Analytics is a pipeline analytics tool for B2B SaaS sales teams. It connects to the CRM and shows which deals are stalling and why.",
    improvedDescription:
      "Target: sales leaders (VP Sales, Head of Sales, RevOps) at B2B SaaS companies with 20 to 200 employees using Salesforce or HubSpot. Signals: posts about forecast misses, stalled deals, pipeline reviews, or hiring SDRs. Qualify on ICP fit with a fit score of 70 to 100, recent activity, and clear pain around pipeline visibility. Goal: start a conversation that leads to a booked demo.",
    sourceUrl: "https://northstar-analytics.com",
    icps: [
      {
        title: "VP of Sales at growth-stage SaaS",
        description:
          "Leads a 5 to 20 person sales team at a B2B SaaS company. Owns the number and lives in the CRM, but struggles to see which deals are actually at risk before the forecast slips.",
        painPoints: [
          "Forecast misses at quarter end",
          "No visibility into stalled deals",
          "Reps updating CRM inconsistently",
        ],
        channels: ["X/Twitter", "LinkedIn"],
      },
      {
        title: "Founder running founder-led sales",
        description:
          "Sells directly at an early-stage startup and cannot afford a dedicated RevOps hire. Needs a simple way to see what is in the pipeline and what to follow up on.",
        painPoints: [
          "No time to audit the pipeline",
          "Deals falling through the cracks",
        ],
        channels: ["X/Twitter"],
      },
    ],
  },
  investors: {
    useCaseKey: "investor_outreach",
    seedDescription:
      "Northstar Analytics is a pipeline analytics tool for B2B SaaS sales teams. The team is raising a pre-seed round and reaching out to investors directly.",
    improvedDescription:
      "Target: pre-seed and seed investors (VC partners, angels) who back B2B SaaS and sales tooling. Signals: posts about sales tech, PLG, outbound, or recent SaaS investments. Qualify on thesis fit, check size, stage preference, and recent activity. Goal: start a conversation that leads to a partner meeting.",
    sourceUrl: "https://northstar-analytics.com",
    icps: [
      {
        title: "Pre-seed VC partner backing B2B SaaS",
        description:
          "Invests in B2B software at pre-seed and seed. Reads every deck but only replies when there is a real traction signal in the first message.",
        painPoints: [
          "Inbox full of generic decks",
          "Hard to spot real traction early",
        ],
        channels: ["X/Twitter", "LinkedIn"],
      },
      {
        title: "Angel investor into sales tooling",
        description:
          "Writes small checks into tools they would have used as an operator. Responds to founders who reference their portfolio and thesis specifically.",
        painPoints: [
          "Founders who never did thesis research",
          "Cold pitches with no context",
        ],
        channels: ["X/Twitter"],
      },
    ],
  },
  candidates: {
    useCaseKey: "recruiting",
    seedDescription:
      "Northstar Analytics is a pipeline analytics tool for B2B SaaS sales teams. The team is growing from 6 to 12 people and hiring its first go-to-market and engineering roles.",
    improvedDescription:
      "Target: senior SDRs, growth marketers, and full-stack engineers open to early-stage startups. Signals: posts about job searches, open-to-work updates, layoffs, or building in public. Qualify on role fit, seniority, and visible interest in early-stage work. Goal: start a conversation that leads to an intro call.",
    sourceUrl: "https://northstar-analytics.com",
    icps: [
      {
        title: "Senior SDR open to early-stage",
        description:
          "Two to five years of outbound experience at a SaaS company. Wants more ownership than a big-team SDR role offers, but needs to believe in the product.",
        painPoints: [
          "Burned out on spray-and-pray targets",
          "Wants a real career path, not a script",
        ],
        channels: ["LinkedIn", "X/Twitter"],
      },
      {
        title: "Full-stack engineer building in public",
        description:
          "Ships side projects and posts about them. Strong product sense, gets excited about owning features end to end at an early-stage company.",
        painPoints: [
          "Big-company ticket factories",
          "No ownership over the product",
        ],
        channels: ["X/Twitter"],
      },
    ],
  },
  creators: {
    useCaseKey: "creator_outreach",
    seedDescription:
      "Northstar Analytics is a pipeline analytics tool for B2B SaaS sales teams. The team wants to partner with creators who cover sales, startups, and SaaS growth.",
    improvedDescription:
      "Target: newsletter writers, YouTubers, and podcasters covering B2B sales and startups with 5k to 100k followers. Signals: recent content about prospecting, CRM, or outbound, plus steady engagement. Qualify on audience fit, posting cadence, and topic overlap. Goal: start a conversation that leads to a collaboration or sponsorship.",
    sourceUrl: "https://northstar-analytics.com",
    icps: [
      {
        title: "B2B sales newsletter writer",
        description:
          "Writes a weekly newsletter about sales and GTM for a loyal niche audience. Picks sponsors carefully and only features tools they have actually tried.",
        painPoints: [
          "Irrelevant sponsorship pitches",
          "Sponsors who never read the newsletter",
        ],
        channels: ["X/Twitter", "LinkedIn"],
      },
      {
        title: "Startup podcast host",
        description:
          "Hosts a podcast about building startups. Always looking for guests and tools with a real story, not another pitch deck.",
        painPoints: ["Generic guest pitches", "Sponsors with no story to tell"],
        channels: ["X/Twitter"],
      },
    ],
  },
  job_seekers: {
    useCaseKey: "recruiting",
    seedDescription:
      "A senior growth marketer looking for the next role, using ReacherX to find the people actually hiring instead of applying into the void.",
    improvedDescription:
      "Target: founders, heads of growth, and hiring managers at startups with 10 to 200 employees who are actively hiring for growth roles. Signals: job posts, we-are-hiring threads, and team expansion announcements. Qualify on role fit, company stage, and how recent the signal is. Goal: start a conversation that leads to an interview.",
    sourceUrl: "https://northstar-analytics.com",
    icps: [
      {
        title: "Founder hiring their first growth marketer",
        description:
          "Runs an early-stage startup and is hiring the first growth person. Reads every reply but ignores anything that feels like a mass application.",
        painPoints: [
          "Inbox full of copy-paste applications",
          "No time to run a formal hiring process",
        ],
        channels: ["X/Twitter", "LinkedIn"],
      },
      {
        title: "Head of growth scaling a team",
        description:
          "Building a growth team at a Series A company. Hires people who show they understand the funnel, not people who just list tools on a resume.",
        painPoints: [
          "Resumes that say nothing about outcomes",
          "Candidates who never looked at the product",
        ],
        channels: ["LinkedIn"],
      },
    ],
  },
};

function createDemoWorkspaceFormValues(
  workspaceName: string,
  useCaseKey: UseCaseDemoKey
): WorkspacePageFormValues {
  const profile = DEMO_WORKSPACE_PROFILES[useCaseKey];
  return {
    name: workspaceName,
    useCaseKey: profile.useCaseKey,
    seedDescription: profile.seedDescription,
    improvedDescription: profile.improvedDescription,
    sourceUrl: profile.sourceUrl,
    icps: profile.icps,
  };
}

function trimIcpDraft(icp: WorkspacePageFormValues["icps"][number]) {
  return {
    title: icp.title.trim(),
    description: icp.description.trim(),
    painPoints: icp.painPoints
      .map((painPoint) => painPoint.trim())
      .filter(Boolean),
    channels: icp.channels.filter(Boolean),
  };
}

function icpDraftHasMeaningfulContent(
  icp: ReturnType<typeof trimIcpDraft>
): boolean {
  return Boolean(icp.title || icp.description || icp.painPoints.length > 0);
}

function WorkspaceAgentSettingsRow({
  icon,
  title,
  description,
  control,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  control: ReactNode;
}) {
  return (
    <article className="px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="border-border text-foreground flex size-8 shrink-0 items-center justify-center rounded-md border">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-x-4 md:grid-cols-[minmax(0,1fr)_7.5rem] md:gap-x-8">
            <div className="min-w-0">
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {description}
              </p>
            </div>
            <div className="flex min-w-0 justify-end pt-0.5">{control}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function DemoWorkspacePage() {
  const { activeWorkspace, useCaseKey } = useDemoShell();
  const [activeTab, setActiveTab] = useState<"details" | "profiles" | "agent">(
    "details"
  );
  const [isEditing, setIsEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [autonomyConfirmationOpen, setAutonomyConfirmationOpen] =
    useState(false);

  // Demo is on the paid Base plan at the 2/2 workspace limit: rollback needs
  // a snapshot and workspace creation is capped, so both stay disabled with
  // real tooltips.
  const canRollback = false;
  const canCreateWorkspace = false;
  const workspaceCreationBlockedReason =
    "Workspace limit reached for your current plan.";

  const [persistedValues, setPersistedValues] =
    useState<WorkspacePageFormValues>(() =>
      createDemoWorkspaceFormValues(activeWorkspace.name, useCaseKey)
    );
  const [agentAutonomyMode, setAgentAutonomyMode] = useState<
    "review_required" | "autonomous"
  >("review_required");
  const persistedAgentAutonomyMode = "review_required";
  const isAgentSettingsDirty = agentAutonomyMode !== persistedAgentAutonomyMode;

  const form = useForm<WorkspacePageFormValues>({
    resolver: zodResolver(
      workspacePageFormSchema
    ) as unknown as Resolver<WorkspacePageFormValues>,
    defaultValues: persistedValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { reset } = form;

  useEffect(() => {
    if (isEditing) {
      return;
    }
    reset(persistedValues);
  }, [isEditing, persistedValues, reset]);

  const selectedUseCaseKey = useWatch({
    control: form.control,
    name: "useCaseKey",
  });
  const selectedUseCase = useMemo(
    () => getWorkspaceUseCase(selectedUseCaseKey),
    [selectedUseCaseKey]
  );

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "icps",
  });

  const hasWorkspacePageChanges =
    form.formState.isDirty || isAgentSettingsDirty;
  const isAgentReviewRequired = agentAutonomyMode === "review_required";
  const agentControlsDisabled = !isEditing || form.formState.isSubmitting;

  const formFieldClassName = "space-y-0";
  const formLabelClassName = "mb-2.5 block";
  const formDescriptionClassName = "mt-1.5 text-xs";
  const formMessageClassName = "mt-1.5";

  const saveWorkspaceChanges = useCallback(
    (
      data: WorkspacePageFormValues,
      options: { autonomyConfirmed: boolean }
    ) => {
      const profilesWereEdited =
        Array.isArray(form.formState.dirtyFields.icps) ||
        Boolean(form.formState.dirtyFields.icps);
      const normalizedIcps = data.icps
        .map(trimIcpDraft)
        .filter(icpDraftHasMeaningfulContent);
      const switchingToAutonomous =
        isAgentSettingsDirty && agentAutonomyMode === "autonomous";

      if (profilesWereEdited && normalizedIcps.length < 3) {
        form.setError("icps", {
          type: "manual",
          message: "At least three ideal customer profiles are required.",
        });
        setActiveTab("profiles");
        return;
      }

      if (switchingToAutonomous && !options.autonomyConfirmed) {
        setAutonomyConfirmationOpen(true);
        return;
      }

      const nextValues: WorkspacePageFormValues = {
        ...data,
        name: data.name.trim(),
        seedDescription: data.seedDescription.trim(),
        improvedDescription: data.improvedDescription.trim(),
        sourceUrl: data.sourceUrl?.trim() || "",
        icps: profilesWereEdited
          ? normalizedIcps.map((icp) => ({
              ...icp,
              channels:
                icp.channels.length > 0
                  ? icp.channels
                  : ["X/Twitter", "LinkedIn"],
            }))
          : data.icps,
      };
      setPersistedValues(nextValues);
      reset(nextValues);
      setAutonomyConfirmationOpen(false);
      setIsEditing(false);
    },
    [agentAutonomyMode, form, isAgentSettingsDirty, reset]
  );

  const handleSave = (data: WorkspacePageFormValues) => {
    saveWorkspaceChanges(data, { autonomyConfirmed: false });
  };

  const handleConfirmAutonomy = () => {
    void form.handleSubmit(async (data) => {
      saveWorkspaceChanges(data, { autonomyConfirmed: true });
    })();
  };

  const handleAgentAutonomyChange = (checked: boolean) => {
    setAgentAutonomyMode(checked ? "review_required" : "autonomous");
  };

  function handleFormSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void form.handleSubmit(handleSave)(event);
  }

  function handleDone() {
    void form.handleSubmit(handleSave)();
  }

  const handleStartEditing = () => {
    reset(persistedValues);
    setAgentAutonomyMode(persistedAgentAutonomyMode);
    setIsEditing(true);
  };

  const handleCancel = () => {
    reset(persistedValues);
    setAgentAutonomyMode(persistedAgentAutonomyMode);
    setIsEditing(false);
  };

  const openMenuDialog = useCallback((setOpen: (next: boolean) => void) => {
    window.setTimeout(() => setOpen(true), 0);
  }, []);

  const editedLabel = format(new Date(DEMO_WORKSPACE_UPDATED_AT), "MMM d");
  const hasPersistedSourceUrl = Boolean(persistedValues.sourceUrl?.trim());

  return (
    <>
      <div className={workspacePageShellClassName}>
        <PageLayout className={workspaceMainColumnClassName}>
          <PageHeader
            className="border-b-0"
            title="Workspace"
            titleSuffix={
              <span className="text-muted-foreground ml-1 text-xs font-normal">
                · edited · {editedLabel}
              </span>
            }
            actions={
              isEditing ? (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="xs" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    type="button"
                    onClick={handleDone}
                    disabled={
                      !hasWorkspacePageChanges || form.formState.isSubmitting
                    }
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleStartEditing}
                  >
                    <EditIcon className="fill-current" />
                    Edit
                  </Button>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="xsIcon"
                        variant="outline"
                        aria-label="Workspace menu"
                      >
                        <MoreHorizIcon className="fill-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-48">
                      <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={!canRollback}
                        title={
                          !canRollback
                            ? "Available on Base and Pro after you refine your audience."
                            : undefined
                        }
                      >
                        <ChangeHistoryIcon className="fill-current" />
                        Rollback
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onSelect={() => openMenuDialog(setDeleteOpen)}
                      >
                        <DeleteIcon className="fill-current" />
                        Delete
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={!canCreateWorkspace}
                        title={
                          !canCreateWorkspace
                            ? workspaceCreationBlockedReason
                            : undefined
                        }
                      >
                        <AddIcon className="fill-current" />
                        New workspace
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            }
          />

          <Tabs
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            value={activeTab}
            onValueChange={(v) =>
              setActiveTab(v as "details" | "profiles" | "agent")
            }
          >
            <div className="border-border shrink-0 border-b">
              <div className="scroll-fade-x scrollbar-none overflow-x-auto [overflow-y:clip] px-4 [&::-webkit-scrollbar]:hidden">
                <TabsList variant="underline">
                  <TabsTrigger value="details" variant="underline">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="profiles" variant="underline">
                    Profiles
                  </TabsTrigger>
                  <TabsTrigger value="agent" variant="underline">
                    Agent
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <PageScrollArea
              className={cn("pb-24", activeTab === "agent" ? "pt-0" : "pt-4")}
            >
              <PageContent className={workspaceBodyColumnClassName}>
                <div className="px-4">
                  <TabsContent value="details" className="mt-0">
                    {isEditing ? (
                      <Alert className="mb-4">
                        <AlertTitle>Note</AlertTitle>
                        <AlertDescription>
                          Changing the workspace affects how the agent finds
                          people. For a different product or use case, create a
                          new workspace.
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    <Form {...form}>
                      <form
                        id="workspace-settings-form"
                        className="space-y-4"
                        onSubmit={handleFormSubmit}
                      >
                        {!isEditing ? (
                          <FormField
                            control={form.control}
                            name="useCaseKey"
                            render={({ field }) => (
                              <FormItem className={formFieldClassName}>
                                <WorkspaceUseCaseCombobox
                                  value={
                                    (field.value ??
                                      DEMO_WORKSPACE_PROFILES[useCaseKey]
                                        .useCaseKey) as WorkspaceUseCaseKey
                                  }
                                  onValueChange={field.onChange}
                                  disabled
                                />
                                <FormMessage className={formMessageClassName} />
                              </FormItem>
                            )}
                          />
                        ) : null}

                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className={formFieldClassName}>
                              <FormLabel className={formLabelClassName}>
                                Name
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  disabled={!isEditing}
                                />
                              </FormControl>
                              <FormMessage className={formMessageClassName} />
                            </FormItem>
                          )}
                        />

                        {hasPersistedSourceUrl ? (
                          <FormField
                            control={form.control}
                            name="sourceUrl"
                            render={({ field }) => (
                              <FormItem className={formFieldClassName}>
                                <FormLabel className={formLabelClassName}>
                                  Source URL
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    disabled={!isEditing}
                                    placeholder="https://"
                                  />
                                </FormControl>
                                <FormMessage className={formMessageClassName} />
                              </FormItem>
                            )}
                          />
                        ) : null}

                        {!isEditing ? (
                          <FormField
                            control={form.control}
                            name="seedDescription"
                            render={({ field }) => (
                              <FormItem className={formFieldClassName}>
                                <FormLabel className={formLabelClassName}>
                                  Description
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    value={field.value ?? ""}
                                    readOnly
                                    rows={4}
                                    autoResize={!isEditing}
                                    className={cn(
                                      "resize-y",
                                      !isEditing && "overflow-hidden"
                                    )}
                                    disabled={!isEditing}
                                  />
                                </FormControl>
                                <FormDescription
                                  className={formDescriptionClassName}
                                >
                                  Seed description (manual or from URL).
                                </FormDescription>
                                <FormMessage className={formMessageClassName} />
                              </FormItem>
                            )}
                          />
                        ) : null}

                        <FormField
                          control={form.control}
                          name="improvedDescription"
                          render={({ field }) => (
                            <FormItem className={formFieldClassName}>
                              <FormLabel className={formLabelClassName}>
                                Agent-generated description
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  value={field.value ?? ""}
                                  disabled={!isEditing}
                                  rows={4}
                                  autoResize={!isEditing}
                                  className={cn(
                                    "resize-y",
                                    !isEditing && "overflow-hidden"
                                  )}
                                />
                              </FormControl>
                              <FormDescription
                                className={formDescriptionClassName}
                              >
                                Used by the △ Agent to find{" "}
                                {
                                  selectedUseCase.promptContext.terminology
                                    .entityPlural
                                }
                                .
                              </FormDescription>
                              <FormMessage className={formMessageClassName} />
                            </FormItem>
                          )}
                        />

                        {isEditing ? (
                          <div className="border-border -mx-4 space-y-2 border-t px-4 pt-4">
                            <div>
                              <p className="text-sm font-medium">
                                Refine audience
                              </p>
                              <p className="text-muted-foreground text-sm">
                                Tweak your description to improve who the agent
                                finds. This regenerates your profiles.
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled
                              title="Refine is not available in this demo."
                            >
                              Refine
                            </Button>
                          </div>
                        ) : null}
                      </form>
                    </Form>
                  </TabsContent>

                  <TabsContent value="profiles" className="mt-0">
                    {isEditing ? (
                      <Alert>
                        <AlertTitle>Note</AlertTitle>
                        <AlertDescription>
                          Editing profiles updates how the agent qualifies
                          prospects.
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    {!isEditing ? (
                      <div className="flex flex-col gap-3">
                        {persistedValues.icps.map((icp, i) => (
                          <IdealCustomerProfileCard
                            key={`${icp.title}-${i}`}
                            profile={icp}
                            className={IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME}
                          />
                        ))}
                      </div>
                    ) : (
                      <Form {...form}>
                        <div className="space-y-0">
                          {fields.map((field, index) => (
                            <div
                              key={field.id}
                              className="border-border -mx-4 border-b px-4 py-4 last:border-b-0"
                            >
                              <div className="mb-4 flex items-center justify-between">
                                <span className="text-muted-foreground text-sm">
                                  Profile · #
                                  <AnimatedNumber
                                    value={index + 1}
                                    animateOnMount
                                  />
                                </span>
                                <Button
                                  type="button"
                                  size="xsIcon"
                                  variant="ghost"
                                  disabled={index < 3}
                                  title={
                                    index < 3
                                      ? "The first three profiles cannot be deleted."
                                      : "Delete profile"
                                  }
                                  onClick={() => {
                                    if (index >= 3) remove(index);
                                  }}
                                >
                                  <DeleteIcon className="fill-current" />
                                </Button>
                              </div>
                              <div className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name={`icps.${index}.title`}
                                  render={({ field: f }) => (
                                    <FormItem className={formFieldClassName}>
                                      <FormLabel className={formLabelClassName}>
                                        Name
                                      </FormLabel>
                                      <FormControl>
                                        <Input {...f} value={f.value ?? ""} />
                                      </FormControl>
                                      <FormMessage
                                        className={formMessageClassName}
                                      />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`icps.${index}.description`}
                                  render={({ field: f }) => (
                                    <FormItem className={formFieldClassName}>
                                      <FormLabel className={formLabelClassName}>
                                        Short description
                                      </FormLabel>
                                      <FormControl>
                                        <Textarea
                                          {...f}
                                          value={f.value ?? ""}
                                          rows={3}
                                          maxLength={ICP_SHORT_DESCRIPTION_MAX}
                                          className="resize-y"
                                        />
                                      </FormControl>
                                      <FormDescription
                                        className={formDescriptionClassName}
                                      >
                                        <CharacterCounter
                                          current={f.value?.length ?? 0}
                                          max={ICP_SHORT_DESCRIPTION_MAX}
                                        />
                                      </FormDescription>
                                      <FormMessage
                                        className={formMessageClassName}
                                      />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`icps.${index}.painPoints`}
                                  render={({ field: f }) => (
                                    <FormItem className={formFieldClassName}>
                                      <FormLabel className={formLabelClassName}>
                                        Pain points ·{" "}
                                        <AnimatedNumber
                                          value={f.value?.length ?? 0}
                                        />
                                      </FormLabel>
                                      <FormControl>
                                        <WorkspaceIcpPainPointsField
                                          value={f.value ?? []}
                                          onChange={f.onChange}
                                        />
                                      </FormControl>
                                      <FormMessage
                                        className={formMessageClassName}
                                      />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            className="mt-4"
                            onClick={() =>
                              append({
                                title: "",
                                description: "",
                                painPoints: [],
                                channels: ["X/Twitter", "LinkedIn"],
                              })
                            }
                          >
                            <AddIcon className="fill-current" />
                            Add profile
                          </Button>
                        </div>
                      </Form>
                    )}
                  </TabsContent>

                  <TabsContent value="agent" className="mt-0">
                    <section className="-mx-4">
                      <WorkspaceAgentSettingsRow
                        icon={
                          <ChangeHistoryIcon
                            className="size-4 fill-current"
                            aria-hidden="true"
                          />
                        }
                        title="Ask before sending"
                        description={
                          <>
                            When off, existing and future plans start
                            automatically, and replies or DMs can send without
                            review.
                          </>
                        }
                        control={
                          <Switch
                            checked={isAgentReviewRequired}
                            disabled={agentControlsDisabled}
                            aria-label="Toggle ask before sending"
                            onCheckedChange={handleAgentAutonomyChange}
                          />
                        }
                      />
                    </section>
                  </TabsContent>
                </div>
              </PageContent>
            </PageScrollArea>
          </Tabs>
        </PageLayout>
      </div>

      <AlertDialog
        open={autonomyConfirmationOpen}
        onOpenChange={setAutonomyConfirmationOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off sending approvals?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {`This will gradually start ${DEMO_DRAFT_PLAN_COUNT.toLocaleString()} existing draft outreach plans.`}
              </span>
              <span className="block">
                Replies and DMs may send without further approval. Wait steps
                and requests for your input will still pause normally.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep approvals on</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirmAutonomy();
              }}
            >
              Turn off and start plans
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all prospects, archives, and stats for
              this workspace and sends you back to setup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setDeleteOpen(false)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
