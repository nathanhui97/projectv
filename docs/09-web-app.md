# 09 — Web App Spec

The web app is the surface players interact with. It runs in any browser — desktop, tablet, or phone browser. It uses the engine for game logic, Supabase for data and multiplayer, and renders everything in Next.js.

## Tech reminder

Next.js 14+ (App Router) + TypeScript + Tailwind + shadcn/ui + Zustand + TanStack Query + dnd-kit + framer-motion.

## App structure

File-based routing via Next.js App Router. Layout:

```
/app
├── layout.tsx                  Root layout with providers
├── (auth)
│   ├── layout.tsx              Auth shell
│   ├── login/
│   │   └── page.tsx
│   └── signup/
│       └── page.tsx
├── (main)
│   ├── layout.tsx              Sidebar / bottom nav layout
│   ├── play/
│   │   ├── page.tsx            Lobby (create / join room)
│   │   └── [matchId]/
│   │       └── page.tsx        Active match screen
│   ├── decks/
│   │   ├── page.tsx            Deck list
│   │   └── [deckId]/
│   │       └── page.tsx        Deck editor
│   ├── cards/
│   │   ├── page.tsx            Card encyclopedia
│   │   └── [cardId]/
│   │       └── page.tsx        Card detail
│   ├── history/
│   │   ├── page.tsx            Match history list
│   │   └── [matchId]/
│   │       └── page.tsx        Match log
│   └── profile/
│       └── page.tsx            Profile + settings
└── page.tsx                    Redirects to /play
```

## Navigation

**Desktop (≥1024px):** Left sidebar with nav items — Play, Decks, Cards, History, Profile. Persistent, always visible.

**Mobile browser (<1024px):** Bottom navigation bar with icons + labels. Fixed to viewport bottom.

Both share the same layout component with responsive breakpoints.

## Screens

### Login / Signup

Standard Supabase Auth flows. Email + password only. Forgot password via Supabase email link.

After signup: prompt for username (unique, used in matches).

Server-side redirect: if already authenticated, skip to `/play`.

### Lobby (Play)

Two prominent actions: **Create Room** and **Join Room**.

