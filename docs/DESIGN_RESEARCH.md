# Design research

Studied before any visual code change, November 2026. Sources: the live pump.fun home (coin pane, prices and market caps in a tight repeating grid), the published pump.fun DESIGN.md (surface `#14151c`, mint `#86efac`, pink `#f472b6`, Inter at every size, 16px radii, 40px buttons), DexScreener’s live board (rank, pair, age, txns, volume, five change columns, mcap, all in one row), Birdeye Terminal (a table: token, mcap, price, 24h vol, txns, liquidity, 5m/1h), Photon vs Axiom write-ups (Photon is chart-centred and quiet; Axiom is a crowded terminal with a right-hand execution dock), Kinetic’s Trenches (three columns, a thin progress bar on every card, hover pauses the stream), and Dribbble shots Nalixo (`#040604` + one green), Crybs (burnt orange on near-black, charts first), Gold Coin (ochre `#D08B30` on `#030202`, warm paper text), and Max Wallet (one large balance, lists not cards). Robinhood and Phantom were used as a contrast: one number dominates, colour is a signal, chrome gets out of the way.

## What those products actually do

**pump.fun.** The page is the coins. No essay, no three steps. A coin is an image, a ticker, a price and a market cap, repeated until the screen is full. Green (`#86efac`) is the only “go” colour and it sits on near-black (`#14151c`), not on a purple gradient. Type is Inter, but the *scale* is the trick: 12–14px labels, prices in a compact weight, display type reserved for a 40–60px moment. Radii are 8–16px, shadows are `0 4px 12px` at most. Pink is a second accent, not the whole brand. Motion is the tape of new coins, not a hover lift.

**DexScreener.** A row is about 56px tall. Left: rank and a 32px image. Then the name, the quote pair, age, txn count. Then five percentage columns, green or red, nothing else coloured. Market cap is the right-hand anchor in a heavier weight. You can scan forty names without scrolling a hero. There is almost no radius and no shadow.

**Birdeye Terminal.** Same idea, more columns, zero decoration. The header is a tool bar (search, watchlist, alerts), not a brand poster. Colour appears only inside the percent cells.

**Photon.** The chart is the page. The buy box is a narrow dock. Safety stats sit on the chart, not in a second card grid. Lots of grey, one action colour.

**Axiom.** Denser than Photon. Discover is a list with quick-buy. The trade page stacks token facts, chart, holders and a tape, with execution glued to the right edge. Social links are tiny icons, not pills.

**Robinhood.** One balance, enormous, tabular. Green means the number went up since you last looked. Lists are hairline-separated. No card chrome.

**Phantom.** Dark, but the dark is neutral. Tokens are a list with a sparkline-sized change. The accent is used once per screen.

**Dribbble, the useful bits only.** Nalixo: background `#040604`, a single green family (`#21CC2F` / `#94E09E`), no second candy colour. Crybs: `#070417` with one burnt orange (`#D54C10`) so the chart is the warm thing. Gold Coin: ochre, brown and warm paper (`#EDE6DC`) on `#030202` — luxury because the palette is narrow, not because of a gradient. Max Wallet: big balance, soft but not bubbly, lists.

## Why the current Meme Market UI looks generated

- The page background is two radial blobs (pink top-right, gold top-left) on a purple-black. That is the default “AI dark theme”.
- Every surface is the same recipe: 20px radius, 1px white-at-8% border, a white gradient sheen, a 20px shadow, and a 2px lift on hover.
- The landing is a centred headline, two pills, an example card, then a 1–2–3 grid. That layout is a template, not a market.
- The example coin is a letter in a pink-to-gold circle. Real coins have pictures. The feed coins that do have pictures are flat colour squares from tests, shown in huge padded cards with acres of empty black under them.
- Pink (`#ff4d88`) is the primary action, the launch FAB, and the focus of the whole brand. Pink-on-black is the current default for “playful crypto” mockups.
- The bottom nav floats a raised circle over the content on desktop as well as on a phone. Desktop products in this category use a top bar or a dock of text, not a mobile FAB.
- Numbers use the same sans as the headlines, so prices don’t feel like prices. Green and red are timid and also used as decoration.
- Empty space is the layout. A trading screen should be full.

## Direction: the rank board

Meme Market should feel like a Johannesburg taxi destination board that learned to trade: condensed names, a yellow stripe, a scrolling tape, and numbers in a monospace. Not a Solana clone and not a startup landing page.

- **Ground:** `#0e0f0c`. Warm black, olive in the shadows. No purple, no blobs.
- **Panels:** `#161814` with a 1px `#2a2e24` rule. Radius 2px. No shadow, no sheen.
- **Stripe:** taxi yellow `#ffe14a` as a 3px rule, the active tab, and the game chip. It is not a fill for every button.
- **Up / down:** `#c6f135` and `#ff4b2b`, only on numbers and candles.
- **Display:** Big Shoulders Display, uppercase, tight tracking. Tickers read like a destination sign (`BRAAI`, `KOEKS`).
- **UI text:** Figtree, 13–15px, for sentences.
- **Numbers:** IBM Plex Mono, tabular. Every price, mcap and balance.
- **Copy:** plain South African English. “The rank”, “koppie”, “howzit”, “sharp”, “eish”, “now now”. The game chip stays the exact line `GAME · FR has no cash value`.
- **Landing:** masthead, then the live tape, then the board. The headline is a label, not a poster. No three steps.
- **Feed:** one row per coin. Image, ticker, sparkline, market cap, a thin graduation meter.
- **Coin:** chart first, execution dock on the right (under the chart on a phone), a monospace tape, holders as bars, a short thread.
- **Motion:** the tape scrolls, a price flashes when it changes, rows don’t jump on hover. Reduced motion turns the tape into a static line.

What we will not copy: pump.fun’s mint-and-pink pair (too close to their brand), Inter-everywhere, DexScreener’s five change columns (we don’t have that data and it would be fake), or Dribbble’s glassmorphism.
