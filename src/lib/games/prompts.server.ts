/**
 * USTAD AI — Games Library question prompts.
 *
 * ONE reusable prompt builder, but every game supplies its OWN generation rules
 * and every difficulty changes the instructions for real. Examples inside these
 * rules only teach the SHAPE of a question — they are never a question bank.
 */
import type { GameId } from "./config";
import type { Difficulty } from "./config";
import type { GameLanguage } from "./language";

const GAME_RULES: Record<GameId, string> = {
  riddle: [
    "Write RIDDLES: indirect clues, description, wordplay or hidden meaning that point to one object, person, place, animal or concept.",
    "The solver must reason from the clues to the answer.",
    "Never reuse famous/classic riddles. Change the subject, the imagery, the clue structure and the point of view every single time.",
  ].join(" "),
  "brain-teaser": [
    "Write BRAIN TEASERS: short, tricky situations where the obvious answer is often wrong.",
    "Test careful reading, hidden assumptions, practical reasoning and observation.",
    "Vary the situation, objects, people, numbers and rules — do not produce 5 versions of one trick.",
  ].join(" "),
  puzzle: [
    "Write LOGIC PUZZLES with structured reasoning: clues, constraints, ordering, matching, relationships or conditional rules.",
    "Rotate the structure between questions (one ordering, one matching, one relationship, one conditional).",
    "Do not make every puzzle a number puzzle.",
  ].join(" "),
  "iq-question": [
    "Write IQ REASONING questions: classification, analogies, logical relationships, deduction, number or letter relationships, transformations and hidden rules.",
    "Rotate the reasoning style between questions. Never reduce this to simple square-number sequences.",
  ].join(" "),
  "pattern-question": [
    "Write PATTERN questions where the solver must discover a rule: numbers, letters, symbols, repeating or changing structures, alternating rules, or a missing element.",
    "Never use trivial patterns such as 2,4,6,8. Vary the pattern structure a lot.",
  ].join(" "),
  "sequence-question": [
    "Write SEQUENCE questions with an ordered series (numeric, alphabetical, symbolic, mixed, alternating or multi-rule).",
    "Ask what comes next, or which item is missing. Do not make every sequence a plain arithmetic progression.",
  ].join(" "),
  "lateral-thinking": [
    "Write LATERAL THINKING questions: an unusual situation where the normal assumption is wrong and a different perspective gives one clearly defensible answer.",
    "Change the scenario, the hidden assumption and the solution mechanism each time. Never reuse the classic textbook lateral puzzles.",
  ].join(" "),
  "odd-one-out": [
    "Write ODD-ONE-OUT questions: four items where exactly one differs by a hidden property (category, spelling, structure, numeric property, meaning, relationship or classification).",
    "Avoid trivial groupings. The explanation must state exactly why the chosen item is the odd one out.",
  ].join(" "),
  "guessing-question": [
    "Write GUESSING questions: several clues that together identify one object, animal, place, profession, concept, activity, technology or everyday thing.",
    "Vary the answer category, the clue order, the clue style and the number of clues. The clues must be enough to identify the answer without naming it.",
  ].join(" "),
};

const DIFFICULTY_RULES: Record<Difficulty, string> = {
  easy: "EASY: straightforward clues, simple one-step logic, familiar concepts, no traps. Solvable in a few seconds by a careful reader.",
  medium:
    "MEDIUM: two-step reasoning, several clues combined, patterns that are not obvious, a little misleading information.",
  hard: "HARD: multiple interacting clues, less obvious relationships, multi-step deduction, deliberate traps and more complex structures.",
  god: "GOD LEVEL: significantly deeper reasoning — layered clues, multiple interacting conditions, subtle patterns, misleading assumptions and unusual but strictly logical structures. Do NOT just use bigger numbers; make the REASONING deeper while keeping exactly one defensible answer.",
};

/**
 * Anti-bias rules. The correct answer must never be identifiable from how the
 * options LOOK — only from the logic of the question. Equal believability, not
 * identical word count.
 */
const OPTION_BALANCE = [
  "OPTION BALANCE (mandatory): all four options must feel written by the same writer — comparable length, detail, structure, punctuation and style.",
  "The correct option must NOT be the longest, the shortest, the only complete sentence, the only one with numbers or precise detail, the only one with reasoning words (because/therefore/क्योंकि/इसलिए), or the only one punctuated differently.",
  "Natural variation is fine (18/17/20/19 words is good); a giveaway gap (30/3/4/5) is forbidden.",
  "Never put the explanation inside an option. Reasoning goes ONLY in the explanation field.",
  "Never let the correct option copy unique key words from the question that no wrong option uses.",
  "Each wrong option must be a strong distractor: relevant, believable, grammatically correct, in the SAME answer space (words stay words, numbers stay numbers, categories stay categories) and based on a realistic reasoning mistake — ignoring a condition, reversing a relationship, a tempting incomplete pattern, a plausible alternative rule or a confused related concept. Never random nonsense.",
  "Do NOT fix balance by making all options tiny. Make them equally believable.",
].join(" ");

export type GamePromptInput = {

  gameId: GameId;
  gameName: string;
  difficulty: Difficulty;
  language: GameLanguage;
  count: number;
  /** Question texts already accepted in this session — never repeat them. */
  avoid: string[];
  seed: number;
};

export function gamePromptParts(input: GamePromptInput): { system: string; user: string } {
  const schema =
    '{"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,' +
    '"explanation":"the reasoning behind the answer"}]}';

  const system = [
    `You are the question master for the USTAD AI game "${input.gameName}".`,
    "Return STRICT JSON only — no prose, no markdown fence, no commentary.",
    `Schema: ${schema}`,
    input.language === "hi"
      ? "Write every question, every option, and every explanation directly in natural Devanagari Hindi. Do not draft in English and translate. Common fixed terms such as IQ may remain as used naturally in Hindi."
      : "Write every question, every option, and every explanation in natural English. Do not include Hindi sentences.",
  ].join(" ");

  const avoidList = input.avoid
    .slice(-60)
    .map((q) => `- ${q.slice(0, 120)}`)
    .join("\n");

  const user = [
    `Create ${input.count} fresh ${input.gameName} questions.`,
    input.language === "hi"
      ? "OUTPUT LANGUAGE: Hindi (Devanagari). All user-visible text values in the JSON must be Hindi."
      : "OUTPUT LANGUAGE: English. All user-visible text values in the JSON must be English.",
    GAME_RULES[input.gameId],
    DIFFICULTY_RULES[input.difficulty],
    "Every question must be multiple choice with EXACTLY 4 different options and EXACTLY ONE logically correct option.",
    'Include "correctIndex" as the 0-based index of the correct option.',
    'Include a short "explanation" (max 2 sentences) that explains the actual reasoning, not just which letter is right.',
    "Each question must be self-contained, understandable on a small phone screen and free of images.",
    "The three wrong options must be plausible but clearly wrong once the reasoning is done.",
    `Variation seed ${input.seed}: avoid your usual first picks, change the subject matter and wording completely.`,
    avoidList
      ? `Do NOT repeat, paraphrase or lightly reword any of these already-used questions:\n${avoidList}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}
