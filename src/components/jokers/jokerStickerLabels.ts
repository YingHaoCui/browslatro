import type { TFunction } from "i18next";
import type { JokerSticker, JokerStickerKind } from "../../items/jokers";
import {
  PERISHABLE_LIFE,
  RENTAL_BASE_PRICE,
  RENTAL_END_OF_ROUND_DRAIN,
} from "../../items/jokers";

const STICKER_NAME_KEY = {
  eternal: "jokers.stickerEternalName",
  perishable: "jokers.stickerPerishableName",
  rental: "jokers.stickerRentalName",
} as const satisfies Record<JokerStickerKind, string>;

export function stickerName(t: TFunction, kind: JokerStickerKind): string {
  return t(STICKER_NAME_KEY[kind]);
}

export function stickerDescription(
  t: TFunction,
  kind: JokerStickerKind,
): string {
  switch (kind) {
    case "eternal":
      return t("jokers.stickerEternalDescription");
    case "perishable":
      return t("jokers.stickerPerishableDescription", {
        rounds: PERISHABLE_LIFE,
      });
    case "rental":
      return t("jokers.stickerRentalDescription", {
        price: RENTAL_BASE_PRICE,
        drain: RENTAL_END_OF_ROUND_DRAIN,
      });
  }
}

export function stickerLine(t: TFunction, sticker: JokerSticker): string {
  if (sticker.kind === "perishable") {
    if (sticker.roundsHeld >= PERISHABLE_LIFE) {
      return t("jokers.stickerPerishableExpired");
    }
    const remaining = PERISHABLE_LIFE - sticker.roundsHeld;
    return t("jokers.stickerRoundsLeft", {
      remaining,
      total: PERISHABLE_LIFE,
    });
  }
  return stickerDescription(t, sticker.kind);
}
