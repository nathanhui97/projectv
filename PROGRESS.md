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

## Week 2 — Admin Portal Card Editor ✅ DONE
**Goal:** Full card editor UI, AI auto-fill, save/publish workflow.

### Completed
- Next.js 14 + Tailwind + shadcn CSS vars scaffolded in `apps/admin`
- Supabase auth clients (browser, server, admin) in `src/lib/supabase/`
- Middleware with `is_admin` gate — non-admins redirected to `/login`
- `/login` page
- Sidebar nav layout (Cards, Traits, Sets, Sandbox)
- `/cards` list page — search by name, filter by status (draft/published/archived)
- Sign-out API route
- `/cards/[id]` card editor — full form with 3-column layout
  - Basic info (name, type, color, rarity, set, card number, cost, flavor)
  - Stats (conditional: AP/HP/Level for units, modifier fields for pilots, cost for commands)
  - Traits multi-select with chip UI + autocomplete
  - Keywords with optional amount (repair/breach)
  - Abilities builder (trigger, qualifiers, cost, steps)
  - Image upload to `card-art` Supabase bucket
  - Draft / Publish / Archive workflow
  - Live card preview sidebar
- `/api/cards` POST — create new card
- `/api/cards/[id]` PUT — update card, increment version
- `/api/cards/upload-art` POST — upload card image
- `/api/cards/ai-fill` POST — AI rules text → abilities (claude-opus-4-7, adaptive thinking, structured JSON output)
- Build compiles clean (verified)

### TODO (non-blocking)
- [ ] `/traits` — trait dictionary management page
- [ ] `renderAbilityToText()` in `packages/engine`
- [ ] Author 10 test cards to validate the form end-to-end

---

## PIVOT — Web-first (2026-05-04)
**Decision:** Switched from React Native + Expo mobile app to Next.js web app (`apps/web`).

### Rationale
- Faster deploys (no app store review)
- No Apple/Google gatekeeper who can pull the app
- Zero platform fragmentation
- Players on any device via browser

### Docs updated
- All 13 docs + BUILD-ORDER.md updated to reflect web-first
- `docs/09-mobile-app.md` → renamed and rewritten as `docs/09-web-app.md`
- `apps/mobile` → `apps/web` throughout
- React Native, Expo, NativeWind, EAS Build, TestFlight all removed from stack
- Added: dnd-kit (drag-and-drop), framer-motion (animations)

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

## Week 6 — Web App Shell + Deck Builder ⏳ NOT STARTED
**Goal:** Next.js web app, auth, card browser, deck builder.

### TODO
- [ ] Next.js App Router scaffold in `apps/web`
- [ ] Supabase auth (email/password), middleware route guards
- [ ] Cards section (browse, search, filter — virtualized)
- [ ] Decks section (create, edit, 50+10 validation)
- [ ] Profile + History sections (shells)
- [ ] Responsive nav (sidebar desktop, bottom bar mobile)

---

## Week 7 — Web App Match Flow ⏳ NOT STARTED
**Goal:** Full 1v1 match playable in browser end-to-end.

### TODO
- [ ] Lobby (create room → 6-char code, join room)
- [ ] Supabase Realtime action sync
- [ ] Match board layout (all zones, hand, action bar, responsive)
- [ ] Click + dnd-kit drag interactions
- [ ] Engine integration
- [ ] Pending choice modals
- [ ] framer-motion animations
- [ ] Desync detection (checksum)

---

## Week 8 — Polish + Launch ⏳ NOT STARTED
**Goal:** Ship to prod URL, community beta.

### TODO
- [ ] Bug fixes from playtesting
- [ ] Animation polish (framer-motion)
- [ ] Cookie consent banner
- [ ] Settings page
- [ ] Community beta via staging URL (20-30 testers)
- [ ] Production deploy → prod Vercel URL
- [ ] Discord announcement

---

## Environment Notes
- pnpm strict-ssl disabled (`pnpm config set strict-ssl false`) — corporate SSL cert
- PATH must include `/opt/homebrew/bin` for pnpm/node in bash
- Git identity: `nathanhui97@gmail.com` / `Nathan Hui`
- Supabase MCP has SSL auth issue — use Supabase dashboard directly for now
- `apps/admin` dev server runs on port 3001 (`pnpm exec next dev --port 3001`)
- Anthropic SDK updated to 0.92.0 (required for `thinking: {type: "adaptive"}` and `output_config`)
