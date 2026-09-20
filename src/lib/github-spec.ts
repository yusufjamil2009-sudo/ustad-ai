/**
 * GitHub integration — client-safe types and error text.
 * No credentials, no tokens, no server logic in this module.
 */

export type GithubStatus =
  | { connected: false; configured: boolean }
  | {
      connected: true;
      configured: true;
      login: string;
      avatarUrl: string | null;
      connectedAt: string;
      repo: GithubSelection | null;
    };

export type GithubSelection = {
  repoId: number;
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  branch: string;
  htmlUrl: string | null;
};

export type GithubRepo = {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  description: string | null;
  updatedAt: string | null;
};

export type GithubTreeEntry = {
  path: string;
  name: string;
  type: "file" | "dir";
  size: number | null;
  sha: string;
};

export type GithubActivityRow = {
  id: string;
  step: string;
  status: string;
  repo: string | null;
  branch: string | null;
  detail: string | null;
  filesRead: number;
  filesCreated: number;
  filesChanged: number;
  filesDeleted: number;
  commitSha: string | null;
  commitUrl: string | null;
  error: string | null;
  at: string;
};

export type GithubErrorCode =
  | "not_configured"
  | "not_connected"
  | "auth_expired"
  | "denied"
  | "cancelled"
  | "repo_not_found"
  | "no_repo_selected"
  | "branch_not_found"
  | "conflict"
  | "permission_denied"
  | "rate_limited"
  | "validation"
  | "network"
  | "unknown";

export const GITHUB_ERROR_TEXT: Record<GithubErrorCode, string> = {
  not_configured: "GitHub is not configured yet. Ask the app owner to add the GitHub App keys.",
  not_connected: "GitHub is not connected. Tap Connect GitHub first.",
  auth_expired: "GitHub authorization expired. Please reconnect GitHub.",
  denied: "GitHub access was denied for this account or repository.",
  cancelled: "GitHub authorization was cancelled.",
  repo_not_found: "That repository was not found, or access to it was revoked.",
  no_repo_selected: "Select a repository first.",
  branch_not_found: "That branch does not exist in the selected repository.",
  conflict: "This file changed on GitHub since it was read. Reload the file and try again.",
  permission_denied: "GitHub denied permission for this action. Check the app's repository access.",
  rate_limited: "GitHub rate limit reached. Please wait a few minutes and try again.",
  validation: "GitHub rejected the request. Check the name or path and try again.",
  network: "Could not reach GitHub. Check your connection and try again.",
  unknown: "Something went wrong while talking to GitHub.",
};

export function githubErrorText(code: string | undefined): string {
  return GITHUB_ERROR_TEXT[(code ?? "unknown") as GithubErrorCode] ?? GITHUB_ERROR_TEXT.unknown;
}

/** GitHub's own repository-name rule, enforced before any API call. */
export function isValidRepoName(name: string): boolean {
  return /^[A-Za-z0-9._-]{1,100}$/.test(name);
}
