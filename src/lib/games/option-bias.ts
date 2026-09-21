/**
 * USTAD AI — Games Library option-bias detector.
 *
 * Pure, shared by the server generator and the client runtime so BOTH use the
 * exact same quality gate. It never changes the number of options (always 4),
 * never touches scoring, timers, multiplayer, daily lock or language logic — it
 * only decides whether a question's four options are comparable enough that the
 * correct one cannot be guessed from its appearance.
 *
 * Core principle: EQUAL BELIEVABILITY, not identical word count. Natural length
 * variation is fine; a correct answer that stands out is not.
 */

export type BiasIssue =
  | "correct-too-long"
  | "correct-too-short"
  | "correct-only-sentence"
  | "correct-only-detailed"
  | "correct-only-specific"
  | "correct-explains-itself"
  | "correct-echoes-question"
  | "correct-formatting-differs"
  | "distractor-out-of-space";

const EXPLAIN_WORDS =
  /(because|therefore|since therefore|which means|so that means|hence|thus|as a result|क्योंकि|इसलिए|अतः|जिसका अर्थ|जिससे)/i;

const CLAUSE_MARK = /[,;:—–]|\b(and|but|which|that|while|after|before|when|if)\b|तथा|लेकिन|जबकि|अगर|जो/i;

const STOP =
  /^(the|a|an|is|are|was|were|of|in|on|at|to|and|or|for|with|it|its|this|that|these|those|what|which|who|whom|how|why|when|where|next|comes|following|option|options|question|है|हैं|था|थे|का|के|की|को|में|से|और|पर|यह|वह|क्या|कौन|कैसे|क्यों|कब|कहाँ|आगे|अगला)$/;

function words(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((w) => w.length > 4 && !STOP.test(w));
}

function sentences(text: string): number {
  return text.split(/[.!?।]+\s*/).filter((s) => s.trim().length > 0).length;
}

function isTerminated(text: string): boolean {
  return /[.!?।]\s*$/.test(text.trim());
}

function hasDigits(text: string): boolean {
  return /\d/.test(text);
}

function isBareValue(text: string): boolean {
  // "24", "B", "42 units", "सोमवार" — a short label rather than a statement.
  return words(text).length <= 3;
}

export type BiasReport = {
  ok: boolean;
  issues: BiasIssue[];
  /** Word counts, in A/B/C/D order — useful for debugging only. */
  lengths: number[];
};

/**
 * Analyse the four options of one question.
 *
 * `correctIndex` refers to `options` as given. The question text is used only
 * to detect extra-clue leakage.
 */
