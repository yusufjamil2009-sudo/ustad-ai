/**
 * USTAD AI — Games Library question runtime (client orchestrator).
 *
 * Fires all 6 batches of the SELECTED game in parallel, validates every
 * question, blocks duplicates and retries ONLY the questions that failed.
 * Valid questions are never thrown away and no other game is ever requested.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { gamesGenerateFn } from "../ustad-api";
import { buildAnswerPositionPlan, validateQuestion } from "./engine";
import type { GameSession, OptionKey, QuestionSlot } from "./types";
import { hasExpectedLanguage } from "./language";

type Generated = {
  question: string;
  options: Record<OptionKey, string>;
  correctAnswer: OptionKey;
  explanation: string;
  difficulty: QuestionSlot["difficulty"];
  questionNumber: number;
};

const MAX_ATTEMPTS = 3;

function friendly(message: string, language: "en" | "hi"): string {
  if (/no ai provider/i.test(message)) return message;
  return language === "hi" ? "कुछ गलत हो गया।" : "Something went wrong.";
}

export type GameRuntime = {
  slots: QuestionSlot[];
  readyCount: number;
  failedCount: number;
  error: string | null;
  restart: () => void;
};

export function useGameRuntime(session: GameSession | null): GameRuntime {
  const [slots, setSlots] = useState<QuestionSlot[]>(session?.questions ?? []);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  const cancelled = useRef(false);

  const restart = useCallback(() => {
    setError(null);
    setRunId((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!session) return;
    cancelled.current = false;
    setSlots(session.questions);
    setError(null);

    // One balanced, shuffled A/B/C/D plan for the whole 30-question session —
    // independent of game, difficulty, batch, question number and player.
    const plan = buildAnswerPositionPlan(session.totalQuestions);
    const accepted: { question?: string }[] = [];
    let failures = 0;

    const apply = (rows: Generated[]) => {
      const kept: Generated[] = [];
      for (const row of rows) {
        const check = validateQuestion(
          { ...row, options: row.options, correctAnswer: row.correctAnswer },
          accepted,
        );
        if (!check.valid) continue;
        const language = session.language ?? "en";
        if (!hasExpectedLanguage(row.question, language) || !hasExpectedLanguage(row.explanation, language)) continue;
        if (Object.values(row.options).some((value) => !hasExpectedLanguage(value, language))) continue;
        accepted.push({ question: row.question });
        kept.push(row);
      }
      if (!kept.length) return [];
      setSlots((prev) =>
        prev.map((slot) => {
          const match = kept.find((k) => k.questionNumber === slot.questionNumber);
          if (!match || slot.status === "ready") return slot;
          return {
            ...slot,
            question: match.question,
            options: match.options,
            correctAnswer: match.correctAnswer,
            explanation: match.explanation,
            difficulty: match.difficulty,
            status: "ready",
          };
        }),
      );
      return kept.map((k) => k.questionNumber);
    };

    const mark = (numbers: number[], status: QuestionSlot["status"]) => {
      if (!numbers.length) return;
      setSlots((prev) =>
        prev.map((slot) =>
          numbers.includes(slot.questionNumber) && slot.status !== "ready"
            ? { ...slot, status, attempts: status === "failed" ? slot.attempts : slot.attempts }
            : slot,
        ),
      );
    };

    const request = async (batchId: number, numbers: number[]) => {
      const result = (await gamesGenerateFn({
        data: {
          token: "",
          gameId: session.gameId,
          difficulty: session.difficulty,
          language: session.language ?? "en",
          batchId,
          questionNumbers: numbers,
          targets: numbers.map((n) => plan[n - 1] ?? "A"),
          avoid: accepted.map((a) => a.question ?? "").filter(Boolean),
          seed: Math.floor(Math.random() * 100000) + batchId * 31,
        },
      })) as { questions: Generated[] };
      return result.questions ?? [];
    };

    const runBatch = async (batchId: number, questionNumbers: number[]) => {
      // A restored session already holds validated questions — never regenerate
      // (or duplicate) a question that is already ready.
      const alreadyReady = session.questions.filter((q) => q.status === "ready");
      for (const q of alreadyReady) if (q.question) accepted.push({ question: q.question });
      let missing = questionNumbers.filter(
        (n) => !alreadyReady.some((q) => q.questionNumber === n),
      );
      for (let attempt = 0; attempt < MAX_ATTEMPTS && missing.length && !cancelled.current; attempt += 1) {
        mark(missing, attempt === 0 ? "generating" : "retrying");
        try {
          // First pass asks for the whole batch; later passes retry ONLY the
          // individual questions that are still missing.
          const rows = attempt === 0 ? await request(batchId, missing) : [];
          let done = apply(rows);
          if (attempt > 0) {
            for (const number of missing) {
              if (cancelled.current) return;
              const single = await request(batchId, [number]).catch(() => []);
              done = [...done, ...apply(single)];
            }
          }
          missing = missing.filter((n) => !done.includes(n));
        } catch (e) {
          if (cancelled.current) return;
          if (attempt === MAX_ATTEMPTS - 1) {
            failures += 1;
            setError((prev) => prev ?? friendly((e as Error)?.message ?? "", session.language ?? "en"));
          }
        }
      }
      if (!cancelled.current && missing.length) mark(missing, "failed");
    };

    void Promise.allSettled(
      session.batches.map((batch) => runBatch(batch.batchId, batch.questionNumbers)),
    ).then(() => {
      if (!cancelled.current && failures === session.batches.length) {
        setError((prev) => prev ?? (session.language === "hi" ? "कुछ गलत हो गया।" : "Something went wrong."));
      }
    });

    return () => {
      // Leaving the game cancels every in-flight request.
      cancelled.current = true;
    };
  }, [session, runId]);

  const readyCount = slots.filter((s) => s.status === "ready").length;
  const failedCount = slots.filter((s) => s.status === "failed").length;
  return { slots, readyCount, failedCount, error, restart };
}
