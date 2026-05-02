import type { GitStatusRemoteResult, GitStatusResult } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  buildGeneratedWorktreeBranchName,
  applyGitStatusStreamEvent,
  buildTemporaryWorktreeBranchName,
  DEFAULT_WORKTREE_BRANCH_PREFIX,
  isTemporaryWorktreeBranch,
  normalizeGitRemoteUrl,
  parseGitWorktreePorcelain,
  parseGitHubRepositoryNameWithOwnerFromRemoteUrl,
  resolveWorktreeBranchPrefix,
  sanitizeWorktreeBranchPrefix,
  WORKTREE_BRANCH_PREFIX,
} from "./git.ts";

describe("normalizeGitRemoteUrl", () => {
  it("canonicalizes equivalent GitHub remotes across protocol variants", () => {
    expect(normalizeGitRemoteUrl("git@github.com:T3Tools/T3Code.git")).toBe(
      "github.com/t3tools/t3code",
    );
    expect(normalizeGitRemoteUrl("https://github.com/T3Tools/T3Code.git")).toBe(
      "github.com/t3tools/t3code",
    );
    expect(normalizeGitRemoteUrl("ssh://git@github.com/T3Tools/T3Code")).toBe(
      "github.com/t3tools/t3code",
    );
  });

  it("preserves nested group paths for providers like GitLab", () => {
    expect(normalizeGitRemoteUrl("git@gitlab.com:T3Tools/platform/T3Code.git")).toBe(
      "gitlab.com/t3tools/platform/t3code",
    );
    expect(normalizeGitRemoteUrl("https://gitlab.com/T3Tools/platform/T3Code.git")).toBe(
      "gitlab.com/t3tools/platform/t3code",
    );
  });

  it("drops explicit ports from URL-shaped remotes", () => {
    expect(normalizeGitRemoteUrl("https://gitlab.company.com:8443/team/project.git")).toBe(
      "gitlab.company.com/team/project",
    );
    expect(normalizeGitRemoteUrl("ssh://git@gitlab.company.com:2222/team/project.git")).toBe(
      "gitlab.company.com/team/project",
    );
  });
});

describe("parseGitHubRepositoryNameWithOwnerFromRemoteUrl", () => {
  it("extracts the owner and repository from common GitHub remote shapes", () => {
    expect(
      parseGitHubRepositoryNameWithOwnerFromRemoteUrl("git@github.com:T3Tools/T3Code.git"),
    ).toBe("T3Tools/T3Code");
    expect(
      parseGitHubRepositoryNameWithOwnerFromRemoteUrl("https://github.com/T3Tools/T3Code.git"),
    ).toBe("T3Tools/T3Code");
  });
});

