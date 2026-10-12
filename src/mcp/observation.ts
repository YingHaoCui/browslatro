import type { GameState } from "../store/game";
import type { Card } from "../cards/types";
import { BlindValues } from "../constants";
import {
  bossHidesJokers,
  bossRequiredCardCount,
  debuffedHandIds,
} from "../items/bosses";
import { consumableCapacityFor, jokerCapacityFor } from "../items/capacities";
import {
  canSellJoker,
  hasChaosTheClownInJokers,
  jokerSellValue,
} from "../items/jokers";
import { consumableSellValue } from "../items/consumables";
import { packPickLimit } from "../items/packs";
import { describeSkipOffer, getTagSpec } from "../items/tags";
import { rerollCostFor } from "../items/shop";
import { applyShopDiscount, rerollCostReduction } from "../items/vouchers";
import { applyNextShopModifiers } from "../run/nextShopMods";
import { requiredChipsForBlind } from "../scoring/anteScaling";
import { shopAdviceItem } from "../ai/advisor/contextSnapshots";
import type { GameObservation } from "./protocol";

export function phaseOf(s: GameState, isScoring: boolean): string {
  if (isScoring || s.discardingIds.size > 0) return "animating";
  if (s.pendingRunSelect) return "new_run";
  if (s.pendingLose) return "lost";
  if (s.pendingGameWon) return "won";
  if (s.pendingWin) return "round_won";
  if (s.pendingJokerGrantIds.length) return "joker_grant";
  if (s.openedPack) return "pack";
  if (s.pendingBlindSelect) return "blind_select";
  if (s.shopOffers) return "shop";
  return "hand";
}

export function currentRerollCost(s: GameState): number {
  if (s.shopRerollCount === 0 && hasChaosTheClownInJokers(s.jokers)) return 0;
  return rerollCostFor(
    s.shopRerollCount,
    rerollCostReduction(s.ownedVoucherIds) +
      applyNextShopModifiers(s.pendingShopMods).rerollReduction,
  );
}

export function visibleCard(card: Card): object {
  if (card.faceDown) return { id: card.id, faceDown: true };
  return { ...card, faceDown: false };
}

const phaseTools: Record<string, readonly string[]> = {
  new_run: ["start_run"],
  lost: ["start_run"],
  won: ["start_run", "continue_round"],
  round_won: ["continue_round"],
  joker_grant: ["continue_round"],
  blind_select: ["select_blind"],
  shop: ["shop_action", "use_consumable", "reorder_jokers"],
  pack: ["pack_action", "use_consumable", "reorder_jokers"],
  hand: [
    "play_hand",
    "discard_cards",
    "use_consumable",
    "reorder_jokers",
    "shop_action",
  ],
  animating: [],
};

