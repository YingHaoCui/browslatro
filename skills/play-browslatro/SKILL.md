---
name: play-browslatro
description: Play or take over a Browslatro browser game through its MCP tools using the harness's existing agent loop. Use when asked to play Browslatro, control its cards and shop, or exercise an agent against this game environment.
---

# Play Browslatro through MCP

Use the connected Browslatro MCP tools as the game environment. The harness owns model calls, reasoning and memory; the game owns rules, randomness and execution. You may observe, query rules and think without taking an action on every model turn.

## Connect and choose the game

Discover the Browslatro MCP tools and call `list_games`. Select the user's specified session; if exactly one session exists, use it. If several sessions exist and the intended game is unclear, ask which one to control before modifying any of them. If tools are unavailable or no session is listed, read [references/setup.md](references/setup.md) for connection instructions. The user must enable MCP control in the browser; do not bypass that opt-in.

Read `get_rules` with topic `overview` and `get_state`. Query other rule topics by exact item ID as needed. Current state carries dynamic effects and counters; catalog descriptions alone do not describe a scaled joker's current value. This is Browslatro's implemented rule set, which can differ from original Balatro.

## Core game rules

Use the rules below to interpret observations before choosing actions. Read `get_rules(topic="hands")` for level-1 hand values; use the current state's hand levels and values for the run. Read `overview` for enhancement, edition and seal descriptions, and query `consumables`, `jokers` or `boss` by item ID for exact effects, amounts, probabilities and restrictions. These general rules do not replace those live details.

### Hands and scoring cards

Each blind is a score target. Scores from successive played hands add toward that target; running out of hands below the target loses the blind unless an active effect prevents it. A play uses 1–5 cards and one hand; a discard uses one discard to replace selected cards without scoring. Playing fewer than five cards is legal unless a boss says otherwise. Unplayed cards remain held in hand for that play's held effects.

The game chooses one hand label by poker priority, not whichever label currently has the highest upgraded score. The following table lists all labels from lowest to highest priority under normal rules. Suits have equal rank; rank order is 2–10, J, Q, K, A. A can be low in A-2-3-4-5 or high in 10-J-Q-K-A, but a straight cannot wrap through K-A-2.

| Label | Combination | Cards that normally score |
| --- | --- | --- |
| High Card | No higher combination; a single card also qualifies | Highest card only |
| Pair | Two cards of one rank | The pair |
| Two Pair | Two different pairs | Both pairs |
| Three of a Kind | Three cards of one rank | The three matching cards |
| Straight | Five distinct consecutive ranks, suits unrestricted | The straight |
| Flush | Five cards of one suit, ranks unrestricted | The flush |
| Full House | Three of one rank and two of another | All five |
| Four of a Kind | Four cards of one rank | The four matching cards |
| Straight Flush | A straight and flush together | The straight flush |
| Royal Flush | The ace-high straight flush under normal five-card rules | All five; same base values as Straight Flush |
| Five of a Kind | Five cards of one rank | All five |
| Flush House | A full house all of one suit | All five |
| Flush Five | Five cards of one rank and one suit | All five |

Deck changes can create duplicate rank/suit cards, enabling the last three hands. Additional played cards outside the scoring combination are kickers: they are played and removed from hand, but normally contribute no rank chips or when-scored effects. Stone cards do not help detect a hand and have no rank/suit contribution, but always score when played. Effects can change hand requirements or make all played cards score; apply the queried rule instead of assuming the normal table still applies.

A condition that a hand **contains** a combination differs from exact label equality: a Full House can satisfy Pair, Two Pair and Three of a Kind conditions, and a Straight Flush can satisfy Straight and Flush conditions. A higher-priority label does not contain every lower-priority label; a Flush alone does not contain a Pair. Check whether the effect says contains, exact hand type, played cards, scoring cards, or held cards.

### Score calculation and order

An ordinary hand scores `floor(finalChips × finalMult)`. Chips and Mult are separate accumulators; money earned is currency, not score. Start from the detected hand's current base Chips and Mult, including level and boss adjustments. Each scoring card normally adds its rank chips: 2–10 at face value, J/Q/K = 10, A = 11, plus permanent chip bonuses and applicable modifiers. Only the detected label supplies a base; bases for contained combinations are not added together.

For example, an unmodified level-1 Two Pair of 10,10,4,4 with a King kicker scores `(20 + 10 + 10 + 4 + 4) × 2 = 96`; the King does not score.

Distinguish `+Chips`, `+Mult` and `×Mult`. `+10 Mult` adds 10 to the current Mult; `×2 Mult` doubles it. Trigger stage and order matter:

