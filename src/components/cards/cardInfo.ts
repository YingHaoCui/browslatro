import type { TFunction } from "i18next";
import type { Card, CardEdition, Enhancement, Seal, Suit } from "../../cards/types";
import { getRankChips } from "../../scoring/scoring";
import {
  BONUS_ENHANCEMENT_CHIPS,
  GLASS_ENHANCEMENT_DESTROY_CHANCE,
  GLASS_ENHANCEMENT_MULT_TIMES,
  LUCKY_ENHANCEMENT_MONEY_AMOUNT,
  LUCKY_ENHANCEMENT_MONEY_CHANCE,
  LUCKY_ENHANCEMENT_MULT_AMOUNT,
  LUCKY_ENHANCEMENT_MULT_CHANCE,
  MULT_ENHANCEMENT_MULT_DELTA,
  STONE_ENHANCEMENT_CHIPS,
} from "../../cards/enhancements";
import { GOLD_SEAL_BONUS } from "../../cards/seals";
import { FOIL_CHIPS, HOLOGRAPHIC_MULT, POLYCHROME_X_MULT } from "../../items/jokers";
import { GOLD_HELD_BONUS_PER_CARD } from "../../scoring/payout";
import { STEEL_MULT_FACTOR } from "../../cards/heldInHand";
import { effectiveChance } from "../../dev/chanceOverride";
import { CARD_EDITION_LABEL_KEY, ENHANCEMENT_LABEL_KEY, SEAL_LABEL_KEY } from "../../i18n/cardLabelKeys";

const SUIT_LABELS: Record<Suit, string> = {
  spades: "Spades",
  hearts: "Hearts",
  diamonds: "Diamonds",
  clubs: "Clubs",
};

const SUIT_GLYPHS: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

export type ChanceRatio =
  | { readonly kind: "guaranteed" }
  | { readonly kind: "ratio"; readonly num: number; readonly den: number };

export function chanceRatio(
  baseChance: number,
  probabilityMultiplier: number = 1,
): ChanceRatio {
  const eff = effectiveChance(baseChance, probabilityMultiplier);
  if (eff >= 1) return { kind: "guaranteed" };
  const denominator = Math.round(1 / baseChance);
  const numerator = Math.min(
    denominator,
    Math.round(eff * denominator),
  );
  return { kind: "ratio", num: numerator, den: denominator };
}

export function formatChanceRatio(
  t: TFunction,
  baseChance: number,
  probabilityMultiplier: number = 1,
): string {
  const ratio = chanceRatio(baseChance, probabilityMultiplier);
  return ratio.kind === "guaranteed"
    ? t("cardLabels.chanceGuaranteed")
    : t("cardLabels.chanceRatio", { num: ratio.num, den: ratio.den });
}

export function enhancementName(t: TFunction, enhancement: Enhancement): string {
  return t(ENHANCEMENT_LABEL_KEY[enhancement]);
}

export function enhancementDescription(
  t: TFunction,
  enhancement: Enhancement,
  probabilityMultiplier: number = 1,
): string {
  switch (enhancement) {
    case "bonus":
      return t("cardLabels.enhancementBonusDescription", {
        value: BONUS_ENHANCEMENT_CHIPS,
      });
    case "mult":
      return t("cardLabels.enhancementMultDescription", {
        value: MULT_ENHANCEMENT_MULT_DELTA,
      });
    case "wild":
      return t("cardLabels.enhancementWildDescription");
    case "glass":
      return t("cardLabels.enhancementGlassDescription", {
        value: GLASS_ENHANCEMENT_MULT_TIMES,
        odds: formatChanceRatio(
          t,
          GLASS_ENHANCEMENT_DESTROY_CHANCE,
          probabilityMultiplier,
        ),
      });
    case "steel":
      return t("cardLabels.enhancementSteelDescription", {
        value: STEEL_MULT_FACTOR,
      });
    case "stone":
      return t("cardLabels.enhancementStoneDescription", {
        value: STONE_ENHANCEMENT_CHIPS,
      });
    case "gold":
      return t("cardLabels.enhancementGoldDescription", {
        value: GOLD_HELD_BONUS_PER_CARD,
      });
    case "lucky":
      return t("cardLabels.enhancementLuckyDescription", {
        multOdds: formatChanceRatio(
          t,
          LUCKY_ENHANCEMENT_MULT_CHANCE,
          probabilityMultiplier,
        ),
        mult: LUCKY_ENHANCEMENT_MULT_AMOUNT,
        moneyOdds: formatChanceRatio(
          t,
          LUCKY_ENHANCEMENT_MONEY_CHANCE,
          probabilityMultiplier,
        ),
        money: LUCKY_ENHANCEMENT_MONEY_AMOUNT,
      });
  }
}

export function sealName(t: TFunction, seal: Seal): string {
  return t(SEAL_LABEL_KEY[seal]);
}

export function sealDescription(t: TFunction, seal: Seal): string {
  switch (seal) {
    case "gold":
      return t("cardLabels.sealGoldDescription", { value: GOLD_SEAL_BONUS });
    case "red":
      return t("cardLabels.sealRedDescription");
    case "blue":
      return t("cardLabels.sealBlueDescription");
    case "purple":
      return t("cardLabels.sealPurpleDescription");
  }
}

export function cardEditionName(t: TFunction, edition: CardEdition): string {
  return t(CARD_EDITION_LABEL_KEY[edition]);
}

export function cardEditionDescription(
  t: TFunction,
  edition: CardEdition,
): string {
  switch (edition) {
    case "foil":
      return t("cardLabels.editionFoilDescription", { value: FOIL_CHIPS });
    case "holographic":
      return t("cardLabels.editionHolographicDescription", {
        value: HOLOGRAPHIC_MULT,
      });
    case "polychrome":
      return t("cardLabels.editionPolychromeDescription", {
        value: POLYCHROME_X_MULT,
      });
  }
}

export interface CardInfo {
  readonly rank: string;
  readonly suitLabel: string;
  readonly suitGlyph: string;
  readonly suitClass: Suit;
  readonly chips: number;
  readonly bonusChips: number;
  readonly isStone: boolean;
  readonly enhancement?: Enhancement;
  readonly seal?: Seal;
  readonly edition?: CardEdition;
}

export interface GetCardInfoOptions {
  readonly suitLabel?: (suit: Suit) => string;
}

export function getCardInfo(
  card: Card,
  options: GetCardInfoOptions = {},
): CardInfo {
  const isStone = card.enhancement === "stone";
  return {
    rank: card.rank,
    suitLabel: (options.suitLabel ?? ((suit) => SUIT_LABELS[suit]))(card.suit),
    suitGlyph: SUIT_GLYPHS[card.suit],
    suitClass: card.suit,
    chips: isStone ? 0 : getRankChips(card.rank),
    bonusChips: card.bonusChips ?? 0,
    isStone,
    enhancement: card.enhancement ?? undefined,
    seal: card.seal ?? undefined,
    edition: card.edition ?? undefined,
  };
}
