# 03 — Tech Stack

Exact stack, with rationale. The principle: pick boring, AI-fluent, and well-documented over clever or new.

## Top-level choices

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | One language across web app, admin portal, engine. Type safety is non-optional for a rules engine. |
| Web app (player-facing) | Next.js 14+ (App Router) | Same as admin portal — one framework, two apps. SSR for fast initial load; ISR for card catalog. |
| Admin portal | Next.js 14+ (App Router) | Standard React stack, AI-fluent, fast to build CRUD. Separate deployment, not publicly linked. |
| Backend | Supabase | Postgres + auth + realtime + storage in one. Cheap. AI tools generate Supabase code well. |
| Schema validation | Zod | Define schemas once, validate everywhere. Generates TypeScript types automatically. |
| UI library | shadcn/ui + Tailwind | Copy-paste components, full control, beautiful defaults, AI-fluent. Used in both apps. |
| Rules engine | Pure TypeScript, no framework | Lives in `packages/engine`. Importable by both apps. Deterministic. |
| Realtime sync | Supabase Realtime | Postgres-backed, simple, free tier handles thousands of concurrent matches. |
| State management | Zustand | Lightweight, AI-fluent, perfect for game state in the web app. |
| Form library | React Hook Form + Zod resolver | Industry standard, generates from schemas. Used in both apps. |
| Drag-and-drop | dnd-kit | Modern, React-specific, accessible, works on desktop and mobile touch. Used for the match game board. |
| Animations | framer-motion | Declarative, well-documented, excellent for card-game-style transitions. |
| Monorepo tool | Turborepo + pnpm workspaces | Standard, well-documented, AI-fluent. |
| Deployment | Vercel | Next.js native, free tier sufficient, automatic CI/CD from git push. Both apps deployed separately. |
| AI assist (in-app feature) | Anthropic API (claude-opus-4-7) | For ability auto-fill from rules text. Server-side only in admin portal. |
| Error tracking | Sentry | Free tier, @sentry/nextjs integration, catches server and client errors. |
| Analytics (lightweight) | PostHog (cloud, free tier) | Privacy-friendly, self-host option later. `posthog-js` for the web app. |

## Why these specifically

### Why two separate Next.js apps instead of one

Admin portal and player-facing web app are kept as separate Vercel projects. The admin portal URL is not publicly linked anywhere. This gives a hard separation: players can never accidentally navigate to admin pages, and admin auth logic doesn't contaminate the player-facing codebase. They share the `engine` and `schemas` packages but have independent deployments and independent auth flows.

### Why Next.js for the player-facing app

- App Router gives SSR for fast first paint (card catalog pre-rendered)
- Same framework as admin portal — one mental model, shared AI context
- Server Components for data fetching, Client Components only where interactivity is needed
- Vercel deployment is zero-config; automatic branch preview URLs for testing

### Why Supabase over Firebase

- Postgres (real SQL, real foreign keys, real schema) vs Firestore's NoSQL constraints
- Card data is highly relational (cards → traits, cards → abilities, decks → cards) — Postgres is the right tool
- Cheaper at scale
- Self-host option later if needed
- Realtime is built-in (Postgres replication-based)
- Storage included for card images

### Why client-side engine

Rules engine runs in TypeScript in each player's browser. The server (Supabase) just relays state changes. Specifically:

- ✅ Faster to build (no separate server to deploy/maintain)
- ✅ Lower latency (no server round-trip for every action)
- ✅ Zero ongoing server cost beyond Supabase
- ✅ Engine is the same code that runs in the admin portal sandbox

Trade-offs:
- ❌ Vulnerable to cheating (a player could modify their client). Acceptable in v1 because no ranked, no stakes. Friend-only play self-polices.
- ❌ Both clients must agree on state. We use deterministic engine + checksums to detect desync; the room creator's state wins on conflict.

Server-authoritative engine is a v2 conversation when we add ranked.

### Why dnd-kit for drag-and-drop

The game board requires dragging cards from hand to zones and between zones. dnd-kit is:
- React-specific and hook-based — no class components, no legacy API
- Actively maintained (2024 releases)
- Accessible by default (keyboard + pointer + touch)
- Works on mobile browsers without extra configuration
- Composable — use only the sensors and modifiers you need

### Why Zod as the spine

Zod is the single source of truth for what card data, ability data, and game state look like.

```typescript
// packages/schemas/src/card.ts
export const CardSchema = z.object({
  id: z.string(),
  name: z.string(),
  // ... etc
});

export type Card = z.infer<typeof CardSchema>;
```

This one definition gives you:
- TypeScript types throughout the codebase
- Runtime validation in both portals
- Runtime validation when the engine loads cards
- Auto-generated form fields

When you add a field, all four places update. No drift.

### Why Turborepo + pnpm workspaces

Monorepo because three packages share code:
- Web app uses engine and schemas
- Admin portal uses engine (for sandbox testing) and schemas
- Engine uses schemas

Without a monorepo, you'd publish packages to npm or copy files. With one, all three update together.

## Specific library choices

### Web app (player-facing)

