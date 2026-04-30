import { Effect, Layer, Result, Schema, SchemaIssue } from "effect";
import {
  type GitPullRequestCheckBucket,
  type GitPullRequestCheckRun,
  type GitPullRequestChecksSummary,
  TrimmedNonEmptyString,
  type GitHubPullRequestReviewComment,
} from "@t3tools/contracts";

import { runProcess } from "../../processRunner.ts";
import { GitHubCliError } from "@t3tools/contracts";
import {
  GitHubCli,
  type GitHubRepositoryCloneUrls,
  type GitHubCliShape,
} from "../Services/GitHubCli.ts";
import {
  decodeGitHubPullRequestJson,
  decodeGitHubPullRequestListJson,
  formatGitHubJsonDecodeError,
} from "../githubPullRequests.ts";

const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeGitHubCliError(operation: "execute" | "stdout", error: unknown): GitHubCliError {
  if (error instanceof Error) {
    if (error.message.includes("Command not found: gh")) {
      return new GitHubCliError({
        operation,
        detail: "GitHub CLI (`gh`) is required but not available on PATH.",
        cause: error,
      });
    }

    const lower = error.message.toLowerCase();
    if (
      lower.includes("authentication failed") ||
      lower.includes("not logged in") ||
      lower.includes("gh auth login") ||
      lower.includes("no oauth token")
    ) {
      return new GitHubCliError({
        operation,
        detail: "GitHub CLI is not authenticated. Run `gh auth login` and retry.",
        cause: error,
      });
    }

    if (
      lower.includes("could not resolve to a pullrequest") ||
      lower.includes("repository.pullrequest") ||
      lower.includes("no pull requests found for branch") ||
      lower.includes("pull request not found")
    ) {
      return new GitHubCliError({
        operation,
        detail: "Pull request not found. Check the PR number or URL and try again.",
        cause: error,
      });
    }

    return new GitHubCliError({
      operation,
      detail: `GitHub CLI command failed: ${error.message}`,
      cause: error,
    });
  }

  return new GitHubCliError({
    operation,
    detail: "GitHub CLI command failed.",
    cause: error,
  });
}

const RawGitHubRepositoryCloneUrlsSchema = Schema.Struct({
  nameWithOwner: TrimmedNonEmptyString,
  url: TrimmedNonEmptyString,
  sshUrl: TrimmedNonEmptyString,
});

const RawGitHubPullRequestReviewCommentSchema = Schema.Struct({
  id: Schema.Union([Schema.Number, Schema.String]),
  html_url: Schema.optional(Schema.String),
  user: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        login: Schema.optional(Schema.String),
      }),
    ),
  ),
  body: Schema.optional(Schema.String),
  path: Schema.optional(Schema.NullOr(Schema.String)),
  line: Schema.optional(Schema.NullOr(Schema.Number)),
  original_line: Schema.optional(Schema.NullOr(Schema.Number)),
  side: Schema.optional(Schema.NullOr(Schema.String)),
  state: Schema.optional(Schema.NullOr(Schema.String)),
  created_at: Schema.String,
  updated_at: Schema.String,
});

const RawGitHubPullRequestReviewCommentsSchema = Schema.Array(
  RawGitHubPullRequestReviewCommentSchema,
);

const RawGitHubPullRequestCheckSchema = Schema.Struct({
  name: Schema.String,
  workflow: Schema.optional(Schema.NullOr(Schema.String)),
  state: Schema.String,
  bucket: Schema.Literals(["pass", "fail", "pending", "skipping", "cancel"]),
  link: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  startedAt: Schema.optional(Schema.NullOr(Schema.String)),
  completedAt: Schema.optional(Schema.NullOr(Schema.String)),
});
const RawGitHubPullRequestChecksSchema = Schema.Array(RawGitHubPullRequestCheckSchema);

function normalizeRepositoryCloneUrls(
  raw: Schema.Schema.Type<typeof RawGitHubRepositoryCloneUrlsSchema>,
): GitHubRepositoryCloneUrls {
  return {
    nameWithOwner: raw.nameWithOwner,
    url: raw.url,
    sshUrl: raw.sshUrl,
  };
}

