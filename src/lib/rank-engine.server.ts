/**
 * USTAD AI — PROFILE LEADERBOARD + WEEKLY RANK SETTLEMENT (server authority).
 *
 * REUSES, never rebuilds:
 *   • guest identity / db()  → `guest.server.ts`
 *   • verified cups          → `ustad_achievements`, `tournament_attempts`,
 *                              `master_event_results`
 *   • coins                  → `wallet.server.ts` (`applyCoins`, idempotent)
 *   • certificates           → `certificate-engine.server.ts`
 *   • notifications          → `notification.server.ts`
 *   • profile names          → existing `profiles` table
 *
 * HARD RULES
 *   1. Every count comes from a verified backend record. Nothing is invented.
 *   2. A finished cycle settles exactly once (`ustad_rank_cycles`), and each
 *      award row is unique per (cycle, category, guest), so a retry, a refresh
 *      or two concurrent readers can never pay twice.
 *   3. Settlement is immutable: a settled cycle is never recomputed.
 */

import { db } from "./guest.server";
import { applyCoins } from "./wallet.server";
import { notifyGuest } from "./notification.server";
import { issueStandaloneCertificate } from "./certificate-engine.server";
import { recipientDisplayName } from "./certificate-spec";
import {
  CATEGORY_LABEL,
  LEADERBOARD_SIZE,
  RANK_CATEGORIES,
  RANK_CUP_LABEL,
  currentCycle,
  cupForRank,
  cycleFromStart,
  formatCoins,
  previousCycle,
  rankContextLine,
  rankEntries,
  rankRewardRef,
  rewardForRank,
  type CupEvent,
  type LeaderboardEntry,
  type RankCategory,
  type RankCycle,
} from "./rank-spec";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const sdb = () => db() as any;

/* ------------------------------------------------------------------ */
/* Verified cup collection                                              */
/* ------------------------------------------------------------------ */

const ACHIEVEMENT_CATEGORY: Record<string, RankCategory | null> = {
  normal_cup: null, // counts only toward Most Cups
  mega_cup: "mega",
  grandmaster: "grandmaster",
  ultra_grandmaster: "ultra_grandmaster",
};

const ACHIEVEMENT_LABEL: Record<string, string> = {
  normal_cup: "Tournament Cup",
  mega_cup: "Mega Tournament Cup",
  grandmaster: "Grandmaster Cup",
  ultra_grandmaster: "Ultra Great Grandmaster Cup",
};

/**
 * Every verified cup in the system, as flat events. Each event carries the
 * category it belongs to; Most Cups is the union of all of them.
 */
async function collectCupEvents(guestId?: string): Promise<CupEvent[]> {
  const events: CupEvent[] = [];
  const seen = new Set<string>();
  const push = (e: CupEvent) => {
    if (seen.has(e.key)) return;
    seen.add(e.key);
    events.push(e);
  };

  try {
    let q = sdb()
      .from("ustad_achievements")
      .select("id,guest_id,type,event_id,match_id,awarded_at,verification_status")
      .eq("verification_status", "verified");
    if (guestId) q = q.eq("guest_id", guestId);
    for (const r of ((await q).data ?? []) as Row[]) {
      const type = String(r["type"]);
      if (!(type in ACHIEVEMENT_CATEGORY)) continue;
      const category = ACHIEVEMENT_CATEGORY[type];
      push({
        guestId: String(r["guest_id"]),
        category: (category ?? "most_cups") as RankCategory,
        at: String(r["awarded_at"] ?? r["created_at"] ?? new Date().toISOString()),
        key: `ach:${r["guest_id"]}:${type}:${r["event_id"] ?? "-"}:${r["match_id"] ?? r["id"]}`,
        label: ACHIEVEMENT_LABEL[type] ?? "USTAD Cup",
        source: "Achievement record",
        reference: String(r["id"]),
      });
    }
  } catch {
    /* a missing table must never blank the whole leaderboard */
  }

  try {
    let q = sdb()
      .from("tournament_attempts")
      .select("id,guest_id,kind,result,cycle_id,completed_at,created_at")
      .eq("result", "won");
    if (guestId) q = q.eq("guest_id", guestId);
    for (const r of ((await q).data ?? []) as Row[]) {
      const kind = String(r["kind"]);
      const category: RankCategory | null =
        kind === "mystery" ? "mystery" : kind === "god" ? "god_master" : null;
      if (!category) continue;
      push({
        guestId: String(r["guest_id"]),
        category,
        at: String(r["completed_at"] ?? r["created_at"]),
        key: `tour:${r["id"]}`,
        label:
          category === "mystery" ? "Mystery + Psychology Cup" : "USTAD GOD MASTER Cup",
        source: category === "mystery" ? "Mystery Tournament" : "God Master Tournament",
        reference: String(r["cycle_id"] ?? r["id"]),
      });
    }
  } catch {
    /* ignore */
  }

  try {
    let q = sdb()
      .from("master_event_results")
      .select("id,guest_id,event_id,is_winner,created_at")
      .eq("is_winner", true);
    if (guestId) q = q.eq("guest_id", guestId);
    for (const r of ((await q).data ?? []) as Row[]) {
      push({
        guestId: String(r["guest_id"]),
        category: "event",
        at: String(r["created_at"]),
        key: `event:${r["id"]}`,
        label: "USTAD Event Cup",
        source: "USTAD Event",
        reference: String(r["event_id"]),
      });
    }
  } catch {
    /* ignore */
  }

  return events;
}

