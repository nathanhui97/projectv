# 02 — Strategic Posture

This doc covers the non-technical decisions that shape technical decisions: how we handle IP risk, what's editable without an app release, what we never do.

## IP posture

### What we are

A fan-built, free, takedown-responsive tool that helps players test decks and play remotely. We exist because the official options don't serve this use case. We benefit Bandai by driving deck experimentation, alt-art aspiration, and overall game engagement.

### What we never do

- **Use "Gundam" or any Bandai trademark in the app name or domain.** The site name and URL are neutral.
- **Use Bandai logos, official font, or trade dress in marketing.** Our visual design is distinct.
- **Monetize.** No paid tier, no IAP, no ads, no Patreon-for-Gundam-content. Zero revenue tied to their IP in v1.
- **Compete commercially with an official Bandai product.** If Bandai launches an official digital game, we re-evaluate posture immediately.
- **Claim affiliation or endorsement.** App description includes "fan-made, not affiliated with Bandai Namco."

### What we do (accepting the risk)

- **Host card art on our servers.** UX requires fast image loading. Worth the risk.
- **Host card names and rules text on our servers.** Required for the engine and search.
- **Implement game mechanics in our engine.** Game mechanics aren't copyrightable; this is the lowest-risk part.

### Survival levers

These are the things that keep us alive if Bandai ever notices:

1. **No trademark in branding.** Without "Gundam" in our domain or app name, automated trademark scanners don't find us. Manual complaint required.
2. **No monetization.** Damages calculation is zero. Nuisance to sue.
3. **DMCA-responsive.** Public takedown email, 24-hour response SLA. We comply on first request without fighting.
4. **Community goodwill.** Users defend us publicly. Every Discord ping organizers post is reputation insurance.
5. **No app store gatekeeper.** Web deployment means no Apple or Google middleman who can unilaterally pull the app. We control the server.
6. **Instant takedown capability.** If we need to go dark, we can Vercel-rollback or flip Plan B in minutes, not days. No app store review cycle standing in the way.
7. **Plan B architecture.** Engine and admin portal are designed to operate with zero hosted IP. If we have to strip card art and names, we can — see [§ Plan B](#plan-b-stripped-mode).

### Plan B: stripped mode

Engineering note: the architecture must support a "stripped mode" where the app ships with no Bandai IP on our servers. In this mode:

- Card images are user-provided (camera or gallery upload, similar to alt-art scanning concept)
- Card names default to the card's set+number (e.g., "GD01-042") with display name optional and user-editable
- Rules text is shown only if a community-hosted "rules pack" is loaded by the user

We don't ship in this mode. But the code path exists, gated behind a feature flag. If Bandai sends a C&D, we flip the flag in 24 hours and stay alive.

This is why all card data is fetched dynamically and nothing is bundled in the app binary.

## Monetization posture

**v1: zero monetization.** No paid features, no IAP, no ads.

**v1.1+: still zero, until we have signal.** If the app gets real traction (1k+ DAU), revisit:
- Cosmetics shop (custom playmats, card backs, board themes — non-IP cosmetics only)
- Pro tier (cloud deck sync, advanced analytics, no Bandai content)
- Tournament organizer tools (paid)

**Never:**
- Ads
- Selling user data
- Charging for access to specific cards or sets

## What's hot-updatable vs requires a deploy

On web, all code changes go live via a Vercel deploy (minutes, not days). The meaningful distinction is now between **pure data changes** (zero deploy needed, instant) and **engine/code changes** (require a Vercel redeploy, still fast — no app store review).

### Hot-updatable (no deploy needed)

These flow through the admin portal → Supabase → web app at next page load or sync:

- ✅ New cards (full data: name, art, stats, traits, abilities, rules text)
- ✅ Card errata (modify any field on an existing card)
- ✅ Format legality (mark cards as legal/banned/restricted)
- ✅ Keyword definitions (e.g., reword what "Repair" does in tooltip)
- ✅ Trait dictionary (add/rename/merge traits)
- ✅ Set metadata (add new sets, mark as legal)
- ✅ FAQ entries / rules clarifications shown in-app
- ✅ Feature flags (toggle Plan B mode, beta features)

### Requires a Vercel deploy (minutes, automatic via CI)

These are engine-level or code-level and require a new deployment:

- ⚡ New trigger types (e.g., a brand-new mechanic Bandai invents)
- ⚡ New action types (e.g., "look at opponent's hand" if not pre-supported)
- ⚡ New zone types (extremely unlikely, but possible)
- ⚡ Core engine bug fixes
- ⚡ UI / UX changes
- ⚡ Network protocol changes
- ⚡ Auth changes

Unlike mobile, these changes reach every user the moment the deploy completes. No user action required.

### Implication: vocabulary breadth still matters at launch

Even though deploys are fast, we want the effect vocabulary to be **comprehensive at launch** so we don't need mid-season engine patches. If we miss a primitive, cards using it fall back to manual-resolve mode until we ship the fix. See [05-effect-vocabulary.md](05-effect-vocabulary.md) for the full list.

## Communication posture

### Public-facing

- **Landing page / meta description:** neutral, mentions "card game simulator," does not claim to be the Gundam Card Game.
- **Favicon / logo:** original design, no Bandai assets.
- **Marketing copy on Discord/Twitter:** describe as a fan tool, never as "the Gundam app."
- **No comparisons to official products in promotional language.**

### When asked "is this official?"

> "[APP_NAME] is a fan-made simulator, built independently and not affiliated with or endorsed by Bandai Namco. We're a tool for the community to test decks and play remotely."

### When asked "won't Bandai sue?"

> "We're a free fan tool with no monetization, and we operate with respect for Bandai's IP. We're DMCA-responsive and would comply with any takedown request. We hope to demonstrate value to the community without conflict."

### When Bandai actually contacts us

Whether C&D, partnership inquiry, or anything else: **respond within 24 hours, acknowledge, and ask what they want.** Don't pre-fight. Don't ignore. Most C&Ds want compliance, not lawsuits. Have a lawyer's contact ready before launch — don't try to negotiate solo.

## Distribution posture

- **Web-only for v1.** Deploy to Vercel. A simple URL — no app store submission, no review cycle, no gatekeeper.
- **Staging URL** for community beta testing before public launch. Password-protect or invite-only via Supabase RLS.
- **No native app distribution in v1.** No APK, no TestFlight, no App Store. Mobile users access via their phone browser.
- **Domain choice:** avoid "gundam" in the domain. Neutral name only.

## Community posture

- **Discord-first.** Build a community Discord. Channel for bug reports, feature requests, card data corrections.
- **Trusted reviewers** (post-launch): a small group of community members who can flag card data errors. Not authoring access — just flagging.
- **Public roadmap:** lightweight, on Discord or a Notion page. No commitments to dates, just direction.
- **Credit the community in app:** "Thanks to [Discord names] for testing" in About screen.

## When the posture changes

We re-evaluate this entire doc if:

- Bandai launches an official digital Gundam Card Game product
- We get a formal C&D or trademark complaint
- We hit 10k+ DAU (we become "worth pursuing")
- We start considering monetization

Until then, this is the posture. Stay disciplined.
