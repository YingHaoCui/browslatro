import { detectLocale, isLocale } from "./index";
import { en } from "./locales/en";
import { haw } from "./locales/haw";
import { zh } from "./locales/zh";

function flattenKeys(messages: Record<string, Record<string, string>>): string[] {
  return Object.entries(messages)
    .flatMap(([section, entries]) =>
      Object.keys(entries).map((key) => `${section}.${key}`),
    )
    .sort();
}

function placeholders(value: string): string[] {
  return (value.match(/\{\{\w+\}\}/g) ?? []).sort();
}

function localeParityBlock(
  name: string,
  locale: Record<string, Record<string, string>>,
): void {
  describe(`${name} locale`, () => {
    test("covers every en key", () => {
      expect(flattenKeys(locale)).toEqual(flattenKeys(en));
    });

    test("preserves every interpolation placeholder", () => {
      const mismatches = Object.entries(en).flatMap(([section, entries]) =>
        Object.entries(entries)
          .filter(
            ([key, value]) =>
              placeholders(value).join(",") !==
              placeholders(locale[section][key]).join(","),
          )
          .map(([key]) => `${section}.${key}`),
      );
      expect(mismatches).toEqual([]);
    });

    test("has no empty translations", () => {
      const empty = Object.entries(locale).flatMap(([section, entries]) =>
        Object.entries(entries)
          .filter(([, value]) => value.trim() === "")
          .map(([key]) => `${section}.${key}`),
      );
      expect(empty).toEqual([]);
    });
  });
}

describe("isLocale", () => {
  test("accepts en", () => {
    expect(isLocale("en")).toBe(true);
  });

  test("accepts haw", () => {
    expect(isLocale("haw")).toBe(true);
  });

  test("accepts zh", () => {
    expect(isLocale("zh")).toBe(true);
  });

  test("rejects an unsupported locale", () => {
    expect(isLocale("fr")).toBe(false);
  });

  test("rejects a chinese region variant that is not a locale code", () => {
    expect(isLocale("zh-CN")).toBe(false);
  });

  test("rejects null", () => {
    expect(isLocale(null)).toBe(false);
  });
});

describe("detectLocale", () => {
  test("falls back to en without a window", () => {
    expect(detectLocale()).toBe("en");
  });
});

localeParityBlock("haw", haw);
localeParityBlock("zh", zh);
