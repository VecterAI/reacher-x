"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  IdealCustomerProfileCard,
  IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME,
} from "@/features/prospects/ui/components/ideal-customer-profile";
import { PageContent } from "@/features/webapp/ui/components/page/PageContent";
import { PageHeader } from "@/features/webapp/ui/components/page/PageHeader";
import { PageLayout } from "@/features/webapp/ui/components/page/PageLayout";
import { PageScrollArea } from "@/features/webapp/ui/components/page/PageScrollArea";
import { WorkspaceIcpPainPointsField } from "@/features/webapp/workspace/WorkspaceIcpPainPointsField";
import { cn } from "@/shared/lib/utils";
import {
  ICP_SHORT_DESCRIPTION_MAX,
  workspaceProfileReviewFormSchema,
  type WorkspaceProfileReviewFormValues,
} from "@/shared/lib/schemas/validation";
import {
  canonicalizeWorkspaceProfileChannels,
  WORKSPACE_PROFILE_CHANNELS,
} from "@/shared/lib/workspaceProfileChannels";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import { CharacterCounter } from "@/shared/ui/components/CharacterCounter";
import { Checkbox } from "@/shared/ui/components/Checkbox";
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
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Textarea } from "@/shared/ui/components/TextArea";
import { AddIcon, DeleteIcon } from "@/shared/ui/components/icons";

const PANEL_SHELL_CLASS_NAME =
  "bg-background flex h-full min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden md:min-w-0";
/** Matches WorkspacePage form spacing conventions. */
const FORM_FIELD_CLASS_NAME = "min-w-0 max-w-full space-y-0";
const FORM_LABEL_CLASS_NAME = "mb-2.5 block";
const FORM_DESCRIPTION_CLASS_NAME = "mt-1.5 text-xs";
const FORM_MESSAGE_CLASS_NAME = "mt-1.5";

export type WorkspaceProfileReviewPreviewProposal = {
  profileLabelPlural: string;
  proposedProfiles: Array<{
    title: string;
    description: string;
    painPoints: string[];
    channels: string[];
  }>;
  addedTitles?: string[];
  updatedTitles?: string[];
  removedTitles?: string[];
};

export type WorkspaceProfileReviewSetupProposal = {
  sessionId: Id<"workspaceSetupSessions">;
  revision: number;
  profileLabelPlural: string;
  proposedProfiles: WorkspaceProfileReviewPreviewProposal["proposedProfiles"];
  errorMessage?: string | null;
};

export interface WorkspaceProfileReviewPanelProps {
  /** Real Convex request. Omit when `previewProposal` is provided (mock/setup preview). */
  requestId?: string;
  onClose: () => void;
  className?: string;
  /**
   * Prop-driven proposal for visual mocks / setup preview without a Convex
   * request. Same panel chrome + form as the live agent profile proposal.
   */
  previewProposal?: WorkspaceProfileReviewPreviewProposal;
  /** Live setup proposal. Approving saves edits and advances setup atomically. */
  setupProposal?: WorkspaceProfileReviewSetupProposal;
  /**
   * Chat-first setup: approve ICPs by sending a message in the thread so the
   * agent picks it up and responds.  When provided, the panel uses this
   * callback instead of calling `approveSetupIcps` directly.
   */
  onApproveIdealProfiles?: () => Promise<void>;
}

function normalizeProfilesForForm(
  profiles: Array<{
    title: string;
    description: string;
    painPoints: string[];
    channels: string[];
  }>
): WorkspaceProfileReviewFormValues["icps"] {
  return profiles.map((profile) => ({
    title: profile.title,
    description: profile.description,
    painPoints: [...profile.painPoints],
    channels: canonicalizeWorkspaceProfileChannels(profile.channels),
  }));
}