describe("isTemporaryWorktreeBranch", () => {
  it("matches the generated temporary worktree branch format", () => {
    expect(isTemporaryWorktreeBranch(buildTemporaryWorktreeBranchName())).toBe(true);
  });

  it("uses the configurable temporary worktree branch prefix", () => {
    const branch = buildTemporaryWorktreeBranchName("team");
    expect(branch.startsWith("team/")).toBe(true);
    expect(isTemporaryWorktreeBranch(branch, "team")).toBe(true);
  });

  it("falls back to the default temporary branch prefix when configured prefix is empty", () => {
    expect(sanitizeWorktreeBranchPrefix("   ")).toBe(DEFAULT_WORKTREE_BRANCH_PREFIX);
    expect(
      buildTemporaryWorktreeBranchName("   ").startsWith(`${DEFAULT_WORKTREE_BRANCH_PREFIX}/`),
    ).toBe(true);
  });

  it("matches generated temporary worktree branches", () => {
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/deadbeef`)).toBe(true);
    expect(isTemporaryWorktreeBranch(` ${WORKTREE_BRANCH_PREFIX}/deadbeef `)).toBe(true);
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/DEADBEEF`)).toBe(true);
  });

  it("rejects non-temporary branch names", () => {
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/feature/demo`)).toBe(false);
    expect(isTemporaryWorktreeBranch("main")).toBe(false);
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/deadbeef-extra`)).toBe(false);
  });

  it("keeps legacy t3code temporary branch recognition when a custom prefix is configured", () => {
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/deadbeef`, "team")).toBe(true);
  });

  it("uses the repository owner when the configured prefix is still the default", () => {
    expect(
      resolveWorktreeBranchPrefix({
        configuredPrefix: DEFAULT_WORKTREE_BRANCH_PREFIX,
        repositoryOwner: "KayleeWilliams",
      }),
    ).toBe("KayleeWilliams");
  });

  it("keeps an explicit custom worktree branch prefix", () => {
    expect(
      resolveWorktreeBranchPrefix({
        configuredPrefix: "team",
        repositoryOwner: "KayleeWilliams",
      }),
    ).toBe("team");
  });
});

describe("buildGeneratedWorktreeBranchName", () => {
  it("uses a configurable generated branch namespace", () => {
    expect(buildGeneratedWorktreeBranchName("Add billing", "team")).toBe("team/add-billing");
  });

  it("removes temporary and generated namespaces before rebuilding the branch name", () => {
    expect(buildGeneratedWorktreeBranchName("work/add billing", "feature")).toBe(
      "feature/add-billing",
    );
    expect(buildGeneratedWorktreeBranchName("t3code/add billing", "team")).toBe("team/add-billing");
  });
});

describe("parseGitWorktreePorcelain", () => {
  it("parses multiple worktree records and strips refs/heads prefixes", () => {
    expect(
      parseGitWorktreePorcelain(
        [
          "worktree /repo/main",
          "HEAD abc123",
          "branch refs/heads/main",
          "",
          "worktree /Users/kaylee/Conductor Worktrees/feature demo",
          "HEAD def456",
          "branch refs/heads/feature/demo",
          "",
        ].join("\n"),
      ),
    ).toEqual([
      {
        path: "/repo/main",
        branch: "main",
        head: "abc123",
        detached: false,
        bare: false,
        lockedReason: null,
        prunableReason: null,
      },
      {
        path: "/Users/kaylee/Conductor Worktrees/feature demo",
        branch: "feature/demo",
        head: "def456",
        detached: false,
        bare: false,
        lockedReason: null,
        prunableReason: null,
      },
    ]);
  });

  it("handles detached, bare, locked, and prunable worktrees", () => {
    expect(
      parseGitWorktreePorcelain(
        [
          "worktree /repo/detached",
          "HEAD abc123",
          "detached",
          "locked agent is running",
          "",
          "worktree /repo/missing",
          "HEAD def456",
          "branch refs/heads/stale",
          "bare",
          "prunable gitdir file points to non-existent location",
          "",
        ].join("\n"),
      ),
    ).toEqual([
      {
        path: "/repo/detached",
        branch: null,
        head: "abc123",
        detached: true,
        bare: false,
        lockedReason: "agent is running",
        prunableReason: null,
      },
      {
        path: "/repo/missing",
        branch: "stale",
        head: "def456",
        detached: false,
        bare: true,
        lockedReason: null,
        prunableReason: "gitdir file points to non-existent location",
      },
    ]);
  });
});

describe("applyGitStatusStreamEvent", () => {
  it("treats a remote-only update as a repository when local state is missing", () => {
    const remote: GitStatusRemoteResult = {
      hasUpstream: true,
      aheadCount: 2,
      behindCount: 1,
      pr: null,
    };

    expect(applyGitStatusStreamEvent(null, { _tag: "remoteUpdated", remote })).toEqual({
      isRepo: true,
      hasOriginRemote: false,
      isDefaultBranch: false,
      branch: null,
      hasWorkingTreeChanges: false,
      workingTree: { files: [], insertions: 0, deletions: 0 },
      hasUpstream: true,
      aheadCount: 2,
      behindCount: 1,
      pr: null,
    });
  });

  it("preserves local-only fields when applying a remote update", () => {
    const current: GitStatusResult = {
      isRepo: true,
      hostingProvider: {
        kind: "github",
        name: "GitHub",
        baseUrl: "https://github.com",
      },
      hasOriginRemote: true,
      isDefaultBranch: false,
      branch: "feature/demo",
      hasWorkingTreeChanges: true,
      workingTree: {
        files: [{ path: "src/demo.ts", insertions: 1, deletions: 0 }],
        insertions: 1,
        deletions: 0,
      },
      hasUpstream: false,
      aheadCount: 0,
      behindCount: 0,
      pr: null,
    };

    const remote: GitStatusRemoteResult = {
      hasUpstream: true,
      aheadCount: 2,
      behindCount: 1,
      pr: null,
    };

    expect(applyGitStatusStreamEvent(current, { _tag: "remoteUpdated", remote })).toEqual({
      ...current,
      hasUpstream: true,
      aheadCount: 2,
      behindCount: 1,
      pr: null,
    });
  });
});
