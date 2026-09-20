import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GamesError } from "@/components/games/GamesError";
import { Button } from "@/components/ui/button";
import { GAMES } from "@/lib/games/config";

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
  return (
    <AppShell>
      <PageHeader title="Games" subtitle="Challenge your mind. Play. Think. Solve." />
      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-8">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {GAMES.map((game) => (
            <li key={game.id}>
              <article className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50">
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl"
                    aria-hidden="true"
                  >
                    {game.icon}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{game.name}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">{game.description}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                    <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                    Available today
                  </span>
                  <Button asChild size="sm">
                    <Link to="/games/$gameId" params={{ gameId: game.id }}>
                      Play
                    </Link>
                  </Button>
                </div>
              </article>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Each game gives you 30 questions, once a day.
        </p>
      </div>
    </AppShell>
  );
}
