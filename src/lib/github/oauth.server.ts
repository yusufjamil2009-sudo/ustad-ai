/**
 * GitHub user-authorization (OAuth) — SERVER ONLY.
 *
 * Nothing in here ever crosses to the browser: the client secret, the
 * authorization code and the access/refresh tokens all stay on the server.
 * The browser only ever receives the GitHub authorize URL.
 */
import { encryptString } from "../crypto.server";

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const STATE_TTL_MS = 10 * 60 * 1000;

export type GithubTokenSet = {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAt?: string | undefined;
  refreshExpiresAt?: string | undefined;
  scopes: string;
};

export function githubClientId(): string | undefined {
  return process.env["GITHUB_CLIENT_ID"]?.trim() || undefined;
}

function githubClientSecret(): string | undefined {
  return process.env["GITHUB_CLIENT_SECRET"]?.trim() || undefined;
}

export function githubConfigured(): boolean {
  return Boolean(githubClientId() && githubClientSecret());
}

function stateSecret(): string {
  const s = process.env["USTAD_GUEST_SECRET"];
  if (!s) throw new Error("USTAD_GUEST_SECRET is not configured");
  return s;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  const pad = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(stateSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Signed, expiring CSRF state that binds the callback to one guest id. */
export async function createState(guestId: string, returnTo: string): Promise<string> {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const body = JSON.stringify({ g: guestId, n: nonce, e: Date.now() + STATE_TTL_MS, r: returnTo });
  const payload = b64url(new TextEncoder().encode(body));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyState(
  state: unknown,
): Promise<{ guestId: string; returnTo: string } | null> {
  if (typeof state !== "string" || !state.includes(".")) return null;
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  if (!timingSafeEqual(sig, await hmac(payload))) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as {
      g?: string;
      e?: number;
      r?: string;
    };
    if (!parsed.g || !parsed.e || parsed.e < Date.now()) return null;
    return { guestId: parsed.g, returnTo: typeof parsed.r === "string" ? parsed.r : "/settings" };
  } catch {
    return null;
  }
}

export function callbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/public/github/callback`;
}

export function authorizeUrl(state: string, origin: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", githubClientId()!);
  url.searchParams.set("redirect_uri", callbackUrl(origin));
  url.searchParams.set("state", state);
  // GitHub Apps derive permissions from the app configuration; the scope
  // parameter is only honoured by classic OAuth apps, where these two are the
  // minimum for reading and writing repository contents.
  url.searchParams.set("scope", "repo read:user");
  return url.toString();
}

async function postToken(params: Record<string, string>): Promise<GithubTokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: githubClientId(),
      client_secret: githubClientSecret(),
      ...params,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const error = typeof json["error"] === "string" ? json["error"] : undefined;
  const token = typeof json["access_token"] === "string" ? json["access_token"] : undefined;
  if (!token) {
    // Never log or echo the raw body — it can contain the client secret hint.
    throw new Error(
      error === "bad_verification_code" || error === "expired_token"
        ? "auth_expired"
        : error === "access_denied"
          ? "denied"
          : "unknown",
    );
  }
  const expiresIn = Number(json["expires_in"] ?? 0);
  const refreshIn = Number(json["refresh_token_expires_in"] ?? 0);
  return {
    accessToken: token,
    refreshToken: typeof json["refresh_token"] === "string" ? json["refresh_token"] : undefined,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined,
    refreshExpiresAt: refreshIn
      ? new Date(Date.now() + refreshIn * 1000).toISOString()
      : undefined,
    scopes: typeof json["scope"] === "string" ? json["scope"] : "",
  };
}

export async function exchangeCode(code: string, origin: string): Promise<GithubTokenSet> {
  return postToken({ code, redirect_uri: callbackUrl(origin) });
}

export async function refreshAccessToken(refreshToken: string): Promise<GithubTokenSet> {
  return postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function encryptTokenSet(set: GithubTokenSet) {
  return {
    access_token_encrypted: await encryptString(set.accessToken),
    refresh_token_encrypted: set.refreshToken ? await encryptString(set.refreshToken) : null,
    token_expires_at: set.expiresAt ?? null,
    refresh_token_expires_at: set.refreshExpiresAt ?? null,
    scopes: set.scopes,
  };
}
