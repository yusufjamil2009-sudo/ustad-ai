/**
 * Refresh protection for an active Games Library session.
 *
 * The full session (game, difficulty, players, questions already generated and
 * every stored answer) is kept in sessionStorage so an accidental refresh
 * resumes instead of restarting. Answers are keyed by player + question, so a
 * restore can never create duplicate answer records.
 */
import type { GameSession } from "./types";

const KEY = "ustad.games.active-session.v1";

export type PersistedGame = {
  session: GameSession;
  index: number;
  finished: boolean;
};

export function saveGame(state: PersistedGame): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — gameplay continues in memory */
  }
}

export function loadGame(gameId: string): PersistedGame | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedGame;
    if (!parsed?.session || parsed.session.gameId !== gameId) return null;
    if (!Array.isArray(parsed.session.questions) || !Array.isArray(parsed.session.answers)) {
      return null;
    }
    // Sessions saved before language support were English-only.
    parsed.session.language = parsed.session.language === "hi" ? "hi" : "en";
    return parsed;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
