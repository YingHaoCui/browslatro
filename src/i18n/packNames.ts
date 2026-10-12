import type { TFunction } from "i18next";
import type { PackPool, PackVariant } from "../items/packs";

const PACK_POOL_KEY = {
  celestial: "shop.packPoolCelestial",
  arcana: "shop.packPoolArcana",
  buffoon: "shop.packPoolBuffoon",
  spectral: "shop.packPoolSpectral",
  standard: "shop.packPoolStandard",
} as const satisfies Record<PackPool, string>;

const PACK_NAME_KEY = {
  normal: "shop.packName",
  jumbo: "shop.packNameJumbo",
  mega: "shop.packNameMega",
} as const satisfies Record<PackVariant, string>;

export function localizedPackName(
  t: TFunction,
  pool: PackPool,
  variant: PackVariant,
): string {
  return t(PACK_NAME_KEY[variant], { pool: t(PACK_POOL_KEY[pool]) });
}