1. Resolve hand detection, current hand level, boss restrictions/debuffs and scoring-card selection. Applicable on-play effects may upgrade the hand, change cards, create items or update scaling counters before scoring.
2. Resolve scoring cards in submitted `cardIds` order, including each card's retriggers. A retrigger repeats that card's scoring and eligible when-scored effects; it does not replay the whole hand or spend another hand. Per-card jokers are checked in equipped left-to-right order for each scoring occurrence.
3. Apply held effects for cards not submitted. In the current implementation, held Steel multipliers precede held-joker steps; held-joker steps retain equipped joker order.
4. Apply ordinary hand-level joker steps left to right. Each step adds its `+Mult` then applies its `×Mult` if both exist; a joker's scoring edition follows its own effect. These steps happen once per hand, unless the effect explicitly specifies another trigger.
5. Apply eligible final modifiers, then multiply Chips by Mult and round down. A deck or other effect that explicitly changes the final formula overrides the ordinary formula. End-of-round rewards and held end-of-round effects resolve only when the blind is cleared.

Browslatro's current final-score calculation groups the **scoring-card stage**: it sums base Mult plus card-stage additive Mult, then multiplies by the product of card-stage enhancement, edition and per-card joker factors. It then applies held Steel, sequential held-joker steps, and sequential ordinary joker steps. Do not infer fully interleaved arithmetic from the card animations, and do not extend this card-stage grouping to the later joker stages. Thus an ordinary `+10 Mult` joker followed by `×2` gives `(M + 10) × 2`, while the reverse gives `M × 2 + 10`.

Debuffed scoring cards can still help form the detected combination but lose their scoring contributions. Bosses can also restrict plays, alter hand values or impose other rules; read the current constraints before estimating a score. Random effects are rolled on execution: distinguish guaranteed score from a possible or expected random bonus.

### Consumables and permanent card changes

- **Tarots** are single-use effects that can modify selected playing cards, change money, or create/copy items. A card modification generally persists in the run's deck across draws and blinds; it is not merely a bonus for the next hand. Use the queried effect's target count and target order, and supply current hand card IDs when targeting is required.
- **Planets** upgrade the base Chips and Mult of their specified hand type(s) for the run. They upgrade the hand category, not the rank chips of individual playing cards. Current hand values already include prior upgrades; do not add them twice.
- **Spectrals** are another consumable family with effects that can modify cards, jokers or the run, sometimes with a cost or tradeoff. Query the exact effect before use. Creation effects need available capacity as specified by the rules; buying, owning or opening an item is distinct from using it.
- A playing card can independently carry one **enhancement**, one **edition**, and one **seal**, alongside rank, suit and permanent chip bonuses. These layers can coexist; applying a new enhancement replaces the previous enhancement rather than stacking two enhancements. Rank/suit changes and copying/destruction alter deck composition, not just the current display.
- Enhancements can add scoring bonuses, change hand evaluation, provide held effects, award money or risk destruction. An effect requiring **when scored** needs a scoring occurrence; **held in hand** needs the card left unplayed; **held at end of round** needs it retained when the blind is cleared. These triggers are not interchangeable. For example, playing a held-effect card removes it from that play's held effects.
- Editions supply an additional modifier separate from enhancement. Seals attach event-based effects such as retriggering, payout or consumable creation; check whether their event is scoring, discarding or round end. Retriggers can repeat eligible card effects and their random rolls, but do not duplicate unrelated once-per-hand or round-end effects.

### Jokers and trigger timing

Jokers are persistent equipped items, separate from the playing-card deck and consumable inventory. Their effects can change hand evaluation, score per card or per hand, react to discards or other events, grow over time, pay money, or change run rules. They do not need to be selected in `play_hand` to work, but must be active and meet their conditions. Rarity describes the item class, not an unconditional score increase.

Read each owned joker's live effect, state/counters, edition and stickers. A growth rate is not its current bonus, and a counter may change on play, discard, sale or round completion. Depleted, disabled or expired jokers may not trigger. Stickers can affect lifetime, costs or selling; editions add a separate modifier, and slot-changing effects affect capacity. Query details instead of assuming every owned joker is freely sellable or always active.

Use each effect's trigger scope: a per-scoring-card effect can fire several times in one hand and on eligible retriggers; a hand-level effect fires in its hand stage; a discard effect needs an actual discard; a round-end effect needs the round to end. A joker's position does not move its effect into another stage. Copy effects resolve from the referenced joker position, so reordering can change what is copied as well as the later arithmetic; copy eligibility and copied effect details come from MCP. Resolve those conditions before choosing an order.

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
