# 10 — Card Authoring Playbook

The daily workflow for adding cards. This is the doc you'll come back to most often once the system is built. Skim once now; reference forever.

## Mindset

Card authoring is the long-tail work that keeps the app current. New sets drop quarterly. Errata happens. You will spend more time authoring cards over the lifetime of this project than you will spend writing code. Make this fast and pleasant.

The system in this doc treats authoring as a *factory*, not artisanal craft. Every card goes through the same steps. You build muscle memory. After 100 cards, complex effects take 5 minutes; simple cards take 60 seconds.

## The standard authoring loop

### 1. Trigger: a new set drops, or an errata is announced

When Bandai releases a new set or errata, you'll see the official card list within 24 hours on Bandai's site. Community sites (exburst.dev, gcgmeta.com) usually have full data within a week.

### 2. Bulk-import basic data

For new sets:

1. Build a CSV with rows for each card. Columns: `id, set_code, card_number, name, type, color, cost, level, ap, hp, traits, rules_text, rarity`. Either type from the official list, or copy-paste with cleanup.
2. Open admin portal → `/cards/import`
3. Upload the CSV
4. Review validation errors; fix typos
5. Submit
6. All cards now exist as drafts

Time: ~2–3 hours for a 120-card set if you're careful with the CSV.

### 3. Author abilities, one card at a time

Open the card list, filter by `status=draft`, sort by card number. Work through the set in order.

For each card:

1. Click into the card editor
2. Read the official rules text in the "Display text" field
3. Decide: does this need an ability beyond just stats and keywords?
   - **No** (vanilla unit, no abilities): just verify keywords, hit Publish, next.
   - **Yes**: continue.
4. Click "Auto-fill from rules text"
5. Review the AI-generated structure
6. Compare the plain-English preview to the official text
7. Adjust steps as needed: fix targets, add/remove conditions, correct durations
8. Click "Test in Sandbox"
9. Verify the ability fires correctly with the expected outcome
10. Click "Save Draft" (or Publish if confident)

Time per card: 60 seconds (vanilla), 3–5 minutes (simple ability), 10–15 minutes (complex ability).

For 120 cards in a set: ~6–10 hours total. One weekend.

### 4. Publish the set atomically

Once all cards in the set are authored:

1. Open the set page
2. Verify all cards are `draft` (not still in progress)
3. Click "Publish set"
4. Atomically flip all cards to `published`
5. Card data is now live; web app users see new cards on their next page load or data refresh

### 5. Announce to the community

Discord post: "GD04 cards now live in [APP_NAME]. Build away! Report any data errors in #card-corrections."

This invites your community to QA the cards for you.

## The decomposition method (for tricky cards)

When a card has a complex effect, decompose it before touching the form. Use a notepad.

### Step 1: Identify the trigger

Read the rules text. The first thing in brackets is usually the trigger:

- 【Deploy】 → `on_deploy`
- 【Attack】 → `on_attack`
- 【Destroyed】 → `on_destroyed`
- 【When Paired】 → `on_pair`
- 【Burst】 → `on_burst`
- 【Activate・Main】 → `activated_main`
- 【Activate・Action】 → `activated_action`
- 【During Pair】 → `during_pair`
- 【During Link】 → `during_link`

Note any qualifiers: "(Zeon) Pilot," "(Earth Federation) Unit," etc. These become trigger qualifiers.

### Step 2: Identify the cost (if any)

Some abilities have costs. Look for: "Rest this Unit," "Pay X resource," etc.

### Step 3: Decompose the effect into steps

Read the effect text and break it into atomic steps. Each "and then" or sentence boundary is usually a new step.

Example:
> "Choose 1 friendly (Zeon) Unit. It gets AP+2 during this turn. Then, if you have 3 or more (Zeon) Units in the battle area, draw 1."

Decomposes into:

| Step | Action | Notes |
|---|---|---|
| 1 | Choose target | Filter: friendly Zeon Unit (excluding self) |
| 2 | Modify stat | Target: result of step 1, AP +2, end of turn |
| 3 | Draw | Amount 1, condition: 3+ Zeon Units in battle area |

### Step 4: Identify variables (cross-step references)

If a later step refers to "it" or "that Unit" or "that card," you need a stored variable from an earlier step. In the example, step 2 refers to step 1's result — store step 1 as `buff_target`.

### Step 5: Identify conditions

Each step might have conditions. Look for "if," "when," "only if," "unless." In the example, step 3 has the condition "3+ Zeon Units."

### Step 6: Build it in the portal

Now open the form and translate. Each row in your decomposition table is one step in the form.

### Step 7: Verify

The plain-English preview should match the official rules text in semantics (not necessarily word-for-word, but no behavior should differ).

## Common patterns and how to encode them

### "Search your deck for X"

