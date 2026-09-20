/**
 * USTAD AI — per-game daily attempt foundation.
 *
 * Each of the 9 games owns its own daily attempt. There is NO global lock.
 * The authoritative date arrives from the USTAD AI date engine (server side);
 * device date and localStorage are never the authority.
 */
import { GAMES, type GameId } from "./config";
import type { GameAvailability, GameDailyAttempt } from "./types";

/** Starting a game consumes that game's attempt, even if the user leaves at Q12. */
export function consumesAttempt(status: GameDailyAttempt["status"]): boolean {
  return status === "started" || status === "completed" || status === "abandoned";
}

export function buildAvailability(
  attempts: GameDailyAttempt[],
  date: string,
): Record<GameId, GameAvailability> {
  const locked = new Set(
    attempts.filter((a) => a.date === date && consumesAttempt(a.status)).map((a) => a.gameId),
  );
  const map = {} as Record<GameId, GameAvailability>;
  for (const game of GAMES) {
    map[game.id] = locked.has(game.id)
      ? { gameId: game.id, available: false, reason: "daily-lock" }
      : { gameId: game.id, available: true };
  }
  return map;
}
