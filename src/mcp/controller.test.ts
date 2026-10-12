import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import { useGame } from "../store/game";
import { createJokerCatalog } from "../items/jokers";
import { createTarotCatalog } from "../items/tarots";
import { createPlanetCatalog } from "../items/planets";
import { GameController, type GameCommands } from "./controller";
import { observeGame } from "./observation";
import { isToolName } from "./protocol";

let commands: GameCommands;
let controller: GameController;
let unsubscribe: () => void;
const card = { id: 101, rank: "A" as const, suit: "spades" as const };
const card2 = { id: 102, rank: "K" as const, suit: "hearts" as const };

beforeEach(() => {
  useGame.getState().resetGame();
  useGame.setState({
    pendingRunSelect: false,
    pendingBlindSelect: false,
    dealt: { hand: [card, card2], remaining: [] },
    handDisplayOrder: [101, 102],
  });
  commands = {
    session: {
      submitHand: vi.fn(() => useGame.getState().setRemainingHands(3)),
      discardSelected: vi.fn(),
      isScoring: false,
      currentScoringId: null,
      currentGoldScoringId: null,
      currentSteelScoringId: null,
      handleCardDiscardEnd: vi.fn(),
      startNewGame: vi.fn(),
      confirmRunSelection: vi.fn(),
      skipBlind: vi.fn(),
      confirmBlindSelect: vi.fn(),
    },
    shop: undefined,
    pickFromOpenedPack: vi.fn(),
    useConsumable: vi.fn(),
    dismissRoundWon: vi.fn(),
  };
  controller = new GameController(
    () => useGame.getState(),
    () => commands,
    (action) => action(),
  );
  controller.sessionId = "game";
  unsubscribe = useGame.subscribe(() => controller.changed());
});
afterEach(() => unsubscribe());
const args = () => ({
  sessionId: "game",
  expectedRevision: controller.revision,
});

