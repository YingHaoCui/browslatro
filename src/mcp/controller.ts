import type { GameState } from "../store/game";
import type { GameSessionActions } from "../components/game/gameSession";
import type { ShopProps } from "../components/shop/Shop";
import { canSellJoker, canAddJokerToRow } from "../items/jokers";
import { jokerCapacityFor } from "../items/capacities";
import {
  applyShopDiscount,
  BOSS_REROLL_COST,
  bossRerollsRemaining,
} from "../items/vouchers";
import { observeGame, phaseOf, currentRerollCost } from "./observation";
import {
  toolSchemas,
  failure,
  type ToolName,
  type ToolResult,
} from "./protocol";
import { queryRules } from "./rules";
import {
  GameActionError,
  requireAction,
  validateCards,
  validateConsumable,
} from "./validation";

export interface GameCommands {
  readonly session: GameSessionActions;
  readonly shop: ShopProps | undefined;
  readonly pickFromOpenedPack: (index: number) => void;
  readonly useConsumable: (index: number) => void;
  readonly dismissRoundWon: () => void;
}

export class GameController {
  revision = 0;
  sessionId = "";
  private executing = false;
  constructor(
    private readonly getState: () => GameState,
    private readonly commands: () => GameCommands,
    private readonly commit: (action: () => void) => void,
  ) {}

  changed(): void {
    this.revision += 1;
  }
  observe() {
    return observeGame(
      this.getState(),
      this.commands().session.isScoring,
      this.sessionId,
      this.revision,
    );
  }

  call(tool: ToolName, input: unknown): ToolResult {
    const parsed = toolSchemas[tool].safeParse(input);
    if (!parsed.success)
      return failure("invalid_arguments", parsed.error.message, this.observe());
    try {
      const args = parsed.data as {
        sessionId?: string;
        expectedRevision?: number;
      };
      requireAction(
        args.sessionId === this.sessionId,
        "Game session changed. Call list_games again.",
        "session_not_found",
      );
      if (tool === "get_state") return { ok: true, state: this.observe() };
      if (tool === "get_rules") return { ok: true, rules: queryRules(input) };
      requireAction(
        args.expectedRevision === this.revision,
        "Game state changed. Read get_state and reconsider the action.",
        "stale_revision",
      );
      requireAction(
        !this.executing && this.observe().ready,
        "Wait for the current animation/action to finish.",
        "busy",
      );
      this.executing = true;
      try {
        this.execute(tool, input);
      } finally {
        this.executing = false;
      }
      return { ok: true, status: "accepted", state: this.observe() };
    } catch (error) {
      return failure(
        error instanceof GameActionError ? error.code : "execution_error",
        error instanceof Error ? error.message : "Action failed.",
        this.observe(),
      );
    }
  }

