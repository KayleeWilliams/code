import * as React from "react";
import type { GitWorktree } from "@t3tools/contracts";
import type { SidebarProjectSortOrder, SidebarThreadSortOrder } from "@t3tools/contracts/settings";
import {
  getThreadSortTimestamp,
  sortThreads,
  toSortableTimestamp,
  type ThreadSortInput,
} from "../lib/threadSort";
import type { SidebarThreadSummary, Thread } from "../types";
import { cn } from "../lib/utils";
import { isLatestTurnSettled } from "../session-logic";

export const THREAD_SELECTION_SAFE_SELECTOR = "[data-thread-item], [data-thread-selection-safe]";
export const THREAD_JUMP_HINT_SHOW_DELAY_MS = 100;
// Visible sidebar rows are prewarmed into the thread-detail cache so opening a
// nearby thread usually reuses an already-hot subscription.
export const SIDEBAR_THREAD_PREWARM_LIMIT = 10;
export type SidebarNewThreadEnvMode = "local" | "worktree";
export interface ExternalWorktreeRow {
  id: string;
  path: string;
  realPath: string | null;
  branch: string | null;
  head: string | null;
  detached: boolean;
  lockedReason: string | null;
  prunableReason: string | null;
  upstream: string | null;
  hasUpstream: boolean;
  disabled: boolean;
  stale: boolean;
  staleReason: string | null;
  label: string;
}

