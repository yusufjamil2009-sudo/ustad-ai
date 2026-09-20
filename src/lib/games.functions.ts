/**
 * Games Library — server function boundary (Part 2).
 *
 * The client asks for ONE batch (or one single question) of the SELECTED game
 * only. Generation rules, prompts and the correct-answer placement stay on the
 * server; the browser never sees a prompt.
 */
import { createServerFn } from "@tanstack/react-start";
import { isDifficulty, isGameId, type Difficulty, type GameId } from "./games/config";
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
