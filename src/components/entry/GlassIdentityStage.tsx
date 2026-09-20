/**
 * Luxury glass presentation for the EXISTING Guest ID screen.
 *
 * It renders `children` (the untouched IdentityScreen) inside a glass card that
 * rises out of the suitcase after the cinematic entry. Without the one-shot
 * entry flag it returns the children exactly as before — zero behaviour change.
 */
import { useState, type ReactNode } from "react";
import { ENTRY_REVEAL_KEY } from "@/components/entry/entry-flags";

export function GlassIdentityStage({ children }: { children: ReactNode }) {
  // Resolve before the first client paint, avoiding a blank checking frame.
  const [mode] = useState<"plain" | "cinematic">(() => {
    try {
      if (window.sessionStorage.getItem(ENTRY_REVEAL_KEY) === "1") {
        // The flag is NOT consumed here. Identity status can flip
        // (initializing → unauthenticated) and remount this component; if the
        // flag were cleared on the first mount the second mount would show the
        // plain white card. IdentityScreen clears it once login succeeds.
        return "cinematic";
      }
    } catch {
      /* fall back to the plain screen */
    }
    return "plain";
  });

  if (mode === "plain") return <>{children}</>;

  return (
    <div className="ce-id-stage">
      <div className="ce-fog" aria-hidden="true" />
      <div className="ce-dust" aria-hidden="true" />
      <div className="ce-id-case" aria-hidden="true">
        <span className="ce-case-glow" style={{ opacity: 0.9 }} />
        <span className="ce-case-shell" />
      </div>
      <div className="ce-id-wrap">
        <div className="ce-id-card">
          <div className="ce-id-inner">{children}</div>
        </div>
      </div>
      <div className="ce-vignette" aria-hidden="true" />
    </div>
  );
}
