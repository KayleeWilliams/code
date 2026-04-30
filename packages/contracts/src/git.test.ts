import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  GitCreateWorktreeInput,
  GitListWorktreesResult,
  GitPreparePullRequestThreadInput,
  GitStatusResult,
  GitRunStackedActionResult,
  GitRunStackedActionInput,
  GitResolvePullRequestResult,
} from "./git.ts";

const decodeCreateWorktreeInput = Schema.decodeUnknownSync(GitCreateWorktreeInput);
const decodeListWorktreesResult = Schema.decodeUnknownSync(GitListWorktreesResult);
const decodePreparePullRequestThreadInput = Schema.decodeUnknownSync(
  GitPreparePullRequestThreadInput,
);
const decodeRunStackedActionInput = Schema.decodeUnknownSync(GitRunStackedActionInput);
const decodeRunStackedActionResult = Schema.decodeUnknownSync(GitRunStackedActionResult);
const decodeResolvePullRequestResult = Schema.decodeUnknownSync(GitResolvePullRequestResult);
const decodeStatusResult = Schema.decodeUnknownSync(GitStatusResult);

describe("GitCreateWorktreeInput", () => {
  it("accepts omitted newBranch for existing-branch worktrees", () => {
    const parsed = decodeCreateWorktreeInput({
      cwd: "/repo",
      branch: "feature/existing",
      path: "/tmp/worktree",
    });

    expect(parsed.newBranch).toBeUndefined();
    expect(parsed.branch).toBe("feature/existing");
  });
});

describe("GitPreparePullRequestThreadInput", () => {
  it("accepts pull request references and mode", () => {
    const parsed = decodePreparePullRequestThreadInput({
      cwd: "/repo",
      reference: "#42",
      mode: "worktree",
    });

    expect(parsed.reference).toBe("#42");
    expect(parsed.mode).toBe("worktree");
  });
});

describe("GitListWorktreesResult", () => {
  it("decodes worktree inventory payloads", () => {
    const parsed = decodeListWorktreesResult({
      isRepo: true,
      cwd: "/repo",
      currentPath: "/repo",
      worktrees: [
        {
          path: "/repo",
          realPath: "/repo",
          branch: "main",
          head: "abc123",
          detached: false,
          bare: false,
          lockedReason: null,
          prunableReason: null,
          upstream: "origin/main",
          hasUpstream: true,
          isCurrent: true,
        },
      ],
    });

    expect(parsed.worktrees[0]?.branch).toBe("main");
    expect(parsed.worktrees[0]?.isCurrent).toBe(true);
  });

  it("accepts detached and prunable worktrees", () => {
    const parsed = decodeListWorktreesResult({
      isRepo: true,
      cwd: "/repo",
      currentPath: "/repo",
      worktrees: [
        {
          path: "/repo/missing",
          realPath: null,
          branch: null,
          head: "abc123",
          detached: true,
          bare: false,
          lockedReason: null,
          prunableReason: "gitdir file points to non-existent location",
          upstream: null,
          hasUpstream: false,
          isCurrent: false,
        },
      ],
    });

    expect(parsed.worktrees[0]?.branch).toBeNull();
    expect(parsed.worktrees[0]?.prunableReason).toContain("gitdir");
  });
});

describe("GitResolvePullRequestResult", () => {
  it("decodes resolved pull request metadata", () => {
    const parsed = decodeResolvePullRequestResult({
      pullRequest: {
        number: 42,
        title: "PR threads",
        url: "https://github.com/pingdotgg/codething-mvp/pull/42",
        baseBranch: "main",
        headBranch: "feature/pr-threads",
        state: "open",
      },
    });

    expect(parsed.pullRequest.number).toBe(42);
    expect(parsed.pullRequest.headBranch).toBe("feature/pr-threads");
  });
});

describe("GitStatusResult", () => {
  const baseStatus = {
    isRepo: true,
    hasOriginRemote: true,
    isDefaultBranch: false,
    branch: "feature/checks",
    hasWorkingTreeChanges: false,
    workingTree: {
      files: [],
      insertions: 0,
      deletions: 0,
    },
    hasUpstream: true,
    aheadCount: 0,
    behindCount: 0,
  };

  it("decodes pull request checks in status payloads", () => {
    const parsed = decodeStatusResult({
      ...baseStatus,
      pr: {
        number: 42,
        title: "Checks",
        url: "https://github.com/pingdotgg/codething-mvp/pull/42",
        baseBranch: "main",
        headBranch: "feature/checks",
        state: "open",
        checks: {
          status: "failing",
          totalCount: 2,
          passCount: 1,
          failCount: 1,
          pendingCount: 0,
          skippingCount: 0,
          cancelCount: 0,
          checks: [
            {
              name: "lint",
              workflow: "CI",
              state: "SUCCESS",
              bucket: "pass",
              link: "https://github.com/pingdotgg/codething-mvp/actions/runs/1",
              description: null,
              startedAt: "2026-04-29T12:00:00.000Z",
              completedAt: "2026-04-29T12:01:00.000Z",
            },
            {
              name: "typecheck",
              workflow: "CI",
              state: "FAILURE",
              bucket: "fail",
              link: null,
              description: "TypeScript failed",
              startedAt: null,
              completedAt: null,
            },
          ],
        },
      },
    });

    expect(parsed.pr?.checks?.status).toBe("failing");
    expect(parsed.pr?.checks?.failCount).toBe(1);
  });

  it("accepts status payloads without pull request checks", () => {
    const parsed = decodeStatusResult({
      ...baseStatus,
      pr: {
        number: 42,
        title: "Checks",
        url: "https://github.com/pingdotgg/codething-mvp/pull/42",
        baseBranch: "main",
        headBranch: "feature/checks",
        state: "open",
      },
    });

    expect(parsed.pr?.checks).toBeUndefined();
  });
});

describe("GitRunStackedActionInput", () => {
  it("accepts explicit stacked actions and requires a client-provided actionId", () => {
    const parsed = decodeRunStackedActionInput({
      actionId: "action-1",
      cwd: "/repo",
      action: "create_pr",
    });

    expect(parsed.actionId).toBe("action-1");
    expect(parsed.action).toBe("create_pr");
  });
});

describe("GitRunStackedActionResult", () => {
  it("decodes a server-authored completion toast", () => {
    const parsed = decodeRunStackedActionResult({
      action: "commit_push",
      branch: {
        status: "created",
        name: "feature/server-owned-toast",
      },
      commit: {
        status: "created",
        commitSha: "89abcdef01234567",
        subject: "feat: move toast state into git manager",
      },
      push: {
        status: "pushed",
        branch: "feature/server-owned-toast",
        upstreamBranch: "origin/feature/server-owned-toast",
      },
      pr: {
        status: "skipped_not_requested",
      },
      toast: {
        title: "Pushed 89abcde to origin/feature/server-owned-toast",
        description: "feat: move toast state into git manager",
        cta: {
          kind: "run_action",
          label: "Create PR",
          action: {
            kind: "create_pr",
          },
        },
      },
    });

    expect(parsed.toast.cta.kind).toBe("run_action");
    if (parsed.toast.cta.kind === "run_action") {
      expect(parsed.toast.cta.action.kind).toBe("create_pr");
    }
  });
});
