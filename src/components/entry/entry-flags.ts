/** Session flag read once by the Guest ID stage to play the glass-card reveal. */
export const ENTRY_REVEAL_KEY = "ustad.entryCinema";

export function markCinematicReveal(): void {
  try {
    window.sessionStorage.setItem(ENTRY_REVEAL_KEY, "1");
  } catch {
    /* best effort — the app works identically without it */
  }
}