type SidebarProject = {
  id: string;
  name: string;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

export type ThreadTraversalDirection = "previous" | "next";

export type ThreadStatusIndicatorKind =
  | "approval"
  | "input"
  | "error"
  | "planning"
  | "working"
  | "connecting"
  | "plan"
  | "completed";

export interface ThreadStatusIndicator {
  kind: ThreadStatusIndicatorKind;
  label:
    | "Working"
    | "Connecting"
    | "Completed"
    | "Pending Approval"
    | "Awaiting Input"
    | "Error"
    | "Planning"
    | "Plan Ready";
  tooltip: string;
  colorClass: string;
  pulse?: boolean;
  spin?: boolean;
  priority: number;
}

export type ThreadStatusPill = ThreadStatusIndicator & {
  dotClass: string;
  pulse: boolean;
};

const THREAD_STATUS_PRIORITY: Record<ThreadStatusIndicator["label"], number> = {
  Error: 7,
  "Pending Approval": 6,
  "Awaiting Input": 5,
  Planning: 4,
  Working: 3,
  Connecting: 3,
  "Plan Ready": 2,
  Completed: 1,
};

type ThreadStatusInput = Pick<
  SidebarThreadSummary,
  | "hasActionableProposedPlan"
  | "hasPendingApprovals"
  | "hasPendingUserInput"
  | "interactionMode"
  | "latestTurn"
  | "session"
> & {
  lastVisitedAt?: string | undefined;
};

export interface ThreadJumpHintVisibilityController {
  sync: (shouldShow: boolean) => void;
  dispose: () => void;
}

export function createThreadJumpHintVisibilityController(input: {
  delayMs: number;
  onVisibilityChange: (visible: boolean) => void;
  setTimeoutFn?: typeof globalThis.setTimeout;
  clearTimeoutFn?: typeof globalThis.clearTimeout;
}): ThreadJumpHintVisibilityController {
  const setTimeoutFn = input.setTimeoutFn ?? globalThis.setTimeout;
  const clearTimeoutFn = input.clearTimeoutFn ?? globalThis.clearTimeout;
  let isVisible = false;
  let timeoutId: NodeJS.Timeout | null = null;

  const clearPendingShow = () => {
    if (timeoutId === null) {
      return;
    }
    clearTimeoutFn(timeoutId);
    timeoutId = null;
  };

  return {
    sync: (shouldShow) => {
      if (!shouldShow) {
        clearPendingShow();
        if (isVisible) {
          isVisible = false;
          input.onVisibilityChange(false);
        }
        return;
      }

      if (isVisible || timeoutId !== null) {
        return;
      }

      timeoutId = setTimeoutFn(() => {
        timeoutId = null;
        isVisible = true;
        input.onVisibilityChange(true);
      }, input.delayMs);
    },
    dispose: () => {
      clearPendingShow();
    },
  };
}

export function useThreadJumpHintVisibility(): {
  showThreadJumpHints: boolean;
  updateThreadJumpHintsVisibility: (shouldShow: boolean) => void;
} {
  const [showThreadJumpHints, setShowThreadJumpHints] = React.useState(false);
  const controllerRef = React.useRef<ThreadJumpHintVisibilityController | null>(null);

  React.useEffect(() => {
    const controller = createThreadJumpHintVisibilityController({
      delayMs: THREAD_JUMP_HINT_SHOW_DELAY_MS,
      onVisibilityChange: (visible) => {
        setShowThreadJumpHints(visible);
      },
      setTimeoutFn: window.setTimeout.bind(window),
      clearTimeoutFn: window.clearTimeout.bind(window),
    });
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const updateThreadJumpHintsVisibility = React.useCallback((shouldShow: boolean) => {
    controllerRef.current?.sync(shouldShow);
  }, []);

  return {
    showThreadJumpHints,
    updateThreadJumpHintsVisibility,
  };
}

export function hasUnseenCompletion(thread: ThreadStatusInput): boolean {
  if (!thread.latestTurn?.completedAt) return false;
  const completedAt = Date.parse(thread.latestTurn.completedAt);
  if (Number.isNaN(completedAt)) return false;
  if (!thread.lastVisitedAt) return true;

  const lastVisitedAt = Date.parse(thread.lastVisitedAt);
  if (Number.isNaN(lastVisitedAt)) return true;
  return completedAt > lastVisitedAt;
}

export function shouldClearThreadSelectionOnMouseDown(target: HTMLElement | null): boolean {
  if (target === null) return true;
  return !target.closest(THREAD_SELECTION_SAFE_SELECTOR);
}

export function resolveSidebarNewThreadEnvMode(input: {
  requestedEnvMode?: SidebarNewThreadEnvMode;
  defaultEnvMode: SidebarNewThreadEnvMode;
}): SidebarNewThreadEnvMode {
  return input.requestedEnvMode ?? input.defaultEnvMode;
}

export function resolveSidebarNewThreadSeedContext(input: {
  projectId: string;
  defaultEnvMode: SidebarNewThreadEnvMode;
  activeThread?: {
    projectId: string;
    branch: string | null;
    worktreePath: string | null;
  } | null;
  activeDraftThread?: {
    projectId: string;
    branch: string | null;
    worktreePath: string | null;
    envMode: SidebarNewThreadEnvMode;
  } | null;
}): {
  branch?: string | null;
  worktreePath?: string | null;
  envMode: SidebarNewThreadEnvMode;
} {
  if (input.defaultEnvMode === "worktree") {
    return {
      envMode: "worktree",
    };
  }

  if (input.activeDraftThread?.projectId === input.projectId) {
    return {
      branch: input.activeDraftThread.branch,
      worktreePath: input.activeDraftThread.worktreePath,
      envMode: input.activeDraftThread.envMode,
    };
  }

  if (input.activeThread?.projectId === input.projectId) {
    return {
      branch: input.activeThread.branch,
      worktreePath: input.activeThread.worktreePath,
      envMode: input.activeThread.worktreePath ? "worktree" : "local",
    };
  }

  return {
    envMode: input.defaultEnvMode,
  };
}

export function orderItemsByPreferredIds<TItem, TId>(input: {
  items: readonly TItem[];
  preferredIds: readonly TId[];
  getId: (item: TItem) => TId;
}): TItem[] {
  const { getId, items, preferredIds } = input;
  if (preferredIds.length === 0) {
    return [...items];
  }

  const itemsById = new Map(items.map((item) => [getId(item), item] as const));
  const preferredIdSet = new Set(preferredIds);
  const emittedPreferredIds = new Set<TId>();
  const ordered = preferredIds.flatMap((id) => {
    if (emittedPreferredIds.has(id)) {
      return [];
    }
    const item = itemsById.get(id);
    if (!item) {
      return [];
    }
    emittedPreferredIds.add(id);
    return [item];
  });
  const remaining = items.filter((item) => !preferredIdSet.has(getId(item)));
  return [...ordered, ...remaining];
}

function normalizeWorktreePathKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

function basenameFromPath(value: string): string {
  const segments = value.replace(/\\/g, "/").split("/");
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment && segment.length > 0) {
      return segment;
    }
  }
  return value;
}

function worktreeMatchKeys(worktree: Pick<GitWorktree, "path" | "realPath">): string[] {
  return [normalizeWorktreePathKey(worktree.path), normalizeWorktreePathKey(worktree.realPath)]
    .filter((value): value is string => value !== null)
    .toSorted();
}

export function deriveExternalWorktreeRows(input: {
  worktrees: readonly GitWorktree[];
  projectCwd: string;
  existingThreads: readonly { worktreePath: string | null }[];
  draftThreads: readonly { worktreePath: string | null }[];
}): ExternalWorktreeRow[] {
  const linkedPathKeys = new Set<string>();
  for (const linked of [...input.existingThreads, ...input.draftThreads]) {
    const key = normalizeWorktreePathKey(linked.worktreePath);
    if (key) {
      linkedPathKeys.add(key);
    }
  }

  const projectCwdKey = normalizeWorktreePathKey(input.projectCwd);
  const seenKeys = new Set<string>();
  const rows: ExternalWorktreeRow[] = [];

  for (const worktree of input.worktrees) {
    const keys = worktreeMatchKeys(worktree);
    if (
      worktree.isCurrent ||
      (projectCwdKey !== null && keys.includes(projectCwdKey)) ||
      keys.some((key) => linkedPathKeys.has(key)) ||
      keys.some((key) => seenKeys.has(key))
    ) {
      continue;
    }

    for (const key of keys) {
      seenKeys.add(key);
    }

    const fallbackName = basenameFromPath(worktree.path);
    rows.push({
      id: keys[0] ?? worktree.path,
      path: worktree.path,
      realPath: worktree.realPath,
      branch: worktree.branch,
      head: worktree.head,
      detached: worktree.detached,
      lockedReason: worktree.lockedReason,
      prunableReason: worktree.prunableReason,
      upstream: worktree.upstream,
      hasUpstream: worktree.hasUpstream,
      disabled: worktree.prunableReason !== null,
      stale:
        worktree.prunableReason !== null ||
        worktree.detached ||
        (worktree.branch !== null && !worktree.hasUpstream),
      staleReason:
        worktree.prunableReason ??
        (worktree.detached
          ? "Detached worktree"
          : worktree.branch !== null && !worktree.hasUpstream
            ? "No upstream branch"
            : null),
      label: worktree.branch ?? (fallbackName.length > 0 ? fallbackName : "Detached worktree"),
    });
  }

  return rows.toSorted((left, right) => {
    if (left.disabled !== right.disabled) {
      return left.disabled ? 1 : -1;
    }
    if (left.stale !== right.stale) {
      return left.stale ? 1 : -1;
    }
    const branchCompare = (left.branch ?? "").localeCompare(right.branch ?? "");
    if (branchCompare !== 0) {
      return branchCompare;
    }
    return left.path.localeCompare(right.path);
  });
}

export function getVisibleSidebarThreadIds<TThreadId>(
  renderedProjects: readonly {
    shouldShowThreadPanel?: boolean;
    renderedThreadIds: readonly TThreadId[];
  }[],
): TThreadId[] {
  return renderedProjects.flatMap((renderedProject) =>
    renderedProject.shouldShowThreadPanel === false ? [] : renderedProject.renderedThreadIds,
  );
}

export function getSidebarThreadIdsToPrewarm<TThreadId>(
  visibleThreadIds: readonly TThreadId[],
  limit = SIDEBAR_THREAD_PREWARM_LIMIT,
): TThreadId[] {
  return visibleThreadIds.slice(0, Math.max(0, limit));
}

export function resolveAdjacentThreadId<T>(input: {
  threadIds: readonly T[];
  currentThreadId: T | null;
  direction: ThreadTraversalDirection;
}): T | null {
  const { currentThreadId, direction, threadIds } = input;

  if (threadIds.length === 0) {
    return null;
  }

  if (currentThreadId === null) {
    return direction === "previous" ? (threadIds.at(-1) ?? null) : (threadIds[0] ?? null);
  }

  const currentIndex = threadIds.indexOf(currentThreadId);
  if (currentIndex === -1) {
    return null;
  }

  if (direction === "previous") {
    return currentIndex > 0 ? (threadIds[currentIndex - 1] ?? null) : null;
  }

  return currentIndex < threadIds.length - 1 ? (threadIds[currentIndex + 1] ?? null) : null;
}

export function isContextMenuPointerDown(input: {
  button: number;
  ctrlKey: boolean;
  isMac: boolean;
}): boolean {
  if (input.button === 2) return true;
  return input.isMac && input.button === 0 && input.ctrlKey;
}

export function resolveThreadRowClassName(input: {
  isActive: boolean;
  isSelected: boolean;
}): string {
  const baseClassName =
    "h-7 w-full translate-x-0 cursor-pointer justify-start px-2 text-left select-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring";

  if (input.isSelected && input.isActive) {
    return cn(
      baseClassName,
      "bg-primary/22 text-foreground font-medium hover:bg-primary/26 hover:text-foreground dark:bg-primary/30 dark:hover:bg-primary/36",
    );
  }

  if (input.isSelected) {
    return cn(
      baseClassName,
      "bg-primary/15 text-foreground hover:bg-primary/19 hover:text-foreground dark:bg-primary/22 dark:hover:bg-primary/28",
    );
  }

  if (input.isActive) {
    return cn(
      baseClassName,
      "bg-accent/85 text-foreground font-medium hover:bg-accent hover:text-foreground dark:bg-accent/55 dark:hover:bg-accent/70",
    );
  }

  return cn(baseClassName, "text-muted-foreground hover:bg-accent hover:text-foreground");
}

export function resolveThreadStatusPill(input: {
  thread: ThreadStatusInput;
}): ThreadStatusPill | null {
  const [status] = resolveThreadStatusIndicators(input);
  if (!status) {
    return null;
  }

  return {
    ...status,
    dotClass: colorClassToDotClass(status.colorClass),
    pulse: status.pulse ?? status.spin ?? false,
  };
}

function colorClassToDotClass(colorClass: string): string {
  if (colorClass.includes("destructive") || colorClass.includes("red")) {
    return "bg-destructive";
  }
  if (colorClass.includes("amber")) {
    return "bg-amber-500 dark:bg-amber-300/90";
  }
  if (colorClass.includes("indigo")) {
    return "bg-indigo-500 dark:bg-indigo-300/90";
  }
  if (colorClass.includes("sky")) {
    return "bg-sky-500 dark:bg-sky-300/80";
  }
  if (colorClass.includes("violet")) {
    return "bg-violet-500 dark:bg-violet-300/90";
  }
  return "bg-emerald-500 dark:bg-emerald-300/90";
}

export function resolveThreadStatusIndicators(input: {
  thread: ThreadStatusInput;
}): ThreadStatusIndicator[] {
  const { thread } = input;
  const statuses: ThreadStatusIndicator[] = [];

  if (thread.hasPendingApprovals) {
    statuses.push({
      kind: "approval",
      label: "Pending Approval",
      tooltip: "Pending approval",
      colorClass: "text-amber-600 dark:text-amber-300/90",
      priority: THREAD_STATUS_PRIORITY["Pending Approval"],
    });
  }

  if (thread.hasPendingUserInput) {
    statuses.push({
      kind: "input",
      label: "Awaiting Input",
      tooltip: "Awaiting input",
      colorClass: "text-indigo-600 dark:text-indigo-300/90",
      priority: THREAD_STATUS_PRIORITY["Awaiting Input"],
    });
  }

  if (thread.session?.status === "error" || Boolean(thread.session?.lastError)) {
    statuses.push({
      kind: "error",
      label: "Error",
      tooltip: thread.session?.lastError ?? "Thread error",
      colorClass: "text-destructive",
      priority: THREAD_STATUS_PRIORITY.Error,
    });
  }

  if (thread.session?.status === "running" && thread.interactionMode === "plan") {
    statuses.push({
      kind: "planning",
      label: "Planning",
      tooltip: "Planning in progress",
      colorClass: "text-violet-600 dark:text-violet-300/90",
      pulse: true,
      priority: THREAD_STATUS_PRIORITY.Planning,
    });
  } else if (thread.session?.status === "running") {
    statuses.push({
      kind: "working",
      label: "Working",
      tooltip: "Working",
      colorClass: "text-sky-600 dark:text-sky-300/80",
      spin: true,
      priority: THREAD_STATUS_PRIORITY.Working,
    });
  }

  if (thread.session?.status === "connecting") {
    statuses.push({
      kind: "connecting",
      label: "Connecting",
      tooltip: "Connecting",
      colorClass: "text-sky-600 dark:text-sky-300/80",
      pulse: true,
      priority: THREAD_STATUS_PRIORITY.Connecting,
    });
  }

  const hasPlanReadyPrompt =
    !thread.hasPendingUserInput &&
    thread.interactionMode === "plan" &&
    isLatestTurnSettled(thread.latestTurn, thread.session) &&
    thread.hasActionableProposedPlan;
  if (hasPlanReadyPrompt) {
    statuses.push({
      kind: "plan",
      label: "Plan Ready",
      tooltip: "Plan ready",
      colorClass: "text-violet-600 dark:text-violet-300/90",
      priority: THREAD_STATUS_PRIORITY["Plan Ready"],
    });
  }

  if (hasUnseenCompletion(thread)) {
    statuses.push({
      kind: "completed",
      label: "Completed",
      tooltip: "Completed since last viewed",
      colorClass: "text-emerald-600 dark:text-emerald-300/90",
      priority: THREAD_STATUS_PRIORITY.Completed,
    });
  }

  const [highestPriorityStatus] = statuses.toSorted(
    (left, right) => right.priority - left.priority,
  );
  return highestPriorityStatus ? [highestPriorityStatus] : [];
}

export function resolveProjectStatusIndicator(
  statuses: ReadonlyArray<ThreadStatusPill | null>,
): ThreadStatusPill | null {
  let highestPriorityStatus: ThreadStatusPill | null = null;

  for (const status of statuses) {
    if (status === null) continue;
    if (
      highestPriorityStatus === null ||
      THREAD_STATUS_PRIORITY[status.label] > THREAD_STATUS_PRIORITY[highestPriorityStatus.label]
    ) {
      highestPriorityStatus = status;
    }
  }

  return highestPriorityStatus;
}

export function resolveProjectStatusIndicators(
  statusGroups: ReadonlyArray<ReadonlyArray<ThreadStatusIndicator>>,
  limit = 3,
): ThreadStatusIndicator[] {
  const byKind = new Map<ThreadStatusIndicatorKind, ThreadStatusIndicator>();

  for (const statuses of statusGroups) {
    for (const status of statuses) {
      const current = byKind.get(status.kind);
      if (!current || status.priority > current.priority) {
        byKind.set(status.kind, status);
      }
    }
  }

  return Array.from(byKind.values())
    .toSorted((left, right) => right.priority - left.priority)
    .slice(0, limit);
}

export function getVisibleThreadsForProject<T extends Pick<Thread, "id">>(input: {
  threads: readonly T[];
  activeThreadId: T["id"] | undefined;
  isThreadListExpanded: boolean;
  previewLimit: number;
}): {
  hasHiddenThreads: boolean;
  visibleThreads: T[];
  hiddenThreads: T[];
} {
  const { activeThreadId, isThreadListExpanded, previewLimit, threads } = input;
  const hasHiddenThreads = threads.length > previewLimit;

  if (!hasHiddenThreads || isThreadListExpanded) {
    return {
      hasHiddenThreads,
      hiddenThreads: [],
      visibleThreads: [...threads],
    };
  }

  const previewThreads = threads.slice(0, previewLimit);
  if (!activeThreadId || previewThreads.some((thread) => thread.id === activeThreadId)) {
    return {
      hasHiddenThreads: true,
      hiddenThreads: threads.slice(previewLimit),
      visibleThreads: previewThreads,
    };
  }

  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  if (!activeThread) {
    return {
      hasHiddenThreads: true,
      hiddenThreads: threads.slice(previewLimit),
      visibleThreads: previewThreads,
    };
  }

  const visibleThreadIds = new Set([...previewThreads, activeThread].map((thread) => thread.id));

  return {
    hasHiddenThreads: true,
    hiddenThreads: threads.filter((thread) => !visibleThreadIds.has(thread.id)),
    visibleThreads: threads.filter((thread) => visibleThreadIds.has(thread.id)),
  };
}

export function getFallbackThreadIdAfterDelete<
  T extends Pick<Thread, "id" | "projectId" | "createdAt" | "updatedAt"> & ThreadSortInput,
>(input: {
  threads: readonly T[];
  deletedThreadId: T["id"];
  sortOrder: SidebarThreadSortOrder;
  deletedThreadIds?: ReadonlySet<T["id"]>;
}): T["id"] | null {
  const { deletedThreadId, deletedThreadIds, sortOrder, threads } = input;
  const deletedThread = threads.find((thread) => thread.id === deletedThreadId);
  if (!deletedThread) {
    return null;
  }

  return (
    sortThreads(
      threads.filter(
        (thread) =>
          thread.projectId === deletedThread.projectId &&
          thread.id !== deletedThreadId &&
          !deletedThreadIds?.has(thread.id),
      ),
      sortOrder,
    )[0]?.id ?? null
  );
}
export function getProjectSortTimestamp(
  project: SidebarProject,
  projectThreads: readonly ThreadSortInput[],
  sortOrder: Exclude<SidebarProjectSortOrder, "manual">,
): number {
  if (projectThreads.length > 0) {
    return projectThreads.reduce(
      (latest, thread) => Math.max(latest, getThreadSortTimestamp(thread, sortOrder)),
      Number.NEGATIVE_INFINITY,
    );
  }

  if (sortOrder === "created_at") {
    return toSortableTimestamp(project.createdAt) ?? Number.NEGATIVE_INFINITY;
  }
  return toSortableTimestamp(project.updatedAt ?? project.createdAt) ?? Number.NEGATIVE_INFINITY;
}

export function sortProjectsForSidebar<
  TProject extends SidebarProject,
  TThread extends Pick<Thread, "projectId" | "createdAt" | "updatedAt"> & ThreadSortInput,
>(
  projects: readonly TProject[],
  threads: readonly TThread[],
  sortOrder: SidebarProjectSortOrder,
): TProject[] {
  if (sortOrder === "manual") {
    return [...projects];
  }

  const threadsByProjectId = new Map<string, TThread[]>();
  for (const thread of threads) {
    const existing = threadsByProjectId.get(thread.projectId) ?? [];
    existing.push(thread);
    threadsByProjectId.set(thread.projectId, existing);
  }

  return [...projects].toSorted((left, right) => {
    const rightTimestamp = getProjectSortTimestamp(
      right,
      threadsByProjectId.get(right.id) ?? [],
      sortOrder,
    );
    const leftTimestamp = getProjectSortTimestamp(
      left,
      threadsByProjectId.get(left.id) ?? [],
      sortOrder,
    );
    const byTimestamp =
      rightTimestamp === leftTimestamp ? 0 : rightTimestamp > leftTimestamp ? 1 : -1;
    if (byTimestamp !== 0) return byTimestamp;
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
  });
}
