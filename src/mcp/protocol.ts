import { z } from "zod";

const session = {
  sessionId: z.string().min(1).describe("Session ID from list_games"),
};
const revision = {
  ...session,
  expectedRevision: z
    .number()
    .int()
    .nonnegative()
    .describe("Revision from the latest get_state; stale actions are rejected"),
};
const cardIds = z
  .array(z.number().int().nonnegative())
  .min(1)
  .max(5)
  .refine((ids) => new Set(ids).size === ids.length, "Card IDs must be unique");
const targets = z
  .array(z.number().int().nonnegative())
  .max(5)
  .default([])
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Target IDs must be unique",
  );
const index = z.number().int().nonnegative();

export const toolSchemas = {
  list_games: z.object({}).strict(),
  get_state: z.object(session).strict(),
  get_rules: z
    .object({
      ...session,
      topic: z
        .enum([
          "overview",
          "hands",
          "jokers",
          "consumables",
          "boss",
          "decks",
          "stakes",
          "vouchers",
          "tags",
        ])
        .default("overview"),
      id: z.string().optional(),
    })
    .strict(),
  start_run: z
    .object({
      ...revision,
      deck: z
        .enum([
          "red-deck",
          "blue-deck",
          "yellow-deck",
          "green-deck",
          "black-deck",
          "magic-deck",
          "nebula-deck",
          "ghost-deck",
          "abandoned-deck",
          "checkered-deck",
          "zodiac-deck",
          "painted-deck",
          "anaglyph-deck",
          "plasma-deck",
          "erratic-deck",
        ])
        .default("red-deck"),
      stake: z
        .enum([
          "white",
          "red",
          "green",
          "black",
          "blue",
          "purple",
          "orange",
          "gold",
        ])
        .default("white"),
    })
    .strict(),
  play_hand: z.object({ ...revision, cardIds }).strict(),
  discard_cards: z.object({ ...revision, cardIds }).strict(),
  select_blind: z
    .object({ ...revision, action: z.enum(["play", "skip", "reroll_boss"]) })
    .strict(),
  shop_action: z
    .object({
      ...revision,
      action: z.enum([
        "buy",
        "buy_voucher",
        "sell_joker",
        "sell_consumable",
        "reroll",
        "leave",
      ]),
      index: index.optional(),
    })
    .strict(),
  use_consumable: z
    .object({ ...revision, index, targetCardIds: targets })
    .strict(),
  pack_action: z
    .object({
      ...revision,
      action: z.enum(["pick", "skip"]),
      index: index.optional(),
      targetCardIds: targets,
    })
    .strict(),
  reorder_jokers: z
    .object({ ...revision, indices: z.array(index).min(1).max(16) })
    .strict(),
  continue_round: z
    .object({
      ...revision,
      action: z.enum(["collect", "acknowledge_jokers", "endless"]),
    })
    .strict(),
  wait_for_state_change: z
    .object({
      ...session,
      afterRevision: z.number().int().nonnegative(),
      readyOnly: z.boolean().default(true),
      timeoutMs: z.number().int().min(1).max(30_000).default(10_000),
    })
    .strict(),
} as const;

export type ToolName = keyof typeof toolSchemas;
export const toolDescriptions: Record<ToolName, string> = {
  list_games:
    "List browser game sessions that explicitly enabled MCP control. Choose a sessionId before using other tools.",
  get_state:
    "Read the current player-visible game state, revision, phase, readiness and available tools. Hidden cards and future random results are withheld.",
  get_rules:
    "Query actual game rules and item catalogs by topic, optionally by exact item ID. Read overview first; get_state contains current dynamic effects.",
  start_run:
    "Start a run from the new-run screen or a terminal win/loss. Does not reset an active run.",
  play_hand:
    "Play any valid selection of 1-5 current hand card IDs. Card ID order sets played card order. Accepted does not mean scoring has finished; use wait_for_state_change.",
  discard_cards:
    "Discard 1-5 current hand cards, consuming one discard. Wait for replacement cards before acting again.",
  select_blind:
    "Play or skip the current blind, or reroll the boss with the required voucher and funds. Boss blinds cannot be skipped.",
  shop_action:
    "Buy a shop offer or voucher, sell an owned joker or consumable, reroll at the engine's price, or leave. Index is required for item actions.",
  use_consumable:
    "Use an owned consumable by index; provide targetCardIds for targeted effects. Target order determines left/right for Death.",
  pack_action:
    "Pick an unpicked pack option by index, with targetCardIds if required, or skip the rest of the pack.",
  reorder_jokers:
    "Reorder all owned jokers by a complete permutation of their current indices. Joker order affects scoring.",
  continue_round:
    "Collect round rewards and enter the shop, acknowledge granted jokers, or continue a won game in endless mode.",
  wait_for_state_change:
    "Wait for a revision newer than afterRevision, optionally only when ready. Timeout returns the latest state; do not assume it became ready.",
};

export interface ToolResult {
  readonly ok: boolean;
  readonly status?: "accepted" | "ready" | "changed" | "timeout";
  readonly error?: { readonly code: string; readonly message: string };
  readonly state?: GameObservation;
  readonly [key: string]: unknown;
}

export interface GameObservation {
  readonly sessionId: string;
  readonly revision: number;
  readonly phase: string;
  readonly ready: boolean;
  readonly [key: string]: unknown;
}

export function failure(
  code: string,
  message: string,
  state?: GameObservation,
): ToolResult {
  return { ok: false, error: { code, message }, ...(state ? { state } : {}) };
}

export function isToolName(value: string): value is ToolName {
  return Object.hasOwn(toolSchemas, value);
}
