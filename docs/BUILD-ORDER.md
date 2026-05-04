# Build Order

The build sequence with concrete deliverables. Follow this exactly, or you'll waste weeks.

## Guiding principle

We build the foundation before the visible product. Schema → admin portal → cards → engine → web app. The web app is the *last* thing built because everything else has to exist first.

This feels backwards because the web app is the visible deliverable. Resist the urge to reorder. Trust the sequence.

## Phase 0: Validation (Week 0, before committing to the full build)

### Why this phase exists

Before spending 8+ weeks building, get signal that your local TCG community actually wants this. You said the existing sim is "kinda shit" — confirm the gap is real and worth filling.

### Goals

- Build the smallest tangible thing that demonstrates the concept
- Show it to 5–10 local players
- Decide: GO or PIVOT

### Deliverables

1. **Validation prototype** — a single Next.js page with:
   - 10 hardcoded cards from ST01 (or whichever deck you know best)
   - Visual layout of zones (battle area, hand, shield area, etc.)
   - Drag-and-drop card placement with dnd-kit (no rules enforcement, just movement)
   - This is throwaway code — it does not become part of the real codebase
2. **Demo session** with 5–10 community members on Discord, in person, or both
3. **Decision gate**:
   - **GO** if 70%+ are excited and would use it weekly
   - **PIVOT** if reception is mixed (consider scope changes — maybe just deck builder, maybe web-only)
   - **STOP** if reception is negative (rare, but possible — better to know now)

### Validation checkpoint

You have a yes/no/pivot answer from real people who play this game. If GO, proceed to Week 1.

## Week 1: Foundation

### Goals

- Set up monorepo, Supabase, and the schemas package
- Lock the effect vocabulary

### Deliverables

1. **Effect vocabulary review** — go through 30+ real cards from ST01–GD01 and verify every effect can be expressed in the vocabulary from `05-effect-vocabulary.md`. Add primitives if needed. This is the most important QA work in the project.
2. **Monorepo scaffolded** with `/apps/web`, `/apps/admin`, `/packages/engine`, `/packages/schemas`, `/supabase`, `/docs`. Empty stubs in each package.
3. **Supabase projects created**: `dev` and `prod` (both on free tier).
4. **Schemas implemented** in `/packages/schemas`: primitives, filter, condition, trigger, action, ability, card, deck, game-state, match-action, user.
5. **DB migrations written** for all tables in `06-data-schemas.md`. Applied to dev.
6. **Row-level security policies** in place.
7. **Storage bucket created**: `card-art`.
8. **Generated TypeScript types** from Supabase into the admin portal.

### Tools you'll use this week

- Claude Code for monorepo setup (paste prompt template from `03-tech-stack.md`)
- Supabase Studio for migration setup
- VS Code / Cursor for review

### Validation checkpoint at end of Week 1

Run a TypeScript type-check across the monorepo. All schemas compile. Database tables exist. Generated types match. You can connect to Supabase from a tiny test script and create/read a card row using the schema.

### Goals

- Card editor end-to-end
- Trait dictionary
- Schema validation
- Author 10 cards manually

### Deliverables

1. **Card editor full UI** per `07-admin-portal-spec.md`
   - All form sections
   - Filter builder component
   - Condition builder component
   - Step builder
   - Ability builder
   - Drag-to-reorder
   - Save draft + publish flow
2. **Trait dictionary management** — add/edit/merge/delete
3. **Live plain-English preview** — implement renderAbilityToText() in /packages/engine and use it in admin portal
4. **Schema validation throughout** — invalid forms won't submit
5. **Author 10 representative ST01 cards** — units, pilots, commands, including 2–3 with abilities
6. **Test the portal end-to-end** — go from blank to published card and back through history

### Validation checkpoint at end of Week 2

Three things must work:
- A non-technical person (or at least: you, after a tutorial) can author a card with abilities without touching JSON
- The plain-English preview matches the official rules text
- 10 cards exist in DB, ready to use

