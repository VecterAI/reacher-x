"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { api } from "@/convex/_generated/api";
import {
  PageHeader,
  PageLayout,
  PageContent,
  PageScrollArea,
} from "@/features/webapp/ui/components";
import { WorkspacePlanLimitAlert } from "@/features/billing/ui/components/WorkspacePlanLimitAlert";
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
import { useAuth } from "@/shared/hooks/useAuth";
import { useQueryWithStatus } from "@/shared/hooks";
import { toast } from "sonner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { logger } from "@/shared/lib/logger";
import {
  workspacePageFormSchema,
  type WorkspacePageFormValues,
  ICP_SHORT_DESCRIPTION_MAX,
} from "@/shared/lib/schemas/validation";
import { useNewWorkspaceDraftFlow } from "@/features/webapp/hooks/useNewWorkspaceDraftFlow";
import { setPreferredShellContext } from "@/shared/stores/preferredShellContext";
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
import {
  AGENT_GENERATED_PROFILE_LABEL,
  resolveWorkspaceProfileProvenance,
} from "@/shared/lib/workspaceProfileProvenance";
import { WorkspaceUseCaseCombobox } from "./WorkspaceUseCaseCombobox";
import { WorkspaceIcpPainPointsField } from "./WorkspaceIcpPainPointsField";
import { workspaceDocToFormValues } from "./workspaceFormDefaults";
import {
  DEFAULT_WORKSPACE_USE_CASE_KEY,
  getWorkspaceUseCase,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";
import { WorkspacePageSkeleton } from "./WorkspacePageSkeleton";
import {
  getWorkspaceDeletionToastId,
  WORKSPACE_DELETION_TOAST_COPY,
} from "@/shared/lib/workspaceDeletionToast";

const workspacePageShellClassName =
  "flex h-full min-h-0 w-full flex-1 flex-col md:flex-row md:items-stretch";
const workspaceMainColumnClassName =
  "max-w-none border-r-0 md:min-w-0 md:flex-1 md:basis-0 md:border-r-0 flex min-h-0 flex-col overflow-hidden";
const workspaceBodyColumnClassName =
  "w-full min-w-0 md:w-[min(32rem,100%)] md:max-w-lg";

function createEmptyWorkspaceFormValues(): WorkspacePageFormValues {
  return {
    name: "",
    useCaseKey: DEFAULT_WORKSPACE_USE_CASE_KEY as WorkspaceUseCaseKey,
    rawUserDescription: "",
    improvedDescription: "",
    sourceUrl: "",
    icps: Array.from({ length: 1 }, () => ({
      title: "",
      description: "",
      painPoints: [],
      channels: [],
      provenance: "manual" as const,
    })),
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
    provenance: icp.provenance,
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

export default function WorkspacePage() {
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    workspace,
    error: authError,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<"details" | "profiles" | "agent">(
    "details"
  );
  const [isEditing, setIsEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [autonomyConfirmationOpen, setAutonomyConfirmationOpen] =
    useState(false);
  const userWorkspaces = useQuery(
    api.workspaces.getUserWorkspaces,
    isAuthenticated ? {} : "skip"
  );
  const workspaceAgentSettings = useQuery(
    api.workspaces.getWorkspaceAgentSettings,
    isAuthenticated && workspace ? { workspaceId: workspace._id } : "skip"
  );
  const workspacePlanStartPreview = useQuery(
    api.workspacePlanStarts.getWorkspacePlanStartPreviewQuery,
    isAuthenticated && workspace ? { workspaceId: workspace._id } : "skip"
  );

  const updateWorkspaceSettings = useMutation(
    api.workspaces.updateWorkspaceSettings
  );
  const updateWorkspaceAgentSettings = useMutation(
    api.workspaces.updateWorkspaceAgentSettings
  );
  const regenerateWorkspaceTargeting = useAction(
    api.workspaceSettingsActions.regenerateWorkspaceTargeting
  );
  const deleteWorkspace = useMutation(api.workspaces.deleteWorkspace);

  const workspaceCreationEligibilityQuery = useQueryWithStatus(
    api.plans.getWorkspaceCreationEligibility,
    isAuthenticated ? {} : "skip"
  );
  const workspaceCreationEligibility = workspaceCreationEligibilityQuery.data;
  const { modal, requestNewWorkspace } = useNewWorkspaceDraftFlow({
    enabled: isAuthenticated,
  });

  const defaultValues = useMemo(
    () =>
      workspace
        ? workspaceDocToFormValues(workspace)
        : createEmptyWorkspaceFormValues(),
    [workspace]
  );
  const workspaceFormVersion = workspace
    ? `${workspace._id}:${workspace.updatedAt}`
    : workspace === null
      ? "no-workspace"
      : "loading";
  const lastSyncedWorkspaceVersionRef = useRef<string | null>(null);
  const formFieldClassName = "space-y-0";
  const formLabelClassName = "mb-2.5 block";
  const formDescriptionClassName = "mt-1.5 text-xs";
  const formMessageClassName = "mt-1.5";
  const workspaceFormId = "workspace-settings-form";

  const form = useForm<WorkspacePageFormValues>({
    resolver: zodResolver(
      workspacePageFormSchema
    ) as unknown as Resolver<WorkspacePageFormValues>,
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { reset } = form;

  useEffect(() => {
    if (isEditing) {
      return;
    }
    if (lastSyncedWorkspaceVersionRef.current === workspaceFormVersion) {
      return;
    }

    reset(defaultValues);
    lastSyncedWorkspaceVersionRef.current = workspaceFormVersion;
  }, [defaultValues, isEditing, reset, workspaceFormVersion]);
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
  const [agentAutonomyMode, setAgentAutonomyMode] = useState<
    "review_required" | "autonomous"
  >("review_required");
  const [isSavingAgentSettings, setIsSavingAgentSettings] = useState(false);
  const persistedAgentAutonomyMode =
    workspaceAgentSettings?.autonomyMode ?? "review_required";
  const isAgentSettingsDirty = agentAutonomyMode !== persistedAgentAutonomyMode;
  const switchingToAutonomous =
    isAgentSettingsDirty &&
    persistedAgentAutonomyMode !== "autonomous" &&
    agentAutonomyMode === "autonomous";
  const hasWorkspacePageChanges =
    form.formState.isDirty || isAgentSettingsDirty;
  const isAgentReviewRequired = agentAutonomyMode === "review_required";
  const agentControlsDisabled =
    !isEditing || form.formState.isSubmitting || isSavingAgentSettings;

  useEffect(() => {
    if (isEditing) {
      return;
    }

    if (!workspaceAgentSettings) {
      return;
    }

    setAgentAutonomyMode(workspaceAgentSettings.autonomyMode);
  }, [isEditing, workspaceAgentSettings]);

  const persistAgentSettings = useCallback(
    async ({
      autonomyMode,
      startExistingDraftPlans = false,
    }: {
      autonomyMode?: "review_required" | "autonomous";
      startExistingDraftPlans?: boolean;
    }) => {
      if (!workspace) return null;
      setIsSavingAgentSettings(true);
      try {
        return await updateWorkspaceAgentSettings({
          workspaceId: workspace._id,
          autonomyMode,
          startExistingDraftPlans,
        });
      } finally {
        setIsSavingAgentSettings(false);
      }
    },
    [updateWorkspaceAgentSettings, workspace]
  );

  const saveWorkspaceChanges = async (
    data: WorkspacePageFormValues,
    options: { autonomyConfirmed: boolean }
  ) => {
    if (!workspace) return "failed" as const;
    const workspaceFormHasChanges = form.formState.isDirty;
    const rawDescriptionChanged = Boolean(
      form.formState.dirtyFields.rawUserDescription
    );
    const profilesWereEdited =
      Array.isArray(form.formState.dirtyFields.icps) ||
      Boolean(form.formState.dirtyFields.icps);
    const normalizedIcps = data.icps
      .map(trimIcpDraft)
      .filter(icpDraftHasMeaningfulContent);
    const agentSettingsChanged =
      agentAutonomyMode !== persistedAgentAutonomyMode;
    if (profilesWereEdited && normalizedIcps.length < 1) {
      form.setError("icps", {
        type: "manual",
        message: "At least one ideal profile is required.",
      });
      setActiveTab("profiles");
      return "failed" as const;
    }

    if (switchingToAutonomous && !options.autonomyConfirmed) {
      setAutonomyConfirmationOpen(true);
      return "confirmation_required" as const;
    }

    try {
      const saveOperations: Promise<unknown>[] = [];

      let regeneratedTargeting:
        | Awaited<ReturnType<typeof regenerateWorkspaceTargeting>>
        | undefined;

      if (workspaceFormHasChanges && !rawDescriptionChanged) {
        const mutationArgs: Parameters<typeof updateWorkspaceSettings>[0] = {
          workspaceId: workspace._id,
          name: data.name.trim(),
          useCaseKey: data.useCaseKey,
          sourceUrl: data.sourceUrl?.trim() || undefined,
          descriptionSource: data.sourceUrl?.trim() ? "url" : "manual",
        };

        if (profilesWereEdited) {
          mutationArgs.icps = normalizedIcps.map((icp) => ({
            ...icp,
            channels:
              icp.channels.length > 0
                ? icp.channels
                : ["X/Twitter", "LinkedIn"],
          }));
        }

        saveOperations.push(updateWorkspaceSettings(mutationArgs));
      }

      if (agentSettingsChanged && !rawDescriptionChanged) {
        saveOperations.push(
          persistAgentSettings({
            autonomyMode: agentAutonomyMode,
            startExistingDraftPlans: switchingToAutonomous,
          })
        );
      }

      if (rawDescriptionChanged) {
        regeneratedTargeting = await regenerateWorkspaceTargeting({
          workspaceId: workspace._id,
          name: data.name.trim(),
          sourceUrl: data.sourceUrl?.trim() || undefined,
          rawUserDescription: data.rawUserDescription,
          currentProfiles: normalizedIcps.map((icp) => ({
            ...icp,
            channels:
              icp.channels.length > 0
                ? icp.channels
                : ["X/Twitter", "LinkedIn"],
          })),
        });
      }

      if (agentSettingsChanged && rawDescriptionChanged) {
        saveOperations.push(
          persistAgentSettings({
            autonomyMode: agentAutonomyMode,
            startExistingDraftPlans: switchingToAutonomous,
          })
        );
      }

      await Promise.all(saveOperations);

      reset({
        ...data,
        name: data.name.trim(),
        rawUserDescription: data.rawUserDescription.trim(),
        improvedDescription:
          regeneratedTargeting?.improvedDescription ??
          data.improvedDescription.trim(),
        useCaseKey: regeneratedTargeting
          ? (regeneratedTargeting.useCaseKey as WorkspaceUseCaseKey)
          : data.useCaseKey,
        sourceUrl: data.sourceUrl?.trim() || "",
        icps: regeneratedTargeting
          ? regeneratedTargeting.profiles
          : profilesWereEdited
            ? normalizedIcps.map((icp) => ({
                ...icp,
                channels:
                  icp.channels.length > 0
                    ? icp.channels
                    : ["X/Twitter", "LinkedIn"],
              }))
            : data.icps,
      });
      lastSyncedWorkspaceVersionRef.current = workspaceFormVersion;
      if (
        rawDescriptionChanged &&
        regeneratedTargeting &&
        !regeneratedTargeting.prospectingRestarted
      ) {
        toast.warning("Workspace and targeting updated", {
          description:
            "The Agent could not restart automatically. Use the Agent status control to start it again.",
        });
      } else {
        toast.success(
          rawDescriptionChanged
            ? "Workspace and targeting updated"
            : workspaceFormHasChanges
              ? "Workspace updated"
              : "Agent settings updated"
        );
      }
      setAutonomyConfirmationOpen(false);
      setIsEditing(false);
      return "saved" as const;
    } catch (error) {
      logger.error("Workspace save failed", error);
      toast.error("Could not save", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
      return "failed" as const;
    }
  };

  const handleSave = async (data: WorkspacePageFormValues) => {
    await saveWorkspaceChanges(data, { autonomyConfirmed: false });
  };

  const handleConfirmAutonomy = () => {
    void form.handleSubmit(async (data) => {
      await saveWorkspaceChanges(data, {
        autonomyConfirmed: true,
      });
    })();
  };

  const handleAutonomyConfirmationOpenChange = (open: boolean) => {
    setAutonomyConfirmationOpen(open);
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
    if (!workspace) return;
    reset(workspaceDocToFormValues(workspace));
    setAgentAutonomyMode(persistedAgentAutonomyMode);
    lastSyncedWorkspaceVersionRef.current = workspaceFormVersion;
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (workspace) {
      reset(workspaceDocToFormValues(workspace));
    } else {
      reset(createEmptyWorkspaceFormValues());
    }
    setAgentAutonomyMode(persistedAgentAutonomyMode);
    lastSyncedWorkspaceVersionRef.current = workspaceFormVersion;
    setIsEditing(false);
  };

  const runDelete = async () => {
    if (!workspace) return;
    const toastId = getWorkspaceDeletionToastId(String(workspace._id));
    toast.loading(WORKSPACE_DELETION_TOAST_COPY.loading, { id: toastId });
    setDeleteOpen(false);
    try {
      const result = await deleteWorkspace({ workspaceId: workspace._id });
      if (result.wasLastWorkspace) {
        setPreferredShellContext("setup_session");
        router.push("/agent/setup");
      } else if (result.newDefaultWorkspaceId) {
        router.refresh();
      }
    } catch {
      toast.error(WORKSPACE_DELETION_TOAST_COPY.error, {
        id: toastId,
        description: WORKSPACE_DELETION_TOAST_COPY.errorDescription,
        action: {
          label: WORKSPACE_DELETION_TOAST_COPY.retry,
          onClick: () => void runDelete(),
        },
      });
    }
  };

  const openMenuDialog = useCallback((setOpen: (next: boolean) => void) => {
    window.setTimeout(() => setOpen(true), 0);
  }, []);

  const editedLabel = workspace
    ? format(new Date(workspace.updatedAt), "MMM d")
    : "";

  const hasPersistedSourceUrl = Boolean(workspace?.sourceUrl?.trim());

  const canCreateWorkspace = workspaceCreationEligibility?.allowed === true;
  const workspaceCreationBlockedReason =
    workspaceCreationEligibility?.reason ??
    "Workspace limit reached for your current plan.";

  const isHydrating = isAuthenticated && workspace === undefined;
  if (authLoading || isHydrating) {
    return (
      <div className={workspacePageShellClassName}>
        <PageLayout className={workspaceMainColumnClassName}>
          <PageHeader className="border-b-0" title="Workspace" />
          <WorkspacePageSkeleton
            bodyColumnClassName={workspaceBodyColumnClassName}
          />
        </PageLayout>
      </div>
    );
  }

  return (
    <>
      <div className={workspacePageShellClassName}>
        <PageLayout className={workspaceMainColumnClassName}>
          <PageHeader
            className="border-b-0"
            title="Workspace"
            titleSuffix={
              workspace ? (
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  · edited · {editedLabel}
                </span>
              ) : null
            }
            actions={
              isAuthenticated && workspace ? (
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
                        !hasWorkspacePageChanges ||
                        form.formState.isSubmitting ||
                        isSavingAgentSettings
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
                          onClick={() => {
                            if (canCreateWorkspace) {
                              void requestNewWorkspace();
                            }
                          }}
                        >
                          <AddIcon className="fill-current" />
                          New workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              ) : null
            }
          />

          {isAuthenticated && workspace ? (
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
                  {authError && (
                    <div className="px-4">
                      <Alert variant="destructive" className="mb-6">
                        <AlertTitle>Could not load workspace</AlertTitle>
                        <AlertDescription>
                          {authError.message ?? "Please refresh."}
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  <div className="px-4">
                    <WorkspacePlanLimitAlert className="mb-4" />
                    <TabsContent value="details" className="mt-0">
                      {isEditing ? (
                        <Alert className="mb-4">
                          <AlertTitle>Note</AlertTitle>
                          <AlertDescription>
                            Changing who you want to reach regenerates the
                            agent's description and AI-generated profiles.
                            Manual profiles stay unchanged.
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <Form {...form}>
                        <form
                          id={workspaceFormId}
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
                                        DEFAULT_WORKSPACE_USE_CASE_KEY) as WorkspaceUseCaseKey
                                    }
                                    onValueChange={field.onChange}
                                    disabled
                                  />
                                  <FormMessage
                                    className={formMessageClassName}
                                  />
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
                                  <FormMessage
                                    className={formMessageClassName}
                                  />
                                </FormItem>
                              )}
                            />
                          ) : null}

                          <FormField
                            control={form.control}
                            name="rawUserDescription"
                            render={({ field }) => (
                              <FormItem className={formFieldClassName}>
                                <FormLabel className={formLabelClassName}>
                                  Who are you looking for?
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    value={field.value ?? ""}
                                    rows={5}
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
                                  Your original instructions. Saving changes
                                  updates future targeting.
                                </FormDescription>
                                <FormMessage className={formMessageClassName} />
                              </FormItem>
                            )}
                          />

                          {!isEditing ? (
                            <FormField
                              control={form.control}
                              name="improvedDescription"
                              render={({ field }) => (
                                <FormItem className={formFieldClassName}>
                                  <FormLabel className={formLabelClassName}>
                                    Agent interpretation
                                  </FormLabel>
                                  <FormControl>
                                    <Textarea
                                      {...field}
                                      value={field.value ?? ""}
                                      disabled
                                      rows={4}
                                      autoResize
                                      className="resize-y overflow-hidden"
                                    />
                                  </FormControl>
                                  <FormDescription
                                    className={formDescriptionClassName}
                                  >
                                    Created from your instructions and used by
                                    the △ Agent to find{" "}
                                    {
                                      selectedUseCase.promptContext.terminology
                                        .entityPlural
                                    }
                                    .
                                  </FormDescription>
                                  <FormMessage
                                    className={formMessageClassName}
                                  />
                                </FormItem>
                              )}
                            />
                          ) : null}
                        </form>
                      </Form>
                    </TabsContent>

                    <TabsContent value="profiles" className="mt-0">
                      {isEditing ? (
                        <Alert>
                          <AlertTitle>Note</AlertTitle>
                          <AlertDescription>
                            Profiles you add or edit become manual profiles and
                            stay unchanged when the description is updated.
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      {!isEditing ? (
                        <div className="flex flex-col gap-3">
                          {(workspace.icps ?? []).map(
                            (
                              icp: WorkspacePageFormValues["icps"][number],
                              i: number
                            ) => (
                              <IdealCustomerProfileCard
                                key={`${icp.title}-${i}`}
                                profile={{
                                  ...icp,
                                  provenance:
                                    resolveWorkspaceProfileProvenance(icp),
                                }}
                                className={
                                  IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME
                                }
                              />
                            )
                          )}
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
                                    />{" "}
                                    ·{" "}
                                    {field.provenance === "manual"
                                      ? "Manual"
                                      : AGENT_GENERATED_PROFILE_LABEL}
                                  </span>
                                  <Button
                                    type="button"
                                    size="xsIcon"
                                    variant="ghost"
                                    disabled={fields.length <= 1}
                                    title={
                                      fields.length <= 1
                                        ? "At least one profile is required."
                                        : "Delete profile"
                                    }
                                    onClick={() => {
                                      if (fields.length > 1) remove(index);
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
                                        <FormLabel
                                          className={formLabelClassName}
                                        >
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
                                        <FormLabel
                                          className={formLabelClassName}
                                        >
                                          Short description
                                        </FormLabel>
                                        <FormControl>
                                          <Textarea
                                            {...f}
                                            value={f.value ?? ""}
                                            rows={3}
                                            maxLength={
                                              ICP_SHORT_DESCRIPTION_MAX
                                            }
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
                                        <FormLabel
                                          className={formLabelClassName}
                                        >
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
                                  provenance: "manual",
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
          ) : (
            <div className={workspaceBodyColumnClassName}>
              <PageContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {authError && (
                  <div className="px-4 pt-4">
                    <Alert variant="destructive" className="mb-6">
                      <AlertTitle>Could not load workspace</AlertTitle>
                      <AlertDescription>
                        {authError.message ?? "Please refresh."}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {isAuthenticated && workspace === null && !authLoading && (
                  <div className="px-4 pt-4">
                    <Alert className="mb-6">
                      <AlertTitle>No workspace yet</AlertTitle>
                      <AlertDescription>
                        Finish setup to create your workspace.
                        <div className="mt-3">
                          <Button
                            size="xs"
                            onClick={() => {
                              setPreferredShellContext("setup_session");
                              router.push("/agent/setup");
                            }}
                          >
                            Continue setup
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {!isAuthenticated && !authLoading && (
                  <div className="px-4 pt-4">
                    <Alert className="mb-6">
                      <AlertTitle>Account required</AlertTitle>
                      <AlertDescription>
                        <Button size="xs" onClick={() => router.push("/login")}>
                          Sign in
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </PageContent>
            </div>
          )}
        </PageLayout>
      </div>

      <AlertDialog
        open={autonomyConfirmationOpen}
        onOpenChange={handleAutonomyConfirmationOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off sending approvals?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {workspacePlanStartPreview === undefined
                  ? "Checking existing draft outreach plans…"
                  : workspacePlanStartPreview.draftPlanCount > 0
                    ? `This will gradually start ${workspacePlanStartPreview.draftPlanCount.toLocaleString()}${workspacePlanStartPreview.draftPlanCountIsCapped ? "+" : ""} existing draft outreach plan${workspacePlanStartPreview.draftPlanCount === 1 ? "" : "s"}.`
                    : "Future outreach plans will start automatically."}
              </span>
              <span className="block">
                Replies and DMs may send without further approval. Wait steps
                and requests for your input will still pause normally.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingAgentSettings}>
              Keep approvals on
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                isSavingAgentSettings || workspacePlanStartPreview === undefined
              }
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
              this workspace
              {userWorkspaces && userWorkspaces.length > 1
                ? " and switches you to another workspace."
                : " and sends you back to setup."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {modal}
    </>
  );
}
