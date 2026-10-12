import { localizedContentString, localizedJokerPlaceholders } from "./localeContent";
import { JOKER_PLACEHOLDER_VALUES } from "./jokerPlaceholders";

function placeholderValuesFor(locale: string, id: string) {
  return localizedJokerPlaceholders(locale)?.[id] ?? JOKER_PLACEHOLDER_VALUES[id];
}

function interpolate(template: string, id: string, locale: string): string {
  const values = placeholderValuesFor(locale, id);
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values?.[key] ?? match);
}

export function localizedJokerName(locale: string, id: string, fallback: string): string {
  return localizedContentString(locale, "jokerNames", id, fallback);
}

export function localizedJokerDescription(locale: string, id: string, fallback: string): string {
  const template = localizedContentString(locale, "jokerDescriptions", id, "");
  return template !== "" ? interpolate(template, id, locale) : fallback;
}

export function localizedJokerPlaceholderValue(
  locale: string,
  id: string,
  key: string,
  fallback: string,
): string {
  return placeholderValuesFor(locale, id)?.[key] ?? fallback;
}
