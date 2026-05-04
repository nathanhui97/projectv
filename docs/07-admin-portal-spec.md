# 07 — Admin Portal Spec

The admin portal is the most important part of [APP_NAME] for the operator (you). It is the *only* tool you'll ever use to manage card data. Form-based, validated, previewed, tested.

You never write JSON. The portal generates JSON behind the scenes from the forms.

## Tech reminder

Next.js 14 App Router + TypeScript + shadcn/ui + Tailwind + React Hook Form + Zod (shared with engine).

## Pages and routes

```
/                       Login / landing
/login                  Email + password login
/dashboard              Stats: card count, drafts, recent activity
/cards                  Card list (search, filter, paginate)
/cards/new              Card editor (blank)
/cards/[id]             Card editor (existing)
/cards/import           Bulk CSV import wizard
/traits                 Trait dictionary
/traits/[slug]          Single trait detail (cards using it)
/sets                   Set list
/sets/[code]            Set detail (all cards in set, publish status)
/formats                Format list
/formats/[slug]         Format detail (legality table)
/sandbox                Sandbox tester (load any card and run it)
/playtest               Manual playtest UI (run a fake match)
/system/version         View / bump card_data_version
/system/users           Admin user management
/system/errata          List errata changes
```

## Authentication

Login via Supabase Auth. Only users with `profiles.is_admin = true` access. Redirect to `/login` otherwise. Server-side rendering for protected routes; double-check on Edge Function calls.

## Core screen: the card editor

The highest-leverage screen. Three-column desktop layout (admin portal is desktop-only):

```
┌─────────────┬──────────────────────────┬────────────────┐
│ Card preview│  Form editor             │  Live preview  │
│ (image,     │  (basics, abilities,     │  (plain Eng-   │
│  rarity,    │   keywords)              │   lish render) │
│  set code)  │                          │                │
│             │                          │  Test sandbox  │
│ Save status │                          │  (run card)    │
│ Draft tag   │                          │                │
│             │                          │  Publish action│
└─────────────┴──────────────────────────┴────────────────┘
```

### Form sections

#### Section 1: Basic info

- **Card ID** (text, e.g., `GD01-042`) — primary key, immutable after save
- **Name** (text) — autocomplete from existing names
- **Set** (select from sets) — autopopulates set_code
- **Card number** (text) — usually derived from card ID
- **Rarity** (select: C, U, R, SR, LR)
- **Card type** (select: Unit, Pilot, Command, Base, Resource, Token)
- **Color** (multi-select: blue, green, red, white, black; auto-determines `multi`)
- **Cost** (number, 0–10)
- **Level** (number, 0–10)

Form fields shown change based on card type.

#### Section 2: Combat stats (Units and Bases only)

- **AP** (number)
- **HP** (number)

#### Section 3: Pilot fields (Pilots only)

- **AP modifier** (number, default 0) — added to paired Unit's AP
- **HP modifier** (number, default 0)
- **Pilot link traits** (multi-select chips) — what traits this Pilot satisfies for link conditions

#### Section 4: Unit link conditions (Units only)

A filter builder. Unit links if paired Pilot satisfies this filter.

UI: series of "match any of these" entries. Each entry has:
- Pilot name (text autocomplete, optional)
- Pilot traits (multi-select chips, optional)

Multiple entries = "any of"; within an entry = "all of".

Live preview: "Links with: Amuro Ray, OR any pilot with traits [White Base Team]."

#### Section 5: Traits

Multi-select chip input with autocomplete from `traits` table. Autocomplete shows `display_name`, stores `slug`. "Create new trait" button when no match — opens modal with slug, display name, category fields.

Critical UX: typo prevention. If user types "zoen", autocomplete shows nothing — they must explicitly create a new trait, forcing them to notice the typo.

#### Section 6: Rules text

Textarea for the official Bandai rules text exactly as printed. Used for display in the encyclopedia and as a reference when authoring abilities.

Below textarea: "Auto-fill abilities from this text" button → triggers AI auto-fill.

#### Section 7: Keywords

Repeatable section. Each row:
- Keyword (select: Repair, Breach, Support, Blocker, First Strike, High-Maneuver, Suppression)
- Value (number, optional — for Repair X, Support X, etc.)

#### Section 8: Abilities builder

The most complex part. Each ability is a card-like UI block:

```
┌─ Ability ────────────────────────────────────────────────┐
│ Trigger: [Dropdown: Deploy / Destroyed / When Paired...] │
│ ├─ Trigger options (varies by trigger type)              │
│ │  E.g., for When Paired: Pilot must satisfy [filter]    │
│ │  E.g., Once per turn? [✓]                              │
│ │                                                         │
│ Cost (optional): [+ Add cost step]                       │
│                                                           │
│ Steps:                                                    │
│ ├─ Step 1 [drag handle]                                  │
│ │  Action: [Dropdown]                                    │
│ │  ...action-specific fields...                          │
│ │  Condition (optional): [+ Add condition]               │
│ │  Store result as: [text input]                         │
│ │                                                         │
│ ├─ Step 2 [drag handle] (similar)                        │
│ │                                                         │
│ └─ [+ Add step]                                          │
│                                                           │
│ [Delete this ability]                                    │
└──────────────────────────────────────────────────────────┘
```

