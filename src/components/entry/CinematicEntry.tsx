/**
 * Cinematic OPEN USTAD AI entry overlay.
 *
 * PRESENTATION ONLY. It never touches identity, session, storage (other than a
 * one-shot "play the glass reveal" flag) or any business logic. When it ends —
 * or is skipped, or fails/times out — it simply hands over to the existing
 * route it was given.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { IdentityScreen } from "@/components/IdentityScreen";

export type EntryPhase = "draw" | "travel" | "reveal" | "case" | "open" | "card";

const TIMELINE: Array<{ phase: EntryPhase; at: number }> = [
  { phase: "travel", at: 1700 },
  { phase: "reveal", at: 7200 },
  { phase: "case", at: 9200 },
  { phase: "open", at: 10350 },
  // The card starts rising while the lid is still opening.
  { phase: "card", at: 10750 },
];

/** Safety only. The normal handover is driven by the card animation ending. */
const SAFETY_HANDOVER_AT = 14_500;

const CAPTIONS: Record<EntryPhase, string> = {
  draw: "Take aim",
  travel: "In flight",
  reveal: "Contact",
  case: "The case falls",
  open: "It opens",
  card: "Your identity forms",
};

const PILLARS = [
  { left: "14%", height: "38%", delay: "0s", drift: "-52vw" },
  { left: "27%", height: "26%", delay: "0.6s", drift: "-34vw" },
  { left: "63%", height: "32%", delay: "0.3s", drift: "38vw" },
  { left: "78%", height: "44%", delay: "0.9s", drift: "56vw" },
  { left: "45%", height: "22%", delay: "1.5s", drift: "-14vw" },
];

export function CinematicEntry({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<EntryPhase>("draw");
  const [closing, setClosing] = useState(false);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setClosing(true);
    window.setTimeout(onDone, 80);
  }, [onDone]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      finish();
      return;
    }

    const timers = TIMELINE.map(({ phase: p, at }) => window.setTimeout(() => setPhase(p), at));
    // Safety: whatever happens on screen, the user always reaches Guest ID.
    timers.push(window.setTimeout(finish, SAFETY_HANDOVER_AT));

    const skipOnKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") finish();
    };
    window.addEventListener("keydown", skipOnKey);

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("keydown", skipOnKey);
    };
  }, [finish]);

  const skip = () => {
    finish();
  };

  return (
    <div
      className="ce-overlay"
      data-phase={phase}
      data-closing={closing ? "true" : "false"}
      role="dialog"
      aria-label="Opening USTAD AI"
    >
      <div className="ce-fog" aria-hidden="true" />
      <div className="ce-grid" aria-hidden="true" />
      {PILLARS.map((p) => (
        <span
          key={p.left}
          className="ce-pillar"
          aria-hidden="true"
          style={{ left: p.left, height: p.height, animationDelay: p.delay, ["--ce-drift" as string]: p.drift }}
        />
      ))}
      <div className="ce-dust" aria-hidden="true" />
      <div className="ce-speed" aria-hidden="true" />

      <div className="ce-stage" aria-hidden="true">
        {phase === "draw" ? (
          <div className="ce-figure ce-archer">
            <div className="ce-body">
              <span className="ce-head" />
              <span className="ce-torso" />
              <span className="ce-leg a" />
              <span className="ce-leg b" />
              <span className="ce-arm back" />
              <span className="ce-arm front" />
              <span className="ce-bow" />
              <span className="ce-string" />
            </div>
          </div>
        ) : null}

        {phase === "travel" || phase === "reveal" ? <span className="ce-arrow" /> : null}

        {phase === "reveal" || phase === "case" || phase === "open" || phase === "card" ? (
          <div className="ce-figure ce-walker">
            <div className="ce-body">
              <span className="ce-head" />
              <span className="ce-torso" />
              <span className="ce-leg a" />
              <span className="ce-leg b" />
              <span className="ce-arm back" />
              <span className="ce-arm front" />
              {phase === "reveal" ? <span className="ce-walker-case" /> : null}
            </div>
          </div>
        ) : null}

        {phase === "case" || phase === "open" || phase === "card" ? (
          <div className="ce-case">
            <span className="ce-case-glow" />
            <span className="ce-case-shell" />
            <span className="ce-case-lid">
              <span className="ce-case-handle" />
            </span>
          </div>
        ) : null}

        {phase === "card" ? (
          <div
            className="ce-rise-card"
            onAnimationEnd={(event) => {
              if (event.animationName === "ce-rise-card") finish();
            }}
          >
            <span className="ce-rise-beam" />
            <div className="ce-rise-glass ce-id-card">
              <div className="ce-id-inner ce-rise-content">
                <IdentityScreen />
              </div>
            </div>
          </div>
        ) : null}

        {phase === "card" ? <span className="ce-case-front" aria-hidden="true" /> : null}
      </div>

      <div className="ce-vignette" aria-hidden="true" />
      <button type="button" className="ce-skip" onClick={skip}>
        Skip
      </button>
      <p className="ce-caption">{CAPTIONS[phase]}</p>
    </div>
  );
}
