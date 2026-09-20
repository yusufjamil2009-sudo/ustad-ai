/**
 * USTAD AI — Games Library final result + complete 30-question review.
 *
 * Every value shown comes from the real session answers passed in. No scores,
 * winners or answers are invented here.
 */
import { useMemo, useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DIFFICULTIES, getGame } from "@/lib/games/config";
import { buildResult, emojiFor, swatchFor } from "@/lib/games/score";
import { OPTION_KEYS, type GameSession, type OptionKey, type QuestionSlot } from "@/lib/games/types";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function ResultScreen({
  session,
  slots,
  onExit,
}: {
  session: GameSession;
  slots: QuestionSlot[];
  onExit: () => void;
}) {
  const game = getGame(session.gameId);
  const result = useMemo(() => buildResult(session, slots), [session, slots]);
  const [open, setOpen] = useState<number | null>(null);
  const [showReview, setShowReview] = useState(false);

  const solo = session.players.length === 1;
  const me = result.scores[0];
  const winners = result.scores.filter((s) => result.winnerPlayerIds.includes(s.playerId));
  const difficultyName =
    DIFFICULTIES.find((d) => d.id === session.difficulty)?.name ?? session.difficulty;

  return (
    <div className="mx-auto w-full max-w-md pb-8">
      <section className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
        <span className="text-4xl" aria-hidden="true">
          {game?.icon}
        </span>
        <h1 className="mt-2 text-xl font-semibold tracking-wide uppercase">Game Complete</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {game?.name} · {difficultyName}
        </p>

        {solo && me ? (
          <>
            <p className="mt-5 text-4xl font-bold tabular-nums">
              {me.score}
              <span className="text-xl text-muted-foreground"> / {session.totalQuestions}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{me.accuracy}% Accuracy</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Correct" value={me.correct} />
              <Stat label="Wrong" value={me.wrong} />
              <Stat label="Time Up" value={me.timeUp} />
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-5 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Final Results
            </h2>
            <ul className="mt-3 space-y-2 text-left">
              {result.scores.map((s) => (
                <li
                  key={s.playerId}
                  className="rounded-xl border border-border bg-background px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ backgroundColor: swatchFor(s.playerId) }}
                        aria-hidden="true"
                      />
                      {s.name}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {s.score} / {session.totalQuestions}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Correct: {s.correct} · Wrong: {s.wrong} · Time Up: {s.timeUp} · {s.accuracy}%
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-xl border border-primary bg-primary/10 p-3">
              <p className="flex items-center justify-center gap-2 text-sm font-semibold">
                <Trophy className="size-4" aria-hidden="true" />
                {winners.length > 1 ? "Tie" : "Winner"}
              </p>
              <p className="mt-1 text-sm">
                {winners
                  .map((w) => `${emojiFor(w.playerId)} ${w.name} — ${w.score}/${session.totalQuestions}`)
                  .join("  ·  ")}
              </p>
            </div>
          </>
        )}

        <Button
          variant="outline"
          className="mt-5 min-h-12 w-full"
          onClick={() => setShowReview((v) => !v)}
        >
          {showReview ? "Hide Review" : `Review All ${session.totalQuestions} Questions`}
        </Button>
        <Button className="mt-2 min-h-12 w-full" onClick={onExit}>
          Back to Games
        </Button>
      </section>

      {showReview ? (
        <section className="mt-4 space-y-2">
          {result.review.map((item) => {
            const isOpen = open === item.questionNumber;
            const mine = item.answers.find((a) => a.playerId === session.players[0]?.id);
            return (
              <article
                key={item.questionNumber}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : item.questionNumber)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Q{item.questionNumber}
                    </span>
                    <span className="mt-0.5 block truncate text-sm">{item.question}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {solo ? (
                      <span
                        className={`text-xs font-semibold ${
                          mine?.result === "correct" ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {mine?.result === "correct"
                          ? "✓"
                          : mine?.result === "time-up"
                            ? "Time Up"
                            : "✗"}
                      </span>
                    ) : null}
                    <ChevronDown
                      className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                {isOpen ? (
                  <div className="border-t border-border px-4 py-3 text-sm">
                    <p className="break-words">{item.question}</p>
                    <ul className="mt-3 space-y-1">
                      {OPTION_KEYS.map((key) => (
                        <li
                          key={key}
                          className={`rounded-lg px-2 py-1.5 text-sm ${
                            item.correctAnswer === key
                              ? "bg-primary/10 font-medium"
                              : "bg-muted/40"
                          }`}
                        >
                          <span className="font-semibold">{key}.</span>{" "}
                          {item.options[key as OptionKey]}
                        </li>
                      ))}
                    </ul>

                    <p className="mt-3">
                      <span className="font-medium">Correct Answer:</span> {item.correctAnswer}
                    </p>

                    {solo ? (
                      <p className="mt-1">
                        <span className="font-medium">Your Answer:</span>{" "}
                        {mine?.result === "time-up" ? "Time Up" : (mine?.selectedAnswer ?? "—")}{" "}
                        <span
                          className={
                            mine?.result === "correct" ? "text-primary" : "text-destructive"
                          }
                        >
                          {mine?.result === "correct"
                            ? "✓ Correct"
                            : mine?.result === "time-up"
                              ? "Time Up"
                              : "✗ Wrong"}
                        </span>
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {session.players.map((p) => {
                          const a = item.answers.find((x) => x.playerId === p.id);
                          return (
                            <li key={p.id} className="flex items-center gap-2 text-xs">
                              <span
                                className="inline-block size-2.5 rounded-full"
                                style={{ backgroundColor: swatchFor(p.id) }}
                                aria-hidden="true"
                              />
                              <span className="font-medium">{p.name}:</span>
                              <span>{a?.selectedAnswer ?? "—"}</span>
                              <span
                                className={
                                  a?.result === "correct" ? "text-primary" : "text-destructive"
                                }
                              >
                                {a?.result === "correct" ? "✓ Correct" : "✗ Wrong"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <p className="mt-3 text-muted-foreground">{item.explanation}</p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
