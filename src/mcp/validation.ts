import type { GameState } from "../store/game";
import type { Card } from "../cards/types";
import type { Consumable } from "../items/consumables";
import { consumableCapacityFor, jokerCapacityFor } from "../items/capacities";
import { effectiveJokerCount } from "../items/jokers";

export class GameActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function requireAction(
  condition: unknown,
  message: string,
  code = "illegal_action",
): asserts condition {
  if (!condition) throw new GameActionError(code, message);
}

export function validateCards(
  ids: readonly number[],
  cards: readonly Card[],
): void {
  requireAction(new Set(ids).size === ids.length, "Card IDs must be unique.");
  requireAction(
    ids.every((id) => cards.some((card) => card.id === id)),
    "Card ID is not present in the current hand.",
  );
}

export function validateConsumable(
  s: GameState,
  item: Consumable,
  ids: readonly number[],
  preview: boolean,
  fromPack = false,
): void {
  const hand = preview ? s.packPreviewHand : s.dealt.hand;
  validateCards(ids, hand);
  if (item.kind === "planet") {
    requireAction(ids.length === 0, "Planet cards do not accept targets.");
    return;
  }
  const effect = item.card.effect;
  const storing =
    fromPack &&
    ((item.kind === "spectral" &&
      effect.kind !== "duplicate-selected" &&
      ["apply-seal", "aura"].includes(effect.kind)) ||
      (item.kind === "tarot" &&
        !preview &&
        [
          "apply-enhancement",
          "destroy-selected",
          "rank-up-selected",
          "death-copy",
          "convert-suit",
        ].includes(effect.kind)));
  if (storing) {
    requireAction(
      ids.length === 0,
      "This pack option is stored as a consumable; targets are chosen when using it.",
    );
    requireAction(
      s.consumables.length <
        consumableCapacityFor(s.ownedVoucherIds, s.selectedDeck),
      "Consumable slots are full.",
    );
    return;
  }
  if ("requiredTargets" in effect)
    requireAction(
      ids.length === effect.requiredTargets,
      `Select exactly ${effect.requiredTargets} target cards.`,
    );
  else if ("maxTargets" in effect) {
    const exact = item.kind === "spectral" && !fromPack;
    requireAction(
      exact
        ? ids.length === effect.maxTargets
        : ids.length > 0 && ids.length <= effect.maxTargets,
      `Select ${exact ? "exactly " : "1–"}${effect.maxTargets} target cards.`,
    );
  } else
    requireAction(
      ids.length === 0,
      "This effect does not accept target cards.",
    );
  if (effect.kind === "copy-last-consumable") {
    requireAction(
      s.lastUsedConsumable && s.lastUsedConsumable.card.id !== "the-fool",
      "There is no previous consumable to copy.",
    );
  }
  if (effect.kind === "create-joker")
    requireAction(
      effectiveJokerCount(s.jokers) <
        jokerCapacityFor(s.ownedVoucherIds, s.selectedDeck),
      "Joker slots are full.",
    );
  if (
    fromPack &&
    ["copy-last-consumable", "create-consumables"].includes(effect.kind)
  )
    requireAction(
      s.consumables.length <
        consumableCapacityFor(s.ownedVoucherIds, s.selectedDeck),
      "Consumable slots are full.",
    );
}
