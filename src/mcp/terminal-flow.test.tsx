import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { useGame } from "../store/game";
import GameSessionProvider from "../components/game/GameSessionProvider";
import { useGameSession } from "../components/game/gameSession";
import { useGameModals } from "../hooks/useGameModals";
import { GameController } from "./controller";
import type { ToolName } from "./protocol";

function wrapper({ children }: { children: ReactNode }) {
  return <GameSessionProvider>{children}</GameSessionProvider>;
}

beforeEach(() => {
  useGame.getState().resetGame();
  useGame.setState({ pendingRunSelect: false, pendingBlindSelect: false });
});

function setup() {
  const { result } = renderHook(
    () => {
      const session = useGameSession();
      const modals = useGameModals(session.startNewGame);
      return { session, modals };
    },
    { wrapper },
  );
  const controller = new GameController(
    () => useGame.getState(),
    () => ({
      session: result.current.session,
      shop: undefined,
      pickFromOpenedPack: vi.fn(),
      useConsumable: vi.fn(),
      dismissRoundWon: result.current.modals.dismissRoundWon,
    }),
    (action) => flushSync(action),
  );
  controller.sessionId = "terminal-flow";
  const mutate = (tool: ToolName, args: Record<string, unknown> = {}) => {
    act(() => {
      const response = controller.call(tool, {
        sessionId: controller.sessionId,
        expectedRevision: controller.revision,
        ...args,
      });
      expect(response.ok, JSON.stringify(response.error)).toBe(true);
    });
    return controller.observe();
  };
  return { controller, mutate };
}

test("MCP can restart after consecutive losses and play the next blind", () => {
  const { controller, mutate } = setup();
  for (let run = 0; run < 2; run += 1) {
    act(() => {
      useGame.getState().setPendingLose({ roundScore: 10, requiredScore: 300 });
    });
    expect(controller.observe().phase).toBe("lost");
    expect(controller.observe().availableTools).toContain("start_run");
    expect(mutate("start_run", { deck: "blue-deck", stake: "red" }).phase).toBe(
      "blind_select",
    );
    expect(useGame.getState().pendingLose).toBeNull();
    expect(useGame.getState().pendingWin).toBeNull();
    expect(useGame.getState().selectedDeck).toBe("blue-deck");
    expect(useGame.getState().selectedStake).toBe("red");
    expect(mutate("select_blind", { action: "play" }).phase).toBe("hand");
  }
  mutate("play_hand", { cardIds: [useGame.getState().dealt.hand[0].id] });
  expect(controller.observe().ready).toBe(false);
});

const winInfo = {
  roundScore: 400,
  requiredScore: 300,
  baseReward: 3,
  walletAtPayout: 0,
  interestWallet: 0,
  interest: 0,
  goldHeldCount: 0,
  remainingHandsCount: 0,
};

test("MCP collects a round win and reaches the shop", () => {
  useGame.getState().setPendingWin(winInfo);
  const { mutate } = setup();
  expect(mutate("continue_round", { action: "collect" }).phase).toBe("shop");
  expect(useGame.getState().pendingWin).toBeNull();
});

test.each(["restart", "endless"])(
  "MCP collects the final boss reward and chooses %s",
  (action) => {
    useGame.setState({ ante: 8, blind: 3, pendingWin: winInfo });
    const { mutate } = setup();
    expect(mutate("continue_round", { action: "collect" }).phase).toBe("won");
    const state =
      action === "restart"
        ? mutate("start_run")
        : mutate("continue_round", { action: "endless" });
    expect(useGame.getState().pendingGameWon).toBeNull();
    expect(state.phase).toBe(action === "restart" ? "blind_select" : "shop");
    expect(state.ready).toBe(true);
  },
);
