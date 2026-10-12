import i18n from ".";
import { createDeckCatalog } from "../items/decks";
import { createStakeCatalog } from "../items/stakes";
import { createBossCatalog } from "../items/bosses";
import { createTagCatalog } from "../items/tags";
import { localizedRule, localizedSkipOffer } from "./ruleLabels";
import { localizedJokerDescription } from "./jokerOverrides";
import {
  localizedBaseValues,
  localizedScoringEvent,
  localizedTraceSource,
} from "./scoringTrace";
import { formatScoringEvent, type ScoringEvent } from "../scoring/scoringTrace";
import { zh } from "./locales/zh";

beforeAll(async () => {
  await i18n.changeLanguage("zh");
});
afterAll(async () => {
  await i18n.changeLanguage("en");
});

test.each([
  ...createDeckCatalog(),
  ...createStakeCatalog(),
  ...createBossCatalog(),
  ...createTagCatalog(),
])("Chinese rules cover $id without changing catalog data", (spec) => {
  const display = localizedRule("zh", spec);
  expect(display.name).toMatch(/[\u4e00-\u9fff]/);
  expect(display.description).toMatch(/[\u4e00-\u9fff]/);
  expect(display.name).not.toBe(spec.name);
  expect(display.description).not.toBe(spec.description);
  expect(localizedRule("en", spec)).toEqual(spec);
});

test("orbital skip reward keeps the actual rolled hand", () => {
  expect(
    localizedSkipOffer(i18n.getFixedT("zh"), "zh", {
      id: "orbital",
      orbitalHand: "Full House",
    }),
  ).toMatchObject({ name: "轨道标签", description: "将葫芦升级 3 级。" });
});

test("all joker descriptions contain no doubled sign or unresolved template", () => {
  for (const id of Object.keys(zh.jokerDescriptions)) {
    const description = localizedJokerDescription("zh", id, "missing");
    expect(description, id).not.toMatch(/\+\+|XX|\{\{/);
  }
  expect(localizedJokerDescription("zh", "plus-four-mult", "")).toBe("+4 倍率");
});

test.each([
  ["9♠ rank", "9♠点数"],
  ["Interest on $10", "资金 $10 的利息"],
  ["Remaining hands × $1", "剩余出牌次数 × $1"],
  ["Remaining hands + discards × $2", "剩余出牌和弃牌次数 × $2"],
  ["Small Blind reward", "小盲注奖励"],
  ["The Tooth: 5 cards played", "牙齿：打出 5 张牌"],
  ["Joker on A♠", "小丑：A♠"],
  ["+4 Mult on A♠", "小丑：A♠"],
  ["Lucky proc on 2♥", "幸运倍率触发：2♥"],
  ["Gold enhancement: K♣ held", "黄金：K♣留在手牌中"],
  ["Observatory: 2 matching Planets", "天文台：2 张对应星球牌"],
])("translates saved trace source %s", (source, expected) => {
  expect(localizedTraceSource(i18n.getFixedT("zh"), "zh", source)).toBe(
    expected,
  );
});

test("trace events can be translated after recording and retain English formatting", () => {
  const event: ScoringEvent = {
    kind: "chips-delta",
    amount: 9,
    source: "9♠ rank",
  };
  expect(localizedScoringEvent(i18n.getFixedT("zh"), "zh", event)).toBe(
    "+9 筹码（9♠点数）",
  );
  expect(localizedScoringEvent(i18n.getFixedT("en"), "en", event)).toBe(
    formatScoringEvent(event),
  );
  expect(localizedBaseValues("zh", 100, 8)).toBe("+100 筹码，+8 倍率");
  expect(i18n.getFixedT("zh")("roundEnd.beatBy")).toBe("超出目标");
  expect(
    localizedScoringEvent(i18n.getFixedT("zh"), "zh", {
      kind: "boss-adjustment",
      source: "The Flint",
      description: "Pair adjusted to 5 × 1 (Lv 1)",
    }),
  ).toBe("对子调整为 5 × 1（等级 1）（燧石）");
});
