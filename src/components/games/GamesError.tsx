import { Button } from "@/components/ui/button";

/**
 * Games Library error isolation. A failure inside the library never crashes
 * the rest of USTAD AI and never shows raw technical text to the user.
 */
export function GamesError({ reset, language = "en" }: { reset?: () => void; language?: "en" | "hi" }) {
  const hindi = language === "hi";
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-4xl" aria-hidden="true">
        🎮
      </span>
      <p className="text-base font-semibold">{hindi ? "कुछ गलत हो गया।" : "Something went wrong."}</p>
      <Button
        onClick={() => {
          if (reset) reset();
          else window.location.reload();
        }}
      >
        {hindi ? "फिर कोशिश करें" : "Try Again"}
      </Button>
    </div>
  );
}
