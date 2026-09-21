import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GAME_COPY,
  difficultyName,
  gameName,
  hasExpectedLanguage,
  toGameLanguage,
} from "../src/lib/games/language";
import { createSession } from "../src/lib/games/engine";

test("Games maps only the global Hindi preference to Hindi", () => {
  assert.equal(toGameLanguage("hindi"), "hi");
  assert.equal(toGameLanguage("english"), "en");
  assert.equal(toGameLanguage("hinglish"), "en");
});

test("stable IDs receive localized labels without changing their values", () => {
  assert.equal(gameName("riddle", "en"), "Riddle");
  assert.equal(gameName("riddle", "hi"), "पहेली");
  assert.equal(difficultyName("hard", "hi"), "कठिन");
  assert.equal(GAME_COPY.hi.correctAnswer, "सही उत्तर");
});

test("a game session permanently stores its selected language", () => {
  const session = createSession({ gameId: "puzzle", playerCount: 2, difficulty: "god", language: "hi" });
  assert.equal(session.language, "hi");
  assert.equal(session.gameId, "puzzle");
  assert.equal(session.questions.length, 30);
  assert.equal(session.timerEnabled, false);
});

test("language validation rejects clearly wrong-script generated content", () => {
  assert.equal(hasExpectedLanguage("Which object follows this pattern?", "en"), true);
  assert.equal(hasExpectedLanguage("इस पैटर्न में आगे क्या आएगा?", "hi"), true);
  assert.equal(hasExpectedLanguage("Which object follows this pattern?", "hi"), false);
  assert.equal(hasExpectedLanguage("इस पैटर्न में आगे क्या आएगा?", "en"), false);
});