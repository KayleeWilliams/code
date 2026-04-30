import { scopeProjectRef, scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime";
import type { GitPullRequestChecksSummary, GitStatusResult } from "@t3tools/contracts";
import {
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  Clock3Icon,
  CloudIcon,
  GitPullRequestIcon,
  ListTodoIcon,
  LoaderCircleIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import { useMemo } from "react";
import { usePrimaryEnvironmentId } from "../environments/primary";
import {
  useSavedEnvironmentRegistryStore,
  useSavedEnvironmentRuntimeStore,
} from "../environments/runtime";
import { useGitStatus } from "../lib/gitStatusState";
import { type AppState, selectProjectByRef, useStore } from "../store";
import { selectThreadTerminalState, useTerminalStateStore } from "../terminalStateStore";
import { useUiStateStore } from "../uiStateStore";
import {
  resolveThreadStatusIndicators,
  type ThreadStatusIndicator,
  type ThreadStatusIndicatorKind,
} from "./Sidebar.logic";
import type { SidebarThreadSummary } from "../types";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

export interface PrStatusIndicator {
  label: "PR open" | "PR closed" | "PR merged";
  colorClass: string;
  tooltip: string;
  url: string;
}

export interface TerminalStatusIndicator {
  label: "Terminal process running";
  colorClass: string;
  pulse: boolean;
}

export interface CiStatusIndicator {
  label: string;
  colorClass: string;
  tooltip: string;
}

export type ThreadPr = GitStatusResult["pr"];

export function prStatusIndicator(pr: ThreadPr): PrStatusIndicator | null {
  if (!pr) return null;

  if (pr.state === "open") {
    return {
      label: "PR open",
      colorClass: "text-emerald-600 dark:text-emerald-300/90",
      tooltip: `#${pr.number} PR open: ${pr.title}`,
      url: pr.url,
    };
  }
  if (pr.state === "closed") {
    return {
      label: "PR closed",
      colorClass: "text-zinc-500 dark:text-zinc-400/80",
      tooltip: `#${pr.number} PR closed: ${pr.title}`,
      url: pr.url,
    };
  }
  if (pr.state === "merged") {
    return {
      label: "PR merged",
      colorClass: "text-violet-600 dark:text-violet-300/90",
      tooltip: `#${pr.number} PR merged: ${pr.title}`,
      url: pr.url,
    };
  }
  return null;
}

export function resolveThreadPr(
  threadBranch: string | null,
  gitStatus: GitStatusResult | null,
): ThreadPr | null {
  if (threadBranch === null || gitStatus === null || gitStatus.branch !== threadBranch) {
    return null;
  }

  return gitStatus.pr ?? null;
}

export function terminalStatusFromRunningIds(
  runningTerminalIds: string[],
): TerminalStatusIndicator | null {
  if (runningTerminalIds.length === 0) {
    return null;
  }
  return {
    label: "Terminal process running",
    colorClass: "text-teal-600 dark:text-teal-300/90",
    pulse: true,
  };
}

export function ciStatusIndicator(
  checks: GitPullRequestChecksSummary | null | undefined,
): CiStatusIndicator | null {
  if (!checks || checks.totalCount === 0 || checks.status === "unknown") {
    return null;
  }

  const countSummary = `${checks.passCount} passed, ${checks.failCount} failed, ${checks.pendingCount} pending`;
  if (checks.status === "failing") {
    return {
      label: "GitHub Actions failing",
      colorClass: "text-destructive",
      tooltip: `GitHub Actions failing: ${countSummary}`,
    };
  }
  if (checks.status === "pending") {
    return {
      label: "GitHub Actions pending",
      colorClass: "text-amber-600 dark:text-amber-300/90",
      tooltip: `GitHub Actions pending: ${countSummary}`,
    };
  }
  if (checks.status === "passing") {
    return {
      label: "GitHub Actions passing",
      colorClass: "text-emerald-600 dark:text-emerald-300/90",
      tooltip: `GitHub Actions passing: ${checks.passCount}/${checks.totalCount} passed`,
    };
  }
  if (checks.status === "cancelled") {
    return {
      label: "GitHub Actions cancelled",
      colorClass: "text-muted-foreground/70",
      tooltip: `GitHub Actions cancelled: ${checks.cancelCount}/${checks.totalCount} cancelled`,
    };
  }
  if (checks.status === "skipped") {
    return {
      label: "GitHub Actions skipped",
      colorClass: "text-muted-foreground/60",
      tooltip: `GitHub Actions skipped: ${checks.skippingCount}/${checks.totalCount} skipped`,
    };
  }
  return null;
}

function ThreadStatusGlyph({
  kind,
  className,
}: {
  kind: ThreadStatusIndicatorKind;
  className: string;
}) {
  if (kind === "approval") return <CircleAlertIcon className={className} />;
  if (kind === "input") return <Clock3Icon className={className} />;
  if (kind === "error") return <CircleAlertIcon className={className} />;
  if (kind === "planning") return <ListTodoIcon className={className} />;
  if (kind === "working") return <LoaderCircleIcon className={className} />;
  if (kind === "connecting") return <LoaderCircleIcon className={className} />;
  if (kind === "plan") return <ListTodoIcon className={className} />;
  return <CircleCheckIcon className={className} />;
}

export function ThreadStatusIcon({ status }: { status: ThreadStatusIndicator }) {
  const iconClassName = `size-3 ${status.spin ? "animate-spin" : status.pulse ? "animate-pulse" : ""}`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={status.tooltip}
            className={`inline-flex size-3.5 shrink-0 items-center justify-center ${status.colorClass}`}
          />
        }
      >
        <ThreadStatusGlyph kind={status.kind} className={iconClassName} />
      </TooltipTrigger>
      <TooltipPopup side="top">{status.tooltip}</TooltipPopup>
    </Tooltip>
  );
}

