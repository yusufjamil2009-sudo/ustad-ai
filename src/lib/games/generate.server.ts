/**
 * USTAD AI — Games Library question generation (server authority).
 *
 * Uses the EXISTING USTAD AI Router / API Manager / USTAD Core fallback chain,
 * exactly like `crorepati-ai.server.ts`. Only the SELECTED game is ever
 * generated: the caller names one gameId per request.
 */
import { coreCandidates, usableProviders } from "../api-manager.server";
import { parseJsonLoose, salvageJsonObjects } from "../exam-ai.server";
import { route, runChat, selectChatProviders } from "../router.server";
import type { ChatMessage } from "../provider-clients.server";
import { getGame, type Difficulty, type GameId } from "./config";
import { biasRepairPromptParts, gamePromptParts } from "./prompts.server";
import { OPTION_KEYS, type OptionKey } from "./types";
import { hasExpectedLanguage, type GameLanguage } from "./language";
import { analyzeOptionBias, biasIssueHints, type BiasIssue } from "./option-bias";

/** A question that is otherwise valid but whose options give the answer away. */
type BiasedRow = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  issues: BiasIssue[];
};


export type GeneratedGameQuestion = {
  question: string;
  options: Record<OptionKey, string>;
  correctAnswer: OptionKey;
  explanation: string;
  difficulty: Difficulty;
};

type RawQ = {
  question?: string;
  options?: string[];
  correctIndex?: number;
  answer?: string;
  explanation?: string;
};

/**
 * Normalised fingerprint used to block duplicates and near-duplicates.
 *
 * Script-aware: Devanagari letters are kept, so Hindi questions produce a real
 * fingerprint instead of an empty string (which used to reject every Hindi
 * question in the duplicate check).
 */
export function fingerprint(question: string): string {
  const STOP = /^(the|a|an|is|are|of|in|on|to|and|what|which|who|that|है|हैं|का|के|की|में|और|कौन|क्या|यह|से)$/;
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word && !STOP.test(word))
    .join(" ")
    .trim()
    .slice(0, 140);
}

function tooSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const wa = new Set(a.split(" ").filter((w) => w.length > 3));
  const wb = new Set(b.split(" ").filter((w) => w.length > 3));
  if (wa.size < 4 || wb.size < 4) return false;
  let shared = 0;
  wa.forEach((w) => {
    if (wb.has(w)) shared += 1;
  });
  return shared / Math.min(wa.size, wb.size) >= 0.85;
}

/** Places the correct option at `target` while keeping all four options. */
function placeAt(values: string[], correctIndex: number, target: OptionKey) {
  const order = [...values];
  const targetIndex = OPTION_KEYS.indexOf(target);
  [order[targetIndex], order[correctIndex]] = [order[correctIndex]!, order[targetIndex]!];
  const options = {} as Record<OptionKey, string>;
  OPTION_KEYS.forEach((key, i) => {
    options[key] = order[i]!;
  });
  return options;
}

