import { JOKER_PLACEHOLDER_VALUES } from "./jokerPlaceholders";
import { zhJokerPlaceholders } from "./locales/zh";

describe("zh joker placeholders", () => {
  test("covers every en joker id", () => {
    expect(Object.keys(zhJokerPlaceholders).sort()).toEqual(
      Object.keys(JOKER_PLACEHOLDER_VALUES).sort(),
    );
  });

  test("preserves every placeholder key per joker", () => {
    const mismatches = Object.entries(JOKER_PLACEHOLDER_VALUES).filter(
      ([id, values]) =>
        Object.keys(values).sort().join(",") !==
        Object.keys(zhJokerPlaceholders[id] ?? {}).sort().join(","),
    );
    expect(mismatches.map(([id]) => id)).toEqual([]);
  });

  test("has no empty values", () => {
    const empty = Object.entries(zhJokerPlaceholders).flatMap(([id, values]) =>
      Object.entries(values)
        .filter(([, value]) => value.trim() === "")
        .map(([key]) => `${id}.${key}`),
    );
    expect(empty).toEqual([]);
  });

  test("keeps bracketed sentinels for dynamic jokers", () => {
    expect(zhJokerPlaceholders["the-idol"]?.rank).toBe("[点数]");
    expect(zhJokerPlaceholders["the-idol"]?.suit).toBe("[花色]");
    expect(zhJokerPlaceholders["castle"]?.suit).toBe("[花色]");
    expect(zhJokerPlaceholders["mail-in-rebate"]?.rank).toBe("[点数]");
  });
});
