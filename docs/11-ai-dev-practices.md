# 11 — AI Development Practices

You're building this 99% with AI tools. This doc is the playbook for doing that without ending up with an unmaintainable mess.

## The mindset

You are not the coder. You are the **architect, reviewer, and integrator**. The AI is the coder. Your job is to:

1. Define what's being built (specs, this doc set)
2. Direct AI to build it section by section
3. Read what AI produced and verify it's right
4. Test it works
5. Integrate pieces together
6. Fix what's broken

Done well, this is faster than coding yourself. Done poorly, you produce a tangle of plausible-looking code that doesn't actually work and breaks subtly when you change anything.

## Tools

### Claude Code (primary)

Use for:
- Architectural changes ("refactor the engine to support X")
- Multi-file features (admin portal screen + API route + DB migration)
- Reading the codebase before making changes
- Running tests and iterating

Workflow: open terminal in repo root. Run `claude` or `claude code`. Have your spec doc open in another window or attach to the conversation. Give Claude the implementation prompt. Review changes before accepting.

### Cursor (secondary)

Use for:
- In-editor edits within a single file
- Quick fixes
- Tab-complete style coding

Useful when you know exactly the change but don't want to type it.

### Direct Anthropic API (rare)

Use only for the AI auto-fill feature in the admin portal. Don't use the API directly for general coding — use Claude Code.

## Prompting principles

### Always provide context

Bad: "Add a deck builder."
Good: "Following /docs/09-mobile-app-spec.md (attached), implement the deck editor screen. Use the schemas from /packages/schema/deck.ts."

The doc set is your context library. Reference it constantly.

### Always specify the interface

Bad: "Make a function that validates decks."
Good: "Implement validateDeck(deck: Deck, format: Format): { valid: boolean, errors: string[] }. Validate per the rules in /docs/06-data-schemas.md. Use Zod for schema-level checks; manual checks for format-specific (50 main, 10 resource, 4-of-each)."

### Constrain output

Bad: "Add tests."
Good: "Add Vitest tests for validateDeck covering: valid deck, undersized main deck, oversized main deck, 5-of-one-card, banned card. Use snapshot tests for error messages."

### Iterate, don't redo

If output is 80% right, ask for a focused change. Don't ask Claude to "redo it cleaner."

Bad: "This is wrong, redo it."
Good: "The validation logic on line 47 misses the case where main deck has correct count but >4 of one card. Fix only that."

### Resist scope creep in prompts

If your prompt is 6 paragraphs long with sub-bullets, you're probably bundling too much. Break it into smaller prompts.

Rule of thumb: a single prompt should produce 50–300 lines of code. More than that and the AI will start drifting.

## Code review discipline

After every AI-generated change, you must:

1. **Read the diff.** Top to bottom. Don't skim.
2. **Check for hallucinations.** Did Claude reference functions that don't exist? Imports from packages we don't have?
3. **Check error handling.** Does it use try/catch where it should? Are errors typed?
4. **Check tests.** Are there tests? Do they cover edge cases?
5. **Run the tests.** Don't trust "it should work."
6. **Check it integrates.** Does the new code actually fit with the existing patterns?

If any of the above fails, send Claude back with specific feedback. Don't accept marginal code.

## Testing discipline

This is where AI projects most often fail. You need tests, and you need to actually run them.

### Coverage targets

- /packages/engine: 90%+ line coverage. Engine bugs destroy player trust.
- /packages/schema: schema definitions don't need tests, but parsing edge cases do
- Admin portal: 60%+ on form validation, filter builder, condition builder
- Mobile app: 40%+ on key flows (deck validation, action dispatching)

### Test types

- **Unit tests** (Vitest): function-level, fast
- **Integration tests**: multiple components together
- **Scenario tests** (engine specifically): full mini-matches
- **E2E tests** (Detox for mobile): critical user flows
- **Visual tests** (admin portal): snapshot tests on form rendering

### Test before merging

Set up a CI check on every commit (GitHub Actions):

```yaml
- name: Type check
  run: pnpm typecheck
- name: Lint
  run: pnpm lint
- name: Test
  run: pnpm test
- name: Engine coverage gate
  run: pnpm --filter engine test --coverage --coverage.thresholds.lines=85
```

If CI fails, don't merge. Period.

## Module discipline

AI generates code well in modules of 200–400 lines. It struggles with monoliths.

Keep files small. Split when a file exceeds 400 lines. Group related code into folders.

Example structure for a feature:

```
/src/features/deck-builder/
├── DeckBuilderScreen.tsx       (orchestration, ~150 lines)
├── DeckCardList.tsx            (~80 lines)
├── DeckCardItem.tsx            (~50 lines)
├── DeckValidator.ts            (logic, ~100 lines)
├── DeckValidator.test.ts       (~150 lines)
├── useDeckBuilder.ts           (Zustand store, ~80 lines)
└── index.ts                    (exports)
```

