import { Badge } from "../ui/Badge";
import { useTranslation } from "react-i18next";
import type { JokerEdition } from "../../items/jokers";
import { jokerEditionDescription, jokerEditionName } from "./jokerEditionLabels";

interface JokerEditionBadgeProps {
  readonly edition: JokerEdition;
}

const EDITION_BADGE_KEY = {
  foil: "cardLabels.editionBadgeFoil",
  holographic: "cardLabels.editionBadgeHolographic",
  polychrome: "cardLabels.editionBadgePolychrome",
  negative: "cardLabels.editionBadgeNegative",
} as const satisfies Record<JokerEdition, string>;

const EDITION_TONE = {
  foil: "chips",
  holographic: "advisor",
  polychrome: "success",
  negative: "muted",
} as const satisfies Record<
  JokerEdition,
  "chips" | "advisor" | "success" | "muted"
>;

export default function JokerEditionBadge({ edition }: JokerEditionBadgeProps) {
  const { t } = useTranslation();
  return (
    <Badge
      tone={EDITION_TONE[edition]}
      aria-label={t("a11y.jokerEdition", {
        name: jokerEditionName(t, edition),
        description: jokerEditionDescription(t, edition),
      })}
      data-testid={`joker-edition-badge-${edition}`}
    >
      {t(EDITION_BADGE_KEY[edition])}
    </Badge>
  );
}