```
Action: search_deck
Side: friendly
Filter: <criteria>
Count: 1
Reveal: public
Store as: searched_card

Action: move_to_hand
Target: $searched_card

Action: shuffle
Side: friendly
Zone: deck
```

### "If [condition], do A. Otherwise, do B."

Use two steps with opposite conditions:

```
Step 1:
  Action: <A>
  Condition: <condition>

Step 2:
  Action: <B>
  Condition: NOT <condition>
```

Or use `prompt_choice` with sub-steps if the player chooses, not the engine.

### "Choose one: A or B"

```
Action: prompt_choice
Prompt: "Choose one effect"
Options:
  - { label: "Effect A", value: "a", sub_steps: [...A...] }
  - { label: "Effect B", value: "b", sub_steps: [...B...] }
```

### "Each (faction) Unit you control gets +X AP"

```
Action: all_matching
Filter: friendly Unit with faction trait
Store as: all_faction_units

Action: modify_stat
Target: $all_faction_units
Stat: AP
Amount: +X
Duration: end_of_turn  (or 'permanent' for static abilities)
```

### "When this attacks, do X"

```
Trigger: on_attack
Steps: [X]
```

For "when this attacks a player vs. unit," add qualifier `target_player: true` or `target_unit: true`.

### "Once per turn"

Add `qualifiers.once_per_turn: true` to the trigger.

### Static / continuous abilities

Use trigger type `static` for "all your X have +1 AP" type effects. The engine treats these as continuous modifiers, recomputed every state update.

### Repair / Blocker / etc.

These are keywords, not abilities. Add them to the card's `keywords` array, not as a custom ability. The engine knows what `repair: 2` means.

## The trait dictionary discipline

This is the single most-important hygiene practice.

### When adding a card with a trait that doesn't exist yet

The portal will warn you: "Trait `psycho_zaku_team` doesn't exist. Create it?"

Before clicking yes:
1. **Check for typos.** Did you mean `psyco_zaku_team` or did Bandai actually use this exact form?
2. **Check for synonyms.** Is there an existing trait that means the same thing? (e.g., `mafty` vs `mafty_navue_erin`)
3. **Check the canonical source.** What does Bandai's official card text say? Use exactly that.

If it's truly new:
1. Open the trait creation modal
2. Slug: lowercase with underscores (`psycho_zaku_team`)
3. Display name: as printed on the card (`Psycho Zaku Team`)
4. Category: `team` / `faction` / `pilot_name` / `mecha_series` / `archetype` / `other`
5. Description: when this trait appears (e.g., "Members of the Psycho Zaku assault team in MS Igloo")

### Periodic trait audit

Every 100 cards or so, open `/traits` and scan for:
- Traits with very low usage (1–2 cards) — possible typos
- Near-duplicate names — possible merges needed
- Inconsistent capitalization / underscore usage

Fix issues by renaming or merging traits. The portal cascades changes to all using cards.

### Pilot-name traits

Convention: every Pilot card with a personal name gets a trait matching their name (lowercase + underscored). E.g., the "Char Aznable" pilot card has trait `char_aznable`. Units with link conditions matching Char then check for `char_aznable`.

This means pilot names are automatic traits. Don't think about it — just add the trait when authoring the pilot.

## Errata workflow

When Bandai issues errata to a card:

1. Open the card in the editor
2. Click "Issue errata" (instead of save)
3. New version is created; old version archived in `card_versions` table
4. New version has fresh edit fields
5. Make the changes (rules text, effects, stats — whatever changed)
6. Save draft, test, publish
7. Web app's next data fetch: replays of old matches still use old version; new decks built use new version

For format-level changes (banning a card):

1. Open the card
2. Set `format_legality.standard_1v1 = 'banned'`
3. Save
4. App will refuse to use this card in new decks; existing decks containing it will fail validation

## Manual mode escape hatch

Some cards are too weird to encode cleanly on first try. Don't let them block your set publish.

Mark the card with `manual_mode: true`. Add a clear `prompt_text` for the manual_resolve step.

In-game: when the ability triggers, both players see a dialog with the official rules text. They agree on the resolution and click "Resolved." Engine continues.

Track manual-mode cards in a Notion / spreadsheet. Revisit them later. Aim to clear the list within a month or two.

This is acceptable for ≤2% of cards. If you hit 10% in manual mode, the vocabulary is too thin and needs expansion.

## When to expand the vocabulary (vs. use manual mode)

| Situation | Action |
|---|---|
| Single weird card, won't be re-used | Manual mode |
| Pattern appears in 3+ cards | Add primitive to vocabulary |
| Pattern is in a hot meta archetype | Add primitive (players will want it) |
| Pattern is in a hyper-niche card | Manual mode |

When adding a primitive:

