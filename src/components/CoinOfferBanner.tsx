/**
 * 🔥 GLOBAL COIN OFFER banner (read-only mirror).
 *
 * The client only READS a banner-safe view of the current weekly offer via
 * `coinOfferBannerFn`. All schedule/discount decisions are server-side; the
 * server-fn also fires the idempotent per-guest "live" notification the first
 * time a live offer is surfaced. Tapping the banner deep-links to the existing
 * /shop page (it never creates a duplicate page).
 */
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { coinOfferBannerFn } from "@/lib/coin-offer.functions";

type BannerState = {
  available: boolean;
  live?: boolean;
  upcoming?: boolean;
  weeklyOfferId?: string;
  discountPct?: number;
  startIso?: string;
  endIso?: string;
  cycle?: { start: string; end: string };
};

const IST_TZ = "Asia/Kolkata";

function istClock(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      timeZone: IST_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function istDay(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      timeZone: IST_TZ,
      weekday: "long",
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export function CoinOfferBanner({ token }: { token: string }) {
  const [state, setState] = useState<BannerState | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      try {
        const res = await coinOfferBannerFn({ data: { token } });
        if (alive) setState(res);
      } catch {
        if (alive) setState(null);
      } finally {
        if (alive) setChecked(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  if (!checked || !state?.available) return null;

  const pct = state.discountPct ?? 0;

  return (
    <div
      data-testid="coin-offer-banner"
      className={`mb-6 flex flex-col gap-1 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        state.live
          ? "border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-red-500/15"
          : "border-border/60 bg-card/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-red-600 text-white shadow"
          aria-hidden
        >
          <Flame className="size-5" />
        </span>
        <div>
          {state.live ? (
            <>
              <p className="text-sm font-bold text-amber-600">
                GLOBAL COIN OFFER LIVE — {pct}% OFF
              </p>
              <p className="text-xs text-muted-foreground">
                {pct}% OFF on every eligible USTAD Coin purchase. Hurry — offer ends today at{" "}
                {istClock(state.endIso)}.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold">Special Coin Offer — Coming Soon</p>
              <p className="text-xs text-muted-foreground">
                This week: up to {pct}% OFF on eligible USTAD Coin purchases on{" "}
                {istDay(state.startIso)} between {istClock(state.startIso)} and{" "}
                {istClock(state.endIso)}.
              </p>
            </>
          )}
        </div>
      </div>
      <span className="mt-2 shrink-0 self-start rounded-full bg-foreground/5 px-3 py-1 text-[11px] font-semibold text-muted-foreground sm:mt-0 sm:self-center">
        Save on coins across the whole app
      </span>
    </div>
  );
}
