/**
 * USTAD AI — Games Library data models.
 *
 * Reusable across all 9 games. No game-specific shapes exist anywhere.
 */
import type { GameId, PlayerColor, PlayerCount, PlayerSlotId } from "./config";

export type OptionKey = "A" | "B" | "C" | "D";
export const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

export type QuestionStatus = "pending" | "generating" | "ready" | "failed" | "retrying";

export type GameQuestion = {
  questionId: string;
  gameId: GameId;
  batchId: number;
  questionNumber: number;
  question: string;
  options: Record<OptionKey, string>;
  /** Exactly one of A/B/C/D. Position is randomised, never fixed to A or B. */
  correctAnswer: OptionKey;
  explanation: string;
  status: QuestionStatus;
  /** Retry bookkeeping for individual-question regeneration. */
  attempts: number;
  error?: string;
};

/** A question slot before generation — the engine always holds exactly 30. */
export type QuestionSlot = Omit<GameQuestion, "question" | "options" | "correctAnswer" | "explanation"> & {
  question?: string;
  options?: Record<OptionKey, string>;
  correctAnswer?: OptionKey;
  explanation?: string;
};

export type BatchStatus = "pending" | "generating" | "ready" | "partial" | "failed";

export type BatchState = {
  batchId: number;
  from: number;
  to: number;
  status: BatchStatus;
  questionNumbers: number[];
};

export type SessionPlayer = {
  id: PlayerSlotId;
  name: string;
  color: PlayerColor;
};

export type SessionStatus = "created" | "generating" | "active" | "completed" | "abandoned";

export type GameSession = {
  sessionId: string;
  gameId: GameId;
  playerCount: PlayerCount;
  players: SessionPlayer[];
  currentPlayerIndex: number;
  currentQuestionIndex: number;
  totalQuestions: 30;
  currentBatch: number;
  timerEnabled: boolean;
  timerSeconds: number | null;
  status: SessionStatus;
  batches: BatchState[];
  questions: QuestionSlot[];
  /** Every player answers the SAME question independently. */
  answers: PlayerAnswer[];
  createdAt: string;
};

export type AnswerResult = "correct" | "wrong" | "time-up";

export type PlayerAnswer = {
  playerId: PlayerSlotId;
  questionId: string;
  selectedAnswer: OptionKey | null;
  submittedAt: string;
  result: AnswerResult;
};

/* ----------------------------------------------------------- future result */

export type PlayerScore = {
  playerId: PlayerSlotId;
  name: string;
  color: PlayerColor;
  correct: number;
  wrong: number;
  timeUp: number;
  score: number;
  accuracy: number;
};

export type SessionResult = {
  sessionId: string;
  gameId: GameId;
  playerCount: PlayerCount;
  scores: PlayerScore[];
  winnerPlayerIds: PlayerSlotId[];
  review: {
    questionNumber: number;
    question: string;
    options: Record<OptionKey, string>;
    correctAnswer: OptionKey;
    explanation: string;
    answers: PlayerAnswer[];
  }[];
};

/* -------------------------------------------------------------- daily lock */

export type DailyAttemptStatus = "started" | "completed" | "abandoned";

/**
 * PER-GAME daily attempt record. There is deliberately no global lock: playing
 * Riddle must never lock the other 8 games. The authoritative USTAD AI date
 * engine supplies `date` — never the device clock, never localStorage.
 */
export type GameDailyAttempt = {
  userId: string;
  gameId: GameId;
  date: string;
  startedAt: string;
  status: DailyAttemptStatus;
};

export type GameAvailability = {
  gameId: GameId;
  available: boolean;
  reason?: "daily-lock";
};
