# 12 — Out of Scope (v1)

This is the most important doc for shipping on time. Every feature listed here is something a player or stakeholder might reasonably ask for. We are explicitly not building any of them in v1.

When in doubt during the build, **default to "out of scope."** Scope creep is the #1 reason solo projects don't ship.

## How to use this doc

When considering any feature, search this doc first. If it's listed, the answer is "no" until v2.

If a feature isn't listed here AND isn't in `01-product-spec.md`, default to "out of scope" and add it here. The product spec defines what's in; this doc defines what's out. The two together cover everything.

## Multiplayer features cut from v1

### Chat (in-match or lobby)

- **Why it's tempting**: players want to communicate with opponents
- **Why we're cutting**: chat introduces moderation requirements, abuse vectors, and 2–3 weeks of work for adequate UX. Players can use Discord / iMessage outside the app.
- **Workaround**: lobby shows opponent username; players coordinate externally.
- **Possible v2**: emote system (predefined messages, no free text) is lower-risk than free chat.

### Hot-seat / pass-and-play

- **Why it's tempting**: lets one device demo two-player play; useful for trade shows
- **Why we're cutting**: fundamentally different UX; requires hiding each player's hand and state when handing the device over. Extra design complexity for a niche use case.
- **Workaround**: two devices (or two browser tabs on different accounts), room code, sit across from each other
- **Possible v2**: yes, medium effort

### AI opponents

- **Why it's tempting**: lets solo players practice without a partner
- **Why we're cutting**: building competent TCG AI is a 4–8 week project on its own
- **Workaround**: deck builder + sandbox (in admin portal) for testing card interactions
- **Possible v2**: yes, but probably v3+

### Ranked matchmaking

- **Why it's tempting**: gives players a reason to keep coming back
- **Why we're cutting**: requires authoritative server engine, MMR system, anti-cheat, leaderboards. Multi-month effort.
- **Workaround**: room codes + community organization (Discord tournaments, etc.)
- **Possible v2**: requires server-authoritative engine first

### Tournaments / brackets

- **Why it's tempting**: organized play is huge for TCGs
- **Why we're cutting**: tournament logic is an entire feature suite
- **Workaround**: community uses Challonge / external tools and reports results
- **Possible v2**: yes, after ranked

### Spectator mode

- **Why it's tempting**: streaming, content creators, learning by watching
- **Why we're cutting**: hidden cards must stay hidden from the spectator view — requires a separate read-only state projection. Doable but non-trivial.
- **Note**: web makes this significantly easier than mobile ever would (just a third browser tab with a read-only Realtime subscription). High priority for v1.1.
- **Workaround**: players screen-share via Discord
- **Possible v2**: yes, and relatively straightforward on web

### Replays

- **Why it's tempting**: review games, share highlights
- **Why we're cutting**: replay UI is its own complex thing; storage/bandwidth costs add up
- **Workaround**: text-based match log in History tab gives the gist
- **Possible v2**: yes, especially since action log is already stored

### Friend lists / friend invites

- **Why it's tempting**: easier than copying room codes
- **Why we're cutting**: friend system implies request/accept flow, blocking, privacy settings — multi-week feature
- **Workaround**: room codes work universally
- **Possible v2**: yes

## Monetization features cut from v1

### In-app purchases

- **Why we're cutting**: per `02-strategic-posture.md`, no monetization in v1. Reduces IP risk.

### Cosmetic shop (card backs, board themes)

- **Why we're cutting**: would require building a shop, payment processing, and cosmetic asset pipeline
- **Possible v2**: maybe; only if we monetize and it doesn't touch Bandai IP

### Premium tier / subscriptions

- **Why we're cutting**: same as IAP

### Ads

- **Why we're cutting**: degrades UX; raises legal stakes (ad revenue from Bandai IP); Bandai's own digital plans are the looming risk

## Content features cut from v1

### Alt-art card scanning

- **Why it's tempting**: lets players use art they actually own physically
- **Why we're cutting**: requires user uploads, image processing, art alignment, moderation, storage costs. Per memory, was discussed and explicitly deferred.
- **Workaround**: ship with default art only
- **Possible v2**: yes, as a clearly separate feature with its own design

### Custom card creation

- **Why it's tempting**: fans love designing cards
- **Why we're cutting**: changes the project from "Gundam TCG simulator" to "TCG game engine for any rules" — entirely different product
- **Workaround**: none; not a v1 use case
- **Possible v2**: never. This is a different product.

