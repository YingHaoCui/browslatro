import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import type { Suit } from "../../cards/types";
import { SUIT_GLYPHS } from "../../cards/deck";

const SUIT_CLASS: Record<Suit, string> = {
  spades: "castle-suit-spades",
  hearts: "castle-suit-hearts",
  diamonds: "castle-suit-diamonds",
  clubs: "castle-suit-clubs",
};

export function castleDescriptionText(
  t: TFunction,
  base: string,
  suit: Suit | null,
  suitName: string | null,
): string {
  if (suit === null || suitName === null) {
    return `${base} — ${t("jokers.castleSuitUnset")}`;
  }
  return `${base} — ${t("jokers.currently")} ${SUIT_GLYPHS[suit]} ${suitName}`;
}

export function castleDescriptionNode(
  t: TFunction,
  base: string,
  suit: Suit | null,
  suitName: string | null,
): ReactNode {
  if (suit === null || suitName === null) {
    return `${base} — ${t("jokers.castleSuitUnset")}`;
  }
  return (
    <>
      {base} — {t("jokers.currently")}{" "}
      <strong className={SUIT_CLASS[suit]}>
        {SUIT_GLYPHS[suit]} {suitName}
      </strong>
    </>
  );
}
