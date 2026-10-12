import type { TFunction } from "i18next";
import { localizedContentString } from "./localeContent";
import { tHandLabel } from "./handLabels";
import {
  describeSkipOffer,
  getTagSpec,
  type AnteSkipOffer,
} from "../items/tags";

/** Localize display copies only; canonical catalogs and saved game data stay stable. */
export function localizedRule<
  T extends { id: string; name: string; description: string },
>(locale: string, spec: T): T {
  return {
    ...spec,
    name: localizedContentString(locale, "ruleNames", spec.id, spec.name),
    description: localizedContentString(
      locale,
      "ruleDescriptions",
      spec.id,
      spec.description,
    ),
  };
}

export function localizedSkipOffer(
  t: TFunction,
  locale: string,
  offer: AnteSkipOffer,
) {
  const spec = localizedRule(locale, getTagSpec(offer.id));
  if (offer.id === "orbital" && offer.orbitalHand) {
    return {
      ...spec,
      description: localizedContentString(
        locale,
        "ruleDescriptions",
        "orbital-hand",
        describeSkipOffer(offer).description,
      ).replace("{{hand}}", tHandLabel(t, offer.orbitalHand)),
    };
  }
  return spec;
}
