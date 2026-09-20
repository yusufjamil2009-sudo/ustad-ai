/**
 * GitHub REST service layer — SERVER ONLY.
 *
 * Every call is made with the connected user's own access token. There is no
 * shared/global GitHub account. Raw GitHub errors are mapped to safe codes
 * (see src/lib/github-spec.ts) before they can reach a user.
 */
import type { GithubRepo, GithubTreeEntry } from "../github-spec";

const API = "https://api.github.com";

export class GithubError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export type RateLimit = { remaining: number | null; resetAt: string | null };

let lastRateLimit: RateLimit = { remaining: null, resetAt: null };
export function lastRateLimitInfo(): RateLimit {
  return lastRateLimit;
}

function mapStatus(status: number, body: string): GithubError {
  if (status === 401) return new GithubError("auth_expired");
  if (status === 403) {
    if (/rate limit/i.test(body)) return new GithubError("rate_limited");
    return new GithubError("permission_denied");
  }
  if (status === 404) return new GithubError("repo_not_found");
  if (status === 409) return new GithubError("conflict");
  if (status === 422) return new GithubError("validation");
  if (status === 429) return new GithubError("rate_limited");
  return new GithubError("unknown");
}

async function gh<T>(
  token: string,
  path: string,
  init: RequestInit & { raw?: boolean } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
        "User-Agent": "USTAD-AI",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new GithubError("network");
  }

  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");
  lastRateLimit = {
    remaining: remaining === null ? null : Number(remaining),
    resetAt: reset ? new Date(Number(reset) * 1000).toISOString() : null,
  };

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Status + code only: never log tokens or full auth headers.
    console.error(`[github] ${init.method ?? "GET"} ${path} -> ${res.status}`);
    if (res.status === 403 && lastRateLimit.remaining === 0) throw new GithubError("rate_limited");
    throw mapStatus(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

type RawRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  description: string | null;
  updated_at: string | null;
  owner: { login: string };
};

function toRepo(r: RawRepo): GithubRepo {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    owner: r.owner?.login ?? r.full_name.split("/")[0] ?? "",
    private: Boolean(r.private),
    defaultBranch: r.default_branch ?? "main",
    htmlUrl: r.html_url,
    description: r.description,
    updatedAt: r.updated_at,
  };
}

export async function getViewer(token: string) {
  const u = await gh<{ id: number; login: string; avatar_url: string }>(token, "/user");
  return { id: u.id, login: u.login, avatarUrl: u.avatar_url };
}

export async function getRepositories(token: string, page = 1): Promise<GithubRepo[]> {
  const rows = await gh<RawRepo[]>(
    token,
    `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
  );
  return rows.map(toRepo);
}

export async function getRepository(token: string, owner: string, repo: string) {
  return toRepo(await gh<RawRepo>(token, `/repos/${owner}/${repo}`));
}

export async function getBranches(token: string, owner: string, repo: string) {
  const rows = await gh<{ name: string; commit: { sha: string } }[]>(
    token,
    `/repos/${owner}/${repo}/branches?per_page=100`,
  );
  return rows.map((b) => ({ name: b.name, sha: b.commit.sha }));
}

export async function getTree(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<GithubTreeEntry[]> {
  const q = `/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`;
  const rows = await gh<
    { path: string; name: string; type: string; size: number | null; sha: string }[]
  >(token, q.replace("contents/?", "contents?"));
  if (!Array.isArray(rows)) throw new GithubError("validation");
  return rows
    .map((r) => ({
      path: r.path,
      name: r.name,
      type: r.type === "dir" ? ("dir" as const) : ("file" as const),
      size: r.size ?? null,
      sha: r.sha,
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
}

export async function getFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<{ path: string; sha: string; content: string; size: number }> {
  const file = await gh<{
    path: string;
    sha: string;
    size: number;
    content?: string;
    encoding?: string;
    type: string;
  }>(
    token,
    `/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`,
  );
  if (file.type !== "file" || typeof file.content !== "string") throw new GithubError("validation");
  const binary = atob(file.content.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return {
    path: file.path,
    sha: file.sha,
    size: file.size,
    content: new TextDecoder().decode(bytes),
  };
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

type ContentWrite = {
  content: { path: string; sha: string };
  commit: { sha: string; html_url: string };
};

export async function createFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
) {
  return gh<ContentWrite>(token, `/repos/${owner}/${repo}/contents/${encodeURI(path)}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: toBase64(content), branch }),
  });
}

export async function updateFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  sha: string,
) {
  return gh<ContentWrite>(token, `/repos/${owner}/${repo}/contents/${encodeURI(path)}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: toBase64(content), branch, sha }),
  });
}

export async function deleteFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  message: string,
  branch: string,
  sha: string,
) {
  return gh<{ commit: { sha: string; html_url: string } }>(
    token,
    `/repos/${owner}/${repo}/contents/${encodeURI(path)}`,
    { method: "DELETE", body: JSON.stringify({ message, branch, sha }) },
  );
}

export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  fromBranch: string,
) {
  const base = await gh<{ object: { sha: string } }>(
    token,
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(fromBranch)}`,
  ).catch(() => {
    throw new GithubError("branch_not_found");
  });
  return gh<{ ref: string }>(token, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }),
  });
}

/**
 * Multi-file commit through the Git data API: blobs -> tree -> commit -> ref.
 * This is the real "create commit + push" path; each file is written exactly
 * once and unrelated files in the repository are preserved by basing the new
 * tree on the current one.
 */
export async function pushChanges(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  message: string,
  changes: { path: string; content: string | null }[],
): Promise<{ sha: string; url: string; created: number; changed: number; deleted: number }> {
  const ref = await gh<{ object: { sha: string } }>(
    token,
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
  ).catch(() => {
    throw new GithubError("branch_not_found");
  });
  const head = ref.object.sha;
  const headCommit = await gh<{ tree: { sha: string } }>(
    token,
    `/repos/${owner}/${repo}/git/commits/${head}`,
  );

  const existing = new Set(
    (
      await gh<{ tree: { path: string; type: string }[] }>(
        token,
        `/repos/${owner}/${repo}/git/trees/${headCommit.tree.sha}?recursive=1`,
      )
    ).tree
      .filter((t) => t.type === "blob")
      .map((t) => t.path),
  );

  let created = 0;
  let changed = 0;
  let deleted = 0;
  const tree: Record<string, unknown>[] = [];
  for (const change of changes) {
    if (change.content === null) {
      if (!existing.has(change.path)) continue;
      deleted++;
      tree.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    const blob = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: change.content, encoding: "utf-8" }),
    });
    if (existing.has(change.path)) changed++;
    else created++;
    tree.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  if (!tree.length) throw new GithubError("validation");

  const newTree = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }),
  });
  const commit = await gh<{ sha: string; html_url: string }>(
    token,
    `/repos/${owner}/${repo}/git/commits`,
    { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [head] }) },
  );
  await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return { sha: commit.sha, url: commit.html_url, created, changed, deleted };
}

/** Alias kept for the documented service-layer surface. */
export const createCommit = pushChanges;

export async function createRepository(
  token: string,
  input: { name: string; description?: string; private: boolean; autoInit: boolean },
): Promise<GithubRepo> {
  const raw = await gh<RawRepo>(token, "/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? "",
      private: input.private,
      auto_init: input.autoInit,
    }),
  });
  return toRepo(raw);
}
