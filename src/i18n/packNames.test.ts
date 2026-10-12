import i18n from "./index";
import { localizedPackName } from "./packNames";

const t = i18n.getFixedT("en");

describe("localizedPackName", () => {
  test("composes the normal celestial pack name in English", () => {
    expect(localizedPackName(t, "celestial", "normal")).toBe("Celestial Pack");
  });

  test("composes the jumbo arcana pack name in English", () => {
    expect(localizedPackName(t, "arcana", "jumbo")).toBe("Jumbo Arcana Pack");
  });

  test("composes the mega standard pack name in English", () => {
    expect(localizedPackName(t, "standard", "mega")).toBe("Mega Standard Pack");
  });
});
