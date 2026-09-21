/**
 * Crorepati / quiz question preparation — REAL progress tracking.
 *
 * The parallel preparation pipeline in `crorepati-ai.server.ts` emits a
 * `QuizPrepEvent` every time a batch actually moves (generating →
 * factChecking → completed/failed). This module is the only place those
 * events are persisted, so the game screen can render the ACTUAL state
 * instead of a timed animation.
 *
 * One row per guest (`crorepati_prep_progress.guest_id` is the primary key):
 * a guest can only prepare one set at a time, and a new run overwrites the
 * previous one. Nothing here touches gameplay, scoring, rewards or timers.
 */
import { db, requireGuest } from "./guest.server";
import type { QuizBatchState, QuizPrepEvent } from "./crorepati-ai.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sdb = () => db() as any;

export type PrepBatch = {
  slot: number;
  state: QuizBatchState;
  generated: number;
  verified: number;
};

export type PrepProgressView = {
  runId: string;
  total: number;
  verified: number;
  phase: "preparing" | "ready" | "failed";
  batches: PrepBatch[];
  startedAt: string;
  updatedAt: string;
};

/**
 * A live progress recorder for one preparation run.
 *
 * Writes are fire-and-forget and serialised through a single in-flight
 * promise: a database hiccup can never slow down or break question
 * preparation, which stays the authority.
 */
export function createPrepRecorder(guestId: string, total: number) {
  const runId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  const batches = new Map<number, PrepBatch>();
  let phase: PrepProgressView["phase"] = "preparing";
  let chain: Promise<unknown> = Promise.resolve();

  const flush = () => {
    const rows = [...batches.values()].sort((a, b) => a.slot - b.slot);
    const verified = rows.reduce((n, b) => n + b.verified, 0);
    chain = chain
      .then(() =>
        sdb()
          .from("crorepati_prep_progress")
          .upsert(
            {
              guest_id: guestId,
              run_id: runId,
              total,
              verified: Math.min(verified, total),
              phase,
              batches: rows,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "guest_id" },
          ),
      )
      .catch(() => {});
  };

  /** Called before any AI work so the screen has something real immediately. */
  const begin = () => {
    chain = chain
      .then(() =>
        sdb()
          .from("crorepati_prep_progress")
          .upsert(
            {
              guest_id: guestId,
              run_id: runId,
              total,
              verified: 0,
              phase: "preparing",
              batches: [],
              started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "guest_id" },
          ),
      )
      .catch(() => {});
  };

  const onProgress = (e: QuizPrepEvent) => {
    if ("slots" in e) {
      for (let slot = 0; slot < e.slots; slot++) {
        if (!batches.has(slot))
          batches.set(slot, { slot, state: "pending", generated: 0, verified: 0 });
      }
    } else {
      const prev = batches.get(e.slot) ?? {
        slot: e.slot,
        state: "pending" as QuizBatchState,
        generated: 0,
        verified: 0,
      };
      batches.set(e.slot, {
        slot: e.slot,
        state: e.state,
        generated: e.generated ?? prev.generated,
        verified: e.verified ?? (e.state === "completed" ? prev.verified : 0),
      });
    }
    flush();
  };

  const finish = (result: "ready" | "failed") => {
    phase = result;
    flush();
    return chain;
  };

  return { runId, begin, onProgress, finish };
}

/** Read the current preparation state for the signed-in guest. */
export async function getPrepProgress(token: string): Promise<PrepProgressView | null> {
  const guestId = await requireGuest(token);
  const { data } = await sdb()
    .from("crorepati_prep_progress")
    .select("*")
    .eq("guest_id", guestId)
    .maybeSingle();
  if (!data) return null;
  const batches = Array.isArray(data.batches) ? (data.batches as PrepBatch[]) : [];
  return {
    runId: String(data.run_id),
    total: Number(data.total ?? 0),
    verified: Number(data.verified ?? 0),
    phase: (data.phase ?? "preparing") as PrepProgressView["phase"],
    batches,
    startedAt: String(data.started_at),
    updatedAt: String(data.updated_at),
  };
}
