import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { localizedJokerName } from "../../i18n/jokerOverrides";
import { formatChanceRatio } from "../cards/cardInfo";
import { dynamicJokerDescriptionNode } from "../../items/jokers/dynamicJokerDescription";
import { jokerEditionDescription, jokerEditionName } from "./jokerEditionLabels";
import { stickerLine, stickerName } from "./jokerStickerLabels";
import {
  jokerCurrentValue,
  jokerEnhancementFilter,
  jokerSellValue,
  jokerStickers,
  probabilityMultiplierFromJokers,
  resolveJokerEffect,
  resolveJokerTargetIndex,
  type Joker,
  type JokerCurrentValue,
  type JokerRarity,
} from "../../items/jokers";
import { useGame } from "../../store/game";
import {
  countEnhancedInFullDeck,
  countEnhancementInFullDeck,
  countMissingFromFullDeck,
  fullDeckSize,
} from "../../cards/deckBuild";
import { useTooltipPosition } from "../system/useTooltipPosition";
import { useJokerDescriptionContext } from "./useJokerDescriptionContext";

interface JokerTooltipProps {
  id: string;
  joker: Joker;
  jokers?: ReadonlyArray<Joker>;
  jokerIndex?: number;
  anchorRect: DOMRect;
}

const RARITY_TEXT = {
  common: "font-semibold text-chips uppercase",
  uncommon: "font-semibold text-success uppercase",
  rare: "font-semibold text-mult uppercase",
  legendary: "font-semibold text-money uppercase",
} as const;

const RARITY_LABEL_KEY = {
  common: "jokers.rarityCommon",
  uncommon: "jokers.rarityUncommon",
  rare: "jokers.rarityRare",
  legendary: "jokers.rarityLegendary",
} as const satisfies Record<JokerRarity, string>;

type CopyTarget =
  | { readonly kind: "none" }
  | { readonly kind: "incompatible" }
  | { readonly kind: "joker"; readonly joker: Joker };

function computeCopyTarget(
  jokers: ReadonlyArray<Joker>,
  index: number,
): CopyTarget {
  const effect = jokers[index]?.effect;
  if (
    effect?.kind !== "copy-right-joker" &&
    effect?.kind !== "copy-leftmost-joker"
  ) {
    return { kind: "none" };
  }
  if (resolveJokerEffect(jokers, index).kind === "noop") {
    return { kind: "incompatible" };
  }
  return { kind: "joker", joker: jokers[resolveJokerTargetIndex(jokers, index)] };
}

function copyTargetLabel(
  t: TFunction,
  locale: string,
  target: CopyTarget,
): string | null {
  if (target.kind === "none") return null;
  if (target.kind === "incompatible") {
    return t("jokers.copying", { target: t("jokers.copyIncompatible") });
  }
  return t("jokers.copying", {
    target: localizedJokerName(locale, target.joker.id, target.joker.name),
  });
}

function currentValueLabel(
  t: TFunction,
  value: JokerCurrentValue,
): string {
  switch (value.kind) {
    case "mult":
      return t("jokers.currentlyMult", { value: value.value });
    case "chips":
      return t("jokers.currentlyChips", { value: value.value });
    case "x-mult":
      return t("jokers.currentlyXMult", {
        value: Math.round(value.value * 100) / 100,
      });
    case "sell-value":
      return t("jokers.currentlySellValue", { value: value.value });
    case "money":
      return t("jokers.currentlyMoney", { value: value.value });
    case "hand-size":
      return t("jokers.currentlyHandSize", { value: value.value });
    case "hands-remaining":
      return t("jokers.currentlyHandsLeft", { count: value.value });
    case "hands-until-x-mult":
      return t("jokers.xMultInHands", {
        value: value.xmult,
        count: value.hands,
      });
  }
}