1. Document the missing primitive (issue or doc note)
2. Add to schemas (one-line addition to enum or new action type)
3. Implement in engine (1–2 hours typically for a new action)
4. Add to admin portal dropdowns (auto-generated from schema in many cases)
5. Re-author the affected cards
6. Ship as app update

Expected frequency: every 1–2 booster sets, maybe one new primitive needed.

## Pre-launch authoring sprint

Before v1 launch, you need ALL cards authored. Realistic estimate: 80–120 hours of focused work for ~1,000 cards.

Strategy:

1. **Bulk-import all sets** at once (~6 hours)
2. **Author starter decks first** (ST01–ST09), as these are simpler and cover most basic effects (~30 hours)
3. **Author boosters** (GD01–GD04) (~50 hours)
4. **Audit all cards** — go through every card, check preview, run sandbox where complex (~10 hours)
5. **Fix bugs found by community testers** (~10 hours buffer)

This can be split across 2–3 weeks if you author 4–6 hours per day.

You can speed this up by trusting the AI auto-fill more — but verify each card. AI errors compound.

## Card data sources

Where to get card information from:

1. **Official Bandai card list** — the source of truth. Use this for rules text, names, stats. Updated by Bandai directly.
2. **Community card databases** (exburst.dev, gcgmeta.com) — convenient for browsing, sometimes include effect categorization (player tags, archetype labels). Don't scrape; use as reference while you type/copy into your CSV.
3. **The official FAQ** (`https://www.gundam-gcg.com/en/rules/faqs/list.php`) — for ruling clarifications. Important for ambiguous interactions. Cite official rulings in your card's `authoring_notes`.
4. **Comprehensive Rules PDF** — for keyword definitions and edge cases. Update your engine when this updates.

Subscribe to Bandai's news page (set a Google Alert) and check community Discord servers for set leaks and errata.

## Initial trait taxonomy seed

When you first launch the admin portal, seed the trait dictionary with the following categories. (This is a starting set; expand as cards are authored.)

### Factions (~12)
`earth_federation`, `zeon`, `principality_of_zeon`, `neo_zeon`, `axis`, `titans`, `aeug`, `londo_bell`, `crossbone_vanguard`, `riah_republic`, `zaft`, `orb`, `coordinator`, `natural`, `celestial_being`, `union`, `aeu`, `human_reform_league`, `a_laws`, `innovator`, `gjallarhorn`, `tekkadan`, `arbrau`, `shaft`, `oz`, `white_fang`, `revolutionary_army`, `colony_assembly`, `space_revolutionary_army`, `mafty`

### Teams / units (~15)
`white_base_team`, `londo_bell`, `red_comet`, `black_tri_stars`, `cyber_newtypes`, `mw_team`, `archangel_crew`, `kira_yamato_team`, `ptolemaios_crew`, `brightslap_squadron`

### Pilot archetypes
`newtype`, `cyber_newtype`, `coordinator`, `innovator`, `innovade`, `super_soldier`

### Mecha series
`gundam`, `zaku`, `gelgoog`, `zeon_remnants`, `mass_production`, `prototype`, `ms`, `ma` (mobile armor)

### Pilot names (~50+)
`amuro_ray`, `char_aznable`, `bright_noa`, `kamille_bidan`, `judau_ashta`, `setsuna_f_seiei`, `kira_yamato`, `athrun_zala`, `shinn_asuka`, `lalah_sune`, `lacus_clyne`, ... (extend as cards are authored)

This list is a starting point. The dictionary will grow to hundreds of entries by the time all sets are authored. The portal supports rename/merge so early mistakes are recoverable.

## QA checklist (before publishing a card)

Run through this list before clicking "Publish":

- [ ] Card name matches the official spelling exactly
- [ ] Set code and card number match the official designation
- [ ] Stats (cost, level, AP, HP) match the printed card
- [ ] Color matches
- [ ] Traits are spelled correctly and exist in the dictionary
- [ ] Rules text is verbatim from the official source
- [ ] Plain-English preview matches the rules text in meaning
- [ ] If the card has a sandbox test, the test passes
- [ ] If the card has manual_mode, there's a clear prompt for players
- [ ] Art URL points to a working image
- [ ] Format legality is correct (legal unless explicitly banned)

## Implementation prompt template

When authoring with AI assistance:

```
I'm authoring Gundam Card Game cards into a structured ability schema. The vocabulary is in @05-effect-vocabulary.md and the schema is in @06-data-schemas.md.

Card details:
Name: {name}
Type: {type}
Traits: {traits}
Rules text: {rules_text}

Generate the abilities array as JSON matching AbilitySchema. Reference traits exactly as their slugs (lowercase, underscored). Output JSON only.
```

This prompt is what runs inside the AI auto-fill feature. You can also use it manually with Claude.ai for cards the in-app feature struggles with.
