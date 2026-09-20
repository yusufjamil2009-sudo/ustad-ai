/**
 * USTAD AI — Games Library scoring & result engine.
 *
 * Every number here is derived from the REAL stored answers of the active
 * session. Nothing is hardcoded, nothing is random, and the winner is only
 * ever computed from actual correct-answer counts.
 */
import { PLAYER_SLOTS } from "./config";
import type {
  GameSession,
  OptionKey,
  PlayerScore,
  QuestionSlot,
  SessionResult,
} from "./types";

export function swatchFor(id: string): string {
  return PLAYER_SLOTS.find((p) => p.id === id)?.swatch ?? "#ef4444";
}

export function emojiFor(id: string): string {
  return PLAYER_SLOTS.find((p) => p.id === id)?.emoji ?? "👤";
}

export function accuracyOf(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 1000) / 10;
}

/** Score = number of correct answers. Wrong and Time Up are worth 0. */
export function scoreForPlayer(session: GameSession, playerId: string): PlayerScore {
  const player = session.players.find((p) => p.id === playerId);
  const answers = session.answers.filter((a) => a.playerId === playerId);
  const correct = answers.filter((a) => a.result === "correct").length;
  const timeUp = answers.filter((a) => a.result === "time-up").length;
  const wrong = answers.filter((a) => a.result === "wrong").length;
  return {
    playerId: (player?.id ?? "player1") as PlayerScore["playerId"],
    name: player?.name ?? "Player",
    color: player?.color ?? "red",
    correct,
    wrong,
    timeUp,
    score: correct,
    accuracy: accuracyOf(correct, session.totalQuestions),
  };
}

/**
 * Builds the final result. `slots` carries the validated question data so the
 * review never triggers a new generation request.
 */
export function buildResult(session: GameSession, slots: QuestionSlot[]): SessionResult {
  const scores = session.players.map((p) => scoreForPlayer(session, p.id));
  const best = scores.reduce((max, s) => Math.max(max, s.score), -1);
  // A tie keeps EVERY tied player — no random pick, no color tiebreaker.
  const winnerPlayerIds = scores.filter((s) => s.score === best).map((s) => s.playerId);

  const review = slots
    .filter((slot) => slot.status === "ready" && !!slot.question)
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .map((slot) => ({
      questionNumber: slot.questionNumber,
      question: slot.question ?? "",
      options: (slot.options ?? { A: "", B: "", C: "", D: "" }) as Record<OptionKey, string>,
      correctAnswer: (slot.correctAnswer ?? "A") as OptionKey,
      explanation: slot.explanation ?? "",
      answers: session.answers.filter((a) => a.questionId === slot.questionId),
    }));

  return {
    sessionId: session.sessionId,
    gameId: session.gameId,
    playerCount: session.playerCount,
    scores,
    winnerPlayerIds,
    review,
  };
}

/** True only when every active player has answered all 30 questions. */
export function isSessionComplete(session: GameSession, slots: QuestionSlot[]): boolean {
  const played = slots.filter((s) => s.status === "ready").slice(0, session.totalQuestions);
  if (played.length < session.totalQuestions) return false;
  return played.every((slot) =>
    session.players.every((p) =>
      session.answers.some((a) => a.playerId === p.id && a.questionId === slot.questionId),
    ),
  );
}
