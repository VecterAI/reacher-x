"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/convex/_generated/api";
import {
  PageHeader,
  PageLayout,
  PageContent,
} from "@/shared/ui/components/PageHeader";
import { Button } from "@/shared/ui/components/Button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/Form";
import { Input } from "@/shared/ui/components/Input";
import { Textarea } from "@/shared/ui/components/TextArea";
import { CharacterCounter } from "@/shared/ui/components/CharacterCounter";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Upload } from "lucide-react";
import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils/validation";
import { EditIcon } from "@/shared/ui/components/icons";
import { useEnsureWorkspace } from "@/shared/hooks/useEnsureWorkspace";
import { useToast } from "@/shared/ui/hooks/useToast";
import {
  workspaceSchema,
  type WorkspaceFormValues,
} from "@/shared/lib/schemas/validation";

const MIN_CHARS = DESCRIPTION_CONSTRAINTS.MIN_LENGTH;
const MAX_CHARS = DESCRIPTION_CONSTRAINTS.MAX_LENGTH;

export default function WorkspacePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  // Use the robust workspace hook that ensures workspace exists
  const {
    workspace,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useEnsureWorkspace();
  const updateWorkspace = useMutation(api.workspaces.updateWorkspace);

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
    // Avoid showing placeholder defaults to prevent flicker before real data loads
    defaultValues: {
      name: "",
      description: "",
    },
    // When authenticated and workspace is available, provide values directly
    // so the form mounts with the correct data and avoids any intermediate state
    values:
      isAuthenticated && workspace
        ? {
            name: workspace.name,
            description: workspace.description,
          }
        : undefined,
    resetOptions: {
      keepDirtyValues: true,
      keepErrors: true,
    },
    mode: "onChange",
  });

  // Avoid redundant effects: values prop above keeps form in sync with data.

  const onSubmit = async (data: WorkspaceFormValues) => {
    try {
      // Only authenticated users can save workspace settings
      if (workspace) {
        await updateWorkspace({
          workspaceId: workspace._id,
          name: data.name,
          description: data.description,
        });
        toast({
          title: "☑︎ Updated!",
          description: "Workspace settings updated successfully.",
        });
        setIsEditing(false); // Exit edit mode
        form.reset(data); // Reset dirty state
      }
    } catch (error) {
      console.error("Failed to save workspace:", error);
      toast({
        variant: "destructive",
        title: "☒ Error!",
        description: "Failed to save workspace settings.",
      });
    }
  };

  const handleCancel = () => {
    if (workspace) {
      form.reset({
        name: workspace.name,
        description: workspace.description,
      });
    }
    setIsEditing(false); // Exit edit mode
  };

  const description = form.watch("description") || "";
  const charCount = description.length;
  const isFormValid = form.formState.isValid && charCount >= MIN_CHARS;

  // Show loading skeleton until workspace data is ready to avoid empty flicker
  const isHydrating = isAuthenticated && workspace === undefined;
  if (authLoading || workspaceLoading || isHydrating) {
    return (
      <PageLayout>
        <PageHeader title="Workspace" onBack={() => router.back()} />
        <PageContent className="mx-4 mt-4">
          <div className="space-y-8">
            {/* Workspace Image Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-32 w-32 rounded-lg" />
            </div>

            {/* Form Skeletons */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Workspace"
        onBack={() => router.back()}
        actions={
          isAuthenticated ? (
            isEditing ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="xs" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  size="xs"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={
                    !form.formState.isDirty ||
                    !isFormValid ||
                    form.formState.isSubmitting
                  }
                >
                  {form.formState.isSubmitting ? "..." : "Done"}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setIsEditing(true)}
              >
                <EditIcon className="fill-current" />
                Edit
              </Button>
            )
          ) : null
        }
      />

      <PageContent className="mx-4 mt-4">
        {/* Error message for workspace creation failures */}
        {workspaceError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/50">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Error:</strong> Failed to create workspace.{" "}
              {workspaceError}
            </p>
          </div>
        )}

        {/* Authentication message for unauthenticated users */}
        {!isAuthenticated && !authLoading && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/50">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Account required:</strong> To use the workspace feature
              and save your data, please create an account or log in. Your
              workspace data will be synced to your account.
            </p>
          </div>
        )}

        {/* Only show workspace content for authenticated users */}
        {isAuthenticated && (
          <>
            {/* Workspace Image Section */}
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Max size 5MB.</p>
              </div>
            </div>

            {/* Note Section */}
            <div className="rounded-lg border border-dashed border-foreground p-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Note</h3>
                <p className="text-sm">
                  If you want to find customers for a different project,
                  it&apos;s better to create a new workspace. Changing the
                  description here will modify how the system suggests keywords
                  and finds posts.
                </p>
              </div>
            </div>

            {/* Workspace Details Form */}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={!isEditing}
                          placeholder="Enter workspace name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          disabled={!isEditing}
                          placeholder="Briefly describe your product, service, or skill..."
                          className="min-h-[120px] resize-none"
                          autoResize
                          maxLength={MAX_CHARS + 50}
                        />
                      </FormControl>
                      <div className="flex items-center justify-between">
                        <CharacterCounter current={charCount} max={MAX_CHARS} />
                        {charCount < MIN_CHARS && isEditing && (
                          <p className="text-sm text-muted-foreground">
                            Describe more ({MIN_CHARS - charCount} more
                            characters needed)
                          </p>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </>
        )}
      </PageContent>
    </PageLayout>
  );
}
