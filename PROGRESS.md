# Build Progress

## Week 1 — Foundation ✅ DONE
**Goal:** Monorepo scaffold, schemas, Supabase setup.

### Completed
- Git repo initialized, pushed to https://github.com/nathanhui97/projectv/
- Turborepo monorepo: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`
- `packages/schemas` — all 11 Zod schema files compiling clean:
  - `primitives.ts`, `filter.ts`, `condition.ts`, `trigger.ts`, `action.ts`
  - `ability.ts`, `card.ts`, `deck.ts`, `game-state.ts`, `match-action.ts`, `user.ts`
- `packages/engine/src/index.ts` — public API stubs (all throw "Not implemented")
- `supabase/migrations/001_initial_schema.sql` — full schema with RLS policies, applied to dev project
- Supabase dev project: `kbnxttlumaofdhyiuioj.supabase.co`
- `card-art` storage bucket created (Public)
- `.env` / `apps/admin/.env.local` filled with dev credentials

### Known gaps (non-blocking)
- Effect vocabulary QA (review real cards against schemas) — can do alongside card authoring
- Supabase generated TS types — revisit when CLI/MCP SSL issue resolved

---

## Week 2 — Admin Portal Card Editor 🔄 IN PROGRESS
**Goal:** Full card editor UI, trait management, 10 authored cards.

### Completed
- Next.js 14 + Tailwind + shadcn CSS vars scaffolded in `apps/admin`
- Supabase auth clients (browser, server, admin) in `src/lib/supabase/`
- Middleware with `is_admin` gate — non-admins redirected to `/login`
- `/login` page
- Sidebar nav layout (Cards, Traits, Sets, Sandbox)
- `/cards` list page — search by name, filter by status (draft/published/archived)
- Sign-out API route
- Build compiles clean

### TODO
- [ ] `/cards/new` + `/cards/[id]` — card editor page
  - [ ] Basic info (name, type, color, rarity, set, cost)
  - [ ] Combat stats (AP, HP, BP)
  - [ ] Pilot fields (link conditions, pilot modifiers)
  - [ ] Traits multi-select
  - [ ] Keywords checkboxes
  - [ ] Abilities builder (trigger → steps)
  - [ ] Image upload to `card-art` bucket
  - [ ] Draft / Publish workflow
- [ ] `/api/cards/ai-fill` — AI auto-fill route (rules text → AbilitySchema)
- [ ] `/traits` — trait dictionary management page
- [ ] `renderAbilityToText()` in `packages/engine`
- [ ] Author 10 test cards to validate the form

---

## Week 3 — Rules Engine Fundamentals ⏳ NOT STARTED
**Goal:** Core engine working: state init, phase machine, basic actions, filter evaluator, 30+ tests.

### TODO
- [ ] `getInitialState(deckA, deckB, seed)` 
- [ ] Phase state machine (mulligan → resource → main → end)
- [ ] Basic actions: `place_resource`, `deploy_unit`, `pair_pilot`, `play_command`, `pass_phase`
- [ ] `evaluateFilter(state, filter, sourceId)` 
- [ ] `listLegalActions(state, side)`
- [ ] Vitest setup + 30+ unit tests

---

## Week 4 — Engine Combat + Abilities ⏳ NOT STARTED
**Goal:** Full combat loop, ability triggers, keyword registry.

### TODO
- [ ] Attack subphase state machine
- [ ] Pending choices / resolution queue
- [ ] Triggered ability collection
- [ ] Step interpreters (~30 action types)
- [ ] Keyword registry (repair, breach, support, blocker, first_strike, high_maneuver, suppression)
- [ ] Continuous effects (`getEffectiveAP`, etc.)
- [ ] Win condition checker
- [ ] Scenario tests (full mini-matches)

---

## Week 5 — Card Authoring Volume ⏳ NOT STARTED
**Goal:** ~600 cards authored (ST01–GD04).

### TODO
- [ ] AI auto-fill tuned and working
- [ ] Bulk CSV import for basic fields
- [ ] Author all ST01 cards (~120)
- [ ] Author GD01 cards (~120)
- [ ] Stretch: GD02–GD04

---

## Week 6 — Mobile App Shell + Deck Builder ⏳ NOT STARTED
**Goal:** Expo app, auth, card browser, deck builder.

### TODO
- [ ] Expo + Expo Router scaffold in `apps/mobile`
- [ ] Supabase auth (email/password)
- [ ] Cards tab (browse, search, filter)
- [ ] Decks tab (create, edit, 50+10 validation)
- [ ] Profile + History tabs (shells)

---

## Week 7 — Mobile Match Flow ⏳ NOT STARTED
**Goal:** Full 1v1 match playable end-to-end.

### TODO
- [ ] Lobby (create room → 6-char code, join room)
- [ ] Supabase Realtime action sync
- [ ] Match screen layout (field, hand, resources, action bar)
- [ ] Touch interactions (tap preview, long-press deploy, tap attack)
- [ ] Engine integration
- [ ] Desync detection (checksum)

---

## Week 8 — Polish + App Store ⏳ NOT STARTED
**Goal:** Ship to TestFlight + Play Store internal testing.

### TODO
- [ ] Bug fixes from playtesting
- [ ] Animations (Reanimated)
- [ ] App icons, splash screen
- [ ] EAS Build config
- [ ] App Store + Play Store submission

---

## Environment Notes
- pnpm strict-ssl disabled (`pnpm config set strict-ssl false`) — corporate SSL cert
- PATH must include `/opt/homebrew/bin` for pnpm/node in bash
- Git identity: `nathanhui97@gmail.com` / `Nathan Hui`
- Supabase MCP has SSL auth issue — use Supabase dashboard directly for now
- `apps/admin` dev server runs on port 3001 (`pnpm exec next dev --port 3001`)