### Card collection tracking

- **Why it's tempting**: track which cards you own in real life
- **Why we're cutting**: out of scope for a sim; would require collection management UI, scanning/manual entry, value tracking
- **Workaround**: external apps (TCGplayer, etc.) handle this
- **Possible v2**: maybe, as integration with TCGplayer or similar

### Drafting / sealed simulator

- **Why it's tempting**: limited formats are popular
- **Why we're cutting**: drafting UI, pack opening simulation, separate game flow
- **Workaround**: none in v1
- **Possible v2**: yes; medium complexity

### Multiple formats

- **Why it's tempting**: as Bandai introduces new formats
- **Why we're cutting**: v1 is standard 1v1 only. Schema supports formats; UI doesn't.
- **Workaround**: only one format available
- **Possible v2**: yes, schema is already there

## Player experience features cut from v1

### Onboarding tutorial (interactive)

- **Why it's tempting**: helps new players learn the game
- **Why we're cutting**: writing a tutorial is its own design project; interactive tutorial is even more
- **Workaround**: 3-screen splash onboarding only; players learn from official Bandai resources
- **Possible v2**: yes, especially as the player base grows

### Achievements / badges

- **Why we're cutting**: meta-game, not core to the playing experience
- **Possible v2**: yes if engagement metrics need a boost

### Stat tracking beyond W/L

- **Why we're cutting**: deep stats (deck winrates, matchup tables, average game length) require analytics infrastructure
- **Workaround**: basic W/L count in profile
- **Possible v2**: yes, especially with ranked

### Push notifications

- **Why we're cutting**: requires Web Push API setup, service worker, notification permission flow, and content design. 1+ week of work for marginal v1 benefit.
- **Possible v2**: yes, once we have features that need them (turn timer, friend online)

### Background tab match continuation

- **Why we're cutting**: if a player switches browser tabs during a match, the Realtime subscription may disconnect (browser throttles background tabs). Reconnect-on-resume handles most cases.
- **Workaround**: keep the game tab in foreground during matches; reconnect on return handles brief backgrounding
- **Possible v2**: service worker keep-alive if this proves to be a real problem

### Voice commentary / sound effects pack

- **Why we're cutting**: licensing, recording, integration. Out of scope for v1.
- **Workaround**: basic UI sounds only (or none if Week 8 is tight)
- **Possible v2**: maybe

## Platform features cut from v1

### Native mobile apps (iOS/Android)

- **Why it's tempting**: App Store discoverability, push notifications, offline play, home screen icon
- **Why we're cutting**: v1 is web-only. The game works in mobile browsers. Native apps require EAS Build, App Store review cycles, and a separate codebase or React Native port.
- **Workaround**: mobile browser works fine for play; players can add the site to their home screen (PWA-style) as a workaround
- **Possible v2**: yes; consider a Progressive Web App (PWA) manifest first before full native

### Tablet-specific UI

- **Why it's tempting**: iPad/Android tablet layouts could be better
- **Why we're cutting**: responsive design handles tablets adequately. A purpose-built tablet layout (landscape, two-column board) is extra design work.
- **Workaround**: app is responsive and usable on tablets at the 768px+ breakpoint
- **Possible v2**: yes; medium effort, especially for the match board

### Localization (non-English)

