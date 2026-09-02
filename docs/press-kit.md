# WattWay press kit / outreach plan

Purpose: get WattWay covered by an EV publication or news outlet. Coverage is the
fastest fix for the one SEO problem the site actually has — zero authoritative
backlinks — and it is not something on-page work can solve.

## The pitch angle (lead with this, not with "I built a tool")

**"The same electricity costs 3× more depending on which stall you pull into,
and nobody tells you before you plug in."**

Editors do not run "someone made a route planner." They run a *finding*. WattWay's
finding is the price spread, and the tool is the evidence and the reader payoff.

Supporting facts, all already verifiable on the site:

- $0.20/kWh (OUC) to $0.59/kWh (Blink) across 16 tracked networks — ~3× for an
  identical product. On one 70 kWh fill: $14 vs $41.
- Charging-membership math: WattWay computes, per trip, whether Electrify America
  Pass+ ($4/mo) or Tesla ($12.99/mo) pays for itself. Austin→Seattle example:
  Tesla membership saved $15.82 against a $12.99 fee. Nobody else does this.
- Free, no account, no ads, no data sale, runs entirely client-side. Good copy for
  outlets tired of covering VC-funded apps.
- Coverage: 177 vehicles, 27 makes, 16 networks, 10-mile search corridor.
- Data provenance is honest and citable: Google Routes API + Open Charge Map.

Secondary angle if the price one is passed on: **the Ionna Hyundai/Genesis owner
discount** (10%, 20% through Sept 30 2026) is under-reported and WattWay prices it
in automatically. That is a news hook with an expiry date, which editors like.

## Target list, best-fit first

**Tier 1 — EV trade press, most likely to bite**
- InsideEVs (tips@insideevs.com) — Tom Moloughney covers charging economics closely.
- Electrek — runs "here's a free tool" pieces; Fred Lambert / charging desk.
- CleanTechnica — lowest bar to entry, will often run a contributed post verbatim.
- Green Car Reports — charging-cost stories are core beat.
- Charged EVs magazine — trade-side, likes the data-provenance story.

**Tier 2 — newsletters (high conversion, small but exactly the right audience)**
- The EV Universe (weekly EV-industry newsletter) — actively solicits new tools.
- Heatmap News, Canary Media — will only take the price-spread *finding*, not the tool.

**Tier 3 — video/community, drives the backlinks that actually move rankings**
- Out of Spec Studios, State of Charge (Moloughney), Transport Evolved.
- r/electricvehicles — already the source of most feature requests in ROADMAP.md;
  a "what I built from your feedback" post credits ~12 named users and tends to
  do well. Hacker News "Show HN" for the client-side/no-account angle.

## Email template

> Subject: The same kWh costs 3× more depending on the stall — data + a free tool
>
> Hi <name>,
>
> Across the 16 US charging networks I track, DC fast pricing runs $0.20/kWh (OUC)
> to $0.59/kWh (Blink). Same electrons, ~3× the price, and drivers almost never
> know which they are pulling into until they are plugged in. On a single 70 kWh
> fill that is $14 vs $41.
>
> I built WattWay (https://wattway.net) to route around it: give it two addresses
> and your car, and it picks the stops that make the trip cheapest, not closest.
> It also does something I have not seen elsewhere — after each route it tells you
> whether a charging membership would have paid for itself on *that* trip
> (Austin→Seattle: Tesla's $12.99/mo plan saved $15.82).
>
> Free, no account, no ads, runs in the browser. Happy to share the underlying
> per-network rate table if it is useful for a piece.
>
> — Randy Walker / TheSaltyKorean

Rules: one outlet per email, personalised first line referencing a piece they
actually wrote, no attachments, link not a press release. Do not blast Tier 1 in
parallel — an exclusive is worth more to them and to you.

## Assets ready to send

- Announcement post: `docs/blog/announcing-wattway.md` (and `.html`)
- OG image `public/og-image.png`, screenshot `public/screenshot.jpg`
- Per-network rate pages: https://wattway.net/charging-networks/<slug>

## What to do when coverage lands

Every article link is a backlink; submit the article URL via IndexNow
(`scripts/indexnow.mjs`) and expect ranking movement to follow within weeks —
that is the mechanism, not more on-page tuning.