**Create Room flow:**
1. Pick deck (from user's saved decks; must be valid)
2. Server creates a match row in Supabase, generates a 6-character room code
3. Show code prominently with a copy button
4. Wait state — real-time subscription shows when opponent joins
5. When opponent joins: show opponent username and their deck name
6. Both click "Ready" → match starts, navigate to `/play/[matchId]`

**Join Room flow:**
1. Enter 6-character code (large text input, auto-uppercase)
2. Validate code, show match preview (opponent username, deck name)
3. Pick own deck
4. Click "Join" → enters waiting state
5. Both ready → match starts

### Match screen

The complex one. Layout adapts to screen size but portrait/vertical orientation is primary.

**Desktop layout (≥1024px):**

```
┌─────────────────────────────────────────────────────┐
│  Top bar: opponent name · hand count · phase tracker │
├─────────────────────────────────────────────────────┤
│                                                     │
│   Opponent battle area (units, max 6)               │
│   ─────────────────────────────────────────         │
│   My battle area (units, max 6)                     │
│                                                     │
├──────────────────────────┬──────────────────────────┤
│  Opponent shield area    │  My shield area           │
│  Opponent base section   │  My base section          │
├──────────────────────────┴──────────────────────────┤
│  My resource area (10 max, scrollable)              │
├─────────────────────────────────────────────────────┤
│  My hand (horizontal scroll, peek)                  │
├─────────────────────────────────────────────────────┤
│  Action bar: phase label · End Phase / End Turn btn │
└─────────────────────────────────────────────────────┘
```

**Mobile browser layout (<768px — stacked, same zones, compressed):**

Same logical zones, tighter spacing. Cards in hand show as smaller thumbnails. Tap to expand card detail. Battle area scrolls horizontally if more than 3 units.

**Interaction model:**

- **Click a card in hand** → card detail modal (preview). Buttons appear for valid actions: "Deploy", "Play as Resource", "Play Command"
- **Drag a card from hand** (dnd-kit) → drag over valid drop zones, zone highlights on valid targets, drop to execute action
- **Click a unit on the board** → action menu appears: Attack, Pair Pilot, Activate Ability, View Detail
- **Drag a unit** → drag to attack target or pair to another unit
- Both click and drag work simultaneously — click is the fallback for mobile browsers where drag is awkward

**State indicators:**

- Active player has a highlighted action bar and a subtle border on their zones
- Phase tracker: step indicators showing Start → Draw → Resource → Main → End, current step lit
- Damage counters render as a number badge on units
- Rested cards show at 90° rotation (CSS transform)
- Linked units (unit + paired pilot) have a connector line and shared glow
- Burst cards show a flash animation when triggered

**Pending choice UI:**

When `state.pending_choices` has an entry for the current player, a modal overlays the board:

- Title: the prompt text from the ability
- For `choose_target`: click valid targets on the board to select; "Confirm" button when minimum met
- For `choose_option`: list of options as buttons
- For `yes_no`: two buttons — "Yes" / "No"
- For `manual_resolution_required`: card name, rules text, "Mark as Resolved" button (both players must confirm)

Cancel/skip available only if `optional: true` on the pending choice.

**Animations (framer-motion):**

- Card entering the battle area (fly from hand position, 300ms ease-out)
- Damage counter appearing / incrementing
- Shield being removed from shield area
- Card going to trash (fade + translate down)
- "Your Turn" banner sliding in from top
- Win/loss overlay fading in
- Phase transition flash

Keep all animations under 400ms and respect `prefers-reduced-motion`. Players can also disable animations in settings.

**Performance:**

- Match board is a Client Component with a Zustand store; only re-renders zones where state changed
- Card images loaded via Next.js `<Image>` with priority on cards in hand; lazy-load out-of-view zones
- Preload card images for cards in the active deck when match starts

### Deck list

List of user's saved decks:
- Name
- Format (Standard 1v1)
- Validity badge (green check or red X with error count)
- Card count (e.g., "50 + 10")
- Last edited date

"+ New Deck" button → choose starter template or blank.

### Deck editor

**Two-panel layout (desktop):**

Left panel (deck contents): cards in deck with quantity. Click card to remove; click quantity badge to adjust ±1. Running totals: Main 50/50 ✓, Resource 10/10 ✓.

Right panel (card browser): search/filter to find cards to add. Click card to add. Filters:
- Set (multi-select chips)
- Card type (chips)
- Color (chips)
- Cost (range slider)
- Traits (chips)
- Search text (debounced)

**Mobile layout:** single column; toggle between "My Deck" and "Browse Cards" views.

Validation runs in real-time. Errors shown inline below card counts:
- "Main deck: 48 / 50 (need 2 more)"
- "Too many copies of [Card Name]: 5 (max 4)"
- "Banned card: [Card Name]"

Save button disabled until validation passes. Unsaved changes show a warning if navigating away.

### Card encyclopedia

Browse all published cards. Same filter/search UI as deck editor browser. Virtualized list for performance with 1000+ cards.

Card grid on desktop, card list on mobile. Click any card to see full detail.

### Card detail

- Large card image
- All printed fields (name, set, cost, AP, HP, traits, rules text)
- Engine-rendered ability description (from `renderAbilityToText()`)
- Ruling notes (if any errata or FAQ entries)
- "Add to deck" button (if a deck is being edited)

### Match history

List of past matches:
- Result (W / L)
- Opponent username
- Deck used
- Date

Click → match log.

### Match log

Turn-by-turn text log:
- "Turn 1 — [Username]'s turn"
- "[Username] placed [Card Name] as resource"
- "[Username] deployed [Card Name] (cost: 3)"
- etc.

v1: text only. Step-by-step board replay is a v2 feature.

### Profile

- Username
- Stats: wins, losses, total matches
- Settings

### Settings

- Animations: on / off
- Sound: on / off (if sound effects added)
- Account: change password, delete account, sign out
- About: app version, engine version, links to terms / takedown email

## State management

**Local state:** Zustand stores:
- `useAuthStore` — current user, sign out action
- `useMatchStore` — active match state (synced from Supabase Realtime)
- `useDeckBuilderStore` — deck currently being edited (unsaved changes)
- `useSettingsStore` — UI preferences (animations, sound), persisted to localStorage

**Server state:** TanStack Query for all Supabase fetches:
- Cards (cached, revalidated on mount via `card_data_version` header check)
- User's decks
- Match history
- Profile

**Match state syncing:**

When in an active match:
1. Subscribe to `match_actions` table for this match via Supabase Realtime
2. On Realtime event (new action from opponent): apply the action through the engine and update `useMatchStore`
3. When local player acts:
   - Apply locally first via `engine.apply(state, action)` → optimistic update
   - Persist the action to Supabase `match_actions`
4. Desync check: at phase boundaries, compute and compare state checksums

## Card image rendering

Cards display from Supabase Storage public URLs. Use Next.js `<Image>` with:
- `sizes` attribute for responsive sizing
- `loading="lazy"` for off-screen cards
- `priority` for cards in the active player's hand during a match

Thumbnails (approx 200×280px) in lists; full size (approx 600×840px) in card detail and match hand view.

## Responsive design

Three breakpoints:
- **Mobile (< 768px):** single column, bottom nav, compressed match board
- **Tablet (768px–1023px):** wider cards, side-by-side panels in deck editor, top nav
- **Desktop (≥ 1024px):** sidebar nav, two-panel layouts, full match board

The app must be usable on a phone browser — the game is playable, not just browsable. But desktop is the primary design target for the match screen.

## Cookie consent

Web app must show a cookie consent banner on first visit before setting any non-essential cookies (analytics, PostHog). A simple banner with "Accept" / "Decline" is sufficient for v1. Gate PostHog initialization behind acceptance.

## Offline / degraded mode

What works without a connection:
- Previously cached card data (TanStack Query cache)
- Viewing saved decks (cached)
- Match history (cached)

What does NOT work offline:
- Creating or joining a match (needs Realtime)
- Login (needs Supabase Auth)
- Saving deck changes (needs Supabase)

No explicit offline mode. If Supabase is unreachable, show a toast: "You appear to be offline. Some features are unavailable."

## Error reporting

Sentry (`@sentry/nextjs`) for both server-side errors (API routes, Server Components) and client-side errors. Show a user-friendly "Something went wrong" boundary with a retry button; underlying error goes to Sentry.

## Accessibility

- Semantic HTML: `<nav>`, `<main>`, `<button>`, `<dialog>` throughout
- Focus management on modal open/close
- `aria-label` on icon-only buttons
- dnd-kit provides keyboard drag-and-drop by default (arrow keys to move, space to drop)
- Min click target 44×44px (CSS `min-height`, `min-width`)
- Color is never the only indicator of state — always pair with text or icon
- `prefers-reduced-motion`: disable framer-motion animations when set

## Localization

v1 English only. String literals in component files. If localization is added later, extract to an `i18n/` module.

## Build and deploy

```bash
# Dev
pnpm --filter web dev

# Build
pnpm --filter web build

# Deploy
git push → Vercel CI picks it up automatically
```

Separate Vercel project for `apps/web` and `apps/admin`. Each has its own environment variables. Neither links to the other.

Preview deployments: every branch push creates a preview URL. Use these for community beta testing before merging to main.

## Open questions

- **Should the lobby show opponent's deck name or keep it hidden?** Recommendation: show deck name. Adds match context; no strategic risk since decks aren't secret before the match.
- **What happens if a card is unpublished after a match was played with it?** Recommendation: match log keeps a snapshot of the deck. Card stays visible in history.
- **Disconnection recovery:** if a player closes the browser mid-match, the match row stays open. Opponent sees "Opponent disconnected" with options: wait (30s reconnect window), claim win, or void match.

## Implementation prompt template

When building the web app, paste this into Claude Code along with this doc, the engine spec, and the data schemas:

> Implement the [APP_NAME] web app per /docs/09-web-app.md.
>
> Use the engine in /packages/engine and Zod schemas in /packages/schemas. Tech stack per /docs/03-tech-stack.md.
>
> Build incrementally:
> 1. Project setup: Next.js App Router file structure, TypeScript strict, Tailwind config, providers (auth, queryClient, Zustand)
> 2. Auth flow: login, signup, middleware route guards
> 3. Card data fetching: TanStack Query hook useCards() with version-check cache logic
> 4. Decks section: list, editor with real-time validation
> 5. Cards section: encyclopedia (virtualized) + card detail
> 6. Profile section: stats, settings
> 7. History section: list + log view
> 8. Play section: lobby (create / join), waiting room, match start
> 9. Match screen (the hardest):
>    - Responsive board layout for both player perspectives
>    - Click interactions + dnd-kit drag-and-drop
>    - Pending choice modals
>    - Real-time sync via Supabase Realtime
>    - Engine integration for local action validation and application
>    - framer-motion animations
> 10. Cookie consent banner
> 11. Settings page
>
> Follow accessibility guidelines. Zustand for local/match state, TanStack Query for server state.
>
> Do NOT implement push notifications, friend system, ranked matchmaking, AI opponents, chat, hot-seat, native mobile app. Those are out of scope per /docs/12-out-of-scope.md.