Each file has one responsibility. Each is small enough that AI can rewrite it confidently.

## Naming conventions

Be consistent. AI cargo-cults patterns from the codebase, so set patterns early.

- **Files**: PascalCase for components (`DeckBuilder.tsx`), camelCase for utilities (`validateDeck.ts`)
- **Functions**: camelCase (`validateDeck`)
- **Types**: PascalCase (`Deck`, `GameState`)
- **Zod schemas**: PascalCase + Schema suffix (`DeckSchema`, `GameStateSchema`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_DECK_SIZE`)
- **DB tables**: snake_case plural (`cards`, `match_states`)
- **DB columns**: snake_case (`card_data_version`)

Add these to a `STYLE_GUIDE.md` and reference it in prompts when you see Claude drift.

## Git discipline

### Commit early, commit often

After every working feature: commit. Even small ones. AI will eventually break something catastrophically and you need clean rollback points.

```
git add .
git commit -m "feat(engine): implement deploy_unit action with cost validation"
```

### Use conventional commits

- `feat:` new feature
- `fix:` bug fix
- `refactor:` no behavior change, code reorganization
- `test:` adding tests
- `docs:` doc changes
- `chore:` dependencies, configs

### Branch per feature

`main` is always working. Each feature in a branch. Merge via PR (you can be the reviewer).

### Tag releases

When admin portal v1 is shipped, tag it: `admin-v1.0.0`. When mobile app submits to App Store: `mobile-v1.0.0`. Lets you track what was shipped when.

## Debugging strategies

When something breaks (and it will):

1. **Reproduce it consistently first.** Write a test if possible.
2. **Read the error.** Actually read it. AI tends to skip this and apply random fixes.
3. **Check recent diffs.** What changed since it last worked?
4. **Bisect** if necessary: `git bisect` to find the commit that broke things.
5. **Ask Claude with full context**: paste the error, the relevant code, and what you've tried. Don't be lazy.
6. **Resist symptom-fixing.** If you don't understand why something broke, you'll just paper over it and it'll resurface.

## When to refactor

Refactor when:

- A file is over 400 lines and has multiple responsibilities
- A pattern appears in 3+ places and could be extracted
- Tests are hard to write (usually means coupling is high)
- AI keeps making the same mistakes (the structure is confusing it)

Don't refactor when:

- Things "feel ugly" but work fine
- You're avoiding the next feature
- It would touch many files for marginal benefit

Refactors should be in their own commits, no behavior changes.

## When to escape AI

Sometimes you need to bypass the AI:

- Configuration files where AI gets exact syntax wrong (Tailwind config, EAS config, native iOS Info.plist)
- Secrets / environment variables (do these manually, never in commits)
- Final UX polish where you want exact pixel control

It's fine to do these manually. AI isn't a religion.

## Common AI failure modes to watch for

### Hallucinated APIs

AI invents library functions. "Use the `expo-camera-secure` package" — nope, doesn't exist. Always verify.

### Outdated patterns

AI's training data may include old React Native, old Supabase patterns. If something looks weird, search the official docs.

### Plausibility over correctness

AI produces code that *looks* like it should work. Reading without running is dangerous. Always run tests.

### Context window drift

In long Claude Code sessions, the model loses track. Restart the session every 30–60 minutes or after major changes.

### Over-engineering

AI loves abstractions. If you ask for a function and it produces a class hierarchy, push back: "Just a function please. No classes."

### Under-testing

AI generates tests but only the happy path. Always ask for edge cases explicitly.

## Documentation as code

Treat the doc set in `/docs` as part of the codebase:

- Update docs when behavior changes
- Reference docs in prompts
- If reality diverges from docs, fix one or the other (don't let drift)
- Docs are source-of-truth for "how it should work"

When you finish a feature, ask: "Did I update the doc?"

## Personal coding skills you'll pick up

Even with AI doing 99%, you'll learn:

- TypeScript types (you'll read them constantly)
- Zod schema patterns
- React component composition
- Postgres query patterns
- Git commands
- Reading error messages
- Debugging principles

This is OK. By the end of this project, you'll be a much better engineer than you started. That's a side benefit.

## When to ask for human help

If AI is stuck for more than 30 minutes on the same problem, get human eyes:

- Post in a developer Discord (Expo, Supabase have active ones)
- Ask on Stack Overflow (real people, slower but more reliable)
- Hire a freelance developer for a 1-hour consultation if it's blocking ($100–200 well spent)

Don't burn 4 hours stuck. Time-box.

## Implementation prompt template

(This doc is meta — the prompts are in the system docs themselves.)
