import i18n from "./index";
import {
  localizedJokerDescription,
  localizedJokerName,
} from "./jokerOverrides";
import { haw } from "./locales/haw";
import { zh } from "./locales/zh";

describe("lazy locale loading", () => {
  test("does not register haw resources at init", () => {
    expect(i18n.hasResourceBundle("haw", "translation")).toBe(false);
  });

  test("loads haw resources on demand via changeLanguage", async () => {
    await i18n.changeLanguage("haw");
    expect(i18n.hasResourceBundle("haw", "translation")).toBe(true);
  });

  test("translates with the haw bundle after the lazy load", async () => {
    await i18n.changeLanguage("haw");
    expect(i18n.t("app.titleMenu")).toBe(haw.app.titleMenu);
  });

  test("registers the locale content for the override helpers on demand", async () => {
    await i18n.changeLanguage("haw");
    expect(localizedJokerName("haw", "plus-four-mult", "+4 Mult")).toBe("Iōka");
  });

  test("does not register zh resources at init", () => {
    expect(i18n.hasResourceBundle("zh", "translation")).toBe(false);
  });

  test("loads zh resources on demand via changeLanguage", async () => {
    await i18n.changeLanguage("zh");
    expect(i18n.hasResourceBundle("zh", "translation")).toBe(true);
  });

  test("translates with the zh bundle after the lazy load", async () => {
    await i18n.changeLanguage("zh");
    expect(i18n.t("app.titleMenu")).toBe(zh.app.titleMenu);
  });

  test("registers the zh locale content for the override helpers on demand", async () => {
    await i18n.changeLanguage("zh");
    expect(localizedJokerName("zh", "plus-four-mult", "+4 Mult")).toBe("小丑");
  });

  test("registers the zh joker placeholders on demand", async () => {
    await i18n.changeLanguage("zh");
    expect(
      localizedJokerDescription(
        "zh",
        "8-ball",
        "{{prob}} chance for each played {{rank}} to create a {{cardType}} card when scored{{room}}",
      ),
    ).toBe(
      "打出的每张 8 在计分时有 1/4几率生成一张塔罗牌（必须有空位）",
    );
  });

  test("keeps serving en after switching back", async () => {
    await i18n.changeLanguage("zh");
    await i18n.changeLanguage("en");
    expect(i18n.language).toBe("en");
  });
});
