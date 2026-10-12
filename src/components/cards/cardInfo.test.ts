import {
  enhancementDescription,
  formatChanceRatio,
  getCardInfo,
} from "./cardInfo";
import type { Card } from "../../cards/types";
import i18n from "../../i18n";

const t = i18n.getFixedT("en");
const luckyCard: Card = { id: 1, rank: "A", suit: "clubs", enhancement: "lucky" };

describe("formatChanceRatio", () => {
  test("formats 1-in-N when multiplier is 1 (identity)", () => {
    expect(formatChanceRatio(t, 0.2)).toBe("1 in 5");
  });

  test("doubles the numerator when the multiplier is 2", () => {
    expect(formatChanceRatio(t, 0.2, 2)).toBe("2 in 5");
  });

  test("renders 'guaranteed' once the effective chance reaches 1", () => {
    expect(formatChanceRatio(t, 0.5, 2)).toBe("guaranteed");
  });

  test("renders 'guaranteed' when the base chance is already 1", () => {
    expect(formatChanceRatio(t, 1)).toBe("guaranteed");
  });

  test("treats a zero multiplier as identity (defensive)", () => {
    expect(formatChanceRatio(t, 0.2, 0)).toBe("1 in 5");
  });
});

describe("getCardInfo — suit label", () => {
  test("defaults the suit label to English when no resolver is provided", () => {
    expect(getCardInfo({ id: 60, rank: "9", suit: "spades" }).suitLabel).toBe(
      "Spades",
    );
  });

  test("uses the provided suit-label resolver when given", () => {
    expect(
      getCardInfo(
        { id: 61, rank: "9", suit: "spades" },
        { suitLabel: (suit) => `localized:${suit}` },
      ).suitLabel,
    ).toBe("localized:spades");
  });
});

describe("getCardInfo — lucky enhancement description", () => {
  test("exposes a card's accumulated bonus chips", () => {
    expect(
      getCardInfo({ id: 51, rank: "9", suit: "spades", bonusChips: 10 })
        .bonusChips,
    ).toBe(10);
  });

  test("defaults bonus chips to zero when unset (negative)", () => {
    expect(getCardInfo({ id: 52, rank: "9", suit: "spades" }).bonusChips).toBe(
      0,
    );
  });

  test("shows 1 in 5 / 1 in 15 by default (no probability multiplier)", () => {
    expect(enhancementDescription(t, "lucky")).toContain("1 in 5");
  });

  test("shows the money-hit ratio (1 in 15) by default too", () => {
    expect(enhancementDescription(t, "lucky")).toContain("1 in 15");
  });

  test("doubles the lucky mult-hit ratio when probabilityMultiplier is 2", () => {
    expect(enhancementDescription(t, "lucky", 2)).toContain("2 in 5");
  });

  test("doubles the lucky money-hit ratio when probabilityMultiplier is 2", () => {
    expect(enhancementDescription(t, "lucky", 2)).toContain("2 in 15");
  });

  test("ignores a multiplier of exactly 1 (no description change)", () => {
    expect(enhancementDescription(t, "lucky", 1)).toBe(
      enhancementDescription(t, "lucky"),
    );
  });

  test("carries the enhancement id for tooltip rendering", () => {
    expect(getCardInfo(luckyCard).enhancement).toBe("lucky");
  });
});

describe("getCardInfo — glass enhancement description", () => {
  test("shows 1 in 4 break chance by default", () => {
    expect(enhancementDescription(t, "glass")).toContain("1 in 4");
  });

  test("doubles the break-chance ratio when probabilityMultiplier is 2", () => {
    expect(enhancementDescription(t, "glass", 2)).toContain("2 in 4");
  });
});
