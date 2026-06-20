"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PageHeader,
  PageLayout,
  PageContent,
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
import { IdealCustomerProfileCard } from "@/features/prospects";
import {
  AddIcon,
  ChangeHistoryIcon,
  DeleteIcon,
  EditIcon,
  MoreHorizIcon,
} from "@/shared/ui/components/icons";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { cn } from "@/shared/lib/utils";
import { WorkspaceUseCaseCombobox } from "./WorkspaceUseCaseCombobox";
import { WorkspaceRefinePanel } from "./WorkspaceRefinePanel";
import { WorkspaceIcpPainPointsField } from "./WorkspaceIcpPainPointsField";
import { workspaceDocToFormValues } from "./workspaceFormDefaults";
import {
  DEFAULT_WORKSPACE_USE_CASE_KEY,
  getWorkspaceUseCase,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";
import { WorkspacePageSkeleton } from "./WorkspacePageSkeleton";

function createEmptyWorkspaceFormValues(): WorkspacePageFormValues {
  return {
    name: "",
    useCaseKey: DEFAULT_WORKSPACE_USE_CASE_KEY as WorkspaceUseCaseKey,
    seedDescription: "",
    improvedDescription: "",
    sourceUrl: "",
    icps: Array.from({ length: 3 }, () => ({
      title: "",
      description: "",
      painPoints: [],
      channels: [],
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
  };
}

function icpDraftHasMeaningfulContent(
  icp: ReturnType<typeof trimIcpDraft>
): boolean {
  return Boolean(icp.title || icp.description || icp.painPoints.length > 0);
}

export default function WorkspacePage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const {
    isAuthenticated,
    isLoading: authLoading,
    workspace,
    error: authError,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<"details" | "profiles">("details");
  const [isEditing, setIsEditing] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineThreadId, setRefineThreadId] = useState<string | null>(null);
  const [refineSessionId, setRefineSessionId] =
    useState<Id<"workspaceSetupSessions"> | null>(null);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const currentPlan = useQuery(
    api.plans.getCurrentPlan,
    isAuthenticated ? {} : "skip"
  );
  const userWorkspaces = useQuery(
    api.workspaces.getUserWorkspaces,
    isAuthenticated ? {} : "skip"
  );

  const updateWorkspaceSettings = useMutation(
    api.workspaces.updateWorkspaceSettings
  );
  const rollbackWorkspace = useMutation(api.workspaces.rollbackWorkspace);
  const deleteWorkspace = useMutation(api.workspaces.deleteWorkspace);
  const startWorkspaceRefineSession = useMutation(
    api.setupSessions.startWorkspaceRefineSession
  );

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

  const tier = currentPlan?.tier ?? "free";
  const canRollback =
    (tier === "base" || tier === "pro") &&
    Boolean(workspace?.refineRollbackSnapshot);

  const handleSave = async (data: WorkspacePageFormValues) => {
    if (!workspace) return;
    const profilesWereEdited =
      Array.isArray(form.formState.dirtyFields.icps) ||
      Boolean(form.formState.dirtyFields.icps);
    const normalizedIcps = data.icps
      .map(trimIcpDraft)
      .filter(icpDraftHasMeaningfulContent);

    if (profilesWereEdited && normalizedIcps.length < 3) {
      form.setError("icps", {
        type: "manual",
        message: "At least three ideal customer profiles are required.",
      });
      setActiveTab("profiles");
      return;
    }

    try {
      const mutationArgs: Parameters<typeof updateWorkspaceSettings>[0] = {
        workspaceId: workspace._id,
        name: data.name.trim(),
        description: data.improvedDescription.trim(),
        seedDescription: data.seedDescription.trim(),
        improvedDescription: data.improvedDescription.trim(),
        useCaseKey: data.useCaseKey,
        sourceUrl: data.sourceUrl?.trim() || undefined,
        descriptionSource: data.sourceUrl?.trim() ? "url" : "manual",
      };

      if (profilesWereEdited) {
        mutationArgs.icps = normalizedIcps.map((icp) => ({
          ...icp,
          channels:
            icp.channels.length > 0 ? icp.channels : ["X/Twitter", "LinkedIn"],
        }));
      }

      await updateWorkspaceSettings(mutationArgs);
      reset({
        ...data,
        name: data.name.trim(),
        seedDescription: data.seedDescription.trim(),
        improvedDescription: data.improvedDescription.trim(),
        sourceUrl: data.sourceUrl?.trim() || "",
        icps: mutationArgs.icps ?? data.icps,
      });
      lastSyncedWorkspaceVersionRef.current = workspaceFormVersion;
      toast.success("Workspace updated");
      setIsEditing(false);
    } catch (error) {
      logger.error("Workspace save failed", error);
      toast.error("Could not save", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const handleStartEditing = () => {
    if (!workspace) return;
    reset(workspaceDocToFormValues(workspace));
    lastSyncedWorkspaceVersionRef.current = workspaceFormVersion;
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (workspace) {
      reset(workspaceDocToFormValues(workspace));
    } else {
      reset(createEmptyWorkspaceFormValues());
    }
    lastSyncedWorkspaceVersionRef.current = workspaceFormVersion;
    setIsEditing(false);
  };

  const runRollback = async () => {
    if (!workspace) return;
    try {
      await rollbackWorkspace({ workspaceId: workspace._id });
      toast.success("Restored previous version");
      setRollbackOpen(false);
    } catch (error) {
      toast.error("Rollback failed", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const runDelete = async () => {
    if (!workspace) return;
    try {
      const result = await deleteWorkspace({ workspaceId: workspace._id });
      setDeleteOpen(false);
      toast.success("Workspace deleted");
      if (result.wasLastWorkspace) {
        setPreferredShellContext("setup_session");
        router.push("/agent/setup");
      } else if (result.newDefaultWorkspaceId) {
        router.refresh();
      }
    } catch (error) {
      toast.error("Could not delete workspace", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const openRefine = useCallback(async () => {
    if (!workspace) return;
    try {
      const { threadId, sessionId } = await startWorkspaceRefineSession({
        workspaceId: workspace._id,
      });
      setRefineThreadId(threadId);
      setRefineSessionId(sessionId);
      setRefineOpen(true);
    } catch (error) {
      toast.error("Could not open refine", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [workspace, startWorkspaceRefineSession]);

  const openMenuDialog = useCallback((setOpen: (next: boolean) => void) => {
    window.setTimeout(() => setOpen(true), 0);
  }, []);

  const handleRefineCancel = useCallback(async () => {
    setRefineOpen(false);
    setRefineThreadId(null);
    setRefineSessionId(null);
    if (workspace) {
      reset(workspaceDocToFormValues(workspace));
    }
    lastSyncedWorkspaceVersionRef.current = workspaceFormVersion;
    setIsEditing(false);
  }, [reset, workspace, workspaceFormVersion]);

  const handleRefineComplete = useCallback(() => {
    setRefineOpen(false);
    setRefineThreadId(null);
    setRefineSessionId(null);
    if (workspace) {
      reset(workspaceDocToFormValues(workspace));
    }
    lastSyncedWorkspaceVersionRef.current = workspaceFormVersion;
    setIsEditing(false);
  }, [reset, workspace, workspaceFormVersion]);

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
      <PageLayout className="border-r-0">
        <PageHeader
          className="border-b-0"
          title="Workspace"
          onBack={() => router.back()}
        />
        <PageContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <WorkspacePageSkeleton />
        </PageContent>
      </PageLayout>
    );
  }

  const showMainColumn = !isMobile || !refineOpen;

  return (
    <>
      <div
        className={cn(
          "flex h-full min-h-0 w-full flex-1 flex-col md:flex-row md:items-stretch",
          refineOpen && !isMobile && "h-full min-h-0 overflow-hidden"
        )}
      >
        {showMainColumn ? (
          <PageLayout
            className={cn(
              "border-r-0 md:max-w-lg md:min-w-0 md:flex-1 md:basis-0 md:border-r",
              "flex min-h-0 flex-col overflow-hidden",
              refineOpen && !isMobile && "border-border h-full overflow-hidden"
            )}
          >
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
              onBack={isEditing ? handleCancel : () => router.back()}
              actions={
                isAuthenticated && workspace ? (
                  refineOpen ? null : isEditing ? (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="xs" onClick={handleCancel}>
                        Cancel
                      </Button>
                      <Button
                        size="xs"
                        onClick={form.handleSubmit(handleSave)}
                        disabled={
                          !form.formState.isDirty || form.formState.isSubmitting
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
                                ? tier === "free"
                                  ? "Available on Base and Pro after you refine your audience."
                                  : "No snapshot yet — refine your audience first."
                                : undefined
                            }
                            onSelect={() =>
                              canRollback && openMenuDialog(setRollbackOpen)
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

              {isAuthenticated && workspace && (
                <Tabs
                  className="flex min-h-0 flex-1 flex-col"
                  value={activeTab}
                  onValueChange={(v) =>
                    setActiveTab(v as "details" | "profiles")
                  }
                >
                  <div className="border-border shrink-0 border-b">
                    <div className="scrollbar-none scroll-fade-effect-x overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden">
                      <TabsList variant="underline">
                        <TabsTrigger value="details" variant="underline">
                          Details
                        </TabsTrigger>
                        <TabsTrigger value="profiles" variant="underline">
                          Profiles
                        </TabsTrigger>
                      </TabsList>
                    </div>
                  </div>

                  <div className="scroll-fade-effect-y min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-24">
                    <WorkspacePlanLimitAlert className="mb-4" />
                    <TabsContent value="details" className="mt-0">
                      {isEditing ? (
                        <Alert className="mb-4">
                          <AlertTitle>Note</AlertTitle>
                          <AlertDescription>
                            {tier === "free" ? (
                              <>
                                Changing the workspace affects how the agent
                                finds people. For a different product or use
                                case, create a new workspace.
                              </>
                            ) : (
                              <>
                                Changing the workspace affects how the agent
                                works. You can roll back to the previous version
                                from the menu if results worsen. For a different
                                product, create a new workspace.
                              </>
                            )}
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <Form {...form}>
                        <form
                          className="space-y-4"
                          onSubmit={form.handleSubmit(handleSave)}
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
                                  <FormMessage
                                    className={formMessageClassName}
                                  />
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
                                  Used by the agent to find{" "}
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
                                  Tweak your description to improve who the
                                  agent finds. This regenerates your profiles.
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                onClick={() => void openRefine()}
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
                            {tier === "free"
                              ? "Editing profiles updates how the agent qualifies prospects."
                              : "You can roll back from the menu if needed after refining."}
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
                                profile={icp}
                                disabled
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
                  </div>
                </Tabs>
              )}
            </PageContent>
          </PageLayout>
        ) : null}

        {refineOpen && refineThreadId && refineSessionId ? (
          <WorkspaceRefinePanel
            threadId={refineThreadId}
            sessionId={refineSessionId}
            isMobile={isMobile}
            onRefineCancel={handleRefineCancel}
            onRefineComplete={handleRefineComplete}
          />
        ) : null}
      </div>

      <AlertDialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Restore the configuration from before your last successful refine.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runRollback()}>
              Rollback
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