export function analyzeOptionBias(
  options: string[],
  correctIndex: number,
  question = "",
): BiasReport {
  const issues: BiasIssue[] = [];
  const lengths = options.map((o) => words(o).length);

  if (options.length !== 4 || correctIndex < 0 || correctIndex > 3) {
    return { ok: false, issues: ["distractor-out-of-space"], lengths };
  }

  const correct = options[correctIndex]!;
  const wrong = options.filter((_, i) => i !== correctIndex);
  const cw = words(correct).length;
  const cc = correct.length;
  const wrongWords = wrong.map((o) => words(o).length);
  const wrongChars = wrong.map((o) => o.length);
  const maxWrongWords = Math.max(...wrongWords);
  const minWrongWords = Math.min(...wrongWords);
  const maxWrongChars = Math.max(...wrongChars);
  const minWrongChars = Math.min(...wrongChars);

  /* ---- LENGTH ---------------------------------------------------------- */
  // Longest-option strategy must not work: the correct answer may be the
  // longest, but only by a natural margin, never by a giveaway margin.
  if ((cw - maxWrongWords >= 4 && cw >= maxWrongWords * 1.6) || cc >= maxWrongChars * 1.9 + 10) {
    issues.push("correct-too-long");
  }
  if ((minWrongWords - cw >= 4 && minWrongWords >= cw * 1.6) || minWrongChars >= cc * 1.9 + 10) {
    issues.push("correct-too-short");
  }

  /* ---- STRUCTURE ------------------------------------------------------- */
  // Only the correct option is a full sentence / multi-clause statement.
  const correctIsStatement = cw >= 6 && (isTerminated(correct) || CLAUSE_MARK.test(correct));
  const wrongStatements = wrong.filter(
    (o) => words(o).length >= 6 && (isTerminated(o) || CLAUSE_MARK.test(o)),
  ).length;
  if (correctIsStatement && wrongStatements === 0) issues.push("correct-only-sentence");

  // Only the correct option is a multi-sentence / clause-stacked explanation.
  const correctClauses = (correct.match(/[,;:—–]/g) ?? []).length + sentences(correct);
  const wrongClauses = wrong.map((o) => (o.match(/[,;:—–]/g) ?? []).length + sentences(o));
  if (correctClauses >= Math.max(...wrongClauses) + 2 && cw >= 10) {
    issues.push("correct-only-detailed");
  }

  /* ---- DETAIL / SPECIFICITY ------------------------------------------- */
  if (hasDigits(correct) && !wrong.some(hasDigits) && cw >= 5) {
    issues.push("correct-only-specific");
  }

  /* ---- EXPLANATION INSIDE THE OPTION --------------------------------- */
  if (EXPLAIN_WORDS.test(correct) && !wrong.some((o) => EXPLAIN_WORDS.test(o))) {
    issues.push("correct-explains-itself");
  }

  /* ---- EXTRA-CLUE LEAKAGE -------------------------------------------- */
  const qWords = new Set(contentWords(question));
  if (qWords.size) {
    const echo = (o: string) => contentWords(o).filter((w) => qWords.has(w)).length;
    const correctEcho = echo(correct);
    const wrongEcho = Math.max(...wrong.map(echo));
    if (correctEcho >= 2 && wrongEcho === 0) issues.push("correct-echoes-question");
  }

  /* ---- FORMATTING / STYLE -------------------------------------------- */
  const correctTerminated = isTerminated(correct);
  const wrongTerminated = wrong.filter(isTerminated).length;
  if (correctTerminated && wrongTerminated === 0 && cw >= 4) {
    if (!issues.includes("correct-only-sentence")) issues.push("correct-formatting-differs");
  }

  /* ---- SAME ANSWER SPACE (no absurd distractors) --------------------- */
  const numericLike = options.filter((o) => isBareValue(o) && hasDigits(o)).length;
  if (numericLike >= 2) {
    const alien = options.filter((o) => isBareValue(o) && !hasDigits(o)).length;
    if (alien >= 1 && numericLike + alien === 4) issues.push("distractor-out-of-space");
  }

  return { ok: issues.length === 0, issues, lengths };
}

/** Human-readable instruction list handed to the AI repair pass. */
export function biasIssueHints(issues: BiasIssue[]): string[] {
  const map: Record<BiasIssue, string> = {
    "correct-too-long":
      "The correct option is far longer than the wrong ones. Rewrite the three wrong options so they are naturally just as long and detailed.",
    "correct-too-short":
      "The correct option is far shorter than the wrong ones. Rewrite the wrong options so they are naturally just as compact.",
    "correct-only-sentence":
      "Only the correct option is a complete sentence. Make all four options the same kind of statement.",
    "correct-only-detailed":
      "Only the correct option carries stacked clauses or extra detail. Give the wrong options comparable structure.",
    "correct-only-specific":
      "Only the correct option contains numbers or precise detail. Give the wrong options comparable specificity.",
    "correct-explains-itself":
      "The correct option explains its own reasoning. Move the reasoning to the explanation field and keep all four options equally plain.",
    "correct-echoes-question":
      "The correct option copies key words from the question that no wrong option uses. Spread that wording across all four options or remove it.",
    "correct-formatting-differs":
      "The correct option is punctuated or formatted differently. Match punctuation and capitalisation across all four options.",
    "distractor-out-of-space":
      "One option does not belong to the same answer space. All four options must be the same type of answer.",
  };
  return issues.map((i) => map[i]);
}
