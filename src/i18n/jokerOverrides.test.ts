import { localizedJokerDescription, localizedJokerName } from "./jokerOverrides";
import { registerJokerPlaceholders, registerLocaleContent } from "./localeContent";
import { haw } from "./locales/haw";
import { zh, zhJokerPlaceholders } from "./locales/zh";

describe("jokerOverrides", () => {
  beforeAll(() => {
    registerLocaleContent("haw", haw);
    registerLocaleContent("zh", zh);
    registerJokerPlaceholders("zh", zhJokerPlaceholders);
  });

  test("localizedJokerName returns the canonical i18n name, not the code fallback", () => {
    expect(localizedJokerName("en", "plus-four-mult", "+4 Mult")).toBe("Joker");
  });

  test("localizedJokerName returns the fallback for an unknown id", () => {
    expect(localizedJokerName("en", "not-a-joker", "Fallback")).toBe("Fallback");
  });

  test("localizedJokerDescription interpolates the templated values", () => {
    expect(localizedJokerDescription("en", "bull", "fallback")).toBe(
      "+2 Chips for each $1 you have",
    );
  });

  test("localizedJokerDescription returns the fallback for an unknown id", () => {
    expect(localizedJokerDescription("en", "not-a-joker", "Fallback")).toBe("Fallback");
  });

  test("an untranslated haw joker name falls back to the English text", () => {
    expect(localizedJokerName("haw", "dna", "DNA")).toBe("DNA");
  });

  test("a translated haw joker name returns the native text", () => {
    expect(localizedJokerName("haw", "plus-four-mult", "+4 Mult")).toBe("Iōka");
  });

  test("a zh joker name returns the official Chinese name", () => {
    expect(localizedJokerName("zh", "plus-four-mult", "+4 Mult")).toBe("小丑");
  });

  test("a zh joker description interpolates the zh placeholders", () => {
    expect(localizedJokerDescription("zh", "bull", "fallback")).toBe(
      "每拥有 $1，+2 筹码",
    );
  });

  test("a zh joker description with a sentinel keeps it until the runtime value lands", () => {
    expect(localizedJokerDescription("zh", "castle", "fallback")).toBe(
      "每弃掉一张[花色]牌，这张小丑牌获得 +3 筹码，每回合花色都会变",
    );
  });
});
