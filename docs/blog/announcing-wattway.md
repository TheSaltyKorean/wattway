---
title: "The same electricity, at three times the price"
slug: announcing-wattway
description: "A fast charge costs $0.20 per kWh at one network and $0.59 at another. WattWay is a free trip planner that routes you through the cheap ones."
date: 2026-08-22
author: TheSaltyKorean
tags: [ev, road trips, charging, wattway]
canonical_url: https://thesaltykorean.com/announcing-wattway
---

Every DC fast charger pushes the same electrons into your battery. What they charge for those
electrons is not remotely the same. Across the sixteen networks WattWay tracks, the spread runs
from **$0.20**/kWh to **$0.59**/kWh — nearly **3×**, for an identical product.

On a single 70 kWh fill-up that is the difference between $14 and $41. Over a two-thousand-mile
road trip, it is the difference between a cheap week and an expensive one. And almost nobody
knows which stall they are pulling into until they are already plugged in.

That is what [WattWay](https://wattway.net) is for. It is free, it needs no account, and it is
live now.

## Price per kWh, by network (2026)

| Network     | Price per kWh |
| ----------- | ------------- |
| OUC         | $0.20         |
| Tesla       | $0.40         |
| ChargePoint | $0.48         |
| EVgo        | $0.55         |
| Blink       | $0.59         |

*Five of the sixteen networks in the database, showing the range. Rates are typical non-member
pricing and vary by site and state.*

## What it actually does

You give it two addresses and your car. It pulls the real driving route, then looks at every fast
charger within a ten-mile corridor of that route and picks the stops that make the trip cheapest —
not the ones that happen to be closest.

Price is the biggest term, but it is not the only one. A charger that is cheap but slow, down a
fifteen-mile detour, has a single plug, or would leave you arriving on fumes gets penalised for
each of those. What comes back is an ordered list of stops with the cost, the kWh, the charge
time, and the battery percentage you arrive and leave on.

- **177** vehicles
- **27** makes
- **16** networks
- **10 mi** search corridor

## The part I did not expect to be the best part

Charging subscriptions are a genuinely hard call. Electrify America Pass+ is $4 a month for ten
cents off per kWh. Tesla's is $12.99. Whether either is worth it depends entirely on how much you
actually charge on that network — which nobody knows in the abstract.

WattWay knows, because it just planned your trip. So after every route it now tells you exactly
what each membership would have saved on *that* trip, against its monthly fee. On a recent
Austin-to-Seattle run it flagged that Tesla's membership would take $15.82 off a $12.99/month
plan — worth buying for that trip alone — and there is a button to re-plan with it applied.

If you already hold memberships, it does the reverse and shows what they earned you. Two active
plans on that same trip came back at $83.80 saved against $19.98 a month in fees.

## What else is in there

**The Ionna owner discount.** Eligible Hyundai and Genesis owners get 10% off Ionna sessions — 20%
through September 30, 2026 — and the planner prices it in automatically when your car qualifies.

**Stops you choose, respected.** Add waypoints, mark the ones where you will charge overnight
anyway, and set the battery level you want to arrive on. The route plans around them.

**A page for every car and network.** What a charge costs, how long it takes at each stall speed,
and how many stops a trip needs — for all 177 vehicles, plus rate breakdowns for every network.

**Networks you can rule out.** Had a bad run with one operator? Exclude it and the planner routes
around it for the whole trip.

## How it works, and what it cannot promise

Routing comes from Google's Routes API; charger locations, power ratings and much of the pricing
come from [Open Charge Map](https://openchargemap.org), an open community database. Where a site
has not published a rate, WattWay falls back to that network's typical pricing.

> These are estimates, and they are honest ones. Real charging speed depends on battery
> temperature, state of charge and how busy the site is. Prices change, stalls break, and idle
> fees exist. Treat the number as a well-informed forecast for comparing routes — not a quote.

## Free, and staying that way

No account, no paywall, no ads, and nothing about your trip is sold to anyone. It runs entirely in
your browser. If it saves you real money and you want to send some back, there is a donate link in
the corner — that is the whole business model.

**[Plan a trip at wattway.net →](https://wattway.net)**

---

*WattWay · built by TheSaltyKorean · charger data from Open Charge Map · rates shown are 2026
typical non-member pricing and vary by site.*
