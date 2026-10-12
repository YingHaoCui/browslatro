import type { TFunction } from "i18next";
import type { JokerEdition } from "../../items/jokers";
import {
  FOIL_CHIPS,
  HOLOGRAPHIC_MULT,
  POLYCHROME_X_MULT,
} from "../../items/jokers";
import { JOKER_EDITION_LABEL_KEY } from "../../i18n/cardLabelKeys";

export function jokerEditionName(t: TFunction, edition: JokerEdition): string {
  return t(JOKER_EDITION_LABEL_KEY[edition]);
}

export function jokerEditionDescription(
  t: TFunction,
  edition: JokerEdition,
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
    case "negative":
      return t("cardLabels.editionNegativeDescription");
  }
}