Drag-to-reorder steps within an ability.

`[+ Add ability]` button at the bottom of all abilities.

##### Action-specific fields

When user picks an action from the dropdown, only relevant fields are revealed:

- `draw` shows: amount, target_player
- `deal_damage` shows: target (filter or variable picker), amount, source (defaults to $self)
- `modify_stat` shows: target, stat (AP/HP), amount, duration
- `choose_target` shows: filter (filter builder), selector (player_choice / opponent_choice / random), min, max, optional, store_as

Form auto-validates that stored variables are referenced consistently.

##### The filter builder

Filters appear in many places (target selection, trigger qualifiers, conditions, link conditions). It's a reusable component.

```
┌─ Filter ────────────────────────────────────────┐
│ Side: [Friendly ▼]                              │
│ Zone: [Battle Area ▼]                           │
│ Type: [Unit ▼]                                  │
│ Color: [Any ▼]                                  │
│ Must have traits: [+ Add chip]                  │
│ Must NOT have traits: [+ Add chip]              │
│ Cost: [<= ▼] [3]                                │
│ AP: [Any ▼]                                     │
│ Exclude self: [✓]                               │
│ Is paired: [Don't care ▼]                       │
│ Has keyword: [Don't care ▼]                     │
│                                                  │
│ Live match count: 12 cards in DB match this     │
│                                                  │
│ [+ Combine with AND] [+ Combine with OR] [+ NOT]│
└──────────────────────────────────────────────────┘
```

The "Live match count" runs the filter against the current DB. Sanity check.

When user clicks "Combine with AND/OR", the filter becomes a combinator with sub-filters.

##### The condition builder

Similar pattern. Conditions are typed:
- Count cards matching filter, compare with operator
- Exists / not exists
- Player has level X+
- Resource count >= X
- Card has keyword
- AND / OR / NOT combinators

#### Section 9: Manual mode

A simple checkbox: "Manual mode — engine cannot auto-resolve this ability."

When checked, abilities builder is replaced with a textarea where admin writes a human-readable instruction for players to follow at runtime.

### Live plain-English preview (right column)

As admin builds the ability, plain-English render appears in the right column. Generated by `renderAbilityToText(ability: Ability): string` (lives in /packages/engine).

Example: Char's Custom Zaku II preview:

> **Triggered ability:** When this Unit is paired with a Pilot that has the trait Zeon (once per turn):
> 1. Choose 1 friendly Unit in the battle area with the trait Zeon (excluding this Unit). Save as `buff_target`.
> 2. The chosen Unit gets AP+2 until end of turn.
> 3. (If you have 3 or more friendly Units in the battle area with the trait Zeon) Draw 1 card.

Below the rendered preview: side-by-side comparison with the official `rules_text` field. If they don't match, something's off and admin should fix.

### Test in sandbox (right column)

Button: **"Test this card in sandbox"**.

Click → modal:
- Pick an opponent deck (or "use generic test opponent")
- Pick game state stage (turn 1, mid-game, late-game)
- Set up the board (drag cards into zones to set up scenarios)

Then runs a sandbox match where the card is in play. Admin verifies "yes this triggers correctly," "yes the AP buff persists until end of turn."

### Save / publish workflow

Three states: draft, published, archived.

- **Save Draft** — saves with `is_published: false`. Always available.
- **Publish** — sets `is_published: true`. Requires:
  - All required fields filled
  - At least one ability OR confirmed it has none
  - Live preview renders without errors
  - Schema validation passes
- **Archive** — sets `is_archived` flag. Card hidden from deck builder but historical matches still work.

After publish, `metadata.card_data_version` increments and a `card_versions` row is created.

### History view

Tab on card editor: "History". Shows all `card_versions` rows with:
- Version number
- Edited by (admin username)
- Edited at (timestamp)
- Change note
- Diff (what fields changed)
- "Restore this version" button

## Bulk CSV import wizard

Used when a new set drops. CSV columns:

```
id,name,set_code,card_number,rarity,card_type,color,cost,level,ap,hp,
pilot_ap_modifier,pilot_hp_modifier,traits,rules_text,flavor_text
```

Abilities NOT included — those must be authored individually.

Wizard flow:
1. Upload CSV
2. Parse and show preview table
3. Validate against schema (errors per row)
4. User confirms
5. Insert as drafts (`is_published: false`, no abilities, manual_mode: false)
6. Show "Next: author abilities for these cards" call-to-action

## AI-assisted auto-fill

When admin clicks "Auto-fill abilities from rules text":

1. Frontend sends rules text + card metadata to a Next.js API route
2. API route calls Anthropic API with system prompt that includes:
   - Effect vocabulary doc as context
   - Examples of correctly-encoded cards
   - Target rules text
