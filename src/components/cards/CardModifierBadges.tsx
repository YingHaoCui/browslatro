import { useTranslation } from "react-i18next";
import type { CardEdition, Enhancement, Seal } from "../../cards/types";
import type { JokerEdition } from "../../items/jokers";
import {
  CARD_EDITION_LABEL_KEY,
  ENHANCEMENT_LABEL_KEY,
  JOKER_EDITION_LABEL_KEY,
  SEAL_LABEL_KEY,
} from "../../i18n/cardLabelKeys";
import { Badge } from "../ui/Badge";

type BadgeTone =
  | "neutral"
  | "money"
  | "chips"
  | "mult"
  | "success"
  | "advisor"
  | "muted";

const ENHANCEMENT_TONE = {
  bonus: "chips",
  mult: "mult",
  wild: "advisor",
  glass: "neutral",
  steel: "muted",
  stone: "neutral",
  gold: "money",
  lucky: "success",
} as const satisfies Record<Enhancement, BadgeTone>;

const CARD_EDITION_TONE = {
  foil: "chips",
  holographic: "advisor",
  polychrome: "success",
} as const satisfies Record<CardEdition, BadgeTone>;

const JOKER_EDITION_TONE = {
  foil: "chips",
  holographic: "advisor",
  polychrome: "success",
  negative: "neutral",
} as const satisfies Record<JokerEdition, BadgeTone>;

const SEAL_TONE = {
  gold: "money",
  red: "mult",
  blue: "chips",
  purple: "advisor",
} as const satisfies Record<Seal, BadgeTone>;

export interface CardModifierBadgesProps {
  readonly scope: string;
  readonly suffix: string | number;
  readonly enhancement?: Enhancement | null;
  readonly cardEdition?: CardEdition | null;
  readonly seal?: Seal | null;
  readonly jokerEdition?: JokerEdition | null;
}

export default function CardModifierBadges({
  scope,
  suffix,
  enhancement,
  cardEdition,
  seal,
  jokerEdition,
}: CardModifierBadgesProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!enhancement && !cardEdition && !seal && !jokerEdition) return null;
  return (
    <>
      {jokerEdition && (
        <Badge
          tone={JOKER_EDITION_TONE[jokerEdition]}
          className="ml-1 align-middle"
          data-testid={`${scope}-edition-${suffix}`}
        >
          {t(JOKER_EDITION_LABEL_KEY[jokerEdition])}
        </Badge>
      )}
      {enhancement && (
        <Badge
          tone={ENHANCEMENT_TONE[enhancement]}
          className="ml-1 align-middle"
          data-testid={`${scope}-card-enhancement-${suffix}`}
        >
          {t(ENHANCEMENT_LABEL_KEY[enhancement])}
        </Badge>
      )}
      {cardEdition && (
        <Badge
          tone={CARD_EDITION_TONE[cardEdition]}
          className="ml-1 align-middle"
          data-testid={`${scope}-card-edition-${suffix}`}
        >
          {t(CARD_EDITION_LABEL_KEY[cardEdition])}
        </Badge>
      )}
      {seal && (
        <Badge
          tone={SEAL_TONE[seal]}
          className="ml-1 align-middle"
          data-testid={`${scope}-card-seal-${suffix}`}
        >
          {t(SEAL_LABEL_KEY[seal])}
        </Badge>
      )}
    </>
  );
}