function nullableTrimmed(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeReviewComment(
  raw: Schema.Schema.Type<typeof RawGitHubPullRequestReviewCommentSchema>,
): GitHubPullRequestReviewComment {
  const side = raw.side === "LEFT" || raw.side === "RIGHT" ? raw.side : null;
  const state = raw.state === "PENDING" || raw.state === "SUBMITTED" ? raw.state : null;
  const rawLine = raw.line ?? raw.original_line ?? null;
  const line =
    typeof rawLine === "number" && Number.isFinite(rawLine) ? Math.max(0, rawLine) : null;
  return {
    id: String(raw.id),
    url: raw.html_url?.trim() || "",
    author: raw.user?.login?.trim() || "unknown",
    body: raw.body ?? "",
    path: raw.path ?? null,
    line,
    side,
    state,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    resolved: null,
  };
}

function normalizePullRequestCheck(
  raw: Schema.Schema.Type<typeof RawGitHubPullRequestCheckSchema>,
): GitPullRequestCheckRun | null {
  const name = raw.name.trim();
  const state = raw.state.trim();
  if (name.length === 0 || state.length === 0) {
    return null;
  }

  return {
    name,
    workflow: nullableTrimmed(raw.workflow),
    state,
    bucket: raw.bucket,
    link: nullableTrimmed(raw.link),
    description: nullableTrimmed(raw.description),
    startedAt: nullableTrimmed(raw.startedAt),
    completedAt: nullableTrimmed(raw.completedAt),
  };
}

function summarizePullRequestCheckStatus(input: {
  totalCount: number;
  passCount: number;
  failCount: number;
  pendingCount: number;
  skippingCount: number;
  cancelCount: number;
}): GitPullRequestChecksSummary["status"] {
  if (input.failCount > 0) {
    return "failing";
  }
  if (input.pendingCount > 0) {
    return "pending";
  }
  if (input.cancelCount > 0) {
    return "cancelled";
  }
  if (input.totalCount > 0 && input.skippingCount === input.totalCount) {
    return "skipped";
  }
  if (input.totalCount > 0 && input.passCount === input.totalCount) {
    return "passing";
  }
  return "unknown";
}

function summarizePullRequestChecks(
  rawChecks: ReadonlyArray<Schema.Schema.Type<typeof RawGitHubPullRequestCheckSchema>>,
): GitPullRequestChecksSummary {
  const checks = rawChecks
    .map(normalizePullRequestCheck)
    .filter((check): check is GitPullRequestCheckRun => check !== null);
  const countBucket = (bucket: GitPullRequestCheckBucket) =>
    checks.filter((check) => check.bucket === bucket).length;
  const passCount = countBucket("pass");
  const failCount = countBucket("fail");
  const pendingCount = countBucket("pending");
  const skippingCount = countBucket("skipping");
  const cancelCount = countBucket("cancel");
  const totalCount = checks.length;

  return {
    status: summarizePullRequestCheckStatus({
      totalCount,
      passCount,
      failCount,
      pendingCount,
      skippingCount,
      cancelCount,
    }),
    totalCount,
    passCount,
    failCount,
    pendingCount,
    skippingCount,
    cancelCount,
    checks,
  };
}

function decodeGitHubJson<S extends Schema.Top>(
  raw: string,
  schema: S,
  operation:
    | "listOpenPullRequests"
    | "getPullRequest"
    | "getRepositoryCloneUrls"
    | "listPullRequestChecks",
  invalidDetail: string,
): Effect.Effect<S["Type"], GitHubCliError, S["DecodingServices"]> {
  return Schema.decodeEffect(Schema.fromJsonString(schema))(raw).pipe(
    Effect.mapError(
      (error) =>
        new GitHubCliError({
          operation,
          detail: `${invalidDetail}: ${SchemaIssue.makeFormatterDefault()(error.issue)}`,
          cause: error,
        }),
    ),
  );
}

const makeGitHubCli = Effect.sync(() => {
  const execute: GitHubCliShape["execute"] = (input) =>
    Effect.tryPromise({
      try: () =>
        runProcess("gh", input.args, {
          cwd: input.cwd,
          timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          allowNonZeroExit: input.allowNonZeroExit,
        }),
      catch: (error) => normalizeGitHubCliError("execute", error),
    });

  const service = {
    execute,
    listOpenPullRequests: (input) =>
      execute({
        cwd: input.cwd,
        args: [
          "pr",
          "list",
          "--head",
          input.headSelector,
          "--state",
          "open",
          "--limit",
          String(input.limit ?? 1),
          "--json",
          "number,title,url,baseRefName,headRefName,state,mergedAt,isCrossRepository,headRepository,headRepositoryOwner",
        ],
      }).pipe(
        Effect.map((result) => result.stdout.trim()),
        Effect.flatMap((raw) =>
          raw.length === 0
            ? Effect.succeed([])
            : Effect.sync(() => decodeGitHubPullRequestListJson(raw)).pipe(
                Effect.flatMap((decoded) => {
                  if (!Result.isSuccess(decoded)) {
                    return Effect.fail(
                      new GitHubCliError({
                        operation: "listOpenPullRequests",
                        detail: `GitHub CLI returned invalid PR list JSON: ${formatGitHubJsonDecodeError(decoded.failure)}`,
                        cause: decoded.failure,
                      }),
                    );
                  }

                  return Effect.succeed(
                    decoded.success.map(({ updatedAt: _updatedAt, ...summary }) => summary),
                  );
                }),
              ),
        ),
      ),
    getPullRequest: (input) =>
      execute({
        cwd: input.cwd,
        args: [
          "pr",
          "view",
          input.reference,
          "--json",
          "number,title,url,baseRefName,headRefName,state,mergedAt,isCrossRepository,headRepository,headRepositoryOwner",
        ],
      }).pipe(
        Effect.map((result) => result.stdout.trim()),
        Effect.flatMap((raw) =>
          Effect.sync(() => decodeGitHubPullRequestJson(raw)).pipe(
            Effect.flatMap((decoded) => {
              if (!Result.isSuccess(decoded)) {
                return Effect.fail(
                  new GitHubCliError({
                    operation: "getPullRequest",
                    detail: `GitHub CLI returned invalid pull request JSON: ${formatGitHubJsonDecodeError(decoded.failure)}`,
                    cause: decoded.failure,
                  }),
                );
              }

              return Effect.succeed(
                (({ updatedAt: _updatedAt, ...summary }) => summary)(decoded.success),
              );
            }),
          ),
        ),
      ),
    getRepositoryCloneUrls: (input) =>
      execute({
        cwd: input.cwd,
        args: ["repo", "view", input.repository, "--json", "nameWithOwner,url,sshUrl"],
      }).pipe(
        Effect.map((result) => result.stdout.trim()),
        Effect.flatMap((raw) =>
          decodeGitHubJson(
            raw,
            RawGitHubRepositoryCloneUrlsSchema,
            "getRepositoryCloneUrls",
            "GitHub CLI returned invalid repository JSON.",
          ),
        ),
        Effect.map(normalizeRepositoryCloneUrls),
      ),
    listPullRequestReviewComments: (input) =>
      execute({
        cwd: input.cwd,
        args: ["api", `repos/${input.repository}/pulls/${input.number}/comments`, "--paginate"],
      }).pipe(
        Effect.map((result) => result.stdout.trim()),
        Effect.flatMap((raw) =>
          decodeGitHubJson(
            raw.length > 0 ? raw : "[]",
            RawGitHubPullRequestReviewCommentsSchema,
            "getPullRequest",
            "GitHub CLI returned invalid review comments JSON.",
          ),
        ),
        Effect.map((comments) =>
          comments
            .map(normalizeReviewComment)
            .filter((comment) => comment.url.length > 0 && comment.body.trim().length > 0),
        ),
      ),
    listPullRequestChecks: (input) =>
      execute({
        cwd: input.cwd,
        allowNonZeroExit: true,
        args: [
          "pr",
          "checks",
          input.reference,
          "--json",
          "bucket,completedAt,description,event,link,name,startedAt,state,workflow",
        ],
      }).pipe(
        Effect.flatMap((result) => {
          if (result.code !== 0 && result.code !== 8) {
            return Effect.fail(
              new GitHubCliError({
                operation: "listPullRequestChecks",
                detail: `GitHub CLI checks command failed with code ${result.code ?? "null"}.`,
                cause: result,
              }),
            );
          }

          const raw = result.stdout.trim();
          return decodeGitHubJson(
            raw.length > 0 ? raw : "[]",
            RawGitHubPullRequestChecksSchema,
            "listPullRequestChecks",
            "GitHub CLI returned invalid pull request checks JSON.",
          );
        }),
        Effect.map(summarizePullRequestChecks),
      ),
    createPullRequest: (input) =>
      execute({
        cwd: input.cwd,
        args: [
          "pr",
          "create",
          "--base",
          input.baseBranch,
          "--head",
          input.headSelector,
          "--title",
          input.title,
          "--body-file",
          input.bodyFile,
        ],
      }).pipe(Effect.asVoid),
    getDefaultBranch: (input) =>
      execute({
        cwd: input.cwd,
        args: ["repo", "view", "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"],
      }).pipe(
        Effect.map((value) => {
          const trimmed = value.stdout.trim();
          return trimmed.length > 0 ? trimmed : null;
        }),
      ),
    checkoutPullRequest: (input) =>
      execute({
        cwd: input.cwd,
        args: ["pr", "checkout", input.reference, ...(input.force ? ["--force"] : [])],
      }).pipe(Effect.asVoid),
  } satisfies GitHubCliShape;

  return service;
});

export const GitHubCliLive = Layer.effect(GitHubCli, makeGitHubCli);