  private execute(tool: ToolName, input: unknown): void {
    const s = this.getState();
    const phase = phaseOf(s, this.commands().session.isScoring);
    const at = (...phases: string[]) =>
      requireAction(
        phases.includes(phase),
        `Action is unavailable during ${phase}.`,
        "wrong_phase",
      );
    const select = (ids: readonly number[], preview = false) =>
      this.commit(() => {
        if (preview) {
          s.setPackPreviewSelectedIds(new Set(ids));
          s.setPackPreviewDisplayOrder([
            ...ids,
            ...s.packPreviewHand
              .map((card) => card.id)
              .filter((id) => !ids.includes(id)),
          ]);
        } else {
          s.selectCards(ids);
          s.setHandDisplayOrder([
            ...ids,
            ...s.dealt.hand
              .map((card) => card.id)
              .filter((id) => !ids.includes(id)),
          ]);
        }
      });
    switch (tool) {
      case "start_run": {
        at("new_run", "lost", "won");
        const args = toolSchemas.start_run.parse(input);
        if (phase !== "new_run")
          this.commit(() => this.commands().session.startNewGame());
        this.commit(() =>
          this.commands().session.confirmRunSelection({
            deck: args.deck,
            stake: args.stake,
          }),
        );
        return;
      }
      case "play_hand":
      case "discard_cards": {
        at("hand");
        const args = toolSchemas[tool].parse(input);
        validateCards(args.cardIds, s.dealt.hand);
        if (tool === "play_hand") {
          requireAction(s.remainingHands > 0, "No hands remaining.");
          const count = (
            this.observe().constraints as {
              requiredPlayedCardCount: number | null;
            }
          ).requiredPlayedCardCount;
          requireAction(
            count === null || count === args.cardIds.length,
            `Boss requires exactly ${count} played cards.`,
          );
          requireAction(
            s.forcedCardId === null || args.cardIds.includes(s.forcedCardId),
            "Boss requires the forced card to be played.",
          );
        } else requireAction(s.remainingDiscards > 0, "No discards remaining.");
        select(args.cardIds);
        this.commit(() => {
          if (tool === "play_hand") this.commands().session.submitHand();
          else this.commands().session.discardSelected();
        });
        return;
      }
      case "select_blind": {
        at("blind_select");
        const args = toolSchemas.select_blind.parse(input);
        if (args.action === "skip")
          requireAction(s.blind !== 3, "Boss blinds cannot be skipped.");
        if (args.action === "reroll_boss")
          requireAction(
            bossRerollsRemaining(s.ownedVoucherIds, s.bossRerollsUsedThisAnte) >
              0 && s.money >= BOSS_REROLL_COST,
            "Boss reroll requires a voucher and sufficient funds.",
          );
        this.commit(() => {
          if (args.action === "play")
            this.commands().session.confirmBlindSelect();
          else if (args.action === "skip") this.commands().session.skipBlind();
          else requireAction(s.rerollBoss(), "Boss reroll failed.");
        });
        return;
      }
      case "shop_action": {
        const args = toolSchemas.shop_action.parse(input);
        const selling = args.action.startsWith("sell_");
        at(...(selling ? ["shop", "hand", "pack"] : ["shop"]));
        const idx = args.index;
        if (!["reroll", "leave"].includes(args.action))
          requireAction(idx !== undefined, "Item index is required.");
        this.commit(() => {
          switch (args.action) {
            case "buy":
              requireAction(
                s.buyShopOffer(idx!),
                "Offer cannot be purchased (sold, insufficient funds or capacity).",
              );
              break;
            case "buy_voucher": {
              const voucher = s.currentAnteVouchers[idx!];
              requireAction(
                voucher &&
                  !s.soldVoucherIds.has(voucher.id) &&
                  (!voucher.requires ||
                    s.ownedVoucherIds.has(voucher.requires)) &&
                  s.money >= applyShopDiscount(voucher.cost, s.ownedVoucherIds),
                "Voucher cannot be purchased.",
              );
              s.buyAnteVoucher(idx!);
              break;
            }
            case "sell_joker":
              requireAction(
                s.jokers[idx!] && canSellJoker(s.jokers[idx!]),
                "Joker is absent or cannot be sold.",
              );
              s.sellJoker(idx!);
              break;
            case "sell_consumable":
              requireAction(s.consumables[idx!], "Consumable is absent.");
              s.sellConsumable(idx!);
              break;
            case "reroll": {
              const cost = currentRerollCost(s);
              requireAction(s.money >= cost, "Cannot afford a reroll.");
              s.rerollShopOffers(cost);
              break;
            }
            case "leave":
              requireAction(this.commands().shop, "Shop is unavailable.");
              this.commands().shop?.onNext();
              break;
          }
        });
        return;
      }
      case "use_consumable": {
        at("hand", "shop", "pack");
        const args = toolSchemas.use_consumable.parse(input);
        const item = s.consumables[args.index];
        requireAction(item, "Consumable is absent.");
        const preview = s.openedPack !== null && s.packPreviewHand.length > 0;
        validateConsumable(s, item, args.targetCardIds, preview);
        select(args.targetCardIds, preview);
        this.commit(() => this.commands().useConsumable(args.index));
        return;
      }
      case "pack_action": {
        at("pack");
        const args = toolSchemas.pack_action.parse(input);
        if (args.action === "skip") {
          this.commit(() => s.closeOpenedPack());
          return;
        }
        requireAction(
          args.index !== undefined,
          "Pack option index is required.",
        );
        const option = s.openedPack?.options[args.index];
        requireAction(
          option &&
            s.packPicksRemaining > 0 &&
            !s.pickedPackOptionIndices.has(args.index),
          "Pack option is absent or already picked.",
        );
        if (option.kind === "joker")
          requireAction(
            canAddJokerToRow(
              s.jokers,
              option.joker,
              jokerCapacityFor(s.ownedVoucherIds, s.selectedDeck),
            ),
            "Joker slots are full.",
          );
        if (option.kind === "tarot")
          validateConsumable(
            s,
            { kind: "tarot", card: option.tarot },
            args.targetCardIds,
            s.packPreviewHand.length > 0,
            true,
          );
        else if (option.kind === "spectral")
          validateConsumable(
            s,
            { kind: "spectral", card: option.spectral },
            args.targetCardIds,
            s.packPreviewHand.length > 0,
            true,
          );
        else
          requireAction(
            args.targetCardIds.length === 0,
            "This option does not accept targets.",
          );
        select(args.targetCardIds, s.packPreviewHand.length > 0);
        this.commit(() => this.commands().pickFromOpenedPack(args.index!));
        return;
      }
      case "reorder_jokers": {
        at("hand", "shop", "pack");
        const { indices } = toolSchemas.reorder_jokers.parse(input);
        requireAction(
          indices.length === s.jokers.length &&
            new Set(indices).size === indices.length &&
            indices.every((idx) => s.jokers[idx]),
          "Provide a complete permutation of current joker indices.",
        );
        this.commit(() =>
          s.reorderJokers(indices.map((idx) => s.jokers[idx].id)),
        );
        return;
      }
      case "continue_round": {
        const { action } = toolSchemas.continue_round.parse(input);
        if (action === "collect") {
          at("round_won");
          this.commit(() => this.commands().dismissRoundWon());
        } else if (action === "endless") {
          at("won");
          this.commit(() => s.continueEndless());
        } else {
          at("joker_grant");
          this.commit(() => s.setPendingJokerGrantIds([]));
        }
        return;
      }
      default:
        throw new GameActionError(
          "unknown_tool",
          "Tool is handled by the MCP bridge, not the game controller.",
        );
    }
  }
}
