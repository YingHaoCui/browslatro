import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  toDoListDescriptionText,
  toDoListDescriptionNode,
} from "./toDoListDescription";
import i18n from "../../i18n";

const t = i18n.getFixedT("en");
const BASE = "Earn $4 if poker hand is the listed hand; hand changes every round";

describe("toDoListDescriptionText", () => {
  test("appends the hand name when todoHand is set", () => {
    expect(toDoListDescriptionText(t, BASE, "Two Pair")).toBe(
      `${BASE} — Currently: Two Pair`,
    );
  });

  test("appends ??? placeholder when todoHand is null", () => {
    expect(toDoListDescriptionText(t, BASE, null)).toBe(
      `${BASE} — Currently: ???`,
    );
  });
});

describe("toDoListDescriptionNode", () => {
  test("renders the hand name in a bold element when todoHand is set", () => {
    render(<>{toDoListDescriptionNode(t, BASE, "Flush")}</>);
    const strong = screen.getByText("Flush");
    expect(strong.tagName).toBe("STRONG");
  });

  test("renders ??? in a bold element when todoHand is null", () => {
    render(<>{toDoListDescriptionNode(t, BASE, null)}</>);
    const strong = screen.getByText("???");
    expect(strong.tagName).toBe("STRONG");
  });

  test("renders the base description text alongside the suffix", () => {
    render(<>{toDoListDescriptionNode(t, BASE, "Pair")}</>);
    expect(screen.getByText(/Earn \$4/)).toBeInTheDocument();
  });
});
