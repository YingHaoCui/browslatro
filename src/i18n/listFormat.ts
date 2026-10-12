export function joinList(
  locale: string,
  items: ReadonlyArray<string>,
): string {
  if (items.length === 0) return "";
  if (locale === "zh") return items.join("、");
  return items.join(", ");
}
