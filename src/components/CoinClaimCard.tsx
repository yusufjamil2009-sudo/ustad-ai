/**
 * USTAD COINS CLAIM — premium glass card for NEW USTAD AI Preferences.
 *
 * The password is never stored here or anywhere on the client: it is typed,
 * sent once over the existing server-function boundary, and discarded. The
 * reward amount and the balance shown come back from the server only.
 */
import { useState } from "react";
import { Coins, Loader2, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimCoinsFn } from "@/lib/ustad-api";
import { formatCoins } from "@/lib/wallet-spec";

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "success"; credited: number; balance: number; duplicate: boolean }
  | { kind: "error"; message: string };

export function CoinClaimCard() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const working = state.kind === "working";

  const submit = async () => {
    if (working) return;
    setState({ kind: "working" });
    // One request id per intentional claim: a retry of THIS request cannot
    // double-credit, while the next claim is a brand-new request.
    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `claim-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const res = (await claimCoinsFn({
        data: { token: "", password, requestId },
      })) as
        | { status: "success"; credited: number; balance: number; duplicate: boolean }
        | { status: "invalid_password" }
        | { status: "rate_limited" };

      if (res.status === "success") {
        setPassword("");
        setState({
          kind: "success",
          credited: res.credited,
          balance: res.balance,
          duplicate: res.duplicate,
        });
        return;
      }
      if (res.status === "rate_limited") {
        setState({ kind: "error", message: "Please try again later." });
        return;
      }
      setState({ kind: "error", message: "Invalid claim password." });
    } catch {
      setState({ kind: "error", message: "Claim failed. Please try again." });
    }
  };

  return (
    <div className="nx-pref-entry">
      <span className="nx-pref-icon" aria-hidden="true">
        <Coins className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-display text-sm font-semibold">USTAD COINS CLAIM</p>
        <p className="text-xs text-muted-foreground">
          Enter your secure claim password to receive USTAD Coins.
        </p>

        {!open ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full sm:w-auto"
            onClick={() => setOpen(true)}
          >
            <Lock className="mr-2 size-4" /> Open claim
          </Button>
        ) : (
          <form
            className="mt-2 space-y-3 rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm backdrop-blur"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="claim-password" className="text-xs">
                Enter your secure claim password
              </Label>
              <Input
                id="claim-password"
                type="password"
                autoComplete="off"
                inputMode="text"
                placeholder="Enter password"
                className="h-11 w-full text-base"
                style={{ fontSize: 16 }}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (state.kind !== "working") setState({ kind: "idle" });
                }}
                disabled={working}
              />
            </div>

            <Button type="submit" className="h-11 w-full" disabled={working || !password}>
              {working ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> VERIFYING CLAIM…
                </>
              ) : (
                <>CLAIM 900 CRORE COINS</>
              )}
            </Button>

            {state.kind === "success" ? (
              <div
                className="space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs"
                role="status"
                aria-live="polite"
              >
                <p className="flex items-center gap-1 font-semibold text-emerald-600">
                  <ShieldCheck className="size-4" /> CLAIM SUCCESSFUL
                </p>
                <p>
                  {state.duplicate
                    ? "This claim was already processed."
                    : "900 CRORE USTAD COINS ADDED"}
                </p>
                <p className="text-muted-foreground">
                  Balance: {formatCoins(state.balance)} USTAD Coins
                </p>
              </div>
            ) : null}

            {state.kind === "error" ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {state.message}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}