3. Anthropic responds with structured Ability JSON
4. API route validates response against AbilitySchema (Zod)
5. If valid, returns to frontend
6. Frontend populates the ability builder form with the AI's structured data
7. Admin reviews, corrects, and saves

**Important:** the form is the source of truth. AI output goes through the form, not directly to DB. Admin always reviews. The preview text generated from the form is what's compared to the official text.

System prompt sketch:

```
You are an expert at translating Gundam Card Game card rules text into structured ability data.

Given the following vocabulary [include vocabulary doc] and examples [include 5–10 worked examples], translate the following card text into a JSON array of Ability objects matching the schema [include AbilitySchema].

Be conservative: if you're unsure about a step's structure, err on the side of using `manual` action with explanatory text. The admin will review your output.

Card text:
{rules_text}

Card type: {card_type}
Card name: {name}
```

Cost: ~3000–6000 tokens per call, ~$0.02–0.06 per card. For 1000 cards: $20–60. Acceptable.

## Cards list view

Standard data table with:
- Search by name (debounced)
- Filter by: set, type, color, rarity, manual_mode, is_published, has_abilities, has_keywords
- Sort by any column
- Pagination
- Bulk actions: publish, archive, delete (with confirmation)

Columns:
- Thumbnail
- Card ID
- Name
- Set
- Type
- Color
- Cost
- Status (Draft / Published / Archived)
- Last edited

Click row → opens card editor.

## Trait dictionary view

Table of traits:
- Slug
- Display name
- Category
- Card count (denormalized)
- Created

Actions:
- Add trait
- Edit trait (rename — propagates to all cards using it)
- Merge traits (consolidate two traits — fixes typo splits)
- Delete trait (only if card_count = 0)

## Set view

For each set:
- Set code, display name, release date
- Card count, drafts count, published count
- Quick action: "Bulk publish all drafts"

## Format legality view

Card list with format-specific status: legal, restricted, banned. Admin can change status with effective_date. Format legality changes do NOT bump card_data_version (separate update flag).

## Sandbox / playtest

Free-form playtest UI. Admin can:
- Pick two decks (or set up arbitrary card piles)
- Click "Start match"
- Make moves on either side (admin plays both)
- Engine logs every event in a side panel
- Step through actions
- Inspect state at any point

Mostly for verifying card behavior end-to-end.

## System pages

### Version

Shows current `card_data_version`. Allows manual bump (used after big content updates if you want to force web app clients to refetch).

### Errata

Lists all errata events (cards updated after publish, with diffs). Used for community changelog.

### Users

Lists admin users. Add/remove admin role.

## Performance and concerns

- Card list paginated server-side; never load all 1000+ at once
- Filter builder live-count debounced 300ms
- AI auto-fill button disabled during call (prevent double-submit)
- Image upload via Supabase Storage with progress indicator
- Forms autosave every 30s as draft (avoid losing work to refresh)
- Confirmation modals on destructive actions (delete, merge, archive)

## Open questions

- **Multi-admin coordination**: do we need card-level locks to prevent simultaneous edits? Recommendation: yes, optimistic locking via `data_version` column. If two admins edit the same card and one saves first, the second's save errors with a "conflict, refresh and retry" message.
- **Card images for unknown cards (no Bandai art yet)**: provide a placeholder template that includes basic layout. Admin can replace later when art appears.
- **Translation support**: v1 is English only. Schema supports adding `name_ja`, `rules_text_ja` etc. later but UI doesn't surface them.

## Implementation prompt template

When ready to build the admin portal, paste this into Claude Code along with this doc, the schema doc, and the vocabulary doc:

> Implement the [APP_NAME] admin portal as specified in /docs/07-admin-portal-spec.md. Use the data schemas from /docs/06-data-schemas.md and the Zod schemas in /packages/schema.
>
> Build in this order:
> 1. Auth gate: login page + middleware that requires is_admin role
> 2. Layout: sidebar nav with all routes; header with username + logout
> 3. Cards list page: table with search, filter, pagination
> 4. Card editor (the hardest one): three-column layout, all sections, drag-to-reorder steps, live preview, schema validation
>    - Use React Hook Form with Zod resolver
>    - Subcomponents: FilterBuilder, ConditionBuilder, AbilityBuilder, StepBuilder
>    - Plain-English preview function: renderAbilityToText(ability) — implement in /packages/engine since the engine uses similar logic
> 5. Trait dictionary: table + create/edit/merge UI
> 6. Bulk CSV import wizard
> 7. Sandbox tester: invokes engine.applyAction in a controlled state
> 8. AI auto-fill API route: calls Anthropic API with system prompt including vocabulary doc
> 9. Set / Format / System pages
>
> Use shadcn/ui components throughout (DataTable, Form, Dialog, Sheet, Combobox). Tailwind for layout. TanStack Query for all Supabase fetches.
>
> Do NOT yet implement: card image processing pipeline (separate script), multiplayer match UI (player-facing web app concern).
>
> When in doubt about UX, prioritize: form clarity, validation feedback, and live preview accuracy.
