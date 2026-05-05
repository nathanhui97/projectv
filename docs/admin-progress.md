# Admin Portal — Progress Log

Last updated: 2026-05-05

---

## Current Status

**Admin portal is live on Vercel.** Card authoring is functional — partners can create, edit, and publish cards.

The engine core (Milestone 1) is also complete. The next major milestone is the game client (`apps/game`).

---

## What's Done

### Deployment
- Admin portal deployed to Vercel from `apps/admin` (Root Directory: `apps/admin`)
- Supabase auth wired — `profiles.is_admin` gate protects all admin routes via Next.js middleware
- Three required env vars in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- GitHub repo: https://github.com/nathanhui97/projectv — Vercel auto-deploys on every push to `main`

### Card Editor Layout (`apps/admin/src/app/(admin)/cards/[id]/CardEditor.tsx`)
- Two-tab layout: **Card Info** | **Abilities**
- Card Info tab: art image sits side-by-side with the basic info grid; sections flow with thin dividers (no boxes inside boxes)
- Abilities tab: full-width, all vertical space used
- Right rail: narrow live card preview (always visible regardless of active tab)
- Section labels are lightweight (`text-xs uppercase`) instead of bold `<h2>` headers

### Card Info Tab
- **BasicInfoSection**: ID, Name, Set Code, Card Number, Type, Color, Rarity, Display Name, Flavor Text — 2-col grid
- **StatsSection**: Cost, Level, AP, HP (conditional on card type); link condition for units; AP/HP mod for pilots
- **TraitsKeywordsSection**: Trait tag picker (search + autocomplete from DB, free-text slug fallback); keyword picker with `amount` field for Repair and Breach
- **RulesTextSection**: Rules text textarea; AI Auto-fill Abilities button (calls `/api/cards/ai-fill` → Anthropic API); Authoring Notes; Manual Mode toggle
- **ImageUpload**: Supabase Storage upload to `card-art` bucket

### Abilities Tab — AbilitiesBuilder (`apps/admin/src/components/card-editor/AbilitiesBuilder.tsx`)

**Ability card structure (cleaned up):**
- Header bar: collapse toggle, `a1` index, trigger type badge, active qualifier pills, display text preview, move up/down, delete
- **Display Text** field (textarea, 2 rows)
- **Trigger row**: type dropdown inline; if activated, cost fields (Rest self checkbox + Pay N resources) appear inline to the right
- **Qualifiers** — collapsed by default behind a `⚙ Qualifiers (N active)` toggle:
  - When collapsed: active qualifiers shown as `bg-primary/10` pills
  - When expanded: boolean qualifiers as compact wrapping checkboxes; string/number qualifiers in a 3-col grid
  - Qualifier fields: `once_per_turn`, `your_turn_only`, `opponent_turn_only`, `requires_pair`, `requires_link`, `target_is_unit`, `attacking_player`, `from_enemy`, `battle_damage`, `not_self`, pilot/unit color selects, pilot max level, resource cost, attacker max AP, pilot/source/attacker/target/command traits
- **Steps** section (see below)
- **Notes** — single-line input at bottom (no Field wrapper)

### Step Editor (`apps/admin/src/components/card-editor/StepEditor.tsx`)

**TargetPicker** (replaces all free-text `$target` boxes):
- Modes: Self / All enemies / All friendly / All (any side) / Stored variable (`$…`)
- Criteria panel (shown for filter modes): Type, Color, **Traits** (comma-sep, all must match), Min/Max level, Has keyword checkboxes, Is rested/damaged/linked
- Outputs `"$self"`, `"$variable"`, or `{ filter: ShorthandFilter }` — normalized on save via `normalizeTargetRef()`

**DurationSelect** — reorganized into two `<optgroup>` sections:
- *Expires once*: End of this turn / End of your next turn / End of opponent's next turn / End of battle / End of phase
- *Active while*: Your turns only (recurring) / Opponent's turns only / Permanent / While paired / While linked / While in zone / Until destroyed

**KeywordPickerWithAmounts** (used in `gain_keyword` step):
- All keywords as checkboxes
- Repair and Breach show an inline amount input when checked

**Steps** mode toggle: Form view ↔ JSON view (JSON view has template insert buttons + copy-to-clipboard)

All target fields across all step types use `TargetPicker`:
- `target` on destroy/heal/rest/ready/modify_stat/deal_damage/etc.
- `pilot` and `unit` on `pair_pilot`
- `source` on `copy_abilities`
- `new_target` on `change_attack_target`

**FilterBuilder** (used by `choose_target`, `all_matching`, `count_zone`, `search_deck`):
- Side, Type, Color, Zone, Name is / Name includes, **Traits** (comma-sep), stat ranges (level/cost/hp/ap min+max), Has keyword checkboxes, boolean flags (is_token, rested, is_damaged, is_paired, is_linked, not_self, paired_with_source)

