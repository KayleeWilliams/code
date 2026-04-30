export function isSyntheticPullRequestWorktreeBranch(branch: string): boolean {
  return /^t3code\/pr-\d+\//i.test(branch.trim());
}

export function isSlashRemoteLocalBranchAlias(input: {
  localBranch: string;
  remoteName: string | null;
  upstreamBranch: string;
}): boolean {
  const remoteName = input.remoteName?.trim() ?? "";
  if (!remoteName.includes("/") || input.upstreamBranch.length === 0) {
    return false;
  }
  const remoteAliasPrefix = remoteName.split("/").at(-1)?.trim() ?? "";
  return input.localBranch === `${remoteAliasPrefix}/${input.upstreamBranch}`;
}