## Week 3: Engine fundamentals

### Goals

- State setup, phase machine, basic actions

### Deliverables

1. **getInitialState** function — accepts deck, sets up shields, EX Resource, etc.
2. **Phase machine** — start, draw, resource, main, end with auto and manual advances
3. **Basic action implementations**:
   - place_resource
   - deploy_unit (cost validation, resource resting, battle area limit)
   - pair_pilot (link condition checking)
   - play_command (basic, cost validation)
   - pass_phase
   - mulligan
4. **Filter evaluator** — evaluateFilter(state, filter, ctx)
5. **Tests for everything above** — Vitest, ~30+ tests

### Validation checkpoint at end of Week 3

You can run a Node script that simulates two players setting up, mulliganing, taking turns, placing resources, deploying units. It works without UI.

## Week 4: Engine combat + abilities

### Goals

- Attack subphase
- Ability triggering
- Action queue
- Pending choices
- Keywords

### Deliverables

1. **Attack subphase state machine**: declare → defender action → attacker action → damage → resolution
2. **Action queue + processing**
3. **Pending choices system**
4. **Triggered ability collection**: after each action, identify and queue triggered abilities
5. **Step interpreters** for all action types in vocabulary (draw, deal_damage, modify_stat, choose_target, etc.)
6. **Keyword registry**: Repair, Blocker, First Strike, High-Maneuver, Breach, Support, Suppression
7. **Continuous effects** (basic)
8. **Win condition checker**
9. **Manual mode handling**
10. **Many more tests** — every keyword effect tested in match scenarios; every action type tested

### Validation checkpoint at end of Week 4

Engine can run a full mirror match between two ST01 decks from start to finish, with combat, attacks, blockers, and ability triggers, all via Node script. Logs are inspectable.

## Week 5: Author the rest of the v1 card pool

### Goals

- Author cards for ST01–ST09 + GD01

### Deliverables

1. **AI-assisted auto-fill** in admin portal — Anthropic API integration
2. **Bulk CSV import** — import basic fields for all cards from a CSV
3. **Author abilities** for ~600 cards (ST01–ST09 + GD01)
4. **Sandbox tester** in admin portal — verify ability behavior per card
5. **Trait dictionary populated** — full set of traits with category labels

This week is mostly volume work. AI auto-fill speeds it up dramatically. Plan: 100 cards/day pace.

### Validation checkpoint at end of Week 5