```json
{
  "next": "^14 (App Router)",
  "react": "^18",
  "@supabase/ssr": "latest",
  "@supabase/supabase-js": "^2",
  "tailwindcss": "^3",
  "@radix-ui/react-* (via shadcn/ui)": "latest",
  "react-hook-form": "^7",
  "zod": "^3",
  "@hookform/resolvers": "^3",
  "@tanstack/react-query": "^5",
  "zustand": "^4",
  "@dnd-kit/core": "latest",
  "@dnd-kit/sortable": "latest",
  "@dnd-kit/utilities": "latest",
  "framer-motion": "latest",
  "lucide-react": "icons",
  "sonner": "toasts",
  "@sentry/nextjs": "latest",
  "posthog-js": "latest"
}
```

### Admin portal

```json
{
  "next": "^14 (App Router)",
  "react": "^18",
  "@supabase/ssr": "latest",
  "@supabase/supabase-js": "^2",
  "tailwindcss": "^3",
  "@radix-ui/react-* (via shadcn/ui)": "latest",
  "react-hook-form": "^7",
  "zod": "^3",
  "@hookform/resolvers": "^3",
  "@tanstack/react-query": "^5",
  "lucide-react": "icons",
  "sonner": "toasts",
  "@anthropic-ai/sdk": "latest (for AI auto-fill feature)"
}
```

### Engine package

Pure TypeScript, minimal deps:

```json
{
  "zod": "^3",
  "nanoid": "^5 (id generation)",
  "immer": "^10 (immutable state updates)"
}
```

That's it. The engine has no UI, no network, no framework — just functions that take state + action → new state. This makes it testable in isolation.

### Schemas package

Even more minimal:

```json
{
  "zod": "^3"
}
```

## Folder structure

```
[APP_NAME]/
├── apps/
│   ├── web/                       # Next.js player-facing app
│   │   ├── app/                   # App Router pages
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── signup/
│   │   │   ├── (main)/
│   │   │   │   ├── play/
│   │   │   │   │   └── [matchId]/
│   │   │   │   ├── decks/
│   │   │   │   │   └── [deckId]/
│   │   │   │   ├── cards/
│   │   │   │   │   └── [cardId]/
│   │   │   │   ├── history/
│   │   │   │   └── profile/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   ├── lib/
│   │   ├── stores/                # Zustand stores
│   │   └── package.json
│   └── admin/                     # Next.js admin portal (separate deployment)
│       ├── app/                   # App Router pages
│       │   ├── (auth)/
│       │   ├── cards/
│       │   ├── traits/
│       │   ├── sets/
│       │   └── layout.tsx
│       ├── components/
│       ├── lib/
│       └── package.json
├── packages/
│   ├── engine/                    # Rules engine
│   │   ├── src/
│   │   │   ├── state.ts
│   │   │   ├── actions.ts
│   │   │   ├── effects.ts
│   │   │   ├── filters.ts
│   │   │   ├── phases.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── schemas/                   # Zod schemas
│   │   ├── src/
│   │   │   ├── card.ts
│   │   │   ├── effect.ts
│   │   │   ├── filter.ts
│   │   │   ├── game-state.ts
│   │   │   └── index.ts
│   │   └── package.json
│   └── ui/                        # Shared UI (later, if needed)
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── docs/                          # This folder
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

## Versions and pinning

- Pin all deps to exact versions (no `^` or `~`) once you find a working combo. Card games + rules engines + AI codegen = you do not want surprise dep upgrades.
- Use `pnpm-lock.yaml`. Commit it.
- Upgrade deliberately, not automatically.

## Environment variables

```
# Web app and admin (server-side)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Admin only
SUPABASE_SERVICE_ROLE_KEY=    # server-side, NEVER expose to browser
ANTHROPIC_API_KEY=             # for AI auto-fill, server-side only

# Both apps, for error tracking
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
```

Use Vercel's environment variable settings for both apps. Never commit `.env` files. The repo includes a `.env.example` with empty values.

## Things explicitly NOT in the stack

- ❌ React Native, Expo, Expo Router — web only for v1
- ❌ NativeWind — use plain Tailwind
- ❌ EAS Build, App Store Connect, Play Console — no native app
- ❌ MMKV, AsyncStorage — use browser localStorage / Zustand persist
- ❌ Redux, MobX, Recoil — Zustand is enough
- ❌ GraphQL — Supabase REST + RPC is sufficient
- ❌ tRPC — overkill, adds complexity
- ❌ Prisma — Supabase migrations handle the schema
- ❌ A separate game server (Node.js, Colyseus, etc.) — client-side engine in v1
- ❌ Custom WebSocket layer — Supabase Realtime
- ❌ Storybook — diminishing returns for solo dev with AI assist
- ❌ Microservices — one Supabase project, two apps, three packages

If a future need pushes against any of these, revisit deliberately. Don't pre-add.

## AI dev tooling (your toolchain)

Not part of the runtime stack but worth specifying:

- **Claude Code** — for architecture, complex changes, multi-file refactors
- **Cursor** — for in-flow editing, autocomplete, single-file changes
- **GitHub Copilot** — optional, supplements Cursor
- **Anthropic Console** — for testing prompts you'll bake into the AI auto-fill feature

See [11-ai-dev-practices.md](11-ai-dev-practices.md) for how to use these productively.
