/**
 * REAL question-preparation progress for the Crorepati hot seat.
 *
 * Every line on this screen comes from the server's actual batch states
 * (pending → generating → factChecking → completed/failed) written by the
 * preparation pipeline. There is no timed animation and no fake percentage.
 *
 * The copy follows the ONE existing USTAD AI language preference
 * (`useIdentityLanguage`) — nothing is hardcoded to a single language.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, XCircle, Clock } from "lucide-react";

import { crorepatiPrepProgressFn } from "@/lib/crorepati.functions";
import { useIdentityLanguage } from "@/lib/identity-language";

type PrepBatch = {
  slot: number;
  state: "pending" | "generating" | "factChecking" | "completed" | "failed";
  generated: number;
  verified: number;
};

type PrepProgressView = {
  runId: string;
  total: number;
  verified: number;
  phase: "preparing" | "ready" | "failed";
  batches: PrepBatch[];
};

type Copy = {
  title: (n: number) => string;
  batch: (n: number) => string;
  pending: string;
  generating: string;
  factChecking: string;
  completed: string;
  failed: string;
  verified: (a: number, b: number) => string;
  starting: string;
};

const COPY: Record<"english" | "hindi" | "hinglish", Copy> = {
  english: {
    title: (n) => `Preparing your ${n} questions`,
    batch: (n) => `Batch ${n}`,
    pending: "waiting",
    generating: "being written",
    factChecking: "being fact-checked",
    completed: "ready",
    failed: "failed — retrying",
    verified: (a, b) => `Verified questions: ${a} / ${b}`,
    starting: "Setting up the hot seat…",
  },
  hindi: {
    title: (n) => `आपके ${n} सवाल तैयार हो रहे हैं`,
    batch: (n) => `बैच ${n}`,
    pending: "इंतज़ार में",
    generating: "तैयार हो रहा है",
    factChecking: "जाँच हो रही है",
    completed: "तैयार",
    failed: "विफल — दोबारा कोशिश",
    verified: (a, b) => `जाँचे गए सवाल: ${a} / ${b}`,
    starting: "हॉट सीट तैयार हो रही है…",
  },
  hinglish: {
    title: (n) => `Aapke ${n} sawaal taiyaar ho rahe hain`,
    batch: (n) => `Batch ${n}`,
    pending: "wait mein",
    generating: "ban raha hai",
    factChecking: "fact-check ho raha hai",
    completed: "taiyaar",
    failed: "fail — dobara try",
    verified: (a, b) => `Verified sawaal: ${a} / ${b}`,
    starting: "Hot seat taiyaar ho rahi hai…",
  },
};

function StateIcon({ state }: { state: PrepProgressView["batches"][number]["state"] }) {
  if (state === "completed") return <CheckCircle2 className="size-4 text-emerald-500" />;
  if (state === "failed") return <XCircle className="size-4 text-destructive" />;
  if (state === "factChecking") return <ShieldCheck className="size-4 animate-pulse text-primary" />;
  if (state === "generating") return <Loader2 className="size-4 animate-spin text-primary" />;
  return <Clock className="size-4 text-muted-foreground" />;
}

export function PreparationProgress({ token, total }: { token: string; total: number }) {
  const language = useIdentityLanguage();
  const copy = COPY[language] ?? COPY.english;
  const [progress, setProgress] = useState<PrepProgressView | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = (await crorepatiPrepProgressFn({
          data: { token },
        })) as unknown as PrepProgressView | null;
        if (alive) setProgress(res);
      } catch {
        /* preparation itself is the authority; a missed poll changes nothing */
      }
    };
    void poll();
    const id = setInterval(poll, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token]);

  const batches = progress?.batches ?? [];
  const verified = Math.min(progress?.verified ?? 0, total);
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        <p className="text-sm font-semibold leading-snug">{copy.title(total)}</p>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{copy.verified(verified, total)}</p>

      <ul className="mt-3 space-y-1.5">
        {batches.length === 0 ? (
          <li className="text-xs text-muted-foreground">{copy.starting}</li>
        ) : (
          batches.map((b) => (
            <li key={b.slot} className="flex items-center gap-2 text-xs">
              <StateIcon state={b.state} />
              <span className="font-medium">{copy.batch(b.slot + 1)}</span>
              <span className="text-muted-foreground">
                {b.state === "completed"
                  ? `${b.verified}/${b.generated || b.verified} ${copy.completed}`
                  : copy[b.state]}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
