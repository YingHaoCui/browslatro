import type { TFunction } from "i18next";
import { createBossCatalog } from "../items/bosses";
import { createDeckCatalog } from "../items/decks";
import { formatNumber } from "../utils/formatNumber";
import { formatScoringEvent, type ScoringEvent } from "../scoring/scoringTrace";
import { en } from "./locales/en";
import { localizedContentString } from "./localeContent";
import { localizedRule } from "./ruleLabels";
import { localizedJokerName } from "./jokerOverrides";
import { tHandLabel } from "./handLabels";

function traceText(
  locale: string,
  key: string,
  fallback: string,
  values: Record<string, string> = {},
) {
  return localizedContentString(locale, "traceText", key, fallback).replace(
    /\{\{(\w+)\}\}/g,
    (match, name: string) => values[name] ?? match,
  );
}

const ruleSpecs = [...createBossCatalog(), ...createDeckCatalog()];
const jokerNames = Object.entries(en.jokerNames);

function sourceName(t: TFunction, locale: string, source: string): string {
  if (source === "+4 Mult") return localizedJokerName(locale, "plus-four-mult", source);
  const joker = jokerNames.find(([, name]) => name === source);
  if (joker) return localizedJokerName(locale, joker[0], source);
  const rule = ruleSpecs.find((spec) => spec.name === source);
  if (rule) return localizedRule(locale, rule).name;
  const labels: Record<string, keyof typeof en.cardLabels> = {
    Stone: "enhancementStone",
    Bonus: "enhancementBonus",
    Mult: "enhancementMult",
    Glass: "enhancementGlass",
    "Gold enhancement": "enhancementGold",
    Steel: "enhancementSteel",
    "Gold Seal": "sealGold",
    Foil: "editionFoil",
    Holographic: "editionHolographic",
    Polychrome: "editionPolychrome",
  };
  if (labels[source]) return t(`cardLabels.${labels[source]}`);
  if (source === "Small Blind") return t("blinds.smallBlind");
  if (source === "Big Blind") return t("blinds.bigBlind");
  if (source === "Boss Blind") return t("blinds.bossBlind");
  const fixed: Record<string, string> = {
    "Glass roll": "glassRoll",
    "Lucky proc": "luckyProc",
    "Lucky money proc": "luckyMoneyProc",
    "Gold enhancement held": "goldHeld",
    "Steel held": "steelHeld",
    "Apply Modifiers (dev)": "modifiers",
  };
  if (fixed[source]) return traceText(locale, fixed[source], source);
  return source;
}

export function localizedTraceSource(
  t: TFunction,
  locale: string,
  source: string,
): string {
  const patterns: Array<
    [RegExp, string, (match: RegExpMatchArray) => Record<string, string>]
  > = [
    [/^Interest on \$(.+)$/, "interest", (m) => ({ money: m[1] })],
    [/^(.+) rank$/, "rank", (m) => ({ card: m[1] })],
    [
      /^(.+) on (.+)$/,
      "on",
      (m) => ({ name: sourceName(t, locale, m[1]), card: m[2] }),
    ],
    [
      /^(Gold enhancement|Steel): (.+) held$/,
      "held",
      (m) => ({ name: sourceName(t, locale, m[1]), card: m[2] }),
    ],
    [
      /^(Foil|Holographic|Polychrome) (.+)$/,
      "on",
      (m) => ({ name: sourceName(t, locale, m[1]), card: m[2] }),
    ],
    [/^(.+) reward$/, "reward", (m) => ({ name: sourceName(t, locale, m[1]) })],
    [/^Remaining hands × \$(.+)$/, "remainingHands", (m) => ({ money: m[1] })],
    [
      /^Remaining hands \+ discards × \$(.+)$/,
      "remainingResources",
      (m) => ({ money: m[1] }),
    ],
    [
      /^Observatory: (\d+) matching Planets?$/,
      "observatory",
      (m) => ({ count: m[1] }),
    ],
    [
      /^(.+): (\d+) cards played$/,
      "cardsPlayed",
      (m) => ({ name: sourceName(t, locale, m[1]), count: m[2] }),
    ],
  ];
  for (const [pattern, key, values] of patterns) {
    const match = source.match(pattern);
    if (match) return traceText(locale, key, source, values(match));
  }
  return sourceName(t, locale, source);
}

function localizedAdjustment(
  t: TFunction,
  locale: string,
  description: string,
): string {
  const hand = (name: string) => tHandLabel(t, name);
  let match = description.match(/^(.+) adjusted to (.+) × (.+) \(Lv (\d+)\)$/);
  if (match)
    return traceText(locale, "adjusted", description, {
      hand: hand(match[1]),
      chips: match[2],
      mult: match[3],
      level: match[4],
    });
  match = description.match(
    /^(.+) zeroed to 0 × 0 \(needs (\d+) cards, played (\d+)\)$/,
  );
  if (match)
    return traceText(locale, "zeroed", description, {
      hand: hand(match[1]),
      required: match[2],
      played: match[3],
    });
  match = description.match(/^(.+) voided — locked to (.+)$/);
  if (match)
    return traceText(locale, "voidLocked", description, {
      hand: hand(match[1]),
      locked: hand(match[2]),
    });
  match = description.match(/^(.+) voided — no repeat hand types$/);
  if (match)
    return traceText(locale, "voidRepeat", description, {
      hand: hand(match[1]),
    });
  return description;
}

export function localizedScoringEvent(
  t: TFunction,
  locale: string,
  event: ScoringEvent,
): string {
  const values: Record<string, string> = {};
  if ("source" in event)
    values.source = localizedTraceSource(t, locale, event.source);
  if ("handLabel" in event) values.hand = tHandLabel(t, event.handLabel);
  if ("level" in event) values.level = String(event.level);
  if ("amount" in event)
    values.amount =
      event.kind === "money-delta"
        ? `${event.amount >= 0 ? "+" : "-"}$${formatNumber(Math.abs(event.amount))}`
        : `${event.amount >= 0 ? "+" : ""}${formatNumber(event.amount)}`;
  if ("chips" in event) values.chips = formatNumber(event.chips);
  if ("mult" in event) values.mult = formatNumber(event.mult);
  if ("factor" in event) values.factor = formatNumber(event.factor);
  if ("cardLabel" in event) values.card = event.cardLabel;
  if ("balanced" in event) values.balanced = formatNumber(event.balanced);
  if ("description" in event)
    values.description = localizedAdjustment(t, locale, event.description);
  return traceText(locale, event.kind, formatScoringEvent(event), values);
}

export function localizedBaseValues(
  locale: string,
  chips: number,
  mult: number,
): string {
  return traceText(
    locale,
    "baseValues",
    `+${formatNumber(chips)} Chips, +${formatNumber(mult)} Mult`,
    {
      chips: formatNumber(chips),
      mult: formatNumber(mult),
    },
  );
}
