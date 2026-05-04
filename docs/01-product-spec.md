# 01 — Product Spec

## What we're building

A web TCG simulator for the Gundam Card Game. Players open the site in any browser, build decks, and play 1v1 online matches with friends using room codes. The app enforces the rules so players never have to.

## Who it's for

- Local TCG players in your community who currently use Tabletop Simulator (or similar) and find it clunky
- Gundam Card Game players globally who want to test decks before buying cards
- Players who want to play remotely with friends without flying somewhere with a binder

Not for:
- Strangers looking for matchmaking (no ranked, no public lobbies in v1)
- People who don't own or play the physical game (we're a complement, not a replacement)
- Tournament organizers (no bracket system in v1)

## Core user flows

### Flow 1: First-time user

1. Open a browser and go to the app URL
2. Sign up with email
3. See empty deck list → tap "New deck"
4. Browse card catalog (search, filter by color/cost/trait)
5. Build a 50-card deck + 10-card resource deck
6. Save deck

### Flow 2: Play with a friend

1. From home screen → tap "Play"
2. Choose deck
3. Tap "Create room" → app shows a 6-character room code
4. Share code with friend (via whatever, Discord/text/yell)
5. Friend enters code from their phone
6. Both confirm, match starts
7. Play through the match — engine enforces all rules
8. Match ends, both see result, return to home

### Flow 3: Returning user

1. Open app
2. Home screen shows: deck list, "Play" button, match history
3. Tap a recent deck → edit cards
4. Or tap "Play" → straight into a match

## Confirmed v1 scope

### In scope

- Email auth (sign up, log in, log out, reset password)
- Card catalog browse / search / filter
- Deck builder (create, edit, delete, duplicate, validate legality)
- Single deck format: standard 1v1 (50 main + 10 resource)
- 1v1 online match via room code
- Full rules engine for standard 1v1 play
- Match history (last N matches, win/loss, deck used, opponent)
- Settings: account, sign out, app version

### Out of scope (explicit non-goals for v1)

These are deliberately deferred. The doc calls them out so you don't accidentally drift into building them.

- ❌ Hot-seat mode (one device, two players) — was considered, dropped because we want app downloads, not in-person workarounds
- ❌ Public matchmaking / ranked
- ❌ Tournament brackets
- ❌ Friend lists / followers
- ❌ Chat (in-game or out)
- ❌ AI opponents / single-player practice
- ❌ Spectator mode
- ❌ Match replays
- ❌ Push notifications
- ❌ Cosmetics, card sleeves, playmats
- ❌ In-app purchases
- ❌ Alt-art card scanning (deferred to v1.1+)
- ❌ Native mobile apps (iOS/Android) — web only for v1; works in mobile browser
- ❌ Tablet-optimized layouts (works on tablets but not specifically tuned)
- ❌ Team battle, battle royale, other multiplayer formats
- ❌ Multiple languages (English only)
- ❌ Accessibility audit (basic only — color contrast, tap targets)
- ❌ Offline mode (online only)
- ❌ Cross-region card legality rules (assume one global pool)
- ❌ Community card submissions (you author solo for v1)

If a decision tries to creep these in, refuse it. Add to v1.1 list.

### Card pool at launch

All cards from these sets, playable on day one:

- **Starter decks:** ST01 Heroic Beginnings, ST02 Wings of Advance, ST03 Zeon's Rush, ST04 SEED Strike, ST05 Iron Bloom, ST06 Clan Unity, ST07 Celestial Drive, ST08 Flash of Radiance, ST09 Destiny Ignition
- **Boosters:** GD01 Newtype Rising, GD02 Dual Impact, GD03 Steel Requiem, GD04 (when released)

Approximately 1,000+ cards. Authoring is the bottleneck — see [10-card-authoring-playbook.md](10-card-authoring-playbook.md).

### Format support at launch

Standard 1v1 only. <cite>5-phase turn structure: Start, Draw, Resource, Main, End.</cite> 50-card main deck, 10-card resource deck, 6-card shield area, max 6 units in battle area, hand size 10.

## Success metric

> "It works flawlessly."

Operationalized as:

- **Engine correctness:** zero known rules bugs at launch. Cards do what they say. The card text/preview match.
- **Sync reliability:** dropped frames or desync events <1% of matches.
- **Crash-free rate:** ≥99.5% of sessions.
- **Card accuracy:** ≥99% of cards play correctly on first try (1% may have edge cases or use manual mode).
- **Load time:** card catalog opens in <2 seconds on a mid-range device / connection.

Quantified user goals (loose, validation-style):

- 20+ local players using it weekly within first month
- One unprompted "this is way better than [current option]" comment from a community member
- Zero takedown requests

## Non-goals worth restating

- **Not trying to be MTG Arena.** No animations beyond functional ones. No voice lines. No 3D.
- **Not trying to monetize.** This is a tool for the community, not a business yet. If it grows, we revisit.
- **Not trying to be official.** We're a fan tool. Posture is "useful, low-key, takedown-responsive."

## Constraints

- **Solo developer, AI-assisted.** Architecture must be maintainable by one person reading the docs.
- **No ongoing server cost beyond Supabase free/cheap tier.** If a feature requires expensive infrastructure, defer.
- **DMCA-responsive from day one.** No mechanic or content that's indefensible.