600 cards published in DB. Sandbox tester runs without errors on randomly sampled cards. Trait dictionary is clean (no duplicate / typo'd traits).

## Week 6: Web app shell + deck builder

### Goals

- Next.js web app scaffolding, auth, deck builder

### Deliverables

1. **`apps/web` project set up** — App Router file structure, Tailwind, providers (Zustand, TanStack Query, Supabase)
2. **Auth flow**: login, signup, middleware route guards, redirect logic
3. **Card data fetching** with TanStack Query and version-check cache invalidation
4. **Decks section fully functional**: list, editor with real-time validation
5. **Cards section**: encyclopedia (virtualized grid) + card detail
6. **Profile section**: stats placeholder, settings, sign out
7. **History section**: empty state for now
8. **Responsive nav**: sidebar on desktop, bottom nav on mobile

Shared via staging URL with 2–3 community testers. Goal: testers can open the URL, sign up, build a valid deck, and save it.

### Validation checkpoint at end of Week 6

Two testers can independently open the staging URL, sign up, build a 50-card deck, and save it. No errors.

## Week 7: Web app match flow

### Goals

- Multiplayer match end-to-end in the browser

### Deliverables

1. **Lobby UI**: create room (copy code), join room (enter code), waiting state
2. **Match state subscription**: Supabase Realtime sync
3. **Match board layout**: all zones, hand, action bar — responsive
4. **Click + drag interactions**: dnd-kit for card drag from hand to zones, unit-to-unit drag for attacks/pairing
5. **Engine integration**: local action validation and application, action persisted to Supabase
6. **Pending choice modals**
7. **Animations** with framer-motion (basic — full polish in Week 8)
8. **Win/loss summary screen**
9. **Match log added to History section**

### Validation checkpoint at end of Week 7

Two testers can join a match via room code and play a complete game from start to win condition. No desyncs.

## Week 8: Polish, beta, launch

### Goals

- Bug fixes
- Polish animations
- Public launch (no app store review — deploy to prod when ready)

### Deliverables

1. **Bug-fix sprint** — every issue from Weeks 6–7 testing
2. **Animation polish** with framer-motion
3. **Sound effects** (optional, can defer)
4. **Settings page**: sound, animations, account management
5. **Cookie consent banner** — gates PostHog on accept
6. **Staging beta** — invite 20–30 TCG community members via staging URL
7. **Bug fixes from beta feedback**
8. **Production deploy** — merge to main, Vercel auto-deploys to prod URL
9. **Announce in Discord**

### Validation checkpoint at end of Week 8

Prod URL is live. Beta testers report stable experience. Cards play correctly. No known engine bugs.

## Post-launch: ongoing card authoring

After v1 launches:

- Continue authoring GD02, GD03, GD04 cards (~400 cards remaining)
- Address any urgent bugs from real users
- Plan v2 features (alt-art scanning, ranked, etc.)

## Time risks

This 8-week plan assumes:
- ~30–40 hrs/week of focused work
- AI tools work well for 80%+ of code generation
- Bandai doesn't issue any takedowns mid-build
- No major engine architectural pivots

Realistically, expect 10–12 weeks. Buffer accordingly.

## What slips first if you're behind

Priority order — drop from the bottom if needed:

1. (Always ship) Engine correctness for all keywords
2. (Always ship) ST01–ST04 starter decks playable
3. (Always ship) Stable 1v1 match
4. (Always ship) Deck builder
5. (Always ship) Admin portal that lets you continue adding cards
6. (Important) Animations beyond "card appears in zone"
7. (Important) ST05–ST09 starter decks
8. (Important) GD01 booster cards
9. (Nice) GD02–GD04 booster cards
10. (Nice) Sound effects
11. (Nice) Match history with detailed log
12. (Nice) Onboarding tutorial

If at Week 8 you're not ready, ship without GD02–GD04 cards. Add them post-launch via admin portal (no redeploy needed — pure data update!). This is the *whole point* of the data-driven architecture.

## Key implementation prompts (for vibe-coding)

When you start each week, the relevant doc has an "Implementation prompt template" at the bottom. Copy that into Claude Code along with the doc(s).

For Week 0: prompt in `03-tech-stack.md` (monorepo setup) and `04-architecture.md` (package layout)
For Week 1 (validation prototype): use a one-shot prompt: "Build a minimal Next.js single page showing 10 cards in zones using dnd-kit for drag-and-drop, these 10 cards [paste data]. No engine, just visual layout."
For Week 1 (admin portal start): prompt in `07-admin-portal-spec.md` (steps 1–3)
For Week 2: prompt in `07-admin-portal-spec.md` (full)
For Week 3–4: prompt in `08-rules-engine.md`
For Week 5: pure card authoring; no new code
For Week 6–7: prompt in `09-web-app.md`
For Week 8: bug fixes — no specific prompt, just fix what's broken

## Scope cuts available

If at any week you're 1+ week behind, here are the cuts available without affecting v1 viability:

- Drop GD02–GD04 cards (add post-launch)
- Drop sound effects (add post-launch)
- Drop animation polish (basic transitions only)
- Drop match log replay (simple text log only)
- Drop card encyclopedia (deck builder is enough for browsing)
- Drop onboarding tutorial

Things that CANNOT be cut:
- Engine correctness
- Multiplayer reliability
- Deck builder validation
- Admin portal flexibility
- Production deploy to the public URL

## Implementation prompt template

(Build order has no implementation prompt; it's the meta-plan.)
