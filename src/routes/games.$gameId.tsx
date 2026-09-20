import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GamesError } from "@/components/games/GamesError";
import { Button } from "@/components/ui/button";
import { getGame, playersFor, timerFor, type PlayerCount } from "@/lib/games/config";
import { createSession } from "@/lib/games/engine";
import { setActiveSession } from "@/lib/games/store";

export const Route = createFileRoute("/games/$gameId")({
  head: () => ({
    meta: [
      { title: "Start a Game — Choose Players | USTAD AI" },
      {
        name: "description",
        content: "Pick your player mode and start a 30-question thinking challenge in USTAD AI Games.",
      },
      { property: "og:title", content: "Start a Game | USTAD AI" },
      { property: "og:description", content: "30 questions, solo or with up to four players." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <AppShell>
      <GamesError />
    </AppShell>
  ),
  component: PreGamePage,
});

const PLAYER_OPTIONS: { count: PlayerCount; label: string; emoji: string }[] = [
  { count: 1, label: "1 Player", emoji: "👤" },
  { count: 2, label: "2 Players", emoji: "👥" },
  { count: 3, label: "3 Players", emoji: "👥" },
  { count: 4, label: "4 Players", emoji: "👥" },
];

/** Pre-game screen. Rendering it generates ZERO questions. */
function PreGamePage() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const game = getGame(gameId);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(1);
  const [started, setStarted] = useState(false);

  if (!game) {
    return (
      <AppShell>
        <GamesError reset={() => void navigate({ to: "/games" })} />
      </AppShell>
    );
  }

  const timer = timerFor(playerCount);
  const roster = playersFor(playerCount);

  const startGame = () => {
    // Only the SELECTED game gets a session. No other game is touched.
    setActiveSession(createSession({ gameId: game.id, playerCount }));
    setStarted(true);
  };

  return (
    <AppShell>
      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-8">
        <div className="mx-auto w-full max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
            <Link to="/games">
              <ArrowLeft className="size-4" /> Games
            </Link>
          </Button>

          <section className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
            <span className="text-4xl" aria-hidden="true">
              {game.icon}
            </span>
            <h1 className="mt-2 text-xl font-semibold tracking-wide uppercase">{game.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ready to challenge your brain?</p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-sm font-medium">
              {game.totalQuestions} Questions
            </div>

            <h2 className="mt-6 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Choose Players
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Choose players">
              {PLAYER_OPTIONS.map((option) => {
                const active = option.count === playerCount;
                return (
                  <button
                    key={option.count}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={started}
                    onClick={() => setPlayerCount(option.count)}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <span aria-hidden="true">{option.emoji}</span>
                    {option.label}
                  </button>
                );
              })}
            </div>

            {playerCount > 1 ? (
              <ul className="mt-4 flex flex-wrap justify-center gap-2">
                {roster.map((player) => (
                  <li
                    key={player.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs"
                  >
                    <span aria-hidden="true">{player.emoji}</span>
                    {player.name}
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="mt-4 text-xs text-muted-foreground">
              {timer.timerEnabled
                ? "2 minutes for each question."
                : "No timer — take all the time you need."}
            </p>

            {started ? (
              <div className="mt-5 rounded-xl border border-border bg-muted/50 p-4 text-sm">
                <p className="font-medium">Getting your questions ready…</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your {game.name} game is set up for {playerCount === 1 ? "solo play" : `${playerCount} players`}.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setStarted(false)}>
                  Change setup
                </Button>
              </div>
            ) : (
              <Button className="mt-5 min-h-12 w-full text-base" onClick={startGame}>
                START GAME
              </Button>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