function clean(
  rows: RawQ[],
  difficulty: Difficulty,
  targets: OptionKey[],
  seenFingerprints: string[],
  language: GameLanguage,
  /** Rows rejected ONLY because their options give the answer away. */
  biasedOut?: BiasedRow[],
): GeneratedGameQuestion[] {
  const out: GeneratedGameQuestion[] = [];
  const seen = [...seenFingerprints];

  for (const row of rows ?? []) {
    if (out.length >= targets.length) break;
    const question = String(row.question ?? "").trim();
    if (question.length < 10) continue;

    const values = (row.options ?? []).map((o) => String(o ?? "").trim()).filter(Boolean);
    if (values.length !== 4) continue;
    if (new Set(values.map((v) => v.toLowerCase())).size !== 4) continue;

    let correctIndex = -1;
    if (typeof row.correctIndex === "number" && row.correctIndex >= 0 && row.correctIndex <= 3) {
      correctIndex = Math.floor(row.correctIndex);
    } else {
      const answer = String(row.answer ?? "").trim();
      const letter = answer.match(/^\(?([A-D])\)?[.):]?$/i);
      if (letter) correctIndex = letter[1]!.toUpperCase().charCodeAt(0) - 65;
      else correctIndex = values.findIndex((v) => v.toLowerCase() === answer.toLowerCase());
    }
    if (correctIndex < 0 || correctIndex > 3) continue;

    const explanation = String(row.explanation ?? "").trim();
    if (!explanation) continue;
    if (!hasExpectedLanguage(question, language) || !hasExpectedLanguage(explanation, language)) continue;
    // Options are often names, numbers or fixed terms — only reject an option
    // that is long enough to really be a sentence in the wrong language.
    if (values.some((value) => value.length >= 14 && !hasExpectedLanguage(value, language))) continue;

    const fp = fingerprint(question);
    if (!fp || seen.some((s) => tooSimilar(s, fp))) continue;
    seen.push(fp);

    // ANSWER-BIAS GATE: the correct option must not be identifiable from how it
    // looks. A failing question is never shown — it goes to the repair pass.
    const bias = analyzeOptionBias(values, correctIndex, question);
    if (!bias.ok) {
      biasedOut?.push({ question, options: values, correctIndex, explanation, issues: bias.issues });
      continue;
    }

    // The correct answer position comes from the session-wide balanced plan,
    // never from the model — so it cannot drift towards A/B.
    const target = targets[out.length]!;
    out.push({
      question,
      options: placeAt(values, correctIndex, target),
      correctAnswer: target,
      explanation: explanation.slice(0, 400),
      difficulty,
    });
  }

  return out;
}


/**
 * Generate up to `targets.length` questions for ONE game at ONE difficulty.
 * Returns only questions that pass validation — the caller retries whatever is
 * still missing, question by question.
 */
export async function generateGameQuestions(input: {
  guestId: string;
  gameId: GameId;
  difficulty: Difficulty;
  language: GameLanguage;
  /** One correct-answer slot per requested question. */
  targets: OptionKey[];
  avoid: string[];
  seed: number;
}): Promise<GeneratedGameQuestion[]> {
  const game = getGame(input.gameId);
  if (!game) throw new Error("unknown-game");
  const count = Math.max(1, Math.min(5, input.targets.length));

  const collected: GeneratedGameQuestion[] = [];
  const seen = input.avoid.map(fingerprint).filter(Boolean);

  for (let round = 0; round < 3 && collected.length < count; round += 1) {
    const need = count - collected.length;
    const { system, user } = gamePromptParts({
      gameId: game.id,
      gameName: game.name,
      difficulty: input.difficulty,
      language: input.language,
      count: need,
      avoid: [...input.avoid, ...collected.map((q) => q.question)],
      seed: input.seed + round * 977,
    });

    const available = await usableProviders(input.guestId);
    const decision = route({
      text: `${user} game question generation`,
      hasImages: false,
      preferredLanguage: "english",
      dataSaver: false,
    });
    const candidates = [...selectChatProviders(available, decision), ...coreCandidates()];
    if (!candidates.length) {
      throw new Error(
        "No AI provider is configured. Add a provider in Settings → API Manager to play.",
      );
    }

    const messages: ChatMessage[] = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    const res = await runChat({ candidates, messages, maxTokens: 3000 });

    let rows: RawQ[] = [];
    try {
      const parsed = parseJsonLoose<{ questions?: RawQ[] } | RawQ[]>(res.text);
      rows = Array.isArray(parsed) ? parsed : (parsed.questions ?? []);
    } catch {
      rows = salvageJsonObjects(res.text) as RawQ[];
    }
    if (!rows.length) continue;

    const slots = input.targets.slice(collected.length, collected.length + need);
    const fresh = clean(rows, input.difficulty, slots, [
      ...seen,
      ...collected.map((q) => fingerprint(q.question)),
    ], input.language);
    collected.push(...fresh);
  }

  return collected.slice(0, count);
}
