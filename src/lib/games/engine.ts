/**
 * USTAD AI — Games Library reusable engine core.
 *
 * ONE architecture serves all 9 games and all 4 player modes. Nothing here
 * generates questions by itself: a `BatchGenerator` is injected by the
 * gameplay layer, so opening the library or a pre-game screen generates
 * absolutely nothing.
 */
import {
  buildBatchPlan,
  batchIdForQuestion,
  getGame,
  playersFor,
  timerFor,
  DEFAULT_DIFFICULTY,
  type Difficulty,
  type GameId,
  type PlayerCount,
} from "./config";
import {
  OPTION_KEYS,
  type BatchState,
  type GameQuestion,
  type GameSession,
  type OptionKey,
  type PlayerAnswer,
  type QuestionSlot,
} from "./types";

function uid(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

/* ------------------------------------------------------------- session ---- */

export type SessionConfig = {
  gameId: GameId;
  playerCount: PlayerCount;
  difficulty?: Difficulty;
};

export function createSession({
  gameId,
  playerCount,
  difficulty = DEFAULT_DIFFICULTY,
}: SessionConfig): GameSession {
  const game = getGame(gameId);
  if (!game) throw new Error("unknown-game");

  const plan = buildBatchPlan(game);
  const batches: BatchState[] = plan.map((b) => ({
    batchId: b.batchId,
    from: b.from,
    to: b.to,
    status: "pending",
    questionNumbers: b.questionNumbers,
  }));

  const questions: QuestionSlot[] = [];
  for (let n = 1; n <= game.totalQuestions; n += 1) {
    questions.push({
      questionId: uid("q"),
      gameId,
      batchId: batchIdForQuestion(n, game.batchSize),
      questionNumber: n,
      difficulty,
      status: "pending",
      attempts: 0,
    });
  }

  const timer = timerFor(playerCount);

  return {
    sessionId: uid("gs"),
    gameId,
    difficulty,
    playerCount,
    players: playersFor(playerCount).map((p) => ({ id: p.id, name: p.name, color: p.color })),
    currentPlayerIndex: 0,
    currentQuestionIndex: 0,
    totalQuestions: 30,
    currentBatch: 1,
    timerEnabled: timer.timerEnabled,
    timerSeconds: timer.timerSeconds,
    status: "created",
    batches,
    questions,
    answers: [],
    createdAt: new Date().toISOString(),
  };
}

/** Multiplayer rotation: Red → Yellow → Black → Green, same question. */
export function nextPlayerIndex(session: GameSession): number {
  return (session.currentPlayerIndex + 1) % session.players.length;
}

export function allPlayersAnswered(session: GameSession, questionId: string): boolean {
  const answered = new Set(
    session.answers.filter((a) => a.questionId === questionId).map((a) => a.playerId),
  );
  return session.players.every((p) => answered.has(p.id));
}

/** Answers are stored per player — one player never overwrites another. */
export function recordAnswer(session: GameSession, answer: PlayerAnswer): GameSession {
  const exists = session.answers.some(
    (a) => a.playerId === answer.playerId && a.questionId === answer.questionId,
  );
  if (exists) return session;
  return { ...session, answers: [...session.answers, answer] };
}

/* --------------------------------------------------- answer randomisation - */

/**
 * Balanced-but-unpredictable correct-answer positions across the 30 questions.
 * Independent of player color, player number, game mode, batch and question
 * number — it is a shuffled, evenly-weighted bag of A/B/C/D.
 */
export function buildAnswerPositionPlan(total = 30): OptionKey[] {
  const bag: OptionKey[] = [];
  for (let i = 0; i < total; i += 1) bag.push(OPTION_KEYS[i % OPTION_KEYS.length]!);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  return bag;
}

/** Moves a question's correct option to `target`, keeping all 4 options. */
export function placeCorrectAnswerAt(
  options: Record<OptionKey, string>,
  correctAnswer: OptionKey,
  target: OptionKey,
): { options: Record<OptionKey, string>; correctAnswer: OptionKey } {
  if (correctAnswer === target) return { options, correctAnswer };
  const next = { ...options };
  next[target] = options[correctAnswer]!;
  next[correctAnswer] = options[target]!;
  return { options: next, correctAnswer: target };
}

/* --------------------------------------------------------- validation ----- */

export type ValidationIssue =
  | "missing-question"
  | "missing-option"
  | "duplicate-option"
  | "invalid-correct-answer"
  | "missing-explanation"
  | "duplicate-question";

export function validateQuestion(
  question: Partial<GameQuestion>,
  existing: { question?: string }[] = [],
): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const text = (question.question ?? "").trim();
  if (!text) issues.push("missing-question");

  const options = question.options;
  const values = OPTION_KEYS.map((k) => (options?.[k] ?? "").trim());
  if (values.some((v) => !v)) issues.push("missing-option");
  const seen = new Set(values.filter(Boolean).map((v) => v.toLowerCase()));
  if (seen.size !== values.filter(Boolean).length) issues.push("duplicate-option");

  if (!question.correctAnswer || !OPTION_KEYS.includes(question.correctAnswer)) {
    issues.push("invalid-correct-answer");
  }
  if (!(question.explanation ?? "").trim()) issues.push("missing-explanation");

  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  if (normalized && existing.some((q) => (q.question ?? "").toLowerCase().replace(/\s+/g, " ") === normalized)) {
    issues.push("duplicate-question");
  }

  return { valid: issues.length === 0, issues };
}

