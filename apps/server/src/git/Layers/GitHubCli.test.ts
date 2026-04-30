import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach, expect, vi } from "vitest";

vi.mock("../../processRunner", () => ({
  runProcess: vi.fn(),
}));

import { runProcess } from "../../processRunner.ts";
import { GitHubCli } from "../Services/GitHubCli.ts";
import { GitHubCliLive } from "./GitHubCli.ts";

const mockedRunProcess = vi.mocked(runProcess);
const layer = it.layer(GitHubCliLive);

afterEach(() => {
  mockedRunProcess.mockReset();
});

layer("GitHubCliLive", (it) => {
  it.effect("parses pull request view output", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify({
          number: 42,
          title: "Add PR thread creation",
          url: "https://github.com/pingdotgg/codething-mvp/pull/42",
          baseRefName: "main",
          headRefName: "feature/pr-threads",
          state: "OPEN",
          mergedAt: null,
          isCrossRepository: true,
          headRepository: {
            nameWithOwner: "octocat/codething-mvp",
          },
          headRepositoryOwner: {
            login: "octocat",
          },
        }),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.getPullRequest({
          cwd: "/repo",
          reference: "#42",
        });
      });

      assert.deepStrictEqual(result, {
        number: 42,
        title: "Add PR thread creation",
        url: "https://github.com/pingdotgg/codething-mvp/pull/42",
        baseRefName: "main",
        headRefName: "feature/pr-threads",
        state: "open",
        isCrossRepository: true,
        headRepositoryNameWithOwner: "octocat/codething-mvp",
        headRepositoryOwnerLogin: "octocat",
      });
      expect(mockedRunProcess).toHaveBeenCalledWith(
        "gh",
        [
          "pr",
          "view",
          "#42",
          "--json",
          "number,title,url,baseRefName,headRefName,state,mergedAt,isCrossRepository,headRepository,headRepositoryOwner",
        ],
        expect.objectContaining({ cwd: "/repo" }),
      );
    }),
  );

  it.effect("trims pull request fields decoded from gh json", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify({
          number: 42,
          title: "  Add PR thread creation  \n",
          url: " https://github.com/pingdotgg/codething-mvp/pull/42 ",
          baseRefName: " main ",
          headRefName: "\tfeature/pr-threads\t",
          state: "OPEN",
          mergedAt: null,
          isCrossRepository: true,
          headRepository: {
            nameWithOwner: " octocat/codething-mvp ",
          },
          headRepositoryOwner: {
            login: " octocat ",
          },
        }),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.getPullRequest({
          cwd: "/repo",
          reference: "#42",
        });
      });

      assert.deepStrictEqual(result, {
        number: 42,
        title: "Add PR thread creation",
        url: "https://github.com/pingdotgg/codething-mvp/pull/42",
        baseRefName: "main",
        headRefName: "feature/pr-threads",
        state: "open",
        isCrossRepository: true,
        headRepositoryNameWithOwner: "octocat/codething-mvp",
        headRepositoryOwnerLogin: "octocat",
      });
    }),
  );

  it.effect("skips invalid entries when parsing pr lists", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            number: 0,
            title: "invalid",
            url: "https://github.com/pingdotgg/codething-mvp/pull/0",
            baseRefName: "main",
            headRefName: "feature/invalid",
          },
          {
            number: 43,
            title: "  Valid PR  ",
            url: " https://github.com/pingdotgg/codething-mvp/pull/43 ",
            baseRefName: " main ",
            headRefName: " feature/pr-list ",
            headRepository: {
              nameWithOwner: "   ",
            },
            headRepositoryOwner: {
              login: "   ",
            },
          },
        ]),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.listOpenPullRequests({
          cwd: "/repo",
          headSelector: "feature/pr-list",
        });
      });

      assert.deepStrictEqual(result, [
        {
          number: 43,
          title: "Valid PR",
          url: "https://github.com/pingdotgg/codething-mvp/pull/43",
          baseRefName: "main",
          headRefName: "feature/pr-list",
          state: "open",
        },
      ]);
    }),
  );

  it.effect("reads repository clone URLs", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify({
          nameWithOwner: "octocat/codething-mvp",
          url: "https://github.com/octocat/codething-mvp",
          sshUrl: "git@github.com:octocat/codething-mvp.git",
        }),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.getRepositoryCloneUrls({
          cwd: "/repo",
          repository: "octocat/codething-mvp",
        });
      });

      assert.deepStrictEqual(result, {
        nameWithOwner: "octocat/codething-mvp",
        url: "https://github.com/octocat/codething-mvp",
        sshUrl: "git@github.com:octocat/codething-mvp.git",
      });
    }),
  );

  it.effect("lists pull request review comments from gh api output", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            id: 123,
            html_url: "https://github.com/octocat/codething-mvp/pull/42#discussion_r123",
            user: {
              login: "reviewer",
            },
            body: "Please keep this branch name configurable.",
            path: "apps/server/src/ws.ts",
            line: 12,
            original_line: 10,
            side: "RIGHT",
            state: "SUBMITTED",
            created_at: "2026-04-29T12:00:00Z",
            updated_at: "2026-04-29T12:30:00Z",
          },
          {
            id: "empty-body",
            html_url: "https://github.com/octocat/codething-mvp/pull/42#discussion_r124",
            user: null,
            body: "   ",
            path: "README.md",
            line: null,
            side: "UNKNOWN",
            state: null,
            created_at: "2026-04-29T12:00:00Z",
            updated_at: "2026-04-29T12:30:00Z",
          },
        ]),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.listPullRequestReviewComments({
          cwd: "/repo",
          repository: "octocat/codething-mvp",
          number: 42,
        });
      });

      assert.deepStrictEqual(result, [
        {
          id: "123",
          url: "https://github.com/octocat/codething-mvp/pull/42#discussion_r123",
          author: "reviewer",
          body: "Please keep this branch name configurable.",
          path: "apps/server/src/ws.ts",
          line: 12,
          side: "RIGHT",
          state: "SUBMITTED",
          createdAt: "2026-04-29T12:00:00Z",
          updatedAt: "2026-04-29T12:30:00Z",
          resolved: null,
        },
      ]);
      expect(mockedRunProcess).toHaveBeenCalledWith(
        "gh",
        ["api", "repos/octocat/codething-mvp/pulls/42/comments", "--paginate"],
        expect.objectContaining({ cwd: "/repo" }),
      );
    }),
  );

  it.effect("lists and summarizes pull request checks", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            name: " lint ",
            workflow: " CI ",
            state: "SUCCESS",
            bucket: "pass",
            link: " https://github.com/pingdotgg/codething-mvp/actions/runs/1 ",
            description: "",
            startedAt: "2026-04-29T12:00:00Z",
            completedAt: "2026-04-29T12:01:00Z",
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
        ]),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.listPullRequestChecks({
          cwd: "/repo",
          reference: "42",
        });
      });

      assert.deepStrictEqual(result, {
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
            startedAt: "2026-04-29T12:00:00Z",
            completedAt: "2026-04-29T12:01:00Z",
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
      });
      expect(mockedRunProcess).toHaveBeenCalledWith(
        "gh",
        [
          "pr",
          "checks",
          "42",
          "--json",
          "bucket,completedAt,description,event,link,name,startedAt,state,workflow",
        ],
        expect.objectContaining({ cwd: "/repo", allowNonZeroExit: true }),
      );
    }),
  );

  it.effect("treats pending check exit code as successful output", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            name: "build",
            workflow: "CI",
            state: "QUEUED",
            bucket: "pending",
            link: null,
            description: null,
            startedAt: null,
            completedAt: null,
          },
        ]),
        stderr: "",
        code: 8,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.listPullRequestChecks({
          cwd: "/repo",
          reference: "42",
        });
      });

      assert.equal(result.status, "pending");
      assert.equal(result.pendingCount, 1);
    }),
  );

  it.effect("rejects invalid pull request checks JSON", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: "{ invalid",
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const error = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.listPullRequestChecks({
          cwd: "/repo",
          reference: "42",
        });
      }).pipe(Effect.flip);

      assert.equal(error._tag, "GitHubCliError");
      assert.equal(error.message.includes("invalid pull request checks JSON"), true);
    }),
  );

  it.effect("surfaces a friendly error when the pull request is not found", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockRejectedValueOnce(
        new Error(
          "GraphQL: Could not resolve to a PullRequest with the number of 4888. (repository.pullRequest)",
        ),
      );

      const error = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.getPullRequest({
          cwd: "/repo",
          reference: "4888",
        });
      }).pipe(Effect.flip);

      assert.equal(error.message.includes("Pull request not found"), true);
    }),
  );
});
