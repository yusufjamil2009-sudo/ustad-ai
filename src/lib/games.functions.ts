/**
 * Games Library — server function boundary (Part 2).
 *
 * The client asks for ONE batch (or one single question) of the SELECTED game
 * only. Generation rules, prompts and the correct-answer placement stay on the
 * server; the browser never sees a prompt.
 */
import { createServerFn } from "@tanstack/react-start";
import { GAME_IDS, isDifficulty, isGameId, type Difficulty, type GameId } from "./games/config";
import { OPTION_KEYS, type OptionKey } from "./games/types";

export type GamesBatchInput = {
  token: string;
  gameId: string;
  difficulty: string;
  batchId: number;
  /** One correct-answer slot per requested question (session-wide balanced plan). */
  targets: string[];
  questionNumbers: number[];
  avoid: string[];
  seed: number;
};

export const gamesGenerateFn = createServerFn({ method: "POST" })
  .inputValidator((d: GamesBatchInput) => d)
  .handler(async ({ data: d }) => {
    const { requireGuest } = await import("./guest.server");
    const guestId = await requireGuest(d.token);

    if (!isGameId(String(d.gameId))) throw new Error("unknown-game");
    const gameId = String(d.gameId) as GameId;
    const difficulty: Difficulty = isDifficulty(String(d.difficulty))
      ? (String(d.difficulty) as Difficulty)
      : "easy";

    const numbers = (Array.isArray(d.questionNumbers) ? d.questionNumbers : [])
      .map((n) => Math.floor(Number(n)))
      .filter((n) => n >= 1 && n <= 30)
      .slice(0, 5);
    if (!numbers.length) throw new Error("no-questions-requested");

    const targets: OptionKey[] = numbers.map((_, i) => {
      const raw = String(d.targets?.[i] ?? "").toUpperCase();
      return (OPTION_KEYS as string[]).includes(raw)
        ? (raw as OptionKey)
        : OPTION_KEYS[Math.floor(Math.random() * 4)]!;
    });

    const avoid = (Array.isArray(d.avoid) ? d.avoid : []).map((a) => String(a)).slice(-60);

    const { generateGameQuestions } = await import("./games/generate.server");
    const generated = await generateGameQuestions({
      guestId,
      gameId,
      difficulty,
      targets,
      avoid,
      seed: Math.floor(Number(d.seed) || Date.now() % 100000),
    });

    return {
      batchId: Math.floor(Number(d.batchId) || 1),
      questions: generated.map((q, i) => ({
        ...q,
        gameId,
        batchId: Math.floor(Number(d.batchId) || 1),
        questionNumber: numbers[i]!,
      })),
    };
  });

/* ---------------------------------------------------------------------------
 * Daily match lock (Part 4).
 *
 * The database is the ONLY authority. The IST (Asia/Kolkata) calendar date is
 * computed server side, so changing the device clock can never unlock a game.
 * A game is consumed for the day only once TWO questions are actually
 * completed — starting a match or finishing Q1 never locks anything.
 * ------------------------------------------------------------------------- */

type DailyState = "available" | "locked";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** One request returns the lock state of all 9 games for today. */
export const gamesDailyStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data: d }) => {
    const { requireGuest } = await import("./guest.server");
    const guestId = await requireGuest(d.token);
    const supabase = await adminClient();

    const { data: dateRow, error: dateError } = await supabase.rpc("ustad_ist_date");
    if (dateError) throw new Error("daily-status-unavailable");
    const date = String(dateRow);

    const { data: rows, error } = await supabase
      .from("ustad_game_daily")
      .select("game_id, completed_questions")
      .eq("guest_id", guestId)
      .eq("daily_date", date);
    if (error) throw new Error("daily-status-unavailable");

    const locked = new Set(
      (rows ?? []).filter((r) => (r.completed_questions ?? 0) >= 2).map((r) => String(r.game_id)),
    );
    const states = {} as Record<GameId, DailyState>;
    for (const id of GAME_IDS) states[id] = locked.has(id) ? "locked" : "available";
    return { date, states };
  });

/** Creating a session. Idempotent; rejects a start when today is already used. */
export const gamesDailyStartFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; gameId: string; sessionId: string }) => d)
  .handler(async ({ data: d }) => {
    const { requireGuest } = await import("./guest.server");
    const guestId = await requireGuest(d.token);
    if (!isGameId(String(d.gameId))) throw new Error("unknown-game");
    const supabase = await adminClient();

    const { data, error } = await supabase.rpc("ustad_game_daily_start", {
      p_guest_id: guestId,
      p_game_id: String(d.gameId),
      p_session_id: String(d.sessionId ?? ""),
    });
    if (error) throw new Error("daily-status-unavailable");
    const row = Array.isArray(data) ? data[0] : data;
    return {
      locked: Boolean(row?.locked),
      date: String(row?.daily_date ?? ""),
      completedQuestions: Number(row?.completed_questions ?? 0),
    };
  });

/** Reports how many questions are FULLY completed. Locks the game at 2. */
export const gamesDailyProgressFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; gameId: string; sessionId: string; completed: number }) => d)
  .handler(async ({ data: d }) => {
    const { requireGuest } = await import("./guest.server");
    const guestId = await requireGuest(d.token);
    if (!isGameId(String(d.gameId))) throw new Error("unknown-game");
    const supabase = await adminClient();

    const { data, error } = await supabase.rpc("ustad_game_daily_progress", {
      p_guest_id: guestId,
      p_game_id: String(d.gameId),
      p_session_id: String(d.sessionId ?? ""),
      p_completed: Math.max(0, Math.floor(Number(d.completed) || 0)),
    });
    if (error) throw new Error("daily-status-unavailable");
    const row = Array.isArray(data) ? data[0] : data;
    return {
      locked: Boolean(row?.locked),
      date: String(row?.daily_date ?? ""),
      completedQuestions: Number(row?.completed_questions ?? 0),
    };
  });
