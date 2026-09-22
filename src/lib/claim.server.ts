/**
 * USTAD Coins claim — server-authoritative.
 *
 * The browser sends only a password and a request id. It can never choose the
 * reward amount, another guest's id, or a balance. The password lives ONLY in
 * the server-side secret `USTAD_CLAIM_PASSWORD` and is never returned, logged,
 * or compared partially.
 *
 * Repeatable by design: every new request id with the correct password credits
 * the reward again. Only the SAME request id is deduplicated (by the existing
 * `ustad_coin_apply` ledger uniqueness on (guest_id, source, ref_id)).
 */
import { requireGuest, db } from "./guest.server";
import { getWallet } from "./wallet.server";

/** Fixed, server-only reward: 900 crore USTAD Coins. */
export const CLAIM_REWARD_COINS = 9_000_000_000;

const CLAIM_SOURCE = "coin_claim";
const FAIL_KIND = "coin_claim_fail";
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const FAIL_LIMIT = 8;

/* eslint-disable @typescript-eslint/no-explicit-any */
const sdb = () => db() as any;

export type ClaimResult =
  | { status: "success"; credited: number; balance: number; duplicate: boolean }
  | { status: "invalid_password" }
  | { status: "rate_limited" };

/** Constant-time string comparison (no early exit on first differing char). */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

async function recentFailures(guestId: string): Promise<number> {
  const since = new Date(Date.now() - FAIL_WINDOW_MS).toISOString();
  const { count } = await sdb()
    .from("request_idempotency")
    .select("id", { count: "exact", head: true })
    .eq("guest_id", guestId)
    .eq("kind", FAIL_KIND)
    .gte("created_at", since);
  return Number(count ?? 0);
}

async function recordFailure(guestId: string): Promise<void> {
  await sdb()
    .from("request_idempotency")
    .insert({ guest_id: guestId, kind: FAIL_KIND, result: {} });
}

function normalizeRequestId(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const safe = raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return safe || crypto.randomUUID();
}

/**
 * Verify the owner-configured password and, only then, credit the fixed reward
 * through the EXISTING coin system (`ustad_coin_apply` → ledger + wallet in one
 * database transaction).
 */
export async function claimCoins(input: {
  token: unknown;
  password: unknown;
  requestId: unknown;
}): Promise<ClaimResult> {
  const guestId = await requireGuest(input.token);
  const configured = process.env["USTAD_CLAIM_PASSWORD"] ?? "";
  const supplied = typeof input.password === "string" ? input.password : "";

  if (await recentFailures(guestId).then((n) => n >= FAIL_LIMIT)) {
    return { status: "rate_limited" };
  }

  // A missing/blank server secret must never authorize a claim.
  if (configured.trim().length === 0 || !safeEqual(supplied, configured)) {
    await recordFailure(guestId);
    return { status: "invalid_password" };
  }

  const requestId = normalizeRequestId(input.requestId);
  const { data, error } = await sdb().rpc("ustad_coin_apply", {
    p_guest_id: guestId,
    p_source: CLAIM_SOURCE,
    p_ref_id: requestId,
    p_amount: CLAIM_REWARD_COINS,
    p_type: "claim_reward",
    p_note: "USTAD Coins claim",
  });
  if (error) throw new Error("Claim could not be completed. Please try again.");

  const row = (Array.isArray(data) ? data[0] : data) as
    | { balance_after?: number; applied?: boolean }
    | undefined;
  const wallet = await getWallet(guestId);
  const applied = row?.applied !== false;

  return {
    status: "success",
    credited: applied ? CLAIM_REWARD_COINS : 0,
    balance: Number(row?.balance_after ?? wallet.balance),
    duplicate: !applied,
  };
}
