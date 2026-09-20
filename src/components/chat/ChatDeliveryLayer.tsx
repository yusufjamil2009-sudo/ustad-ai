import { useEffect, useLayoutEffect } from "react";

export type ChatDeliveryPhase =
  | "idle"
  | "thinking-enter"
  | "thinking-active"
  | "thinking-exit"
  | "delivery-enter"
  | "card-present"
  | "card-kick"
  | "card-flight"
  | "delivery-exit";

function FuturisticCharacter({ role }: { role: "thinker" | "courier" }) {
  const courier = role === "courier";
  return (
    <svg
      className="nx-chat-person"
      viewBox="0 0 160 360"
      role="img"
      aria-label={courier ? "Futuristic response courier" : "Futuristic AI specialist thinking"}
    >
      <defs>
        <linearGradient id={`${role}-suit`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--nx-figure-suit-hi)" />
          <stop offset="0.48" stopColor="var(--nx-figure-suit)" />
          <stop offset="1" stopColor="var(--nx-figure-suit-low)" />
        </linearGradient>
        <linearGradient id={`${role}-skin`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="var(--nx-figure-skin-hi)" />
          <stop offset="1" stopColor="var(--nx-figure-skin)" />
        </linearGradient>
        <linearGradient id={`${role}-visor`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--nx-figure-cyan)" stopOpacity="0.35" />
          <stop offset="0.55" stopColor="var(--nx-figure-cyan)" />
          <stop offset="1" stopColor="var(--nx-figure-blue)" />
        </linearGradient>
        <filter id={`${role}-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <ellipse className="nx-figure-ground" cx="80" cy="348" rx="48" ry="8" />
      <g className="nx-figure-back-leg">
        <path d="M75 219 C70 252 68 282 66 316 L48 337 L35 334 L48 310 L50 222 Z" fill={`url(#${role}-suit)`} />
        <path d="M47 327 L68 326 L72 342 C59 349 41 349 30 342 Z" fill="var(--nx-figure-boot)" />
        <path d="M47 309 L68 308" className="nx-figure-seam" />
      </g>
      <g className="nx-figure-front-leg">
        <path d="M82 218 C94 253 100 282 103 316 L119 337 L132 333 L118 309 L108 217 Z" fill={`url(#${role}-suit)`} />
        <path d="M105 326 L126 325 L137 341 C124 348 106 348 96 342 Z" fill="var(--nx-figure-boot)" />
        <path d="M101 307 L121 304" className="nx-figure-seam" />
      </g>

      <path d="M48 102 Q80 84 112 103 L122 220 Q81 242 39 220 Z" fill={`url(#${role}-suit)`} />
      <path d="M79 98 L79 222" className="nx-figure-seam" />
      <path d="M52 105 Q80 128 108 105" className="nx-figure-panel" />
      <path d="M58 124 L72 137 L58 169" className="nx-figure-cyan-line" />
      <path d="M102 124 L88 137 L102 169" className="nx-figure-cyan-line" />
      <circle cx="80" cy="143" r="7" className="nx-figure-core" filter={`url(#${role}-glow)`} />
      <path d="M43 188 Q80 203 117 188 L120 217 Q80 237 40 216 Z" className="nx-figure-waist" />

      <g className="nx-figure-back-arm">
        <path d="M49 108 C27 123 24 167 35 196" fill="none" stroke={`url(#${role}-suit)`} strokeWidth="20" strokeLinecap="round" />
        <path d="M35 193 L42 213" stroke={`url(#${role}-skin)`} strokeWidth="12" strokeLinecap="round" />
      </g>
      <g className="nx-figure-front-arm">
        <path d="M111 108 C135 125 138 166 124 193" fill="none" stroke={`url(#${role}-suit)`} strokeWidth="20" strokeLinecap="round" />
        <path d="M124 190 L116 211" stroke={`url(#${role}-skin)`} strokeWidth="12" strokeLinecap="round" />
      </g>

      <path d="M70 91 L70 105 Q80 112 90 105 L90 91 Z" fill={`url(#${role}-skin)`} />
      <g className="nx-figure-head">
        <path d="M56 46 Q61 18 82 17 Q110 19 108 55 L103 83 Q94 99 79 99 Q61 95 56 76 Z" fill={`url(#${role}-skin)`} />
        <path d="M55 51 Q56 17 83 12 Q111 17 110 52 Q98 35 70 37 L62 58 Z" fill="var(--nx-figure-hair)" />
        <path d="M60 55 Q80 46 105 55 L102 69 Q82 76 60 68 Z" fill={`url(#${role}-visor)`} opacity="0.9" filter={`url(#${role}-glow)`} />
        <path d="M65 60 L99 60" className="nx-figure-visor-line" />
        <path d="M103 62 Q116 68 112 85" className="nx-figure-comms" />
        <circle cx="111" cy="87" r="3" className="nx-figure-core" />
      </g>

      <path d="M50 112 L39 136" className="nx-figure-armor-edge" />
      <path d="M110 112 L122 136" className="nx-figure-armor-edge" />
      <path d="M61 215 L52 231 M99 215 L108 231" className="nx-figure-cyan-line" />
    </svg>
  );
}

export function ChatDeliveryLayer({
  phase,
  onAdvance,
}: {
  phase: ChatDeliveryPhase;
  onAdvance: () => void;
}) {
  useEffect(() => {
    if (phase === "idle" || phase === "thinking-active") return;
    const durations: Partial<Record<ChatDeliveryPhase, number>> = {
      "thinking-enter": 880,
      "thinking-exit": 760,
      "delivery-enter": 1100,
      "card-present": 680,
      "card-kick": 560,
      "card-flight": 940,
      "delivery-exit": 780,
    };
    const id = window.setTimeout(onAdvance, (durations[phase] ?? 900) + 60);
    return () => window.clearTimeout(id);
  }, [onAdvance, phase]);

  useLayoutEffect(() => {
    if (phase !== "thinking-exit") return;

    const frame = window.requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>('[data-delivering="true"]');
      const stage = card?.closest<HTMLElement>("[data-chat-stage]");
      if (!card || !stage) return;

      const cardRect = card.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const mobile = window.matchMedia("(max-width: 30rem)").matches;
      const rootSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const actorWidth = mobile
        ? Math.min(Math.max(rootSize * 3.7, window.innerWidth * 0.16), rootSize * 4.6)
        : Math.min(Math.max(rootSize * 4.2, window.innerWidth * 0.09), rootSize * 6.5);
      const actorHeight = mobile
        ? Math.min(Math.max(rootSize * 8.2, window.innerHeight * 0.2), rootSize * 10.8)
        : Math.min(Math.max(rootSize * 9.6, window.innerHeight * 0.25), rootSize * 15.5);
      const actorInset = mobile
        ? rootSize * 0.35
        : Math.min(Math.max(rootSize * 0.4, window.innerWidth * 0.04), rootSize * 3);
      const actorLeft = stageRect.right - actorInset - actorWidth;
      const actorTop = stageRect.top + stageRect.height * 0.58 - actorHeight / 2;
      const carryLeft = actorLeft + actorWidth * 0.28;
      const carryTop = actorTop + actorHeight * 0.08;
      const frontLeft = actorLeft + actorWidth * 0.58;
      const frontTop = actorTop + actorHeight * 0.58;

      card.style.setProperty("--nx-carry-x", `${carryLeft - cardRect.left}px`);
      card.style.setProperty("--nx-carry-y", `${carryTop - cardRect.top}px`);
      card.style.setProperty("--nx-front-x", `${frontLeft - cardRect.left}px`);
      card.style.setProperty("--nx-front-y", `${frontTop - cardRect.top}px`);
      card.style.setProperty("--nx-entry-shift", `${actorWidth * 1.5}px`);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  if (phase === "idle") return null;
  const thinking = phase.startsWith("thinking");

  return (
    <div className="nx-chat-cinema" data-phase={phase} aria-hidden="true">
      <div
        className={thinking ? "nx-chat-thinking-actor" : "nx-chat-delivery-actor"}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) onAdvance();
        }}
      >
        <FuturisticCharacter role={thinking ? "thinker" : "courier"} />
        {!thinking ? <span className="nx-chat-contact-shadow" /> : null}
      </div>
    </div>
  );
}