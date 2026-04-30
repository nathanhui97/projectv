# 03 — Tech Stack

Exact stack, with rationale. The principle: pick boring, AI-fluent, and well-documented over clever or new.

## Top-level choices

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | One language across mobile, web, engine. Type safety is non-optional for a rules engine. |
| Mobile framework | React Native + Expo | Cross-platform iOS/Android, massive AI training corpus, Expo handles deployment pain. |
| Admin portal | Next.js 14+ (App Router) | Standard React stack, AI-fluent, fast to build CRUD. |
| Backend | Supabase | Postgres + auth + realtime + storage in one. Cheap. AI tools generate Supabase code well. |
| Schema validation | Zod | Define schemas once, validate everywhere. Generates TypeScript types automatically. |
| UI library (admin) | shadcn/ui + Tailwind | Copy-paste components, full control, beautiful defaults, AI-fluent. |
| UI library (mobile) | React Native primitives + NativeWind | NativeWind = Tailwind for React Native. Consistent styling language with admin. |
| Rules engine | Pure TypeScript, no framework | Lives in `packages/engine`. Importable by both apps. Deterministic. |
| Realtime sync | Supabase Realtime | Postgres-backed, simple, free tier handles thousands of concurrent matches. |
| State management | Zustand (mobile), React state (admin) | Zustand is lightweight, AI-fluent, perfect for game state. |
| Form library (admin) | React Hook Form + Zod resolver | Industry standard, generates from schemas. |
| Monorepo tool | Turborepo + pnpm workspaces | Standard, well-documented, AI-fluent. |
| Deployment (admin) | Vercel | Next.js native, free tier sufficient. |
| Deployment (mobile) | Expo EAS Build + App Store / Play Store | Expo handles native builds; you don't touch Xcode. |
| AI assist (in-app feature) | Anthropic API (Claude Sonnet) | For ability auto-fill from rules text. |
| Error tracking | Sentry | Free tier, dead simple integration, catches crashes. |
| Analytics (lightweight) | PostHog (cloud, free tier) | Privacy-friendly, self-host option later. |

## Why these specifically

### Why React Native + Expo over Flutter

- AI tools have far more React Native code in training data than Flutter
- Expo abstracts away native code entirely — you never open Xcode or Android Studio for routine work
- TypeScript-native; matches the rest of the stack
- OTA updates for non-native changes (Expo Updates)
- Larger ecosystem of libraries

Flutter is excellent technically but worse for AI-assisted dev today.

### Why Supabase over Firebase

- Postgres (real SQL, real foreign keys, real schema) vs Firestore's NoSQL constraints
- Card data is highly relational (cards → traits, cards → abilities, decks → cards) — Postgres is the right tool
- Cheaper at scale
- Self-host option later if needed
- Realtime is built-in (Postgres replication-based)
- Storage included for card images

Firebase would work, but Postgres is the better match for this data model.

### Why client-side engine

Rules engine runs in TypeScript on each player's device. Server (Supabase) just relays state changes. Specifically:

- ✅ Faster to build (no separate server to deploy/maintain)
- ✅ Lower latency (no server round-trip for every action)
- ✅ Zero ongoing server cost beyond Supabase
- ✅ Engine is the same code that runs in the admin portal sandbox

Trade-offs:
- ❌ Vulnerable to cheating (a player could modify their client). Acceptable in v1 because no ranked, no stakes. Friend-only play self-polices.
- ❌ Both clients must agree on state. We use deterministic engine + checksums to detect desync; the room creator's state wins on conflict.

Server-authoritative engine is a v2 conversation when we add ranked.

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
- Runtime validation in the admin portal forms
- Runtime validation when the engine loads cards
- Auto-generated form fields (via libraries like `@autoform/react`)

When you add a field, all four places update. No drift.

### Why Turborepo + pnpm workspaces

Monorepo because three packages share code:
- Mobile app uses engine and schemas
- Admin portal uses engine (for sandbox testing) and schemas
- Engine uses schemas

Without a monorepo, you'd publish packages to npm or copy files. With one, all three update together.

Turborepo handles caching builds. pnpm workspaces handles linking local packages. Both well-documented and AI-fluent.

## Specific library choices

### Mobile

```json
{
  "expo": "^51",
  "react-native": "0.74.x (matched to Expo SDK)",
  "expo-router": "^3 (file-based routing)",
  "@supabase/supabase-js": "^2",
  "zustand": "^4",
  "nativewind": "^4",
  "@tanstack/react-query": "^5 (data fetching/caching)",
  "react-hook-form": "^7",
  "zod": "^3",
  "@hookform/resolvers": "^3",
  "react-native-mmkv": "^2 (local storage, fast)",
  "expo-image": "latest (better than RN Image)",
  "@sentry/react-native": "latest",
  "posthog-react-native": "latest"
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
  "@anthropic-ai/sdk": "^0.x (for AI auto-fill feature)"
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
│   ├── mobile/                    # Expo app
│   │   ├── app/                   # Expo Router screens
│   │   │   ├── (auth)/
│   │   │   ├── (main)/
│   │   │   ├── match/[code].tsx
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   ├── lib/
│   │   ├── stores/                # Zustand stores
│   │   └── package.json
│   └── admin/                     # Next.js portal
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
│   └── ui/                        # Shared UI (later)
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

You'll need:

```
# Mobile and admin
SUPABASE_URL=
SUPABASE_ANON_KEY=

# Admin only
SUPABASE_SERVICE_ROLE_KEY=    # server-side, NEVER ship to mobile
ANTHROPIC_API_KEY=             # for AI auto-fill, server-side only

# Both, for error tracking
SENTRY_DSN=
POSTHOG_API_KEY=
```

Use Expo's env handling for mobile, Vercel env for admin. Never commit `.env` files. The repo includes a `.env.example` with empty values.

## Things explicitly NOT in the stack

- ❌ Redux, MobX, Recoil — Zustand is enough
- ❌ GraphQL — Supabase REST + RPC is sufficient
- ❌ tRPC — overkill, adds complexity
- ❌ Prisma — Supabase migrations handle the schema
- ❌ A separate game server (Node.js, Colyseus, etc.) — client-side engine in v1
- ❌ Custom WebSocket layer — Supabase Realtime
- ❌ Native modules / Swift / Kotlin — Expo managed workflow only
- ❌ A "design system" package — shadcn/NativeWind is enough
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
