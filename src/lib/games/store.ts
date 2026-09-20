/**
 * In-memory holder for the active Games Library session. The gameplay parts
 * read the session from here; nothing is persisted as a daily-lock authority.
 */
import type { GameSession } from "./types";

let active: GameSession | null = null;
const listeners = new Set<(session: GameSession | null) => void>();

export function getActiveSession(): GameSession | null {
  return active;
}

export function setActiveSession(session: GameSession | null): void {
  active = session;
  listeners.forEach((fn) => fn(active));
}

export function subscribeSession(fn: (session: GameSession | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