- **Why we're cutting**: localization workflow, translation costs, legal review per locale
- **Workaround**: English only
- **Possible v2**: yes; Japanese first (the game's primary market)

### Cross-device sync

- **Why we're cutting**: deck data is in DB so cross-device works for that. Match resume across devices is the harder case and isn't supported.
- **Workaround**: account-based decks already cross-device
- **Possible v2**: yes for match resume, low priority

### Tablet split-screen / Stage Manager

- **Why we're cutting**: edge case
- **Possible v2**: never explicitly

## Admin / operator features cut from v1

### Multi-admin role permissions

- **Why we're cutting**: v1 has just you (and maybe one trusted helper)
- **Workaround**: simple `is_admin` boolean
- **Possible v2**: yes; granular roles (card editor, format manager, etc.)

### Public changelog / errata feed

- **Why we're cutting**: nice-to-have, not blocking
- **Workaround**: announce changes in your TCG community Discord
- **Possible v2**: yes

### Card image AI generation

- **Why it's tempting**: fill placeholder art for unspoiled cards
- **Why we're cutting**: AI-generated card art muddies IP waters significantly; not worth the risk
- **Workaround**: blank-template placeholder for unrevealed cards
- **Possible v2**: probably never

### Automated card data import (scraping)

- **Why it's tempting**: faster than manual entry
- **Why we're cutting**: scraping community sites like Limitless TCG could draw their ire and produces poorly-structured data
- **Workaround**: manual CSV import + AI auto-fill from rules text
- **Possible v2**: maybe, with permission

### Analytics dashboards (player numbers, deck winrates, etc.)

- **Why we're cutting**: analytics infrastructure, privacy considerations, low immediate value
- **Workaround**: basic queries on Postgres directly
- **Possible v2**: yes if data ever justifies it

## Engine features cut from v1

### Server-authoritative match validation

- **Why it's tempting**: prevents cheating
- **Why we're cutting**: client-side is fine for v1 (no ranked/rewards). Detailed in `04-architecture.md`.
- **Workaround**: trust both clients
- **Possible v2**: yes, port engine to Edge Function

### Anti-cheat detection

- **Why we're cutting**: requires server-authoritative engine
- **Possible v2**: yes if ranked launches

### Network optimization (binary protocols, compression)

- **Why we're cutting**: JSON over Realtime is fine at our scale
- **Possible v2**: only if performance becomes an issue

### Offline matches against local AI

- **Why we're cutting**: depends on AI opponents (cut above)
- **Possible v2**: tied to AI opponents

## Aesthetic features cut from v1

### Dark / light theme toggle

- **Why we're cutting**: dark mode is a clear extra; pick one and ship
- **Workaround**: pick one as default (recommendation: dark, fits sci-fi/mecha vibe)
- **Possible v2**: easy add

### Custom themes / skins

- **Why we're cutting**: theming infrastructure overhead
- **Possible v2**: maybe, low priority

### Card animations from official Bandai assets

- **Why we're cutting**: increases IP risk; not necessary for play
- **Workaround**: subtle motion / glow only
- **Possible v2**: probably never (IP risk)

### Custom playmats / backgrounds

- **Why we're cutting**: nice-to-have
- **Possible v2**: simple feature, low effort

## Support features cut from v1

### In-app feedback / bug reporting

- **Why we're cutting**: takedown@/support@ email is sufficient
- **Workaround**: settings page links to email
- **Possible v2**: yes; in-app feedback form lowers friction

### In-app support chat

- **Why we're cutting**: requires staffing
- **Possible v2**: never (cost too high for free product)

### FAQ / help center

- **Why we're cutting**: small player base in v1; questions answered in Discord
- **Possible v2**: yes once player base grows

## Legal / compliance features cut from v1

### Full cookie consent management platform

- A simple "Accept / Decline" banner is in scope for v1 (see `09-web-app.md`). A full consent management platform (CMP) with granular per-category toggles, audit logs, and consent receipts is not.
- **Workaround**: simple banner gates PostHog. That's enough for v1.
- **Possible v2**: only if GDPR audit ever requires it

### GDPR / CCPA explicit data export tooling

- **Why we're deferring**: user can email for data deletion; we comply manually
- **Workaround**: support@ handles requests
- **Possible v2**: automated tooling

### Age verification

- **Why we're cutting**: web has no equivalent of App Store age rating. A disclaimer on signup ("This app is for players of the physical card game") is sufficient for v1.
- **Possible v2**: only if regulations require it in specific markets

## Things that are tempting but never in scope

These are things you might consider in a moment of weakness. Resist always.

- A "casino" mode (gambling implications, App Store rejection)
- Crypto / NFT integrations (legal landmine)
- Cross-game compatibility with other TCGs (we are a Gundam-specific tool)
- Streaming integrations (Twitch overlay, etc.) — too narrow audience
- AR / VR card display — high engineering, low player benefit
- Voice-controlled play — accessibility benefit but very niche

## When to revisit this doc

Re-read this doc:

- Before starting any new week of work
- When you feel the urge to add a feature
- When a community member requests a feature ("can the app do X?")
- During scope-cut discussions if you're behind schedule

Update this doc whenever you confirm a "no" decision. Future-you needs the record.

## Implementation prompt template

(Not applicable — this is policy, not code.)
