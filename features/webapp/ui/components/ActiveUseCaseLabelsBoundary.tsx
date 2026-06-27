import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ActiveUseCaseLabelsProvider } from "@/shared/contexts/ActiveUseCaseLabelsProvider";
import {
  parseWorkspaceUseCaseKeyParam,
  WORKSPACE_USE_CASE_STORAGE_KEY,
} from "@/shared/lib/workspaceUseCaseCache";

export async function ActiveUseCaseLabelsBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const initialUseCaseKey = parseWorkspaceUseCaseKeyParam(
    cookieStore.get(WORKSPACE_USE_CASE_STORAGE_KEY)?.value
  );

  return (
    <ActiveUseCaseLabelsProvider initialUseCaseKey={initialUseCaseKey}>
      {children}
    </ActiveUseCaseLabelsProvider>
  );
}