function inCycle(e: CupEvent, cycle: RankCycle): boolean {
  const t = Date.parse(e.at);
  return (
    Number.isFinite(t) && t >= Date.parse(cycle.startIso) && t < Date.parse(cycle.endIso)
  );
}

function matches(e: CupEvent, category: RankCategory): boolean {
  return category === "most_cups" ? true : e.category === category;
}

async function profileNames(guestIds: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!guestIds.length) return out;
  try {
    const { data } = await sdb().from("profiles").select("guest_id,name").in("guest_id", guestIds);
    for (const r of ((data ?? []) as Row[])) {
      out[String(r["guest_id"])] = recipientDisplayName({ name: r["name"] });
    }
  } catch {
    /* fall through to the neutral label below */
  }
  for (const id of guestIds) out[id] ??= recipientDisplayName({});
  return out;
}

/** Top-N table for one category and one cycle, from verified records only. */
function buildBoard(
  events: CupEvent[],
  category: RankCategory,
  cycle: RankCycle,
): Array<Omit<LeaderboardEntry, "rank" | "profileName">> {
  const acc = new Map<string, { cycleCups: number; totalCups: number; firstCupAt: string }>();
  for (const e of events) {
    if (!matches(e, category)) continue;
    const row = acc.get(e.guestId) ?? {
      cycleCups: 0,
      totalCups: 0,
      firstCupAt: "9999-12-31T00:00:00.000Z",
    };
    row.totalCups += 1;
    if (inCycle(e, cycle)) {
      row.cycleCups += 1;
      if (Date.parse(e.at) < Date.parse(row.firstCupAt)) row.firstCupAt = e.at;
    }
    acc.set(e.guestId, row);
  }
  return [...acc.entries()].map(([guestId, v]) => ({ guestId, ...v }));
}

/* ------------------------------------------------------------------ */
/* Public reads                                                         */
/* ------------------------------------------------------------------ */

export type CategoryBoard = {
  category: RankCategory;
  label: string;
  entries: LeaderboardEntry[];
  /** This user's live position, even when outside the top 20. */
  you: LeaderboardEntry | null;
};

export type LeaderboardView = {
  cycle: { start: string; end: string; id: string };
  boards: CategoryBoard[];
  /** Settled weekly rank awards this user holds. */
  myAwards: RankAwardView[];
};

export type RankAwardView = {
  cycleStart: string;
  cycleEnd: string;
  category: RankCategory;
  categoryLabel: string;
  rank: number;
  cupCount: number;
  coins: number;
  cupAwarded: boolean;
  cupLabel: string | null;
  certificateId: string | null;
};

export type CupDetail = {
  key: string;
  label: string;
  category: RankCategory;
  categoryLabel: string;
  source: string;
  reference: string;
  awardedAt: string;
  cycleStart: string;
};