export default function JokerTooltip({
  id,
  joker,
  jokers = [],
  jokerIndex = 0,
  anchorRect,
}: JokerTooltipProps) {
  const { t, i18n } = useTranslation();
  const { ref, style } = useTooltipPosition(anchorRect);
  const descriptionContext = useJokerDescriptionContext();
  const copyTarget = computeCopyTarget(jokers, jokerIndex);
  const copyLabel = copyTargetLabel(t, i18n.language, copyTarget);
  const sellValue = jokerSellValue(joker);
  const progress = useEnhancedThresholdProgress(joker);
  const effectiveOdds = useEffectiveOdds(t, joker);
  const currentValue = useCurrentValue(joker);
  return createPortal(
    <div
      id={id}
      ref={ref}
      role="tooltip"
      data-testid="joker-tooltip"
      className="pointer-events-none fixed z-50 flex -translate-x-1/2 w-64 flex-col gap-1 rounded-lg border border-border bg-raised p-3 text-xs text-ink shadow-lg shadow-black/40"
      style={style}
    >
      <p className="text-sm font-bold">
        {localizedJokerName(i18n.language, joker.id, joker.name)}
      </p>
      {copyLabel !== null && (
        <p className="text-advisor" data-testid="joker-tooltip-copy-target">
          {copyLabel}
        </p>
      )}
      <p
        className={RARITY_TEXT[joker.rarity]}
        data-testid="joker-tooltip-rarity"
      >
        {t(RARITY_LABEL_KEY[joker.rarity])}
      </p>
      <p className="text-muted" data-testid="joker-tooltip-description">
        {dynamicJokerDescriptionNode({
          ...descriptionContext,
          jokerId: joker.id,
          description: joker.description,
        })}
      </p>
      {currentValue && (
        <p
          className="font-semibold text-chips"
          data-testid="joker-tooltip-current-value"
        >
          {currentValueLabel(t, currentValue)}
        </p>
      )}
      {effectiveOdds && (
        <p className="text-muted" data-testid="joker-tooltip-effective-odds">
          {t("jokers.effectiveOdds", { odds: effectiveOdds })}
        </p>
      )}
      {progress && (
        <p className="text-muted" data-testid="joker-tooltip-enhanced-progress">
          {t("jokers.enhancedProgress", {
            count: progress.count,
            total: progress.threshold,
          })}
        </p>
      )}
      {joker.edition && (
        <p className="text-chips">
          <strong>{jokerEditionName(t, joker.edition)}</strong> —{" "}
          {jokerEditionDescription(t, joker.edition)}
        </p>
      )}
      {jokerStickers(joker).map((sticker, idx) => (
        <p
          key={`${sticker.kind}-${idx}`}
          className="text-money"
          data-testid={`joker-tooltip-sticker-${sticker.kind}`}
        >
          <strong>{stickerName(t, sticker.kind)}</strong> —{" "}
          {stickerLine(t, sticker)}
        </p>
      ))}
      <p className="mt-1 border-t border-border pt-1 font-semibold text-money">
        {t("jokers.sellFor", { value: sellValue })}
      </p>
    </div>,
    document.body,
  );
}

function useEnhancedThresholdProgress(
  joker: Joker,
): { readonly count: number; readonly threshold: number } | null {
  const baseDeckCards = useGame((s) => s.baseDeckCards);
  const destroyedCardIds = useGame((s) => s.destroyedCardIds);
  const addedCards = useGame((s) => s.addedCards);
  const cardEnhancementsById = useGame((s) => s.cardEnhancementsById);
  if (joker.effect.kind !== "x-mult-when-enhanced-count-at-least") return null;
  const count = countEnhancedInFullDeck(
    baseDeckCards,
    destroyedCardIds,
    addedCards,
    cardEnhancementsById,
  );
  return { count, threshold: joker.effect.threshold };
}

function getJokerBaseChance(joker: Joker): number | null {
  const e = joker.effect;
  if (
    e.kind === "business-card" ||
    e.kind === "per-suit-chance-x-mult" ||
    e.kind === "per-held-face-chance-money"
  ) {
    return e.chance;
  }
  return null;
}

function useCurrentValue(joker: Joker): JokerCurrentValue | null {
  const blindsSkipped = useGame((s) => s.runStats.blindsSkipped);
  const addedCardsCount = useGame((s) => s.addedCards.length);
  const missingDeckCards = useGame((s) =>
    countMissingFromFullDeck(s.baseDeckCards, s.destroyedCardIds, s.addedCards),
  );
  const money = useGame((s) => s.money);
  const jokerCount = useGame((s) => s.jokers.length);
  const remainingDiscards = useGame((s) => s.remainingDiscards);
  const remainingDeckCards = useGame((s) =>
    s.dealt.hand.length > 0
      ? s.dealt.remaining.length
      : fullDeckSize(s.baseDeckCards, s.destroyedCardIds, s.addedCards),
  );
  const enhancement = jokerEnhancementFilter(joker);
  const matchingEnhancedDeckCards = useGame((s) =>
    countEnhancementInFullDeck(
      s.baseDeckCards,
      s.destroyedCardIds,
      s.addedCards,
      s.cardEnhancementsById,
      enhancement,
    ),
  );
  return jokerCurrentValue(joker, {
    blindsSkipped,
    addedCardsCount,
    missingDeckCards,
    money,
    jokerCount,
    remainingDiscards,
    remainingDeckCards,
    matchingEnhancedDeckCards,
  });
}

function useEffectiveOdds(t: TFunction, joker: Joker): string | null {
  const multiplier = useGame((s) => probabilityMultiplierFromJokers(s.jokers));
  const baseChance = getJokerBaseChance(joker);
  if (baseChance === null) return null;
  if (multiplier === 1) return null;
  return formatChanceRatio(t, baseChance, multiplier);
}
