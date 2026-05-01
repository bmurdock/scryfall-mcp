# Blech, Loafing Pest Historic Brawl Deck Test

Date: 2026-04-27

Commander: Blech, Loafing Pest
Platform: Arena
Format target: Historic Brawl, 100 cards, singleton except basic lands

## Result

The Arena import list is in `docs/decks/blech-loafing-pest-historic-brawl.txt`.

The deck is BG lifegain counters midrange. Blech rewards life gain by putting +1/+1 counters on each Pest, Bat, Insect, Snake, and Spider, so the deck uses three overlapping packages:

- Relevant creature types: Pest, Bat, Insect, Snake, and Spider bodies that scale with Blech.
- Repeatable life gain: lifelink, Food, landfall life gain, High Market, The Shire, and drain effects.
- Counter payoffs: Winding Constrictor, Inspiring Call, The Great Henge, Karn's Bastion, and large token boards from Scute Swarm, Arasta, Hornet Queen, Ishkanah, and Rotwidow Pack.

## Tool Calls Used

- `get_card` for `sos/176`.
- `validate_brawl_commander` for `Blech, Loafing Pest` in `brawl`.
- `find_synergistic_cards` for mechanic synergy.
- `search_cards` with explicit `game:arena legal:brawl ci<=bg` filters for creature types, life gain, lifelink, Food, lands, draw/ramp, and removal.
- `search_format_staples` for removal, ramp, and draw ideas.
- `suggest_mana_base` for an initial BG mana base estimate.
- `analyze_deck_composition` for a final pass, which failed because of rate limiting.

## Issues Found

1. `find_synergistic_cards` returned off-color cards for a BG commander.
   - Repro: focus card `Blech, Loafing Pest`, format `brawl`, arena only, mechanic synergy.
   - Example result: `Akroma's Will`, `Mangara, the Diplomat`, and `Danitha Capashen, Paragon`.
   - Expected: tool should respect commander color identity or expose that it does not enforce deck-building constraints.

2. `search_format_staples` does not appear to enforce Arena availability.
   - Repro: format `brawl`, color identity `BG`, roles `removal`, `ramp`, and `draw`.
   - Example results included Commander product print contexts such as `Neon Dynasty Commander` and `March of the Machine Commander`.
   - Expected: either an `arena_only` option should be available for this tool, or Brawl staples should default to Arena-available cards when using `brawl` and `standardbrawl`.

3. `suggest_mana_base` recommended 30 lands for a 100-card Brawl midrange deck.
   - Repro: colors `BG`, deck size `100`, format `brawl`, strategy `midrange`, average CMC `3.2`.
   - Expected: Historic Brawl recommendations should usually land closer to 36-40 lands, with adjustments for ramp and curve.

4. `search_cards` query validation rejected valid Scryfall syntax containing `+1/+1`.
   - Repro query: `game:arena legal:brawl ci<=bg (o:"put a +1/+1 counter" or o:proliferate)`.
   - Error: `Query contains invalid characters. Only alphanumeric characters, spaces, and common search operators are allowed`.
   - Expected: Scryfall oracle text queries need to allow plus signs and slash characters inside quoted strings.

5. `analyze_deck_composition` failed with `Rate limit exceeded` after the deck-building search sequence.
   - Repro: run the composition analyzer after several search and staple calls in one session.
   - Expected: the tool should queue, delay, or return a structured retry hint instead of surfacing an unexpected error.

## Validation Notes

- `validate_brawl_commander` confirmed Blech is a valid Historic Brawl commander, BG color identity, Arena available, and legal.
- The final list has 100 cards including commander.
- The final list is singleton except for `Forest` and `Swamp`.
- The final composition analyzer pass could not be completed because of the rate-limit issue above.
- `npm test` passed after adding the deck artifacts: 21 test files and 236 tests passed.
