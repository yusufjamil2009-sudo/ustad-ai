import type { Language } from "@/lib/settings-store";
import type { Difficulty, GameId, PlayerColor } from "./config";

export type GameLanguage = "en" | "hi";

export function toGameLanguage(language: Language | null | undefined): GameLanguage {
  return language === "hindi" ? "hi" : "en";
}

export function toSettingsLanguage(language: GameLanguage): Language {
  return language === "hi" ? "hindi" : "english";
}

const GAME_NAMES: Record<GameLanguage, Record<GameId, string>> = {
  en: {
    riddle: "Riddle",
    "brain-teaser": "Brain Teaser",
    puzzle: "Puzzle",
    "iq-question": "IQ Question",
    "pattern-question": "Pattern Question",
    "sequence-question": "Sequence Question",
    "lateral-thinking": "Lateral Thinking",
    "odd-one-out": "Odd-One-Out",
    "guessing-question": "Guessing Question",
  },
  hi: {
    riddle: "पहेली",
    "brain-teaser": "दिमागी सवाल",
    puzzle: "तर्क पहेली",
    "iq-question": "IQ सवाल",
    "pattern-question": "पैटर्न सवाल",
    "sequence-question": "क्रम सवाल",
    "lateral-thinking": "अलग तरीके से सोचो",
    "odd-one-out": "अलग कौन है?",
    "guessing-question": "अनुमान लगाओ",
  },
};

const GAME_DESCRIPTIONS: Record<GameLanguage, Record<GameId, string>> = {
  en: {
    riddle: "Crack the clues and find the hidden answer.",
    "brain-teaser": "Think beyond the obvious.",
    puzzle: "Use clues, logic and rules to solve the challenge.",
    "iq-question": "Test your logical reasoning.",
    "pattern-question": "Find the rule hidden inside the pattern.",
    "sequence-question": "Discover what comes next.",
    "lateral-thinking": "Look at the problem from a different angle.",
    "odd-one-out": "Find what doesn't belong.",
    "guessing-question": "Identify the answer from the clues.",
  },
  hi: {
    riddle: "संकेत समझें और छिपा उत्तर खोजें।",
    "brain-teaser": "सीधे दिखने वाले उत्तर से आगे सोचें।",
    puzzle: "संकेतों, तर्क और नियमों से चुनौती हल करें।",
    "iq-question": "अपनी तार्किक क्षमता परखें।",
    "pattern-question": "पैटर्न में छिपा नियम खोजें।",
    "sequence-question": "पता लगाएँ कि आगे क्या आएगा।",
    "lateral-thinking": "समस्या को एक नए नज़रिए से देखें।",
    "odd-one-out": "समूह से अलग चीज़ पहचानें।",
    "guessing-question": "संकेतों से सही उत्तर पहचानें।",
  },
};

const DIFFICULTY_NAMES: Record<GameLanguage, Record<Difficulty, string>> = {
  en: { easy: "Easy", medium: "Medium", hard: "Hard", god: "God Level" },
  hi: { easy: "आसान", medium: "मध्यम", hard: "कठिन", god: "गॉड लेवल" },
};

const DIFFICULTY_HINTS: Record<GameLanguage, Record<Difficulty, string>> = {
  en: {
    easy: "Simple, direct thinking.",
    medium: "Two steps and a few clues.",
    hard: "Multi-step deduction with traps.",
    god: "Layered clues and deep reasoning.",
  },
  hi: {
    easy: "सरल और सीधी सोच।",
    medium: "दो चरण और कुछ संकेत।",
    hard: "कई चरणों वाला कठिन तर्क।",
    god: "गहरे तर्क और कई परतों वाले संकेत।",
  },
};

const PLAYER_NAMES: Record<GameLanguage, Record<PlayerColor | "you", string>> = {
  en: { red: "Red Player", yellow: "Yellow Player", black: "Black Player", green: "Green Player", you: "You" },
  hi: { red: "लाल खिलाड़ी", yellow: "पीला खिलाड़ी", black: "काला खिलाड़ी", green: "हरा खिलाड़ी", you: "आप" },
};

