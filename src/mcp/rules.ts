import { HANDS } from "../constants";
import { createJokerCatalog } from "../items/jokers";
import { createTarotCatalog } from "../items/tarots";
import { createPlanetCatalog } from "../items/planets";
import { createSpectralCatalog } from "../items/spectrals";
import { createBossCatalog } from "../items/bosses";
import { createDeckCatalog } from "../items/decks";
import { createStakeCatalog } from "../items/stakes";
import { VOUCHER_CATALOG } from "../items/vouchers";
import { createTagCatalog } from "../items/tags";
import { CARD_EDITION_INFO } from "../cards/editions";
import { ENHANCEMENT_KINDS } from "../cards/enhancements";
import {
  enhancementDescription,
  enhancementName,
} from "../components/cards/cardInfo";
import { SEAL_KINDS, getSealInfo } from "../cards/seals";
import i18n from "../i18n";
import { toolDescriptions, toolSchemas } from "./protocol";

export function queryRules(input: unknown): object {
  const { topic, id } = toolSchemas.get_rules.parse(input);
  if (topic === "overview")
    return {
      objective:
        "Reach each blind's scoreTarget within remainingHands; beat ante 8 to win. Endless mode is optional.",
      flow: "start_run → select_blind → play/discard/use items → continue_round collect → shop → select_blind. Packs and joker grants may interrupt this flow.",
      scoring:
        "A played hand scores chips × mult; hand levels, ordered cards, ordered jokers, held cards, modifiers and boss effects affect the result. Random outcomes are determined only when executing.",
      hand: "Play 1-5 cards for one hand, or discard 1-5 cards for one discard and replacement cards. cardIds order sets played card order. Boss restrictions are in state.constraints and state.blind.boss.",
      economy:
        "Unused hands, blind rewards, eligible interest, gold held cards and joker payouts fund the shop. Shop prices, sell values and current reroll cost are exposed in get_state.",
      tools: toolDescriptions,
      concurrency:
        "Every mutation requires sessionId and expectedRevision. On stale_revision re-read state. accepted is an execution acknowledgement, not completion of scoring. Wait for ready=true before the next action; wait timeouts do not imply readiness.",
      observation:
        "Hidden hand cards and face-down jokers are redacted. Unopened pack contents, future shop offers, random state and draw order are never exposed.",
      enhancements: (() => {
        const t = i18n.getFixedT("en");
        return ENHANCEMENT_KINDS.map((kind) => ({
          kind,
          name: enhancementName(t, kind),
          description: enhancementDescription(t, kind),
        }));
      })(),
      editions: CARD_EDITION_INFO,
      seals: SEAL_KINDS.map((kind) => ({ kind, ...getSealInfo(kind) })),
    };
  const catalogs = {
    hands: HANDS.map((hand) => ({ ...hand, id: hand.label })),
    jokers: createJokerCatalog(),
    consumables: [
      ...createTarotCatalog(),
      ...createPlanetCatalog(),
      ...createSpectralCatalog(),
    ],
    boss: createBossCatalog(),
    decks: createDeckCatalog(),
    stakes: createStakeCatalog(),
    vouchers: VOUCHER_CATALOG,
    tags: createTagCatalog(),
  };
  const items = catalogs[topic];
  return { topic, items: id ? items.filter((item) => item.id === id) : items };
}
