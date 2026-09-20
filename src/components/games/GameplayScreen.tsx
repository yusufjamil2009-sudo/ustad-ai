/**
 * USTAD AI — Games Library gameplay screen.
 *
 * One reusable screen for all 9 games and all 4 player modes. Mobile-first,
 * 2D only. Questions arrive from the runtime orchestrator; this screen never
 * generates anything itself.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GamesError } from "@/components/games/GamesError";
import { ResultScreen } from "@/components/games/ResultScreen";
import { DIFFICULTIES, getGame, PLAYER_SLOTS } from "@/lib/games/config";
import { recordAnswer } from "@/lib/games/engine";
import { clearGame, saveGame } from "@/lib/games/persist";
import { useGameRuntime } from "@/lib/games/runtime";
import { OPTION_KEYS, type AnswerResult, type GameSession, type OptionKey } from "@/lib/games/types";

function swatchFor(id: string): string {
  return PLAYER_SLOTS.find((p) => p.id === id)?.swatch ?? "#ef4444";
}

function mmss(total: number): string {
  const safe = Math.max(0, total);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function GameplayScreen({
  session: initial,
  resumeIndex = 0,
  resumeFinished = false,
  onExit,
}: {
  session: GameSession;
  resumeIndex?: number;
  resumeFinished?: boolean;
  onExit: () => void;
}) {
  const game = getGame(initial.gameId);
  const runtime = useGameRuntime(initial);
  const [session, setSession] = useState<GameSession>(initial);
  const [index, setIndex] = useState(resumeIndex);
  const [playerTurn, setPlayerTurn] = useState(() => {
    // After a refresh the turn resumes with the first player who has not
    // answered the current question — no duplicate answer is ever created.
    const q = initial.questions[resumeIndex];
    if (!q) return 0;
    const answered = initial.answers.filter((a) => a.questionId === q.questionId).length;
    return Math.min(answered, initial.players.length - 1);
  });
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(resumeFinished);
  const [seconds, setSeconds] = useState(initial.timerSeconds ?? 0);
  const lockRef = useRef(false);

  const slot = runtime.slots[index];
  const ready = slot?.status === "ready" && !!slot.question;
  const difficultyName =
    DIFFICULTIES.find((d) => d.id === session.difficulty)?.name ?? session.difficulty;

  /* ------------------------------------------------- per-question timer -- */
  useEffect(() => {
    // A FRESH 120-second timer for each question — single player only.
    if (!session.timerEnabled) return;
    setSeconds(session.timerSeconds ?? 120);
  }, [index, session.timerEnabled, session.timerSeconds]);

  useEffect(() => {
    if (!session.timerEnabled || !ready || revealed || finished) return;
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [session.timerEnabled, ready, revealed, finished, index]);

  const submit = (answer: OptionKey | null, result?: AnswerResult) => {
    if (!slot?.questionId || revealed || lockRef.current) return;
    lockRef.current = true;
    const player = session.players[playerTurn];
    if (!player) return;
    const outcome: AnswerResult =
      result ?? (answer && answer === slot.correctAnswer ? "correct" : "wrong");

    setSession((prev) =>
      recordAnswer(prev, {
        playerId: player.id,
        questionId: slot.questionId,
        selectedAnswer: answer,
        submittedAt: new Date().toISOString(),
        result: outcome,
      }),
    );

    const isLastPlayer = playerTurn >= session.players.length - 1;
    if (isLastPlayer) {
      setRevealed(true);
    } else {
      // Same question, same options — only the active player changes.
      setPlayerTurn((p) => p + 1);
      setSelected(null);
    }
    lockRef.current = false;
  };

  /* --------------------------------------------------------- time up ----- */
  useEffect(() => {
    if (!session.timerEnabled || !ready || revealed || finished) return;
    if (seconds > 0) return;
    submit(null, "time-up");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, session.timerEnabled, ready, revealed, finished]);

  const next = () => {
    setRevealed(false);
    setSelected(null);
    setPlayerTurn(0);
    if (index + 1 >= session.totalQuestions) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
  };

  const myAnswer = useMemo(() => {
    if (!slot?.questionId) return null;
    const player = session.players[0];
    return (
      session.answers.find(
        (a) => a.questionId === slot.questionId && a.playerId === player?.id,
      ) ?? null
    );
  }, [session.answers, session.players, slot?.questionId]);

  if (!game) return <GamesError reset={onExit} />;

  if (finished) {
    return (
      <div className="mx-auto w-full max-w-md px-1 py-6 text-center">
        <span className="text-4xl" aria-hidden="true">
          {game.icon}
        </span>
        <h1 className="mt-2 text-xl font-semibold">Challenge complete</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You finished all {session.totalQuestions} {game.name} questions.
        </p>
        <Button className="mt-5 min-h-12 w-full" onClick={onExit}>
          Back to Games
        </Button>
      </div>
    );
  }

  if (runtime.error && runtime.readyCount === 0) {
    return <GamesError reset={runtime.restart} />;
  }

  const currentPlayer = session.players[playerTurn];

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onExit}>
          <ArrowLeft className="size-4" /> Exit
        </Button>
        {session.timerEnabled ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
              seconds <= 15 ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"
            }`}
            aria-label="Time left for this question"
          >
            <Clock className="size-4" /> {mmss(seconds)}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {game.icon} {game.name}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5">{difficultyName}</span>
        <span>Question {index + 1} / {session.totalQuestions}</span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${((index + (revealed ? 1 : 0)) / session.totalQuestions) * 100}%` }}
        />
      </div>

      {!ready ? (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-base font-medium">Preparing your challenge…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions ready: {runtime.readyCount}/{session.totalQuestions}
          </p>
          {slot?.status === "failed" ? (
            <Button variant="outline" size="sm" className="mt-4" onClick={runtime.restart}>
              Try Again
            </Button>
          ) : null}
        </section>
      ) : (
        <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          {session.players.length > 1 ? (
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <span
                className="inline-block size-3 rounded-full"
                style={{ backgroundColor: swatchFor(currentPlayer?.id ?? "player1") }}
                aria-hidden="true"
              />
              {currentPlayer?.name}'s turn
            </div>
          ) : null}

          <h1 className="text-lg leading-snug font-semibold break-words">{slot.question}</h1>

          <div className="mt-4 grid gap-2">
            {OPTION_KEYS.map((key) => {
              const text = slot.options?.[key] ?? "";
              const isSelected = selected === key;
              const isCorrect = revealed && slot.correctAnswer === key;
              const isWrongPick = revealed && isSelected && slot.correctAnswer !== key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={revealed}
                  onClick={() => setSelected(key)}
                  className={`flex min-h-12 w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    isCorrect
                      ? "border-primary bg-primary/10 text-foreground"
                      : isWrongPick
                        ? "border-destructive bg-destructive/10 text-foreground"
                        : isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  <span className="mt-0.5 font-semibold">{key}.</span>
                  <span className="min-w-0 break-words">{text}</span>
                </button>
              );
            })}
          </div>

          {revealed ? (
            <div className="mt-4 rounded-xl border border-border bg-muted/50 p-3 text-sm">
              {session.players.length === 1 ? (
                <p className="font-semibold">
                  {myAnswer?.result === "correct"
                    ? "Correct!"
                    : myAnswer?.result === "time-up"
                      ? "Time up"
                      : "Wrong"}
                </p>
              ) : (
                <ul className="mb-2 space-y-1">
                  {session.players.map((player) => {
                    const answer = session.answers.find(
                      (a) => a.questionId === slot.questionId && a.playerId === player.id,
                    );
                    return (
                      <li key={player.id} className="flex items-center gap-2 text-xs">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: swatchFor(player.id) }}
                          aria-hidden="true"
                        />
                        {player.name}: {answer?.selectedAnswer ?? "—"}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-1">
                <span className="font-medium">Correct answer:</span> {slot.correctAnswer}.{" "}
                {slot.options?.[slot.correctAnswer as OptionKey]}
              </p>
              <p className="mt-1 text-muted-foreground">{slot.explanation}</p>
              <Button className="mt-3 min-h-11 w-full" onClick={next}>
                {index + 1 >= session.totalQuestions ? "Finish" : "Next question"}
              </Button>
            </div>
          ) : (
            <Button
              className="mt-4 min-h-12 w-full"
              disabled={!selected}
              onClick={() => submit(selected)}
            >
              Submit answer
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