export const GAME_COPY = {
  en: {
    library: "Games Library", subtitle: "Challenge your mind. Play. Think. Solve.", language: "Language",
    checking: "Checking…", locked: "Today's Match Completed", available: "Available today", play: "Play",
    dailyNote: "Each game gives you 30 questions, once a day.", tryAgain: "Try Again", games: "Games",
    backToGames: "Back to Games", opensTomorrow: "This game opens again tomorrow. Your other games are still ready to play.",
    ready: "Ready to challenge your brain?", questions: "Questions", chooseDifficulty: "Choose Difficulty",
    choosePlayers: "Choose Players", player: "Player", minutes: "2 minutes for each question.",
    noTimer: "No timer — take all the time you need.", start: "START GAME", starting: "STARTING…",
    exit: "Exit", question: "Question", preparing: "Preparing your challenge…", questionsReady: "Questions ready",
    turn: "'s turn", correct: "Correct", wrong: "Wrong", timeUp: "Time Up", correctAnswer: "Correct answer",
    explanation: "Explanation", finish: "Finish", nextQuestion: "Next question", submitAnswer: "Submit answer",
    gameComplete: "Game Complete", score: "Score", accuracy: "Accuracy", finalResults: "Final Results",
    winner: "Winner", tie: "Tie", hideReview: "Hide Review", reviewAll: "Review All Questions",
    yourAnswer: "Your Answer", result: "Result", somethingWrong: "Something went wrong.",
    verifyError: "Unable to verify today's game status. Please try again.",
  },
  hi: {
    library: "गेम लाइब्रेरी", subtitle: "अपने दिमाग को चुनौती दें। खेलें। सोचें। हल करें।", language: "भाषा",
    checking: "जाँच हो रही है…", locked: "आज का मैच पूरा हुआ", available: "आज उपलब्ध", play: "खेलें",
    dailyNote: "हर गेम में रोज़ एक बार 30 सवाल मिलते हैं।", tryAgain: "फिर कोशिश करें", games: "गेम",
    backToGames: "गेम पर वापस जाएँ", opensTomorrow: "यह गेम कल फिर खुलेगा। आपके बाकी गेम अभी खेलने के लिए तैयार हैं।",
    ready: "अपने दिमाग को चुनौती देने के लिए तैयार हैं?", questions: "सवाल", chooseDifficulty: "कठिनाई चुनें",
    choosePlayers: "खिलाड़ी चुनें", player: "खिलाड़ी", minutes: "हर सवाल के लिए 2 मिनट।",
    noTimer: "कोई समय सीमा नहीं — आराम से सोचें।", start: "गेम शुरू करें", starting: "शुरू हो रहा है…",
    exit: "बाहर जाएँ", question: "सवाल", preparing: "आपकी चुनौती तैयार हो रही है…", questionsReady: "तैयार सवाल",
    turn: " की बारी", correct: "सही", wrong: "गलत", timeUp: "समय समाप्त", correctAnswer: "सही उत्तर",
    explanation: "व्याख्या", finish: "पूरा करें", nextQuestion: "अगला सवाल", submitAnswer: "उत्तर जमा करें",
    gameComplete: "गेम पूरा हुआ", score: "स्कोर", accuracy: "सटीकता", finalResults: "अंतिम परिणाम",
    winner: "विजेता", tie: "बराबरी", hideReview: "समीक्षा छिपाएँ", reviewAll: "सभी सवालों की समीक्षा",
    yourAnswer: "आपका उत्तर", result: "परिणाम", somethingWrong: "कुछ गलत हो गया।",
    verifyError: "आज के गेम की स्थिति जाँची नहीं जा सकी। फिर कोशिश करें।",
  },
} satisfies Record<GameLanguage, Record<string, string>>;

export function gameName(id: GameId, language: GameLanguage): string { return GAME_NAMES[language][id]; }
export function gameDescription(id: GameId, language: GameLanguage): string { return GAME_DESCRIPTIONS[language][id]; }
export function difficultyName(id: Difficulty, language: GameLanguage): string { return DIFFICULTY_NAMES[language][id]; }
export function difficultyHint(id: Difficulty, language: GameLanguage): string { return DIFFICULTY_HINTS[language][id]; }
export function playerName(color: PlayerColor, language: GameLanguage, solo = false): string {
  return PLAYER_NAMES[language][solo ? "you" : color];
}

export function hasExpectedLanguage(text: string, language: GameLanguage): boolean {
  const letters = text.match(/[A-Za-z\u0900-\u097F]/g) ?? [];
  if (letters.length < 2) return true;
  const devanagari = letters.filter((letter) => /[\u0900-\u097F]/.test(letter)).length;
  return language === "hi" ? devanagari / letters.length >= 0.35 : devanagari === 0;
}