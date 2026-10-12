import { en } from "./locales/en";

export type LocaleContent = {
  readonly [Section in keyof typeof en]: Readonly<Record<string, string>>;
};

export type ContentSection = keyof LocaleContent;

export type JokerPlaceholderValues = Readonly<
  Record<string, Readonly<Record<string, string>>>
>;

const EN_CONTENT: LocaleContent = en;

const loadedContent = new Map<string, LocaleContent>();
const loadedJokerPlaceholders = new Map<string, JokerPlaceholderValues>();

export function registerLocaleContent(locale: string, content: LocaleContent): void {
  loadedContent.set(locale, content);
}

export function registerJokerPlaceholders(
  locale: string,
  values: JokerPlaceholderValues,
): void {
  loadedJokerPlaceholders.set(locale, values);
}

export function localizedJokerPlaceholders(
  locale: string,
): JokerPlaceholderValues | undefined {
  return loadedJokerPlaceholders.get(locale);
}

function sectionFor(
  locale: string,
  section: ContentSection,
): Readonly<Record<string, string>> | undefined {
  if (locale === "en") return EN_CONTENT[section];
  return loadedContent.get(locale)?.[section];
}

export function localizedContentString(
  locale: string,
  section: ContentSection,
  id: string,
  fallback: string,
): string {
  return sectionFor(locale, section)?.[id] ?? EN_CONTENT[section][id] ?? fallback;
}
