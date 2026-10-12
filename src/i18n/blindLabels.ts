import type { TFunction } from "i18next";
import type { Blind } from "../cards/types";

export const BLIND_NAME_KEYS = {
  1: "blinds.smallBlind",
  2: "blinds.bigBlind",
  3: "blinds.bossBlind",
} as const satisfies Record<Blind, string>;

export function tBlindName(t: TFunction, blind: Blind): string {
  return t(BLIND_NAME_KEYS[blind]);
}