### ShorthandFilter (`packages/schemas/src/shorthand-filter.ts`)
- `normalizeTargetRef()` — converts `{ filter: ShorthandFilter }` → `{ filter: FilterSchema }` on target fields
- `normalizeStepFilters()` — recursively normalizes filter and all target fields (`target`, `new_target`, `pilot`, `unit`, `source`) in a step tree
- `normalizeAbilityFilters()` — entry point called on save

---

## Engine Core — Milestone 1 (Complete)

All files in `packages/engine/src/`:

| File | What it does |
|---|---|
| `rng.ts` | mulberry32 PRNG, `drawRng`, `shuffleArray` |
| `state.ts` | `getInitialState` — deals 5 hand + 5 shields, P2 gets EX resource token |
| `win.ts` | `checkWinCondition`, `setWinner` |
| `phases.ts` | `advancePhase`, `applyPhaseEntry` (readies cards on turn start) |
| `conditions.ts` | `evaluateCondition` — all 17 condition types |
| `steps.ts` | `resolveStep` — all 35+ step types; `destroyInstance`, `resolveTargetRef` |
| `triggers.ts` | `collectTriggers` for all event types |
| `queue.ts` | `processQueue` — walks pending_resolutions until empty or waiting |
| `catalog.ts` | `buildCatalog`, `CardCatalog` |
| `stats.ts` | `resolveEffectiveStats`, `hasKeyword` |
| `validate.ts` | `validateAction` — per-action validation for all MatchAction types |
| `apply.ts` | `applyAction` — routes to handler, stamps log |
| `legal.ts` | `listLegalActions` — all valid actions for a player |
| `actions/setup.ts` | Mulligan: `applyRedraw`, `applyKeepHand` |
| `actions/resources.ts` | `applyPlaceResource`, `applySkipResource` |
| `actions/deploy.ts` | `applyDeployCard`, `applyPairPilot`, `applyPlayCommand` |
| `actions/combat.ts` | Attack/blocker/damage resolution, shield break, burst detection |
| `actions/abilities.ts` | `applyActivateAbility`, `applyResolveChoice`, `applyResolveManual` |
| `actions/turn.ts` | `applyPassPriority`, `applyEndPhase`, `applyEndTurn`, `applyConcede` |
| `engine.test.ts` | 13 Vitest tests — initial state, mulligan, validate, win condition, legal actions |

**Keyword engine status:**
- `blocker` ✅ — `use_blocker` action + combat validation
- `first_strike` ✅ — `resolveCombatDamage`
- `repair`, `breach`, `support`, `suppression`, `high_maneuver` ❌ — definitions agreed, not yet implemented

**Agreed keyword definitions:**
- `repair N` — Heal N HP at the start of your turn
- `breach N` — When this unit destroys the defender, deal N damage to opponent's base
- `support` — Can rest to give another friendly unit +1 AP for one attack
- `suppression` — Opponent cannot place resources while this unit is in the battle area
- `high_maneuver` — Cannot be chosen as the target of `attack_unit`

---

## Pending / Next Steps

### Admin portal — remaining small items
- [ ] Keyword mechanics not yet in engine (implement when game client exists)
- [ ] `renderAbilityToText()` plain-English preview (nice-to-have for auditors)
- [ ] Bulk CSV import for new sets (in original spec, not yet built)

### Milestone 2 — Game client (`apps/game`)
Scaffold `apps/game` as a Next.js (or React Native Expo) app:
1. Deck loading from Supabase
2. Match creation / room code join
3. Pass-and-play screen (two players, one device) for local testing
4. Basic routing: Home → Deck Builder → Match → Result

### Milestone 3+ — Board UI, gameplay interactions, ability resolution UI

---

## Key File Paths

```
apps/admin/src/
  app/(admin)/cards/[id]/
    CardEditor.tsx          ← main editor shell, tabs, save/publish
    page.tsx                ← server component, fetches card + traits
  components/card-editor/
    AbilitiesBuilder.tsx    ← ability list, AbilityCard, qualifiers, StepsSection
    StepEditor.tsx          ← StepList, StepItem, StepFields, TargetPicker, DurationSelect
    FilterBuilder.tsx       ← shorthand filter form (side/type/color/traits/stats/keywords/flags)
    BasicInfoSection.tsx
    StatsSection.tsx
    TraitsKeywordsSection.tsx
    RulesTextSection.tsx    ← rules text + AI auto-fill
    ImageUpload.tsx
    CardPreview.tsx
    ConditionEditor.tsx
    FormPrimitives.tsx      ← Field, FieldError, Select

packages/schemas/src/
  shorthand-filter.ts       ← normalizeFilter, normalizeTargetRef, normalizeStepFilters
  filter.ts                 ← formal FilterSchema
  action.ts                 ← StepSchema discriminated union
  ability.ts, trigger.ts, card.ts, ...

packages/engine/src/
  (all files listed above)
```

---

## How to Resume

1. Open Claude Code in `/Users/nathhui/Documents/GTCG`
2. Reference this file for context
3. Run `pnpm --filter @project-v/admin typecheck` to verify admin is clean
4. Run `pnpm --filter @project-v/engine test` to verify engine tests pass
5. Continue from **Milestone 2** above
