import { Button } from "@/components/ui/button";
import { GAME_COPY, type GameLanguage } from "@/lib/games/language";

export function GameLanguageSelector({
  language,
  onChange,
  disabled = false,
}: {
  language: GameLanguage;
  onChange: (language: GameLanguage) => void;
  disabled?: boolean;
}) {
  const copy = GAME_COPY[language];
  return (
    <div className="flex items-center justify-between gap-3" aria-label={copy.language}>
      <span className="text-sm font-medium text-muted-foreground">{copy.language}</span>
      <div className="grid grid-cols-2 rounded-lg border border-border bg-muted p-1" role="radiogroup">
        {([{"id":"en","label":"🇬🇧 English"},{"id":"hi","label":"🇮🇳 हिन्दी"}] as const).map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={language === option.id ? "default" : "ghost"}
            role="radio"
            aria-checked={language === option.id}
            disabled={disabled}
            className="min-h-9 px-3"
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}