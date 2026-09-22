import { describe, expect, it } from "vitest";
import { analyzeOptionBias, biasIssueHints } from "../src/lib/games/option-bias";

describe("option bias detector", () => {
  it("rejects a correct answer that is much longer", () => {
    const r = analyzeOptionBias(
      [
        "22, because the pattern increases by four after every transformation and therefore stays consistent",
        "18",
        "20",
        "24",
      ],
      0,
    );
    expect(r.ok).toBe(false);
    expect(biasIssueHints(r.issues).length).toBeGreaterThan(0);
  });

  it("accepts four comparable options with natural variation", () => {
    const r = analyzeOptionBias(
      [
        "The younger brother reached the station first",
        "The older brother reached the station first",
        "Both brothers reached the station together",
        "Neither brother reached the station in time",
      ],
      0,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects an option that explains itself", () => {
    const r = analyzeOptionBias(
      ["Monday because the week restarts", "Tuesday morning", "Wednesday night", "Thursday noon"],
      0,
    );
    expect(r.issues).toContain("correct-explains-itself");
  });

  it("works for Hindi options", () => {
    const r = analyzeOptionBias(
      [
        "छोटा भाई पहले स्टेशन पहुँचा",
        "बड़ा भाई पहले स्टेशन पहुँचा",
        "दोनों भाई साथ स्टेशन पहुँचे",
        "कोई भाई समय पर नहीं पहुँचा",
      ],
      1,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects an out-of-space distractor", () => {
    const r = analyzeOptionBias(["12", "18", "24", "सोमवार"], 0);
    expect(r.issues).toContain("distractor-out-of-space");
  });
});