export function observeGame(
  s: GameState,
  isScoring: boolean,
  sessionId: string,
  revision: number,
): GameObservation {
  const phase = phaseOf(s, isScoring);
  const hiddenJokers = s.blind === 3 && bossHidesJokers(s.currentBoss);
  const debuffed = debuffedHandIds(
    s.dealt.hand,
    s.currentBoss,
    s.blind === 3,
    s.playedCardKeysThisAnte,
  );
  const byId = new Map(s.dealt.hand.map((card) => [card.id, card]));
  const orderedHand = [
    ...new Set([...s.handDisplayOrder, ...byId.keys()]),
  ].flatMap((id) => {
    const card = byId.get(id);
    return card
      ? [{ ...visibleCard(card), debuffed: !card.faceDown && debuffed.has(id) }]
      : [];
  });
  const deck = [...s.baseDeckCards, ...s.addedCards].filter(
    (card) => !s.destroyedCardIds.has(card.id),
  );
  const composition: Record<string, number> = {};
  for (const card of deck) {
    const key = `${card.rank}:${card.suit}`;
    composition[key] = (composition[key] ?? 0) + 1;
  }
  const option = s.openedPack;
  return {
    sessionId,
    revision,
    phase,
    ready: phase !== "animating",
    availableTools: [
      "get_state",
      "get_rules",
      "wait_for_state_change",
      ...(phaseTools[phase] ?? []),
    ],
    ante: s.ante,
    round: s.round,
    deckId: s.selectedDeck,
    stake: s.selectedStake,
    endlessMode: s.endlessMode,
    money: s.money,
    roundScore: s.roundScore,
    remainingHands: s.remainingHands,
    remainingDiscards: s.remainingDiscards,
    blind: {
      kind: s.blind,
      name: BlindValues[s.blind],
      scoreTarget: requiredChipsForBlind({
        ante: s.ante,
        blind: s.blind,
        boss: s.currentBoss,
        stake: s.selectedStake,
        deck: s.selectedDeck,
      }),
      boss: s.currentBoss,
      skipRewards: {
        small: {
          ...s.skipTagOffers.small,
          ...describeSkipOffer(s.skipTagOffers.small),
        },
        big: {
          ...s.skipTagOffers.big,
          ...describeSkipOffer(s.skipTagOffers.big),
        },
      },
    },
    hand: orderedHand,
    selectedCardIds: [...s.selectedIds],
    forcedCardId: s.forcedCardId,
    constraints: {
      maxSelectedCards: 5,
      requiredPlayedCardCount:
        s.blind === 3 ? bossRequiredCardCount(s.currentBoss) : null,
    },
    handStats: s.handStats,
    handPlayCounts: s.handPlayCounts,
    handHistoryThisRound: s.handHistoryThisRound,
    deck: {
      totalCards: deck.length,
      remainingCount: s.dealt.remaining.length,
      composition,
      note: "Composition of the whole owned deck, not remaining draw order or hidden-card identities.",
    },
    jokers: s.jokers.map((joker, index) =>
      hiddenJokers
        ? { index, faceDown: true }
        : {
            ...joker,
            index,
            sellValue: jokerSellValue(joker),
            canSell: canSellJoker(joker),
          },
    ),
    jokerCapacity: jokerCapacityFor(s.ownedVoucherIds, s.selectedDeck),
    jokerTargets: hiddenJokers
      ? null
      : {
          idol: s.idolTarget,
          ancientSuit: s.ancientSuit,
          castleSuit: s.castleSuit,
          rebateRank: s.rebateRank,
          todoHand: s.todoHand,
        },
    consumables: s.consumables.map((entry, index) => ({
      ...entry,
      index,
      sellValue: consumableSellValue(entry),
    })),
    consumableCapacity: consumableCapacityFor(
      s.ownedVoucherIds,
      s.selectedDeck,
    ),
    lastUsedConsumable: s.lastUsedConsumable,
    ownedVoucherIds: [...s.ownedVoucherIds],
    pendingTags: s.pendingTags.map(getTagSpec),
    shop: s.shopOffers
      ? {
          rerollCost: currentRerollCost(s),
          rerollCount: s.shopRerollCount,
          offers: s.shopOffers.map((offer, index) => ({
            index,
            sold: Boolean(offer.sold),
            ...shopAdviceItem(
              offer,
              applyShopDiscount(offer.price, s.ownedVoucherIds),
            ),
            ...(offer.kind === "joker"
              ? {
                  effect: offer.joker.effect,
                  edition: offer.joker.edition,
                  stickers: offer.joker.stickers,
                }
              : {}),
          })),
          vouchers: s.currentAnteVouchers.map((voucher, index) => ({
            ...voucher,
            index,
            price: applyShopDiscount(voucher.cost, s.ownedVoucherIds),
            sold: s.soldVoucherIds.has(voucher.id),
          })),
        }
      : null,
    pack: option
      ? {
          pool: option.pool,
          variant: option.variant,
          pickLimit: packPickLimit(option.variant),
          picksRemaining: s.packPicksRemaining,
          options: option.options.map((entry, index) => ({
            ...entry,
            index,
            picked: s.pickedPackOptionIndices.has(index),
          })),
          previewHand: s.packPreviewHand.map(visibleCard),
          selectedCardIds: [...s.packPreviewSelectedIds],
        }
      : null,
    result: s.pendingWin ?? s.pendingLose ?? s.pendingGameWon,
  };
}