describe("MCP game actions", () => {
  test("plays caller-selected cards in caller-selected order", () => {
    const result = controller.call("play_hand", {
      ...args(),
      cardIds: [102, 101],
    });
    expect([
      result.status,
      [...useGame.getState().selectedIds],
      useGame.getState().handDisplayOrder,
      commands.session.submitHand,
    ]).toEqual(["accepted", [102, 101], [102, 101], expect.any(Function)]);
    expect(commands.session.submitHand).toHaveBeenCalledOnce();
  });
  test("rejects stale state before any game mutation", () => {
    const old = args();
    useGame.getState().setMoney(15);
    expect(
      controller.call("play_hand", { ...old, cardIds: [101] }).error?.code,
    ).toBe("stale_revision");
    expect(commands.session.submitHand).not.toHaveBeenCalled();
    expect(useGame.getState().selectedIds.size).toBe(0);
  });
  test("rejects unknown card IDs without modifying selection", () => {
    expect(controller.call("play_hand", { ...args(), cardIds: [999] }).ok).toBe(
      false,
    );
    expect(useGame.getState().selectedIds.size).toBe(0);
  });
  test("rejects duplicate and oversized selections", () => {
    expect(
      controller.call("play_hand", { ...args(), cardIds: [101, 101] }).error
        ?.code,
    ).toBe("invalid_arguments");
    expect(
      controller.call("play_hand", { ...args(), cardIds: [1, 2, 3, 4, 5, 6] })
        .error?.code,
    ).toBe("invalid_arguments");
  });
  test("rejects actions while scoring", () => {
    commands = {
      ...commands,
      session: { ...commands.session, isScoring: true },
    };
    expect(
      controller.call("play_hand", { ...args(), cardIds: [101] }).error?.code,
    ).toBe("busy");
  });
  test("rejects discards while replacement animation is active", () => {
    useGame.getState().setDiscardingIds(new Set([101]));
    expect(
      controller.call("discard_cards", { ...args(), cardIds: [102] }).error
        ?.code,
    ).toBe("busy");
  });
  test("rejects discards without remaining discards", () => {
    useGame.getState().setRemainingDiscards(0);
    expect(
      controller.call("discard_cards", { ...args(), cardIds: [101] }).ok,
    ).toBe(false);
  });
  test("refuses resetting an active run", () => {
    expect(controller.call("start_run", args()).error?.code).toBe(
      "wrong_phase",
    );
  });
  test("rejects boss skips", () => {
    useGame.setState({ pendingBlindSelect: true, blind: 3 });
    expect(
      controller.call("select_blind", { ...args(), action: "skip" }).ok,
    ).toBe(false);
  });
  test("enforces mandatory boss card count and forced card", () => {
    useGame.setState({
      blind: 3,
      currentBoss: {
        ...useGame.getState().currentBoss,
        effect: { kind: "force-card-count", value: 5 },
      },
    });
    expect(controller.call("play_hand", { ...args(), cardIds: [101] }).ok).toBe(
      false,
    );
    useGame.setState({
      currentBoss: {
        ...useGame.getState().currentBoss,
        effect: { kind: "none" },
      },
      forcedCardId: 102,
    });
    expect(controller.call("play_hand", { ...args(), cardIds: [101] }).ok).toBe(
      false,
    );
  });
  test("requires an explicit item index and refuses eternal joker sales", () => {
    useGame.setState({
      shopOffers: [],
      jokers: [{ ...createJokerCatalog()[0], stickers: [{ kind: "eternal" }] }],
    });
    expect(
      controller.call("shop_action", { ...args(), action: "sell_joker" }).ok,
    ).toBe(false);
    expect(
      controller.call("shop_action", {
        ...args(),
        action: "sell_joker",
        index: 0,
      }).ok,
    ).toBe(false);
  });
  test("executes and prices consecutive rerolls from shared state", () => {
    useGame.setState({ shopOffers: [], money: 30 });
    controller.call("shop_action", { ...args(), action: "reroll" });
    controller.call("shop_action", { ...args(), action: "reroll" });
    expect([
      useGame.getState().money,
      useGame.getState().shopRerollCount,
      (controller.observe().shop as { rerollCost: number }).rerollCost,
    ]).toEqual([19, 2, 7]);
  });
  test("allows only complete joker permutations", () => {
    useGame.setState({ jokers: createJokerCatalog().slice(0, 2) });
    expect(
      controller.call("reorder_jokers", { ...args(), indices: [0, 0] }).ok,
    ).toBe(false);
    const first = useGame.getState().jokers[0].id;
    controller.call("reorder_jokers", { ...args(), indices: [1, 0] });
    expect(useGame.getState().jokers[1].id).toBe(first);
  });
  test("validates targeted consumables before touching selection", () => {
    const tarot = createTarotCatalog().find(
      (item) => item.effect.kind === "death-copy",
    )!;
    useGame.setState({ consumables: [{ kind: "tarot", card: tarot }] });
    expect(
      controller.call("use_consumable", {
        ...args(),
        index: 0,
        targetCardIds: [101],
      }).ok,
    ).toBe(false);
    controller.call("use_consumable", {
      ...args(),
      index: 0,
      targetCardIds: [102, 101],
    });
    expect(commands.useConsumable).toHaveBeenCalledWith(0);
    expect(useGame.getState().handDisplayOrder).toEqual([102, 101]);
  });
  test("does not use Fool without a previous consumable", () => {
    const tarot = createTarotCatalog().find(
      (item) => item.effect.kind === "copy-last-consumable",
    )!;
    useGame.setState({
      consumables: [{ kind: "tarot", card: tarot }],
      lastUsedConsumable: null,
    });
    expect(controller.call("use_consumable", { ...args(), index: 0 }).ok).toBe(
      false,
    );
    expect(commands.useConsumable).not.toHaveBeenCalled();
  });
  test("supports pack picks and rejects repeated options", () => {
    useGame.setState({
      openedPack: {
        pool: "celestial",
        variant: "normal",
        options: [{ kind: "planet", planet: createPlanetCatalog()[0] }],
      },
      packPicksRemaining: 1,
    });
    expect(
      controller.call("pack_action", { ...args(), action: "pick", index: 0 })
        .status,
    ).toBe("accepted");
    useGame.getState().setPickedPackOptionIndices(new Set([0]));
    expect(
      controller.call("pack_action", { ...args(), action: "pick", index: 0 })
        .ok,
    ).toBe(false);
  });
});

describe("MCP observations and rules", () => {
  test("redacts face-down cards, joker identities and unopened pack contents", () => {
    useGame.setState({
      blind: 3,
      currentBoss: {
        ...useGame.getState().currentBoss,
        effect: { kind: "flip-shuffle-jokers" },
      },
      jokers: [createJokerCatalog()[0]],
      dealt: {
        hand: [{ ...card, faceDown: true }],
        remaining: [{ id: 500, rank: "Q", suit: "diamonds" }],
      },
      shopOffers: [
        {
          kind: "pack",
          price: 4,
          sold: false,
          pack: {
            pool: "celestial",
            variant: "normal",
            options: [{ kind: "planet", planet: createPlanetCatalog()[0] }],
          },
        },
      ],
    });
    const state = controller.observe();
    expect(state.hand).toEqual([{ id: 101, faceDown: true, debuffed: false }]);
    expect(state.jokers).toEqual([{ index: 0, faceDown: true }]);
    expect(JSON.stringify(state.shop)).not.toContain(
      createPlanetCatalog()[0].name,
    );
    expect(JSON.stringify(state.deck)).not.toContain("500");
  });
  test("observation reads never advance RNG", () => {
    const random = vi.spyOn(Math, "random");
    observeGame(useGame.getState(), false, "game", 1);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });
  test("returns actual rules by item ID and rejects prototype names", () => {
    const id = createJokerCatalog()[0].id;
    const result = controller.call("get_rules", {
      sessionId: "game",
      topic: "jokers",
      id,
    });
    expect(result.ok).toBe(true);
    expect((result.rules as { items: { id: string }[] }).items[0].id).toBe(id);
    expect(isToolName("constructor")).toBe(false);
  });
});
