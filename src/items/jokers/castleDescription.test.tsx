import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  castleDescriptionNode,
  castleDescriptionText,
} from "./castleDescription";
import i18n from "../../i18n";

const t = i18n.getFixedT("en");

describe("castleDescriptionText", () => {
  test("appends the current suit glyph and name when a suit is set", () => {
    expect(castleDescriptionText(t, "Base", "hearts", "Hearts")).toBe(
      "Base — Currently: ♥ Hearts",
    );
  });

  test("shows the descriptive placeholder when no suit is set", () => {
    expect(castleDescriptionText(t, "Base", null, null)).toBe(
      "Base — Suit is chosen when the blind starts",
    );
  });
});

describe("castleDescriptionNode", () => {
  test("renders the suit name inside its suit-colored element", () => {
    const { container } = render(
      <>{castleDescriptionNode(t, "Base", "clubs", "Clubs")}</>,
    );
    expect(container.querySelector(".castle-suit-clubs")?.textContent).toBe(
      "♣ Clubs",
    );
  });

  test("shows the descriptive placeholder when no suit is set", () => {
    const { container } = render(
      <>{castleDescriptionNode(t, "Base", null, null)}</>,
    );
    expect(container.textContent).toBe(
      "Base — Suit is chosen when the blind starts",
    );
  });
});
