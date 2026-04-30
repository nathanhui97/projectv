# 09 — Mobile App Spec

The mobile app is the surface players interact with. It uses the engine for game logic, Supabase for data and multiplayer, and renders everything in React Native + Expo.

## Tech reminder

React Native + Expo + Expo Router + TypeScript + NativeWind + Zustand + TanStack Query + Reanimated.

## App structure

File-based routing via Expo Router. Layout:

```
/app
├── _layout.tsx              Root layout with providers
├── (auth)
│   ├── _layout.tsx          Auth stack
│   ├── login.tsx
│   └── signup.tsx
├── (main)
│   ├── _layout.tsx          Tabs layout
│   ├── play
│   │   ├── index.tsx        Lobby (create / join room)
│   │   ├── create.tsx       Pick deck, generate code
│   │   ├── join.tsx         Enter code
│   │   └── [matchId].tsx    Active match screen
│   ├── decks
│   │   ├── index.tsx        Decks list
│   │   ├── new.tsx          Pick template / blank
│   │   └── [deckId].tsx     Deck editor
│   ├── cards
│   │   ├── index.tsx        Card encyclopedia
│   │   └── [cardId].tsx     Card detail
│   ├── history
│   │   ├── index.tsx        Match history list
│   │   └── [matchId].tsx    Match log replay
│   └── profile
│       ├── index.tsx        Profile + settings
│       └── settings.tsx
└── splash.tsx               Initial load screen
```

## Tab navigation (bottom)

Five tabs: **Play**, **Decks**, **Cards**, **History**, **Profile**.

## Screens

### Splash / Auth flow

On first launch:

1. Show splash with logo
2. Check auth state via Supabase
3. Fetch card data (using cached version + version check)
4. If not authenticated, route to /login
5. If authenticated, route to /(main)/play

### Login / Signup

Standard Supabase Auth flows. Email + password. Forgot password via Supabase email link.

After signup: prompt for username (unique, used in matches).

### Lobby (Play tab)

Two big buttons: "Create Room" and "Join Room".