export async function getLeaderboard(guestId: string): Promise<LeaderboardView> {
  await settleDueCycles();
  const cycle = currentCycle();
  const events = await collectCupEvents();
  const boards: CategoryBoard[] = [];

  const ids = new Set<string>();
  const raw = new Map<RankCategory, Array<Omit<LeaderboardEntry, "rank" | "profileName">>>();
  for (const category of RANK_CATEGORIES) {
    const rows = buildBoard(events, category, cycle);
    raw.set(category, rows);
    for (const r of rows) if (r.cycleCups > 0) ids.add(r.guestId);
  }
  ids.add(guestId);
  const names = await profileNames([...ids]);

  for (const category of RANK_CATEGORIES) {
    const rows = (raw.get(category) ?? []).map((r) => ({
      ...r,
      profileName: names[r.guestId] ?? recipientDisplayName({}),
    }));
    // Rank the full field, then cut to the visible size, so "you" is truthful.
    const full = rankEntries(rows, Number.MAX_SAFE_INTEGER);
    const mine = full.find((r) => r.guestId === guestId) ?? null;
    boards.push({
      category,
      label: CATEGORY_LABEL[category],
      entries: full.slice(0, LEADERBOARD_SIZE),
      you: mine,
    });
  }

  return {
    cycle: { start: cycle.start, end: cycle.end, id: cycle.id },
    boards,
    myAwards: await listRankAwards(guestId),
  };
}

/** Every verified cup this user owns, with its full provenance. */
export async function getAllCups(guestId: string): Promise<CupDetail[]> {
  const events = await collectCupEvents(guestId);
  return events
    .filter((e) => e.guestId === guestId)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((e) => ({
      key: e.key,
      label: e.label,
      category: e.category,
      categoryLabel: CATEGORY_LABEL[e.category],
      source: e.source,
      reference: e.reference,
      awardedAt: e.at,
      cycleStart: currentCycle(e.at).start,
    }));
}

