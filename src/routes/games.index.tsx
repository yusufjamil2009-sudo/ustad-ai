import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GamesError } from "@/components/games/GamesError";
import { GameLanguageSelector } from "@/components/games/GameLanguageSelector";
import { Button } from "@/components/ui/button";
import { GAMES } from "@/lib/games/config";
import { useDailyStatus } from "@/lib/games/daily-client";
import { GAME_COPY, gameDescription, gameName, toGameLanguage, toSettingsLanguage } from "@/lib/games/language";
import { useSettings } from "@/lib/settings-store";

export const Route = createFileRoute("/games/")({
  head: () => ({
    meta: [
      { title: "Games — Riddles, Puzzles & Brain Teasers | USTAD AI" },
      {
        name: "description",
        content:
          "Play nine thinking games inside USTAD AI: riddles, brain teasers, puzzles, IQ, pattern, sequence, lateral thinking, odd-one-out and guessing.",
      },
      { property: "og:title", content: "Games — Challenge Your Mind | USTAD AI" },
      {
        property: "og:description",
        content: "Nine mind games with 30 questions each, solo or with up to four players.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <AppShell>
      <GamesError />
    </AppShell>
  ),
  component: GamesLibraryPage,
});

/**
 * Games Library. Rendering this screen generates ZERO questions — the list is
 * pure configuration.
 */
function GamesLibraryPage() {
  // The backend is the only authority for today's availability.
  const daily = useDailyStatus();
  const { settings, saving, update } = useSettings();
  const language = toGameLanguage(settings?.language);
  const copy = GAME_COPY[language];

  return (
    <AppShell>
      <PageHeader title={copy.library} subtitle={copy.subtitle} />
      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-8">
        <div className="mx-auto mb-4 max-w-sm">
          <GameLanguageSelector
            language={language}
            disabled={saving}
            onChange={(next) => void update({ language: toSettingsLanguage(next) })}
          />
        </div>
        {daily.error ? (
          <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">{copy.verifyError}</p>
            <Button className="mt-4 min-h-11 w-full" onClick={daily.refresh}>
              {copy.tryAgain}
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {GAMES.map((game) => {
              const state = daily.states?.[game.id] ?? null;
              const locked = state === "locked";
              const checking = daily.loading || state === null;
              return (
                <li key={game.id}>
                  <article
                    className={`flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors ${
                      locked ? "border-border opacity-75" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl"
                        aria-hidden="true"
                      >
                        {game.icon}
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold">{gameName(game.id, language)}</h2>
                        <p className="mt-0.5 text-sm text-muted-foreground">{gameDescription(game.id, language)}</p>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                      {checking ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          {copy.checking}
                        </span>
                      ) : locked ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          <Lock className="size-3" aria-hidden="true" />
                           {copy.locked}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                           {copy.available}
                        </span>
                      )}
                      {locked ? (
                        <Button size="sm" disabled>
                          {copy.play}
                        </Button>
                      ) : (
                        <Button asChild size="sm" disabled={checking}>
                          <Link to="/games/$gameId" params={{ gameId: game.id }}>
                            {copy.play}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {copy.dailyNote}
        </p>
      </div>
    </AppShell>
  );
}
