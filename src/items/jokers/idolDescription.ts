export function idolDescriptionText(
  base: string,
  rankName: string | null,
  suitName: string | null,
  rankSentinel: string = "[rank]",
  suitSentinel: string = "[suit]",
): string {
  if (rankName === null || suitName === null) return base;
  return base.replace(rankSentinel, rankName).replace(suitSentinel, suitName);
}
