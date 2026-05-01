# Sanar, Unfinished Genius Historic Brawl

Arena import block:

```text
Commander
1 Sanar, Unfinished Genius (SOS) 223

Deck
1 Guttersnipe (FDN) 716
1 Goblin Electromancer (GRN) 174
1 Storm-Kiln Artist (STX) 115
1 Archmage Emeritus (STX) 37
1 Balmor, Battlemage Captain (FDN) 237
1 Third Path Iconoclast (BRO) 223
1 Young Pyromancer (JMP) 372
1 Talrand, Sky Summoner (JMP) 181
1 Murmuring Mystic (GRN) 45
1 Erebor Flamesmith (LTR) 122
1 Kaza, Roil Chaser (ZNR) 225
1 Rootha, Mercurial Artist (STX) 227
1 Prismari Apprentice (STX) 213
1 Naru Meha, Master Wizard (DOM) 59
1 Gandalf the Grey (LTR) 207
1 Chrome Host Seedshark (MOM) 51
1 Baral and Kari Zev (MOM) 218
1 Baral, Chief of Compliance (MUL) 8
1 Slickshot Show-Off (OTJ) 146
1 Magmatic Channeler (ZNR) 148
1 Witty Roastmaster (SNC) 131
1 Ral, Storm Conduit (WAR) 211
1 Ral, Crackling Wit (BLB) 230
1 Saheeli, Sublime Artificer (WAR) 234
1 Invasion of Segovia (MOM) 63
1 Arcane Signet (ELD) 331
1 Mind Stone (HA1) 19
1 Coldsteel Heart (HA4) 22
1 Midnight Clock (ELD) 54
1 The Celestus (MID) 252
1 Double Vision (M21) 142
1 Thousand-Year Storm (FDN) 248
1 Prismari Command (STX) 214
1 Opt (FDN) 512
1 Consider (MID) 44
1 Sleight of Hand (WOE) 67
1 Play with Fire (MID) 154
1 Lightning Strike (TLA) 146
1 Abrade (FDN) 188
1 Fiery Impulse (EA2) 13
1 Torch the Tower (WOE) 153
1 Counterspell (OMB) 9
1 Negate (TMT) 47
1 Spell Pierce (DFT) 64
1 Stern Scolding (LTR) 71
1 Wash Away (VOW) 87
1 Saw It Coming (KHM) 76
1 Big Score (SNC) 102
1 Unexpected Windfall (AFR) 164
1 Seize the Spoils (SOS) 129
1 Practical Research (STX) 212
1 Teach by Example (FDN) 666
1 Twinferno (DMU) 149
1 Solve the Equation (STX) 54
1 Experimental Augury (ONE) 49
1 Quick Study (SOS) 65
1 Thirst for Discovery (VOW) 85
1 Radical Idea (GRN) 52
1 Finale of Promise (WAR) 127
1 Magma Opus (STX) 203
1 Creative Outburst (STX) 171
1 Command Tower (ELD) 333
1 Reliquary Tower (M19) 254
1 Riverglide Pathway (ZNR) 264
1 Steam Vents (ECL) 267
1 Spirebluff Canal (OTJ) 270
1 Shivan Reef (DMU) 255
1 Stormcarved Coast (SOS) 263
1 Sulfur Falls (DOM) 247
1 Thundering Falls (MKM) 269
1 Fiery Islet (HA7) 21
1 Frostboil Snarl (STX) 265
1 Izzet Guildgate (FDN) 691
1 Prismari Campus (STX) 270
1 Swiftwater Cliffs (TDM) 268
1 Temple of Epiphany (FDN) 699
1 Volatile Fjord (KHM) 273
1 Plaza of Heroes (DMU) 252
1 Den of the Bugbear (AFR) 254
1 Hall of Storm Giants (AFR) 257
1 Otawara, Soaring City (NEO) 271
1 Sokenzan, Crucible of Defiance (NEO) 276
1 Castle Vantress (ELD) 242
1 Castle Embereth (ELD) 239
1 Mystic Sanctuary (ELD) 247
1 Fabled Passage (BLB) 252
1 Evolving Wilds (ECL) 264
1 Field of Ruin (MID) 262
1 Demolition Field (FDN) 687
1 Mirrex (ONE) 254
1 Restless Spire (WOE) 260
5 Island (SOS) 274
3 Mountain (SOS) 278
```

Validation notes:

- Re-tested on 2026-04-28 through the local Streamable HTTP MCP endpoint at `http://127.0.0.1:3000/mcp`.
- `npm run smoke:http` passed after restarting the stale detached `screen` listener from the current branch.
- The commander was validated through MCP as legal for Historic Brawl and Arena available.
- The deck contains 100 cards total: 1 commander plus 99 maindeck cards.
- Chunked exact-name `search_cards` calls resolved all 94 unique card names under `game:arena legal:brawl`; the apparent misses were DFC/name-normalization cases (`Sanar, Unfinished Genius // Wild Idea`, `Invasion of Segovia // Caetus, Sea Tyrant of Segovia`, and `Riverglide Pathway // Lavaglide Pathway`).
- The remediated JSON formatter now exposes `set`, `collector_number`, and `arena_id` where available.
- `suggest_mana_base` now recommends 38 lands for 100-card Historic Brawl, matching this deck's 38-land structure.
- Remaining tool issues observed during the second exercise:
  - The in-app MCP client did not recover after the HTTP server restart and returned a Streamable HTTP JSON-RPC deserialization error until direct HTTP calls were used.
  - `find_synergistic_cards` still returned no Sanar results because earlier zero-result semantic queries (`unfinished`, `genius`) counted as failures and opened the circuit breaker before oracle-derived fallback queries could be used.
  - `analyze_deck_composition` still made enough per-card lookups to hit a retryable `Rate limit exceeded` response on the 100-card list.