**Create Room flow:**
1. Pick deck (from user's saved decks; must be valid)
2. Generate room code via Supabase function
3. Show 6-char code prominently with "Share" sheet (system share to Discord, iMessage, etc.)
4. Wait for opponent to join
5. When opponent joins, show "Opponent is here" → "Ready" button
6. Both ready → game starts

**Join Room flow:**
1. Enter 6-char code (large numeric pad style input)
2. App validates code, fetches match, shows opponent username and deck
3. Pick own deck
4. Tap "Join" → enters waiting state
5. Both ready → game starts

### Match screen

The complex one. Layout for portrait orientation (landscape rotation supported on tablets if we get there):

```
┌──────────────────────────────────┐
│ Top bar: opponent name, hand size │
├──────────────────────────────────┤
│ Opponent's shield area (6 cards) │
│ Opponent's base section          │
│ Opponent's battle area (units)   │
├──────────────────────────────────┤
│ My battle area (units)           │
│ My base section                  │
│ My shield area                   │
├──────────────────────────────────┤
│ My resource area (10 max)        │
├──────────────────────────────────┤
│ My hand (scrollable, peek)       │
├──────────────────────────────────┤
│ Action bar: phase, end turn etc. │
└──────────────────────────────────┘
```

**Touch interactions:**

- Tap a card in hand → preview card detail in modal
- Long-press → drag to deploy / pair / play
- Tap a unit → see options (attack, activate ability)
- Tap empty zone → context-appropriate action (e.g., tap resource area when phase is resource → place from hand)
- Two-finger pinch on opponent's field → see field details

**State indicators:**

- Active player has subtle highlight on their action bar
- Phase tracker: dot trail showing 5 phases, current highlighted
- Damage counters render as numbers on units
- Rested cards rotate 90° (subtle)
- Linked units have a glow

**Pending choice UI:**

When `state.pending_choices` has an entry for the current player, show a modal:

- Title: prompt text
- For `choose_target`: tap valid targets to select; "Confirm" button when min met
- For `choose_option`: list of options as tappable buttons
- For `yes_no`: two buttons
- For `manual_resolution_required`: card name, rules text, "Confirm Resolved" button (both players must confirm)

Cancel/skip available only if `optional: true`.

**Animations:**

Reanimated 3 for:
- Card flying from hand to battle area on deploy
- Damage counters appearing
- Shield breaking when destroyed
- Card flipping when burst triggers
- "Your turn" banner sliding in
- Win/loss ending overlay

Keep animations fast (200–400ms) and skippable. Players can disable animations in settings.

**Performance considerations:**

- Use FlashList for hand (variable card count)
- Use memo for unit cards (re-render only when state changes)
- Image preloading for cards in deck on match start
- Avoid full re-renders on every state update

### Deck list (Decks tab)

List of user's decks with:
- Name
- Format (just `Standard 1v1` for v1)
- Validity badge (green check or red X with errors)
- Card count
- Last edited

Tap → deck editor. "+ New Deck" button → choose template (starter decks pre-built) or blank.

### Deck editor

Split UI:

**Top: deck contents** — list of cards in deck with quantity. Tap card to remove, tap quantity to adjust. Total counts at top: Main 50/50 ✓, Resource 10/10 ✓.

**Bottom: card browser** — search/filter, tap card to add. Filters:
- Set (multi-select)
- Card type (chips)
- Color (chips)
- Cost (range)
- Traits (chips)
- Search text

Validation runs in real-time. Errors shown inline:
- "Main deck: 48 / 50 (need 2 more)"
- "Too many copies of [Card Name]: 5 (max 4)"
- "Banned card included: [Card Name]"

Save button disabled until validation passes.

### Card encyclopedia (Cards tab)

Browse all published cards. Same filter/search UI as deck editor browser. Tap card to see full detail.

### Card detail

- Large card image
- All printed info (name, set, cost, AP, HP, traits, rules text)
- Engine-rendered ability description (from preview function, useful for double-checking against print)
- Ruling notes (if any errata or FAQ entries linked to this card)
- "Add to deck" button (if deck open)

### Match history (History tab)

List of past matches:
- Result (W/L)
- Opponent username
- Deck used
- Date
- Tap → match log replay

### Match log

Turn-by-turn log of the match:
- "Turn 1 - Player A's turn"
- "Player A placed [Card Name] as resource"
- "Player A deployed [Card Name]"
- ...

For v1, just text log. Step-by-step state replay is a v2 feature.

### Profile

- Username
- Stats: wins, losses, total matches
- Settings link
- Sign out

### Settings

- Sound: on/off
- Animations: on/off
- Battery saver mode (reduces animations and FPS)
- Account: change password, delete account, log out
- About: app version, engine version, links to terms / privacy
- Support: takedown email, feedback link

## State management

**Local state:** Zustand stores for:
- `useAuthStore` — current user, sign out
- `useMatchStore` — active match state (synced from Supabase)
- `useDeckBuilderStore` — current deck-being-edited
- `useUIStore` — settings (sound, animations)

**Server state:** TanStack Query for all Supabase fetches:
- Cards (cached for offline; revalidated on launch via `card_data_version`)
- User's decks
- Match history
- Profile

**Match state syncing:**

When in a match:
1. Subscribe to `match_states` row for this match via Supabase Realtime
2. On Realtime event, update local Zustand match state
3. When player takes action: 
   - Apply locally first (engine.applyAction)
   - Then UPDATE `match_states` row with new state and incremented `state_version`
   - Append action to `match_actions`
4. If concurrent update detected (state_version mismatch), refetch and merge

## Card image rendering

Cards display from Supabase Storage URLs. Use Expo Image with caching enabled.

For first launch with 1000+ cards, we don't preload all images. Strategy:
- Preload images for cards in user's decks
- Lazy-load others as scrolled into view
- OS handles cache eviction

Thumbnails (200x280) used in lists; full size (600x836) used in detail views and during match.

## Offline support

What works offline:
- Card encyclopedia (cards cached after first load)
- Deck editor (cards cached, decks saved to local DB and synced when online)
- Match history (cached)

What does NOT work offline:
- Active matches (needs Realtime sync)
- Login (initial)
- Card refresh (needs server)

Use AsyncStorage for cache; persist Zustand stores there for resume on relaunch.

## Push notifications

NOT in v1. Per `12-out-of-scope.md`.

## Crash and error reporting

For v1, errors caught and logged to `error_logs` table in Supabase. Mobile app shows generic error UI: "Something went wrong. Please try again. If this persists, contact support."

In v2, integrate Sentry or similar.

## Splash and onboarding

First launch shows a brief onboarding (3 screens):
1. "Build decks. Play with friends. Made by fans."
2. "We don't replace official products. Buy your cards! [link to Bandai]"
3. "Sign up or log in to get started."

After signup, prompt for username, then deposit user in /play with empty decks. Encourage them to "build your first deck or pick a starter".

## Accessibility

- Support iOS / Android dynamic text sizes
- VoiceOver / TalkBack labels on all interactive elements
- High-contrast mode respected (use semantic colors)
- Min tap target 44x44pt
- Don't rely on color alone (use icons + color for state)

## Localization

v1 English only. Strings in `i18n/en.ts`. Schema supports adding `ja`, `zh`, etc. later.

## Build, deploy, and update

### Build

- `eas build --platform ios` for iOS
- `eas build --platform android` for Android

### Deploy

- iOS: TestFlight (beta), then App Store via App Store Connect
- Android: Internal testing → closed testing → production via Play Console

### OTA updates

Expo's EAS Update lets us push JS-only changes without an App Store review. Use this for:
- Bug fixes
- Minor UI tweaks
- Engine bug fixes (since engine is JS)

Don't use OTA for:
- Native dep changes
- App Store metadata changes
- Major UI changes (testers should review)

For card data: hot updates from Supabase don't need OTA at all. The app refetches data based on `card_data_version`.

## App Store and Play Store metadata

Per the strategic posture doc, the app name is neutral. Description emphasizes "fan-made tool", "unofficial", and includes the takedown email.

Screenshots: deck editor, match in progress, card encyclopedia, match history. Use generic mock data; never copy Bandai's marketing imagery.

Categories: Card Games (primary), Strategy (secondary).

Age rating: 9+ (mild fantasy violence, in line with Gundam franchise).

## Open questions

- **Should the app warn before deleting a deck used in match history?** Recommendation: yes, soft-delete decks (move to archive); match history continues to show the snapshot deck.
- **What happens if a card is unpublished after a match was played with it?** Recommendation: card stays viewable in match history (stored snapshot), but deck builder filters out unpublished cards.
- **Lobby disconnect handling**: if creator leaves before opponent joins, room becomes invalid. If opponent joins and then leaves before ready, creator gets notified and can wait or cancel.

## Implementation prompt template

When you're ready to build the mobile app, paste this into Claude Code along with this doc, the engine spec, and the data schemas:

> Implement the [APP_NAME] mobile app per /docs/09-mobile-app-spec.md.
>
> Use the engine in /packages/engine and Zod schemas in /packages/schema. Tech stack per /docs/03-tech-stack.md.
>
> Build incrementally:
> 1. Project setup: Expo Router file structure, TypeScript strict, NativeWind config, providers (auth, queryClient)
> 2. Auth flow: login, signup, splash, route guards
> 3. Card data fetching: TanStack Query hook useCards() with version-check refetch logic
> 4. Decks tab: list, editor with validation
> 5. Cards tab: encyclopedia + detail
> 6. Profile tab: stats, settings
> 7. History tab: list + log view
> 8. Play tab: lobby (create / join), waiting room
> 9. Match screen (the hardest):
>    - Layout for both player perspectives
>    - Touch interactions (tap, long-press drag)
>    - Pending choice modals
>    - Real-time sync via Supabase Realtime
>    - Engine integration for local action validation and application
>    - Animations with Reanimated
> 10. Settings page
>
> Follow accessibility guidelines. Keep state in Zustand for local UI state, TanStack Query for server state.
>
> Do NOT implement push notifications, friend system, ranked matchmaking, AI opponents, chat, hot-seat. Those are out of scope per /docs/12-out-of-scope.md.
