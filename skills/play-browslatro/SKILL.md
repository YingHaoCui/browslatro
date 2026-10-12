---
name: play-browslatro
description: Play or take over a Browslatro browser game through its MCP tools using the harness's existing agent loop. Use when asked to play Browslatro, control its cards and shop, or exercise an agent against this game environment.
---

# Play Browslatro through MCP

Use the connected Browslatro MCP tools as the game environment. The harness owns model calls, reasoning and memory; the game owns rules, randomness and execution. You may observe, query rules and think without taking an action on every model turn.

## Connect and choose the game

Discover the Browslatro MCP tools and call `list_games`. Select the user's specified session; if exactly one session exists, use it. If several sessions exist and the intended game is unclear, ask which one to control before modifying any of them. If tools are unavailable or no session is listed, read [references/setup.md](references/setup.md) for connection instructions. The user must enable MCP control in the browser; do not bypass that opt-in.

Read `get_rules` with topic `overview` and `get_state`. Query other rule topics by exact item ID as needed. Current state carries dynamic effects and counters; catalog descriptions alone do not describe a scaled joker's current value. This is Browslatro's implemented rule set, which can differ from original Balatro.

## Observe, plan and act

- Treat `sessionId`, `revision`, `phase`, `ready` and `availableTools` as authoritative. Every modifying tool call needs `sessionId` and the latest `expectedRevision`. Serialize mutations; parallel mutations against the same revision conflict.
- Use current hand IDs and item indices, not remembered positions. `play_hand.cardIds` order sets played card order. `targetCardIds` order sets left/right target order, including Death. `reorder_jokers.indices` must be a complete permutation of current joker indices.
- Plan for the run: consider the remaining score target, hands and discards, held effects, joker order and synergies, money, interest, deck composition and upcoming boss. Use the actual tool schemas instead of inventing commands or restricting yourself to a fixed move shortlist.
- Respect observation boundaries. A face-down card's ID does not reveal its rank or suit. Deck composition describes the whole owned deck, not the remaining draw order. Unopened pack contents and future random outcomes are unavailable. Maintain legitimate memory from earlier observations without accessing files, browser internals or dev cheats to reveal hidden state.

Use the phase to route actions:

| Phase          | Relevant tools                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| `new_run`      | `start_run` using requested deck/stake, or defaults                                                          |
| `blind_select` | `select_blind` to play, skip a non-boss blind, or pay for an eligible boss reroll                            |
| `hand`         | `play_hand`, `discard_cards`, `use_consumable`, `reorder_jokers`; `shop_action` supports selling owned items |
| `round_won`    | `continue_round` with `collect`                                                                              |
| `shop`         | `shop_action`, `use_consumable`, `reorder_jokers`                                                            |
| `pack`         | `pack_action` with option index and any required targets; manage owned items as permitted                    |
| `joker_grant`  | `continue_round` with `acknowledge_jokers`                                                                   |
| `animating`    | Observe or wait; do not modify the game                                                                      |
| `won` / `lost` | Report the outcome; start another run or choose endless only if within the user's requested scope            |

## Completion and recovery

`status=accepted` acknowledges submission, not finished scoring or replacement cards. If the returned state has `ready=false`, call `wait_for_state_change` with its revision as `afterRevision` and `readyOnly=true`. Check the returned readiness even when the wait times out. Synchronous actions with `ready=true` need no extra wait. The revision may jump by more than one for a single action.

- `stale_revision`: re-read the current state and reconsider. A player or another client may have changed it.
- `busy`: wait until ready, then decide using the new revision.
- `invalid_arguments`, `illegal_action`, `wrong_phase`: inspect the returned explanation, state and relevant schema/rules; correct the action rather than repeating it unchanged.
- `session_not_found`, `disconnected`: re-list games and resolve the current session. Reconnection creates a new sessionId.
- `browser_timeout`, `bridge_unavailable`, `cancelled`: the action may already have executed. Inspect state before issuing another mutation; do not blindly replay the previous call.

If the connection remains unavailable or the same action fails after correction, stop issuing mutations and explain the specific blocker. Stop when the user's requested endpoint is reached, on a terminal result unless further runs were requested, or when the user asks to stop. Do not start another run automatically just because the last run lost.

Keep player updates brief: consequential decisions, blockers and the final outcome. Use the harness and gateway's existing tracing for diagnostics; do not add a separate model loop or test dashboard to the game.