/* ------------------------------------------------- parallel batch loading - */

export type BatchRequest = { gameId: GameId; batchId: number; questionNumbers: number[] };
export type BatchGenerator = (request: BatchRequest) => Promise<GameQuestion[]>;

export type BatchEvent =
  | { type: "batch-start"; batchId: number }
  | { type: "batch-ready"; batchId: number; questions: GameQuestion[] }
  | { type: "batch-failed"; batchId: number; error: string };

/**
 * Fires ALL 6 batch requests at once for the SELECTED GAME ONLY. Each batch
 * resolves independently, so the first ready batch is playable immediately and
 * one failure never blocks the others.
 */
export function generateBatchesInParallel(
  session: GameSession,
  generate: BatchGenerator,
  onEvent: (event: BatchEvent) => void,
): Promise<PromiseSettledResult<GameQuestion[]>[]> {
  return Promise.allSettled(
    session.batches.map(async (batch) => {
      onEvent({ type: "batch-start", batchId: batch.batchId });
      try {
        const questions = await generate({
          gameId: session.gameId,
          batchId: batch.batchId,
          questionNumbers: batch.questionNumbers,
        });
        onEvent({ type: "batch-ready", batchId: batch.batchId, questions });
        return questions;
      } catch (error) {
        onEvent({
          type: "batch-failed",
          batchId: batch.batchId,
          error: error instanceof Error ? error.message : "generation-failed",
        });
        throw error;
      }
    }),
  );
}

/** Individual-question retry: only the failing question number is regenerated. */
export type QuestionGenerator = (request: {
  gameId: GameId;
  batchId: number;
  questionNumber: number;
}) => Promise<GameQuestion>;

export async function retryQuestion(
  session: GameSession,
  questionNumber: number,
  generate: QuestionGenerator,
): Promise<GameSession> {
  const slot = session.questions.find((q) => q.questionNumber === questionNumber);
  if (!slot) return session;

  const mark = (patch: Partial<QuestionSlot>): GameSession => ({
    ...session,
    questions: session.questions.map((q) =>
      q.questionNumber === questionNumber ? { ...q, ...patch } : q,
    ),
  });

  try {
    const fresh = await generate({
      gameId: session.gameId,
      batchId: slot.batchId,
      questionNumber,
    });
    const others = session.questions.filter((q) => q.questionNumber !== questionNumber);
    const check = validateQuestion(fresh, others);
    if (!check.valid) {
      return mark({ status: "failed", attempts: slot.attempts + 1, error: check.issues[0] ?? "missing-question" });
    }
    return mark({ ...fresh, status: "ready", attempts: slot.attempts + 1 });
  } catch {
    return mark({ status: "failed", attempts: slot.attempts + 1, error: "generation-failed" });
  }
}