export async function listRankAwards(guestId: string): Promise<RankAwardView[]> {
  try {
    const { data } = await sdb()
      .from("ustad_rank_awards")
      .select("*")
      .eq("guest_id", guestId)
      .order("cycle_start", { ascending: false });
    return ((data ?? []) as Row[]).map((r) => {
      const category = String(r["category"]) as RankCategory;
      return {
        cycleStart: String(r["cycle_start"]),
        cycleEnd: String(r["cycle_end"]),
        category,
        categoryLabel: CATEGORY_LABEL[category] ?? category,
        rank: Number(r["rank"]),
        cupCount: Number(r["cup_count"] ?? 0),
        coins: Number(r["coins"] ?? 0),
        cupAwarded: r["cup_awarded"] === true,
        cupLabel: r["cup_awarded"] === true ? (RANK_CUP_LABEL[category] ?? null) : null,
        certificateId: (r["certificate_id"] as string) ?? null,
      };
    });
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Weekly settlement (immutable, idempotent)                            */
/* ------------------------------------------------------------------ */

async function isSettled(cycle: RankCycle): Promise<boolean> {
  try {
    const { data } = await sdb()
      .from("ustad_rank_cycles")
      .select("cycle_start")
      .eq("cycle_start", cycle.start)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return true; // never risk paying twice when the check itself failed
  }
}

/**
 * Settle every finished cycle that has not been settled yet (bounded look-back
 * so a long-idle app never replays months of history).
 */
export async function settleDueCycles(now: Date = new Date()): Promise<string[]> {
  const settled: string[] = [];
  let cycle = previousCycle(currentCycle(now));
  for (let i = 0; i < 4; i++) {
    if (await settleCycle(cycle)) settled.push(cycle.start);
    cycle = previousCycle(cycle);
  }
  return settled;
}

/** Settle ONE finished cycle. Returns true when this call did the settling. */
export async function settleCycle(cycle: RankCycle): Promise<boolean> {
  if (Date.now() < Date.parse(cycle.endIso)) return false; // still running
  if (await isSettled(cycle)) return false;

  const events = await collectCupEvents();
  const summary: Row = {};

  for (const category of RANK_CATEGORIES) {
    const rows = buildBoard(events, category, cycle);
    const names = await profileNames(rows.filter((r) => r.cycleCups > 0).map((r) => r.guestId));
    const top = rankEntries(
      rows.map((r) => ({ ...r, profileName: names[r.guestId] ?? recipientDisplayName({}) })),
      3,
    );
    summary[category] = top.map((t) => ({ rank: t.rank, guestId: t.guestId, cups: t.cycleCups }));
    for (const entry of top) await awardRank(cycle, category, entry);
  }

  try {
    await sdb()
      .from("ustad_rank_cycles")
      .insert({ cycle_start: cycle.start, cycle_end: cycle.end, summary });
  } catch {
    /* a concurrent settler already recorded it — awards are unique anyway */
  }
  return true;
}

async function awardRank(
  cycle: RankCycle,
  category: RankCategory,
  entry: LeaderboardEntry,
): Promise<void> {
  const coins = rewardForRank(entry.rank);
  if (coins <= 0) return;

  // 1. Claim the award row. The unique index is the real duplicate guard.
  const { data: inserted, error } = await sdb()
    .from("ustad_rank_awards")
    .insert({
      cycle_start: cycle.start,
      cycle_end: cycle.end,
      category,
      guest_id: entry.guestId,
      profile_name: entry.profileName,
      rank: entry.rank,
      cup_count: entry.cycleCups,
      coins,
      cup_awarded: cupForRank(entry.rank),
    })
    .select()
    .maybeSingle();
  if (error || !inserted) return; // already settled for this guest+category

  // 2. Coins — idempotent at the ledger level as well.
  let transactionId: string | null = null;
  try {
    const res = await applyCoins({
      guestId: entry.guestId,
      source: "rank_reward",
      refId: rankRewardRef(cycle.start, category, entry.rank),
      amount: coins,
      type: "weekly_rank",
      note: `Weekly Rank #${entry.rank} — ${CATEGORY_LABEL[category]}`,
    });
    transactionId = res.transactionId;
  } catch {
    /* the award row stays, but we never claim a credit that did not happen */
  }

  // 3. Rank certificate for all three places.
  let certificateId: string | null = null;
  try {
    const cert = await issueStandaloneCertificate({
      guestId: entry.guestId,
      type: "weekly_rank",
      reference: `${cycle.start}:${category}:${entry.rank}`,
      awardTitle: `Weekly Rank #${entry.rank} — ${CATEGORY_LABEL[category]}`,
      eventName: `USTAD Weekly Leaderboard (${cycle.start} → ${cycle.end})`,
      tournament: "USTAD AI Weekly Leaderboard",
      facts: [
        { label: "Category", value: CATEGORY_LABEL[category] },
        { label: "Rank", value: `#${entry.rank}` },
        { label: "Verified Cups", value: String(entry.cycleCups) },
        { label: "Reward", value: `${formatCoins(coins)} USTAD Coins` },
      ],
    });
    certificateId = cert;
  } catch {
    /* certificate failure must never void the settled rank */
  }

  try {
    await sdb()
      .from("ustad_rank_awards")
      .update({
        transaction_id: transactionId,
        certificate_id: certificateId,
      })
      .eq("cycle_start", cycle.start)
      .eq("category", category)
      .eq("guest_id", entry.guestId);
  } catch {
    /* bookkeeping only */
  }

  await notifyGuest(
    entry.guestId,
    "achievement",
    `rank:${cycle.start}:${category}:${entry.rank}`,
    { achievementName: `Weekly Rank #${entry.rank} — ${CATEGORY_LABEL[category]}` },
    {
      referenceType: "ustad_rank_awards",
      referenceId: `${cycle.start}:${category}`,
      actionPath: "/settings",
      metadata: {
        category,
        rank: entry.rank,
        coins,
        cycleStart: cycle.start,
        cupAwarded: cupForRank(entry.rank),
      },
    },
  );
}

/* ------------------------------------------------------------------ */
/* Chat context                                                         */
/* ------------------------------------------------------------------ */

/** Verified leaderboard facts for USTAD AI. Empty when there is nothing real. */
export async function rankContext(guestId: string): Promise<string> {
  const awards = await listRankAwards(guestId);
  return rankContextLine(
    awards.map((a) => ({
      category: a.category,
      rank: a.rank,
      cycleStart: a.cycleStart,
      coins: a.coins,
    })),
  );
}

export { cycleFromStart };