export function ThreadLifecycleStatusIcons({
  statuses,
}: {
  statuses: readonly ThreadStatusIndicator[];
}) {
  if (statuses.length === 0) {
    return null;
  }

  return (
    <>
      {statuses.map((status) => (
        <ThreadStatusIcon key={status.kind} status={status} />
      ))}
    </>
  );
}

export function CiStatusIcon({ status }: { status: CiStatusIndicator }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={status.tooltip}
            className={`inline-flex size-3.5 shrink-0 items-center justify-center ${status.colorClass}`}
          />
        }
      >
        {status.label.includes("failing") ? (
          <CircleAlertIcon className="size-3" />
        ) : status.label.includes("pending") ? (
          <Clock3Icon className="size-3 animate-pulse" />
        ) : status.label.includes("passing") ? (
          <CheckIcon className="size-3" />
        ) : status.label.includes("cancelled") ? (
          <XIcon className="size-3" />
        ) : (
          <CircleCheckIcon className="size-3" />
        )}
      </TooltipTrigger>
      <TooltipPopup side="top">{status.tooltip}</TooltipPopup>
    </Tooltip>
  );
}

/**
 * Non-interactive leading status icons for a thread row in compact contexts
 * like the command palette. Shows the PR state icon (if present) and the
 * thread status dot, matching the sidebar's leading indicators.
 */
export function ThreadRowLeadingStatus({ thread }: { thread: SidebarThreadSummary }) {
  const threadRef = scopeThreadRef(thread.environmentId, thread.id);
  const lastVisitedAt = useUiStateStore(
    (state) => state.threadLastVisitedAtById[scopedThreadKey(threadRef)],
  );
  const threadProjectCwd = useStore(
    useMemo(
      () => (state: AppState) =>
        selectProjectByRef(state, scopeProjectRef(thread.environmentId, thread.projectId))?.cwd ??
        null,
      [thread.environmentId, thread.projectId],
    ),
  );
  const gitCwd = thread.worktreePath ?? threadProjectCwd;
  const gitStatus = useGitStatus({
    environmentId: thread.environmentId,
    cwd: thread.branch != null ? gitCwd : null,
  });
  const pr = resolveThreadPr(thread.branch, gitStatus.data);
  const prStatus = prStatusIndicator(pr);
  const threadStatuses = resolveThreadStatusIndicators({
    thread: {
      ...thread,
      lastVisitedAt,
    },
  });
  const ciStatus = ciStatusIndicator(pr?.checks);

  if (!prStatus && threadStatuses.length === 0 && !ciStatus) {
    return null;
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {prStatus ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                aria-label={prStatus.tooltip}
                className={`inline-flex items-center justify-center ${prStatus.colorClass}`}
              />
            }
          >
            <GitPullRequestIcon className="size-3" />
          </TooltipTrigger>
          <TooltipPopup side="top">{prStatus.tooltip}</TooltipPopup>
        </Tooltip>
      ) : null}
      {ciStatus ? <CiStatusIcon status={ciStatus} /> : null}
      <ThreadLifecycleStatusIcons statuses={threadStatuses} />
    </span>
  );
}

/**
 * Non-interactive trailing status icons for a thread row in compact contexts
 * like the command palette. Shows a terminal-running indicator and a remote
 * environment indicator, matching the sidebar's trailing indicators.
 */
export function ThreadRowTrailingStatus({ thread }: { thread: SidebarThreadSummary }) {
  const threadRef = scopeThreadRef(thread.environmentId, thread.id);
  const runningTerminalIds = useTerminalStateStore(
    (state) =>
      selectThreadTerminalState(state.terminalStateByThreadKey, threadRef).runningTerminalIds,
  );
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const isRemoteThread =
    primaryEnvironmentId !== null && thread.environmentId !== primaryEnvironmentId;
  const remoteEnvLabel = useSavedEnvironmentRuntimeStore(
    (state) => state.byId[thread.environmentId]?.descriptor?.label ?? null,
  );
  const remoteEnvSavedLabel = useSavedEnvironmentRegistryStore(
    (state) => state.byId[thread.environmentId]?.label ?? null,
  );
  const threadEnvironmentLabel = isRemoteThread
    ? (remoteEnvLabel ?? remoteEnvSavedLabel ?? "Remote")
    : null;
  const terminalStatus = terminalStatusFromRunningIds(runningTerminalIds);

  if (!terminalStatus && !isRemoteThread) {
    return null;
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {terminalStatus ? (
        <span
          role="img"
          aria-label={terminalStatus.label}
          title={terminalStatus.label}
          className={`inline-flex items-center justify-center ${terminalStatus.colorClass}`}
        >
          <TerminalIcon className={`size-3 ${terminalStatus.pulse ? "animate-pulse" : ""}`} />
        </span>
      ) : null}
      {isRemoteThread ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                aria-label={threadEnvironmentLabel ?? "Remote"}
                className="inline-flex items-center justify-center"
              />
            }
          >
            <CloudIcon className="size-3 text-muted-foreground/60" />
          </TooltipTrigger>
          <TooltipPopup side="top">{threadEnvironmentLabel}</TooltipPopup>
        </Tooltip>
      ) : null}
    </span>
  );
}