function WorkspaceProfileReviewPanelSkeleton({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  return (
    <aside className={cn(PANEL_SHELL_CLASS_NAME, className)}>
      <PageLayout className="flex h-full flex-col md:w-full">
        <PageHeader title="Profiles" onBack={onClose} />
        <div className="space-y-3 px-4 py-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageLayout>
    </aside>
  );
}

export function WorkspaceProfileReviewPanel({
  requestId,
  onClose,
  className,
  previewProposal,
  setupProposal,
  onApproveIdealProfiles,
}: WorkspaceProfileReviewPanelProps) {
  const isPreview = Boolean(previewProposal);
  const isSetupProposal = Boolean(setupProposal);
  const proposalFromQuery = useQuery(
    api.workspaceProfileChanges.getWorkspaceProfileChange,
    isPreview || isSetupProposal || !requestId
      ? "skip"
      : { requestId: requestId as Id<"workspaceProfileChangeRequests"> }
  );
  const propDrivenProposal = setupProposal ?? previewProposal;
  const proposal = propDrivenProposal
    ? {
        status: "pending_approval" as const,
        revision: setupProposal?.revision ?? 1,
        profileLabelPlural: propDrivenProposal.profileLabelPlural,
        proposedProfiles: propDrivenProposal.proposedProfiles,
        addedTitles:
          previewProposal?.addedTitles ??
          propDrivenProposal.proposedProfiles.map((profile) => profile.title),
        updatedTitles: previewProposal?.updatedTitles ?? [],
        removedTitles: previewProposal?.removedTitles ?? [],
        removedProfiles: [] as Array<{
          title: string;
          description: string;
          painPoints: string[];
          channels: string[];
        }>,
      }
    : proposalFromQuery;
  const approveProposal = useMutation(
    api.workspaceProfileChanges.approveWorkspaceProfileChange
  );
  const approveSetupProposal = useMutation(api.setupSessions.approveSetupIcps);
  const form = useForm<WorkspaceProfileReviewFormValues>({
    resolver: zodResolver(
      workspaceProfileReviewFormSchema
    ) as Resolver<WorkspaceProfileReviewFormValues>,
    defaultValues: { icps: [] },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { append, fields, remove } = useFieldArray({
    control: form.control,
    name: "icps",
  });
  const loadedRevisionRef = React.useRef<number | null>(null);
  const [proposalUpdatedWhileEditing, setProposalUpdatedWhileEditing] =
    React.useState(false);
  const proposalRevision = proposal?.revision ?? null;
  const proposedProfiles = proposal?.proposedProfiles ?? null;

  React.useEffect(() => {
    if (
      proposalRevision === null ||
      !proposedProfiles ||
      loadedRevisionRef.current === proposalRevision
    ) {
      return;
    }
    if (loadedRevisionRef.current !== null && form.formState.isDirty) {
      setProposalUpdatedWhileEditing(true);
      return;
    }

    form.reset({ icps: normalizeProfilesForForm(proposedProfiles) });
    loadedRevisionRef.current = proposalRevision;
    setProposalUpdatedWhileEditing(false);
  }, [form, proposalRevision, proposedProfiles]);

  if (proposal === undefined) {
    return (
      <WorkspaceProfileReviewPanelSkeleton
        onClose={onClose}
        className={className}
      />
    );
  }

  if (!proposal) {
    return (
      <aside className={cn(PANEL_SHELL_CLASS_NAME, className)}>
        <PageLayout className="flex h-full flex-col md:w-full">
          <PageHeader title="Profiles" onBack={onClose} />
          <PageContent className="px-4 py-4">
            <Alert variant="destructive">
              <AlertTitle>Proposal unavailable</AlertTitle>
              <AlertDescription>
                This workspace profile proposal could not be loaded.
              </AlertDescription>
            </Alert>
          </PageContent>
        </PageLayout>
      </aside>
    );
  }

  const isPending = proposal.status === "pending_approval";
  const addedTitles = new Set(proposal.addedTitles);
  const updatedTitles = new Set(proposal.updatedTitles);
  const label = proposal.profileLabelPlural;

  const handleApprove = form.handleSubmit(async (data) => {
    if (!isPending || proposalUpdatedWhileEditing) {
      return;
    }

    if (isPreview) {
      toast.success(`${label} updated`);
      onClose();
      return;
    }

    const proposedProfiles = data.icps.map((profile) => ({
      title: profile.title.trim(),
      description: profile.description.trim(),
      painPoints: profile.painPoints
        .map((painPoint) => painPoint.trim())
        .filter(Boolean),
      channels: profile.channels,
    }));

    try {
      if (setupProposal) {
        // Chat-first setup: send approval through the thread so the agent
        // picks it up and responds, instead of directly mutating the session.
        if (onApproveIdealProfiles) {
          await onApproveIdealProfiles();
          onClose();
          return;
        }

        await approveSetupProposal({
          sessionId: setupProposal.sessionId,
          generatedProfiles: proposedProfiles,
        });
        toast.success(`${label} approved`);
        onClose();
        return;
      }

      if (!requestId) {
        throw new Error("Profile proposal is unavailable.");
      }

      const result = await approveProposal({
        requestId: requestId as Id<"workspaceProfileChangeRequests">,
        expectedRevision: loadedRevisionRef.current ?? proposal.revision,
        proposedIcps: proposedProfiles,
      });

      if (result.outcome === "applied") {
        toast.success(`${label} updated`);
        onClose();
        return;
      }
      if (result.outcome === "stale") {
        toast.error("Workspace changed", {
          description: "Ask Agent to prepare a fresh proposal, then try again.",
        });
        return;
      }
      if (result.outcome === "superseded") {
        setProposalUpdatedWhileEditing(true);
        toast.error("Newer proposal available", {
          description:
            "Close and open the proposal again to load the latest one.",
        });
        return;
      }

      toast.error("This proposal is no longer pending.");
    } catch (error) {
      toast.error("Could not update workspace", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  });

  const statusAlert =
    proposal.status === "applied"
      ? {
          variant: "default" as const,
          title: "Changes applied",
          description: "These profiles are already saved to the workspace.",
        }
      : proposal.status === "rejected"
        ? {
            variant: "destructive" as const,
            title: "Proposal rejected",
            description: "This proposal was rejected and cannot be applied.",
          }
        : proposal.status === "stale"
          ? {
              variant: "destructive" as const,
              title: "Workspace changed",
              description: "Ask Agent to prepare a fresh proposal.",
            }
          : null;

  return (
    <aside
      aria-label="Review workspace profile changes"
      className={cn(PANEL_SHELL_CLASS_NAME, className)}
    >
      <PageLayout className="flex h-full flex-col md:w-full">
        <PageHeader
          title="Profiles"
          titleSuffix={
            <span className="text-muted-foreground ml-1 text-xs font-normal">
              · Agent proposal
            </span>
          }
          onBack={onClose}
          actions={
            isPending ? (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={onClose}
                  disabled={form.formState.isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="xs"
                  onClick={() => void handleApprove()}
                  disabled={
                    proposalUpdatedWhileEditing || form.formState.isSubmitting
                  }
                >
                  {form.formState.isSubmitting ? "Approving..." : "Approve"}
                </Button>
              </div>
            ) : null
          }
        />

        <PageScrollArea className="pt-4 pb-24">
          <PageContent className="space-y-4 px-4">
            {setupProposal?.errorMessage ? (
              <Alert variant="destructive">
                <AlertTitle>Preview could not start</AlertTitle>
                <AlertDescription>
                  {setupProposal.errorMessage}
                </AlertDescription>
              </Alert>
            ) : null}

            {isPending ? (
              <Alert>
                <AlertTitle>Note</AlertTitle>
                <AlertDescription>
                  Review and edit the {label.toLowerCase()} Agent proposed.
                  Nothing is saved until you click Approve.
                </AlertDescription>
              </Alert>
            ) : null}

            {statusAlert ? (
              <Alert variant={statusAlert.variant}>
                <AlertTitle>{statusAlert.title}</AlertTitle>
                <AlertDescription>{statusAlert.description}</AlertDescription>
              </Alert>
            ) : null}

            {proposalUpdatedWhileEditing ? (
              <Alert variant="destructive">
                <AlertTitle>Newer proposal available</AlertTitle>
                <AlertDescription>
                  Close and open the proposal again so your edits do not
                  overwrite the latest one.
                </AlertDescription>
              </Alert>
            ) : null}

            {!isPending ? (
              <div className="flex flex-col gap-3">
                {proposal.proposedProfiles.map((profile, index) => (
                  <IdealCustomerProfileCard
                    key={`${profile.title}-${index}`}
                    profile={profile}
                    className={IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME}
                  />
                ))}
              </div>
            ) : (
              <Form {...form}>
                <form
                  className="max-w-full min-w-0 space-y-0"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleApprove();
                  }}
                >
                  {fields.map((field, index) => {
                    const currentTitle = form.getValues(`icps.${index}.title`);
                    const changeLabel = addedTitles.has(currentTitle)
                      ? "New"
                      : updatedTitles.has(currentTitle)
                        ? "Updated"
                        : null;

                    return (
                      <div
                        key={field.id}
                        className="border-border -mx-4 max-w-[calc(100%+2rem)] min-w-0 border-b px-4 py-4 last:border-b-0"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-2 text-sm">
                            <span>
                              Profile · #
                              <AnimatedNumber
                                value={index + 1}
                                animateOnMount
                              />
                            </span>
                            {changeLabel ? (
                              <Badge variant="outline" className="font-normal">
                                {changeLabel}
                              </Badge>
                            ) : null}
                          </span>
                          <Button
                            type="button"
                            size="xsIcon"
                            variant="ghost"
                            aria-label={`Delete profile ${index + 1}`}
                            disabled={fields.length <= 3}
                            title={
                              fields.length <= 3
                                ? "At least three profiles are required."
                                : "Delete profile"
                            }
                            onClick={() => remove(index)}
                          >
                            <DeleteIcon className="fill-current" />
                          </Button>
                        </div>

                        <div className="max-w-full min-w-0 space-y-4">
                          <FormField
                            control={form.control}
                            name={`icps.${index}.title`}
                            render={({ field: profileField }) => (
                              <FormItem className={FORM_FIELD_CLASS_NAME}>
                                <FormLabel className={FORM_LABEL_CLASS_NAME}>
                                  Name
                                </FormLabel>
                                <FormControl>
                                  <Input {...profileField} />
                                </FormControl>
                                <FormMessage
                                  className={FORM_MESSAGE_CLASS_NAME}
                                />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`icps.${index}.description`}
                            render={({ field: profileField }) => (
                              <FormItem className={FORM_FIELD_CLASS_NAME}>
                                <FormLabel className={FORM_LABEL_CLASS_NAME}>
                                  Short description
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...profileField}
                                    rows={3}
                                    maxLength={ICP_SHORT_DESCRIPTION_MAX}
                                    className="resize-y"
                                  />
                                </FormControl>
                                <FormDescription
                                  className={FORM_DESCRIPTION_CLASS_NAME}
                                >
                                  <CharacterCounter
                                    current={profileField.value.length}
                                    max={ICP_SHORT_DESCRIPTION_MAX}
                                  />
                                </FormDescription>
                                <FormMessage
                                  className={FORM_MESSAGE_CLASS_NAME}
                                />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`icps.${index}.painPoints`}
                            render={({ field: profileField }) => (
                              <FormItem className={FORM_FIELD_CLASS_NAME}>
                                <FormLabel className={FORM_LABEL_CLASS_NAME}>
                                  Pain points ·{" "}
                                  <AnimatedNumber
                                    value={profileField.value.length}
                                  />
                                </FormLabel>
                                <FormControl>
                                  <WorkspaceIcpPainPointsField
                                    value={profileField.value}
                                    onChange={profileField.onChange}
                                  />
                                </FormControl>
                                <FormMessage
                                  className={FORM_MESSAGE_CLASS_NAME}
                                />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`icps.${index}.channels`}
                            render={({ field: profileField }) => (
                              <FormItem className={FORM_FIELD_CLASS_NAME}>
                                <FormLabel className={FORM_LABEL_CLASS_NAME}>
                                  Channels
                                </FormLabel>
                                <div className="flex flex-wrap gap-x-6 gap-y-2">
                                  {WORKSPACE_PROFILE_CHANNELS.map((channel) => (
                                    <label
                                      key={channel}
                                      className="flex cursor-pointer items-center gap-2 text-sm"
                                    >
                                      <Checkbox
                                        checked={profileField.value.includes(
                                          channel
                                        )}
                                        onCheckedChange={(checked) => {
                                          profileField.onChange(
                                            checked
                                              ? [...profileField.value, channel]
                                              : profileField.value.filter(
                                                  (value) => value !== channel
                                                )
                                          );
                                        }}
                                      />
                                      {channel}
                                    </label>
                                  ))}
                                </div>
                                <FormMessage
                                  className={FORM_MESSAGE_CLASS_NAME}
                                />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}

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
                        channels: [...WORKSPACE_PROFILE_CHANNELS],
                      })
                    }
                  >
                    <AddIcon className="fill-current" />
                    Add profile
                  </Button>
                </form>
              </Form>
            )}

            {isPending && proposal.removedProfiles.length > 0 ? (
              <section className="border-border -mx-4 space-y-2 border-t px-4 pt-4">
                <div>
                  <p className="text-sm font-medium">Removed</p>
                  <p className="text-muted-foreground text-sm">
                    Restore a profile to keep it in the workspace.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {proposal.removedProfiles.map((profile) => (
                    <Button
                      key={profile.title}
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        append(normalizeProfilesForForm([profile])[0])
                      }
                    >
                      <AddIcon className="fill-current" />
                      Restore {profile.title}
                    </Button>
                  ))}
                </div>
              </section>
            ) : null}
          </PageContent>
        </PageScrollArea>
      </PageLayout>
    </aside>
  );
}
