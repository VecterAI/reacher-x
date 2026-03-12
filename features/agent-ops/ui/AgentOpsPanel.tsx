"use client";

import * as React from "react";
import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "@/shared/hooks";
import { Button } from "@/shared/ui/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { StatusBadge, formatRelativeDate } from "./shared";
import type { AgentOpsPanelKind } from "./types";

type PanelSelection = {
  panel: AgentOpsPanelKind | null;
  queryId: string | null;
  monitorId: string | null;
  memoryId: string | null;
  eventId: string | null;
  runId: string | null;
  suggestionId: string | null;
};

export function AgentOpsPanel({
  workspaceId,
  selection,
  onClose,
  onOpenMonitor,
  onOpenMemory,
}: {
  workspaceId: string;
  selection: PanelSelection;
  onClose: () => void;
  onOpenMonitor: (monitorId: string) => void;
  onOpenMemory: (memoryId: string) => void;
}) {
  const queryDetail = useQueryWithStatus(
    api.agentOps.getAgentOpsQueryDetail,
    selection.panel === "query" && selection.queryId
      ? {
          workspaceId: workspaceId as never,
          queryCandidateId: selection.queryId as never,
        }
      : "skip"
  );
  const monitorDetail = useQueryWithStatus(
    api.agentOps.getAgentOpsMonitorDetail,
    selection.panel === "monitor" && selection.monitorId
      ? {
          workspaceId: workspaceId as never,
          monitorId: selection.monitorId as never,
        }
      : "skip"
  );
  const memoryDetail = useQueryWithStatus(
    api.agentOps.getAgentOpsMemoryDetail,
    selection.panel === "memory" && selection.memoryId
      ? { workspaceId: workspaceId as never, memoryId: selection.memoryId }
      : "skip"
  );
  const eventDetail = useQueryWithStatus(
    api.agentOps.getAgentOpsEventDetail,
    selection.panel === "event" && selection.eventId
      ? {
          workspaceId: workspaceId as never,
          eventId: selection.eventId as never,
        }
      : "skip"
  );
  const runDetail = useQueryWithStatus(
    api.agentOps.getAgentOpsRunDetail,
    selection.panel === "run" && selection.runId
      ? { workspaceId: workspaceId as never, runId: selection.runId as never }
      : "skip"
  );
  const suggestionDetail = useQueryWithStatus(
    api.agentOps.getAgentOpsSuggestionDetail,
    selection.panel === "suggestion" && selection.suggestionId
      ? {
          workspaceId: workspaceId as never,
          suggestionId: selection.suggestionId as never,
        }
      : "skip"
  );

  const activeQuery =
    selection.panel === "query"
      ? queryDetail
      : selection.panel === "monitor"
        ? monitorDetail
        : selection.panel === "memory"
          ? memoryDetail
          : selection.panel === "event"
            ? eventDetail
            : selection.panel === "run"
              ? runDetail
              : suggestionDetail;

  const hasSelection = selection.panel !== null;
  const panelTitle =
    selection.panel === "query"
      ? "Query detail"
      : selection.panel === "monitor"
        ? "Monitor detail"
        : selection.panel === "memory"
          ? "Memory detail"
          : selection.panel === "event"
            ? "Workflow event detail"
            : selection.panel === "run"
              ? "Evaluator run detail"
              : selection.panel === "suggestion"
                ? "Memory suggestion detail"
                : "No selection yet";
  const panelSubtitle = hasSelection
    ? "Inspect the selected operational record."
    : "Select a query, monitor, memory, event, run, or suggestion in Agent Ops.";

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{panelTitle}</p>
            <p className="text-muted-foreground text-xs">{panelSubtitle}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1" viewportClassName="h-full">
        <div className="space-y-4 p-4">
          {activeQuery.isPending ? (
            <Card className="shadow-none">
              <CardContent className="text-muted-foreground p-4 text-sm">
                Loading details...
              </CardContent>
            </Card>
          ) : null}

          {activeQuery.isError ? (
            <Card className="border-destructive/40 shadow-none">
              <CardContent className="text-destructive p-4 text-sm">
                {activeQuery.error.message || "Failed to load detail record."}
              </CardContent>
            </Card>
          ) : null}

          {!hasSelection && !activeQuery.isPending && !activeQuery.isError ? (
            <Card className="shadow-none">
              <CardContent className="text-muted-foreground p-4 text-sm">
                No record selected yet. Choose a query, monitor, memory, event,
                run, or suggestion from the dashboard to see details here.
              </CardContent>
            </Card>
          ) : null}

          {hasSelection &&
          !activeQuery.isPending &&
          !activeQuery.isError &&
          !queryDetail.data &&
          !monitorDetail.data &&
          !memoryDetail.data &&
          !eventDetail.data &&
          !runDetail.data &&
          !suggestionDetail.data ? (
            <Card className="shadow-none">
              <CardContent className="text-muted-foreground p-4 text-sm">
                The selected record could not be found. It may have been removed
                or is no longer available.
              </CardContent>
            </Card>
          ) : null}

          {selection.panel === "query" && queryDetail.data ? (
            <>
              <Card className="shadow-none">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-base">
                    {queryDetail.data.rawValue}
                  </CardTitle>
                  <CardDescription>
                    {queryDetail.data.canonicalValue}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={queryDetail.data.status} />
                    <StatusBadge value={queryDetail.data.type} />
                    {queryDetail.data.monitor ? (
                      <StatusBadge
                        value={queryDetail.data.monitor.healthStatus}
                      />
                    ) : null}
                  </div>
                  <p>
                    Novelty {queryDetail.data.noveltyScore ?? 0} · Performance{" "}
                    {queryDetail.data.performanceScore ?? 0}
                  </p>
                  {queryDetail.data.sourceTheme ? (
                    <p className="text-muted-foreground">
                      Source theme: {queryDetail.data.sourceTheme}
                    </p>
                  ) : null}
                  {queryDetail.data.performance ? (
                    <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
                      <Metric
                        label="Prospects found"
                        value={queryDetail.data.performance.prospectsFound}
                      />
                      <Metric
                        label="Qualified"
                        value={queryDetail.data.performance.qualifiedCount}
                      />
                      <Metric
                        label="Converted"
                        value={queryDetail.data.performance.convertedCount}
                      />
                      <Metric
                        label="Reply rate"
                        value={`${queryDetail.data.performance.replyRate.toFixed(1)}%`}
                      />
                    </div>
                  ) : null}
                  {queryDetail.data.monitor ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (queryDetail.data?.monitor) {
                          onOpenMonitor(queryDetail.data.monitor.monitorId);
                        }
                      }}
                    >
                      Open monitor
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              <SimpleListCard
                title="Related events"
                items={queryDetail.data.relatedEvents.map((event) => ({
                  title: event.eventType.replaceAll("_", " "),
                  body: `${event.status} · ${formatRelativeDate(event.occurredAt)}`,
                }))}
              />
            </>
          ) : null}

          {selection.panel === "monitor" && monitorDetail.data ? (
            <Card className="shadow-none">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-base">
                  {monitorDetail.data.query}
                </CardTitle>
                <CardDescription>
                  {monitorDetail.data.monitorExternalId}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 text-sm">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={monitorDetail.data.status} />
                  <StatusBadge value={monitorDetail.data.healthStatus} />
                </div>
                <p>Refresh frequency: {monitorDetail.data.refreshFrequency}</p>
                <p>
                  Prospects found:{" "}
                  {monitorDetail.data.totalProspectsFound.toLocaleString()}
                </p>
                <p>
                  Last webhook:{" "}
                  {monitorDetail.data.lastWebhookAt
                    ? formatRelativeDate(monitorDetail.data.lastWebhookAt)
                    : "Never"}
                </p>
                {monitorDetail.data.performance ? (
                  <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
                    <Metric
                      label="Qualified"
                      value={monitorDetail.data.performance.qualifiedCount}
                    />
                    <Metric
                      label="Converted"
                      value={monitorDetail.data.performance.convertedCount}
                    />
                    <Metric
                      label="Reply rate"
                      value={`${monitorDetail.data.performance.replyRate.toFixed(1)}%`}
                    />
                    <Metric
                      label="Qualification rate"
                      value={`${monitorDetail.data.performance.qualificationRate.toFixed(1)}%`}
                    />
                  </div>
                ) : null}
                {monitorDetail.data.lastError ? (
                  <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-3">
                    {monitorDetail.data.lastError}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {selection.panel === "memory" && memoryDetail.data ? (
            <>
              <Card className="shadow-none">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-base">
                    {memoryDetail.data.title}
                  </CardTitle>
                  <CardDescription>{memoryDetail.data.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={memoryDetail.data.source} />
                    <StatusBadge value={memoryDetail.data.category} />
                  </div>
                  <p>
                    Confidence {(memoryDetail.data.confidence * 100).toFixed(1)}
                    % · Impact{" "}
                    {(memoryDetail.data.impactScore * 100).toFixed(1)}%
                  </p>
                  {memoryDetail.data.prospect ? (
                    <p className="text-muted-foreground">
                      Prospect: {memoryDetail.data.prospect.displayName}
                    </p>
                  ) : null}
                  <SimpleListCard
                    title="Signals"
                    items={memoryDetail.data.signals.map((signal) => ({
                      title: signal,
                      body: "",
                    }))}
                  />
                  <SimpleListCard
                    title="Evidence"
                    items={memoryDetail.data.evidence.map((evidence) => ({
                      title: evidence,
                      body: "",
                    }))}
                  />
                </CardContent>
              </Card>

              <SimpleListCard
                title="Related queries"
                items={memoryDetail.data.relatedQueries.map((query) => ({
                  title: query.rawValue,
                  body: query.status,
                }))}
              />
            </>
          ) : null}

          {selection.panel === "event" && eventDetail.data ? (
            <Card className="shadow-none">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-base">
                  {eventDetail.data.eventType.replaceAll("_", " ")}
                </CardTitle>
                <CardDescription>
                  {formatRelativeDate(eventDetail.data.occurredAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 text-sm">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={eventDetail.data.status} />
                  <StatusBadge value={eventDetail.data.sourceType} />
                </div>
                {eventDetail.data.workflowName ? (
                  <p>Workflow: {eventDetail.data.workflowName}</p>
                ) : null}
                {eventDetail.data.error ? (
                  <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-3">
                    {eventDetail.data.error}
                  </p>
                ) : null}
                <pre className="bg-muted/30 overflow-x-auto rounded-md border p-3 text-xs">
                  {JSON.stringify(eventDetail.data.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ) : null}

          {selection.panel === "run" && runDetail.data ? (
            <>
              <Card className="shadow-none">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-base">
                    Memory evaluator run
                  </CardTitle>
                  <CardDescription>
                    {runDetail.data.eventType.replaceAll("_", " ")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={runDetail.data.status} />
                    {runDetail.data.model ? (
                      <StatusBadge value={runDetail.data.model} />
                    ) : null}
                  </div>
                  {runDetail.data.summary ? (
                    <p>{runDetail.data.summary}</p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
                    <Metric
                      label="Promoted"
                      value={runDetail.data.promotedMemoryCount}
                    />
                    <Metric
                      label="Suggested"
                      value={runDetail.data.suggestedMemoryCount}
                    />
                    <Metric
                      label="Query updates"
                      value={runDetail.data.queryPerformanceUpdateCount}
                    />
                    <Metric
                      label="Relevant memories"
                      value={
                        runDetail.data.retrievalStats?.relevantMemories ?? 0
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <SimpleListCard
                title="Suggestions"
                items={runDetail.data.suggestions.map((suggestion) => ({
                  title: suggestion.title,
                  body: suggestion.status,
                }))}
              />
            </>
          ) : null}

          {selection.panel === "suggestion" && suggestionDetail.data ? (
            <Card className="shadow-none">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-base">
                  {suggestionDetail.data.title}
                </CardTitle>
                <CardDescription>
                  {suggestionDetail.data.summary}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 text-sm">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={suggestionDetail.data.status} />
                  <StatusBadge value={suggestionDetail.data.source} />
                  <StatusBadge value={suggestionDetail.data.category} />
                </div>
                <p>
                  Confidence{" "}
                  {(suggestionDetail.data.confidence * 100).toFixed(1)}% ·
                  Impact {(suggestionDetail.data.impactScore * 100).toFixed(1)}%
                </p>
                <SimpleListCard
                  title="Signals"
                  items={suggestionDetail.data.signals.map((signal) => ({
                    title: signal,
                    body: "",
                  }))}
                />
                {suggestionDetail.data.promotedMemory ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (suggestionDetail.data?.promotedMemory) {
                        onOpenMemory(
                          suggestionDetail.data.promotedMemory.memoryId
                        );
                      }
                    }}
                  >
                    Open promoted memory
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function SimpleListCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ title: string; body: string }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0 text-sm">
        {items.map((item, index) => (
          <div key={`${item.title}-${index}`} className="rounded-md border p-3">
            <p className="font-medium">{item.title}</p>
            {item.body ? (
              <p className="text-muted-foreground mt-1">{item.body}</p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
