/**
 * USTAD AI — Games Library central configuration.
 *
 * Single source of truth for the library. The gameplay engine, the pre-game
 * screen and every future backend record read the game list from here.
 * There are EXACTLY 9 games. Never add a tenth.
 */

export type GameId =
  | "riddle"
  | "brain-teaser"
  | "puzzle"
  | "iq-question"
  | "pattern-question"
  | "sequence-question"
  | "lateral-thinking"
  | "odd-one-out"
  | "guessing-question";

export type PlayerCount = 1 | 2 | 3 | 4;

/* ------------------------------------------------------------- difficulty */

export type Difficulty = "easy" | "medium" | "hard" | "god";

export type DifficultyConfig = { id: Difficulty; name: string; hint: string };

/** Difficulty is real: it changes what the generator is asked to produce. */
export const DIFFICULTIES: DifficultyConfig[] = [
  { id: "easy", name: "Easy", hint: "Simple, direct thinking." },
  { id: "medium", name: "Medium", hint: "Two steps and a few clues." },
  { id: "hard", name: "Hard", hint: "Multi-step deduction with traps." },
  { id: "god", name: "God Level", hint: "Layered clues and deep reasoning." },
];

export const DEFAULT_DIFFICULTY: Difficulty = "easy";

export function isDifficulty(value: string): value is Difficulty {
  return DIFFICULTIES.some((d) => d.id === value);
}

export type GameConfig = {
  id: GameId;
  name: string;
  icon: string;
  description: string;
  totalQuestions: 30;
  batchSize: 5;
  totalBatches: 6;
  supportedPlayers: PlayerCount[];
};

const SUPPORTED_PLAYERS: PlayerCount[] = [1, 2, 3, 4];

const base = {
  totalQuestions: 30,
  batchSize: 5,
  totalBatches: 6,
  supportedPlayers: SUPPORTED_PLAYERS,
} as const;

export const GAMES: GameConfig[] = [
  { id: "riddle", name: "Riddle", icon: "🧩", description: "Crack the clues and find the hidden answer.", ...base },
  { id: "brain-teaser", name: "Brain Teaser", icon: "🧠", description: "Think beyond the obvious.", ...base },
  { id: "puzzle", name: "Puzzle", icon: "🔐", description: "Use clues, logic and rules to solve the challenge.", ...base },
  { id: "iq-question", name: "IQ Question", icon: "🧠", description: "Test your logical reasoning.", ...base },
  { id: "pattern-question", name: "Pattern Question", icon: "🔵", description: "Find the rule hidden inside the pattern.", ...base },
  { id: "sequence-question", name: "Sequence Question", icon: "🔢", description: "Discover what comes next.", ...base },
  { id: "lateral-thinking", name: "Lateral Thinking", icon: "🧠", description: "Look at the problem from a different angle.", ...base },
  { id: "odd-one-out", name: "Odd-One-Out", icon: "👀", description: "Find what doesn't belong.", ...base },
  { id: "guessing-question", name: "Guessing Question", icon: "🔮", description: "Identify the answer from the clues.", ...base },
];

export const GAME_IDS = GAMES.map((g) => g.id);

export function getGame(id: string): GameConfig | undefined {
  return GAMES.find((g) => g.id === id);
}

export function isGameId(id: string): id is GameId {
  return GAMES.some((g) => g.id === id);
}

/* ---------------------------------------------------------------- players */

export type PlayerSlotId = "player1" | "player2" | "player3" | "player4";
export type PlayerColor = "red" | "yellow" | "black" | "green";

export type PlayerSlot = {
  id: PlayerSlotId;
  name: string;
  color: PlayerColor;
  /** Presentation only — never linked to an answer option. */
  swatch: string;
  emoji: string;
};

/**
 * Player identity ONLY. Colors have no relationship whatsoever with the
 * A/B/C/D answer options.
 */
export const PLAYER_SLOTS: PlayerSlot[] = [
  { id: "player1", name: "Red Player", color: "red", swatch: "#ef4444", emoji: "🔴" },
  { id: "player2", name: "Yellow Player", color: "yellow", swatch: "#eab308", emoji: "🟡" },
  { id: "player3", name: "Black Player", color: "black", swatch: "#1f2937", emoji: "⚫" },
  { id: "player4", name: "Green Player", color: "green", swatch: "#22c55e", emoji: "🟢" },
];

/** 1P → no multiplayer colors. 2P → Red+Yellow. 3P → +Black. 4P → +Green. */
export function playersFor(playerCount: PlayerCount): PlayerSlot[] {
  if (playerCount === 1) return [{ id: "player1", name: "You", color: "red", swatch: "#ef4444", emoji: "👤" }];
  return PLAYER_SLOTS.slice(0, playerCount);
}

/* ------------------------------------------------------------------ timer */

export type TimerConfig = { timerEnabled: boolean; timerSeconds: number | null };

/** Single player: 120s PER QUESTION. Multiplayer: no timer at all. */
export function timerFor(playerCount: PlayerCount): TimerConfig {
  return playerCount === 1
    ? { timerEnabled: true, timerSeconds: 120 }
    : { timerEnabled: false, timerSeconds: null };
}

/* ------------------------------------------------------------------ batch */

export type BatchPlan = { batchId: number; from: number; to: number; questionNumbers: number[] };

/** 30 questions → 6 batches of 5 (Q1–Q5, Q6–Q10, …, Q26–Q30). */
export function buildBatchPlan(config: Pick<GameConfig, "totalQuestions" | "batchSize" | "totalBatches">): BatchPlan[] {
  const plan: BatchPlan[] = [];
  for (let batchId = 1; batchId <= config.totalBatches; batchId += 1) {
    const from = (batchId - 1) * config.batchSize + 1;
    const to = from + config.batchSize - 1;
    const questionNumbers: number[] = [];
    for (let n = from; n <= to; n += 1) questionNumbers.push(n);
    plan.push({ batchId, from, to, questionNumbers });
  }
  return plan;
}

export function batchIdForQuestion(questionNumber: number, batchSize = 5): number {
  return Math.floor((questionNumber - 1) / batchSize) + 1;
}
