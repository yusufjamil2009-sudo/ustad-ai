/**
 * USTAD AI — Games Library daily lock (client side).
 *
 * This module only DISPLAYS what the backend says. It never decides whether a
 * game is locked, never reads the device clock as an authority and has no
 * reset switch. The IST (Asia/Kolkata) calendar date always comes from the
 * server; the local clock is used only to schedule a revalidation near
 * midnight so an open Games Library refreshes itself for the new day.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { gamesDailyProgressFn, gamesDailyStartFn, gamesDailyStatusFn } from "../ustad-api";
import { GAME_IDS, type GameId } from "./config";

export type DailyState = "available" | "locked";
export type DailyStates = Record<GameId, DailyState>;

export const LOCKED_LABEL = "Today's Match Completed";
export const VERIFY_ERROR = "Unable to verify today's game status. Please try again.";

function allAvailable(): DailyStates {
  const map = {} as DailyStates;
  for (const id of GAME_IDS) map[id] = "available";
  return map;
}

/** Milliseconds until the next 00:00:00 in Asia/Kolkata, from the device clock. */
function msToIstMidnight(): number {
  const now = Date.now();
  // IST is UTC+5:30 with no DST, so the day boundary is a fixed offset.
  const offset = 5.5 * 60 * 60 * 1000;
  const istNow = now + offset;
  const nextDay = Math.floor(istNow / 86_400_000) * 86_400_000 + 86_400_000;
  return Math.max(1000, nextDay - istNow + 1500);
}

export type DailyStatus = {
  states: DailyStates | null;
  date: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/** Lock state for all 9 games in ONE backend request. */
export function useDailyStatus(): DailyStatus {
  const [states, setStates] = useState<DailyStates | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = (await gamesDailyStatusFn({ data: { token: "" } })) as {
          date: string;
          states: DailyStates;
        };
        if (cancelled) return;
        setStates({ ...allAvailable(), ...res.states });
        setDate(res.date);
      } catch {
        if (!cancelled) setError(VERIFY_ERROR);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  // Midnight IST: previous locks expire, so revalidate without a reload.
  useEffect(() => {
    const id = setTimeout(refresh, msToIstMidnight());
    return () => clearTimeout(id);
  }, [refresh, tick]);

  // Coming back to the app re-checks the authoritative state.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [refresh]);

  return { states, date, loading, error, refresh };
}

export type DailyClaim = { locked: boolean; date: string; completedQuestions: number };

/** Ask the backend to open today's match. Throws when it cannot be verified. */
export async function claimDailyStart(gameId: GameId, sessionId: string): Promise<DailyClaim> {
  return (await gamesDailyStartFn({ data: { token: "", gameId, sessionId } })) as DailyClaim;
}

/**
 * Reports fully completed questions. The backend consumes the daily attempt
 * atomically at 2 — duplicate calls are harmless.
 */
export async function reportDailyProgress(
  gameId: GameId,
  sessionId: string,
  completed: number,
): Promise<DailyClaim> {
  return (await gamesDailyProgressFn({
    data: { token: "", gameId, sessionId, completed },
  })) as DailyClaim;
}

/** Fire-and-forget reporter that never reports the same count twice. */
export function useProgressReporter(gameId: GameId, sessionId: string) {
  const highest = useRef(0);
  return useCallback(
    (completed: number) => {
      if (completed <= highest.current) return;
      highest.current = completed;
      void reportDailyProgress(gameId, sessionId, completed).catch(() => {
        // A failed report is retried by the next completed question; the
        // backend stays authoritative either way.
        highest.current = Math.max(0, completed - 1);
      });
    },
    [gameId, sessionId],
  );
}
