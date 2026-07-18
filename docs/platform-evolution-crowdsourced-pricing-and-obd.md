# Crowdsourced Pricing & OBD Integration

> **Status:** Backlog epic — a scoping/planning document, not a commitment or a
> schedule. Created 2026-07-18.

This document is organized around four questions:

1. **[What we want to solve for](#1-what-we-want-to-solve-for)** — the goal.
2. **[What the problem is](#2-what-the-problem-is)** — why WattWay can't do it today.
3. **[The features](#3-the-features)** — what we'd actually build.
4. **[What needs to happen](#4-what-needs-to-happen)** — the work required to get there.

---

## 1. What we want to solve for

**We want WattWay to tell you the *real* price of charging on your trip, based on
your *real* car — not an estimate.**

Today WattWay is very good at *routing*: given your car and a destination, it finds
the cheapest realistic sequence of stops. But two things it relies on are guesses:

- **The price at each charger.** We use whatever Open Charge Map has recorded, and
  fall back to per-network average rates. Those averages don't know that a station
  charges more at 6pm than at 2am, or that prices spike when demand is high.
- **The state of your car.** We ask you to tell us your battery level and we assume
  a typical efficiency. We can't see the actual charge, the real range in today's
  weather, or how the specific car actually consumes energy.

The goal is to close both gaps:

- **Prices that are real and current** — reported by the people actually charging,
  and aware that price changes with **time of day** and with **demand (surge)**.
- **A car that reports itself** — pull the true state of charge, range, and charging
  power straight from the vehicle, so the plan starts from reality instead of a form.

The payoff: trip estimates you can trust, and a pricing dataset that gets better
every time someone uses the app.

---

## 2. What the problem is

WattWay was deliberately built as a **static website** — no server, no database, no
accounts. Your browser does everything, and the whole thing costs almost nothing to
run. That design is perfect for a routing tool. It's the wrong shape for the two
features above, for concrete reasons:

- **There's nowhere to send a price report.** Collecting prices from users means
  receiving data, storing it, and serving it back. A static site has no server to
  receive it and no database to keep it.
- **There's no way to know who's reporting.** Crowdsourced data only works if you
  can weight trustworthy contributors, catch abuse, and moderate bad entries. That
  needs user accounts and identity — which we don't have.
- **Prices that change over time need a different kind of storage.** "This station
  costs $0.45" is a single value. "This station costs $0.31 overnight, $0.55 at
  peak, and surges when it's busy" is a *time series* that has to be collected and
  averaged on a server.
- **The browser can't capture prices well.** The best way to collect accurate
  prices is at the charger — a prompt when you arrive, a photo of the price screen,
  a reading pulled automatically after a charging session. Those need reliable
  background location, the camera, and Bluetooth in a way only a real mobile app
  can deliver.
- **The browser can't read the car.** Talking to an OBD dongle needs Bluetooth;
  pulling data from the automaker's cloud needs a secure server-side login. Neither
  is possible from a static web page.
- **The map platform doesn't fit a data product.** Google Maps bills per call and
  its terms restrict storing and building on top of its data. A product that
  constantly loads maps for lots of app users and builds its own charger/pricing
  database is a poor fit for that model.

**In short:** these aren't features we can bolt onto the current app. They're the
reason to grow WattWay into a proper product — a mobile app plus the website, backed
by a real server and accounts, on a map platform we can build on.

---

## 3. The features

### 3.1 Crowdsourced pricing (time-of-day + surge aware)

**What the user gets:** charging prices that are real, current, and community-
verified — and that reflect *when* you'll actually be plugging in.

The reason this is hard is that a charging price isn't one number. To be accurate,
each price has to capture:

- **How you're billed** — per kWh, per minute, a flat session fee, an idle fee for
  staying plugged in after you're done, plus taxes and minimums.
- **Your plan** — the same plug costs different amounts on pay-as-you-go versus a
  paid membership (WattWay already models memberships, so reports must note which
  plan they were seen under).
- **The time** — many networks and utilities charge different rates by hour of day
  and day of week.
- **Demand** — some networks use live surge pricing, so a price seen at 5pm on a
  Friday may not hold an hour later. These have to be stored as time-stamped
  observations and turned into a statistical estimate, never a single fixed rate.

**How people would contribute** (best done in a mobile app — see §4):

- A prompt when you arrive at a charger: "You're at *Buck-ee's #62* — confirm the
  price?"
- A **photo of the price screen** that the app reads automatically (less typing,
  harder to fake).
- Manual entry.
- **Automatic capture after a charging session** — if the car is connected
  (Feature 3.2), detect that a session ended and offer to attach the price. This is
  the highest-quality source.

**How we keep it trustworthy:** cross-check against official network prices where we
have them, reject outliers, remove duplicates, score each contributor's reliability,
and run a moderation queue for flagged entries. This is ongoing work, not a one-time
build — open contribution invites spam.

**The catch:** with no contributors there's no data and no value ("cold start"). We'd
seed from existing sources and lean on WattWay's routing quality to attract the users
who then contribute.

### 3.2 OBD / telematics integration

**What the user gets:** WattWay reads the car directly — real state of charge, real
range, charging power, odometer — so the plan starts from your actual battery
instead of a number you typed, and adapts to how your specific car really drives.

There are two ways to connect a car, and they're not mutually exclusive:

- **Through the automaker's cloud (recommended first).** You log in once to your
  car's account through a service like Smartcar or Enode, and WattWay reads
  standardized data from the server. No hardware, works across many brands. Downsides
  are per-vehicle coverage gaps and a per-use cost.
- **Through an OBD-II Bluetooth dongle (later).** A cheap adapter plugs into the car
  and the app talks to it directly. Works offline and in real time, but EV battery
  data isn't part of the standard OBD set — it's proprietary and different for every
  make — so this needs per-brand work and a mobile app for Bluetooth.

Beyond starting the trip from the real battery level, connecting the car also lets us
**calibrate the estimate to how your car actually consumes energy** and **detect
charging sessions to auto-capture prices** for Feature 3.1.

**Non-negotiable:** a car's location and telematics are sensitive personal data.
This requires explicit, revocable consent; encryption; strict limits on what we keep
and for how long; a clear privacy policy; and app-store privacy disclosures.

---

## 4. What needs to happen

Delivering the two features means three pieces of platform work plus a shared code
foundation. None of it is a weekend project; the point of listing it is to be honest
about scope.

### 4.1 Move off Google Maps to an open-maps stack

A data-collection product that loads maps for many app users fits an owned,
open-maps stack better than Google's per-call billing and storage restrictions.

| Layer | Proposed | Why |
|---|---|---|
| Map rendering | **MapLibre** (web + native) | Open, one style across web and app |
| Map tiles | **OpenStreetMap** data via **Protomaps** or MapTiler | Cheap to host, self-serve |
| Routing | **Valhalla** (or OSRM / GraphHopper) | Costing model suits EV-style, range-aware routing |
| Search / geocoding | **Photon** or Pelias | OSM-based address search |

Trade-off to go in eyes-open: Google's place quality, business data, and live
traffic are hard to match, so expect a quality dip in search/places and plan to
blend sources and let users correct data. There's also a licensing decision — OSM's
ODbL terms carry attribution and "share-alike" obligations that affect how our own
pricing database can be licensed.

### 4.2 Stand up a real backend and user accounts

This is what makes crowdsourcing possible at all:

- **A server + API** to receive price reports, serve pricing, and run the app's
  logic (TypeScript, to reuse what we have).
- **A database** built for geography and time — PostgreSQL with PostGIS, plus a
  time-series layer for the stream of price observations.
- **User accounts** (sign in with Apple/Google/email) so we can do reputation and
  moderation.
- **Storage** for price-screen photos, **background jobs** for aggregation and
  moderation, plus the usual hosting, backups, and monitoring.

This is the biggest change in character: WattWay goes from **~$0/month** to a real
recurring cost (server, database, telematics fees, map hosting, developer accounts).
That ties directly to monetization — the product needs a revenue model to be
sustainable, whereas the current static site does not.

### 4.3 Ship native mobile apps

The best price-capture and the OBD dongle path both need a real mobile app —
Bluetooth, reliable background location, the camera, and push notifications aren't
available to a website. The plan is **React Native (with Expo)** so we reuse the
existing TypeScript/React work and share logic between web and app, with MapLibre for
maps. This also brings app-store realities: developer accounts, review cycles, and
privacy disclosures for location and vehicle data.

### 4.4 Extract a shared core (do this first)

Before any of the above, pull WattWay's pure logic — the **optimizer**, the **EV
database**, and the **cost model** — into a standalone TypeScript package that both
the website and the future mobile app use. It's low-risk, it's useful on its own, and
everything else builds on it. This is the natural first step.

---

## A suggested order

Sequenced so the current free website keeps working the whole time and the biggest
risks are retired early:

1. **Foundations** — extract the shared core (§4.4); decide data licensing; pick the
   backend and telematics providers.
2. **Backend + open maps on the website** — stand up the server, database, and
   accounts, and migrate the *website* off Google Maps to MapLibre/OSM. This proves
   out the map move with no mobile work.
3. **Crowdsourced pricing MVP** — manual price entry and moderation on the website,
   plus the first mobile app; basic per-charger pricing.
4. **Native capture + connected car** — arrival prompts, price-screen photo reading,
   and cloud telematics; auto-detect sessions to attach prices.
5. **Time-of-day + surge + OBD dongle** — model temporal and surge pricing, add the
   dongle path for uncovered cars, and move to range-aware routing.

The cheapest slice that delivers real value on its own is **step 1 plus the
website-only open-maps migration in step 2** — it de-risks the largest platform change
without any mobile or crowdsourcing work.

---

## Open questions

- **Data licensing** — is the crowdsourced pricing database open (community goodwill,
  share-alike) or proprietary (a moat, but OSM's terms constrain it)?
- **Connected-car priority** — cloud telematics vs. the OBD dongle, and which
  provider.
- **Budget** — appetite for moving off $0 static hosting to a real cost floor.
- **Monetization** — the revenue model that funds the running costs.
- **Capacity** — moderation and abuse handling are continuous, not one-off.
