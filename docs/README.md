# [APP_NAME] — Build Documentation

A web TCG simulator for a popular collectible card game. Built solo, AI-assisted, ship-quality.

> **Note:** Throughout these docs, `[APP_NAME]` is a placeholder. Find-and-replace once a final name is chosen. Avoid any trademark from the game's IP holder in the name.

---

## Purpose of these docs

These docs are the source of truth for the build. They exist for two readers:

1. **You**, when you forget what you decided three weeks ago.
2. **AI coding tools** (Claude Code, Cursor), which need explicit context to generate good code.

Treat each Markdown file as the context window for that subsystem. When working on the admin portal, paste `07-admin-portal-spec.md` into your AI tool. When building the engine, paste `08-rules-engine.md`. The docs are designed to be small enough to fit in context but complete enough to fully specify the system.

---

## Reading order

If this is your first read, go through them in order. The dependencies are linear:

1. **[01-product-spec.md](01-product-spec.md)** — what we're building, scope, what's explicitly out
2. **[02-strategic-posture.md](02-strategic-posture.md)** — IP risk handling, monetization stance, what's hot-updatable vs requires app release
3. **[03-tech-stack.md](03-tech-stack.md)** — exact stack, libraries, why each
4. **[04-architecture.md](04-architecture.md)** — layered model, data flow, client-side engine
5. **[05-effect-vocabulary.md](05-effect-vocabulary.md)** — the primitives the engine understands
6. **[06-data-schemas.md](06-data-schemas.md)** — Card, Deck, GameState, Match schemas
7. **[07-admin-portal-spec.md](07-admin-portal-spec.md)** — how cards get authored
8. **[08-rules-engine.md](08-rules-engine.md)** — how games are played
9. **[09-web-app.md](09-web-app.md)** — what users see and click
10. **[10-card-authoring-playbook.md](10-card-authoring-playbook.md)** — daily workflow for adding cards
11. **[11-ai-dev-practices.md](11-ai-dev-practices.md)** — how to vibe-code without painting yourself into corners
12. **[12-out-of-scope.md](12-out-of-scope.md)** — explicit non-goals, defenses against scope creep
13. **[BUILD-ORDER.md](BUILD-ORDER.md)** — week-by-week plan with deliverables

---

## Core principles

These run through every doc. If a decision contradicts one of these, the principle wins.

- **Data-driven over hardcoded.** Cards are configuration, not code. Adding a card is filling a form, not writing logic.
- **The schema is the contract.** Zod schemas define what's valid; the admin portal forms generate from them; the engine validates against them. One source of truth.
- **Hot-updatable by default.** Anything that can be changed without a code deploy should be. Data changes reach every user instantly; player frustration with stale data is fast.
- **Form-based authoring, never raw JSON.** The admin portal is a UI over the schema. JSON is the engine's language, never the human's.
- **Preview is non-negotiable.** Every authored ability renders to plain English next to the official rules text. If they don't match, something's wrong.
- **Validation gate before scale.** Build the smallest thing that proves people want it before committing 8 weeks. Show local players the prototype in Week 1.
- **Manual-mode fallback.** Some cards will resist clean encoding. Ship them with a manual-resolution dialog rather than blocking. Encode properly later.
- **Engine logic is shared.** The rules engine is TypeScript that runs identically on both clients in a match. The web app is a thin renderer over it.

---

## Confirmed scope (v1)

- **Platform:** web (Next.js), playable in any browser on desktop, tablet, or phone
- **Mode:** 1v1 online via room code (friends share code, connect, play)
- **No chat, no hot-seat, no AI opponents, no ranked, no tournaments**
- **Free, no monetization**
- **Card pool at launch:** all starter decks (ST01–ST09) + boosters (GD01–GD04), ~1,000 cards
- **Engine:** client-side, deterministic, shared TypeScript
- **Admin portal:** Next.js web app, form-based card authoring with AI auto-fill assist
- **App name:** TBD, will not contain trademarked terms

See [01-product-spec.md](01-product-spec.md) for full scope and explicit non-goals.

---

## Success bar

> "It works flawlessly."

Read as: rules engine is correct, multiplayer sync is reliable, card data is accurate, app doesn't crash. Polish over feature breadth. A small number of features done extremely well beats a large feature set done okay.

---

## Repo structure (target)

```
/
├── apps/
│   ├── web/              # Next.js player-facing web app
│   └── admin/            # Next.js admin portal (separate deployment, not public)
├── packages/
│   ├── engine/           # Shared rules engine (TypeScript)
│   ├── schemas/          # Zod schemas (cards, effects, game state)
│   └── ui/               # Shared UI primitives (if needed)
├── docs/                 # This folder
├── supabase/             # Supabase migrations and config
└── README.md             # Pointer to docs/README.md
```

This is a monorepo. The shared `engine` and `schemas` packages are the spine — the web app, admin portal, and any future server all depend on them.

---

## Quick links

- **Build sequence:** [BUILD-ORDER.md](BUILD-ORDER.md)
- **First-week deliverable:** Validation prototype, see [BUILD-ORDER.md § Phase 0](BUILD-ORDER.md#phase-0-validation-week-0)
- **The non-negotiable architecture decision:** [04-architecture.md § Layer 2: Filter expression language](04-architecture.md)
