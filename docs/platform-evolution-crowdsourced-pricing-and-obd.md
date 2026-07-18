# Platform Evolution — Crowdsourced Pricing & OBD Integration

> **Status:** Backlog epic. Not scheduled. This is a scoping/planning document, not
> a commitment. Created 2026-07-18.
>
> **TL;DR:** Two headline features — (A) crowdsourced charging prices that capture
> time-of-day and surge pricing, and (B) live vehicle data via OBD/telematics —
> cannot be built on WattWay's current architecture (a static, client-only web app
> on GitHub Pages). Together they require re-platforming into a **native app + web**
> product backed by a **real server, database, and user accounts**, and moving the
> map layer from **Google Maps to an open-maps (OpenStreetMap) stack**. This
> document lays out everything that would need to happen, why, and in what order.

---

## 1. Why the current architecture can't do this

Today WattWay is:

- **Next.js static export → GitHub Pages.** No server, no database, no backend
  logic. Everything runs in the visitor's browser.
- **Google Maps Platform** for map render, routing, geocoding, places (a single
  HTTP-referrer-restricted browser key).
- **Open Charge Map** read-only for charger locations and whatever pricing it has.
- **No user accounts, no identity, no persistence** beyond `localStorage`.
- **Effectively $0/month** to run (within Google's trial credit / free tiers).

The two requested features each break one or more of those constraints:

| Requirement | Why the static/client-only model fails |
|---|---|
| Receive & store price submissions from users | No backend to POST to; no database to hold them. |
| Trust / reputation / anti-abuse | No user identity, so no way to weight or moderate contributions. |
| Time-of-day + surge pricing | Needs a time-series datastore and server-side aggregation, not static JSON. |
| Capture prices at the charger (photo OCR, geofence prompts, background) | Browsers can't do reliable background geolocation, BLE, or app-store-grade capture UX. |
| Read the car (OBD / telematics) | Needs native Bluetooth (dongles) or server-side OAuth to automaker cloud APIs. |
| Store/derive map + pricing data at scale | Google Maps ToS restricts caching/storing/deriving map data, and per-call cost scales badly for a data-collection product. |

**Conclusion:** these are not incremental features on the current app. They are the
motivation to graduate WattWay into a proper product with a backend, accounts,
native apps, and an owned map stack. The rest of this document scopes that.

---

## 2. Feature A — Crowdsourced pricing (time-of-day + surge aware)

### 2.1 Goal

Replace the current static/estimated pricing (OCM published price + per-network
fallback) with **real, current, community-verified prices** that reflect how
charging is actually billed — including that the price **changes with time of day
and with demand**.

### 2.2 The hard part: pricing is not one number

An accurate price model has to represent, per charger + connector + membership:

- **Energy rate** — $/kWh.
- **Time rate** — $/minute (some networks bill by time, not energy; effective
  $/kWh then depends on charger power — already a known roadmap gap for municipal
  networks).
- **Session / connection fee** — flat per-session charge.
- **Idle fee** — $/minute after charging completes.
- **Minimums, taxes, surcharges.**
- **Membership / plan context** — the same plug costs different amounts on
  pay-as-you-go vs a paid subscription; WattWay already models memberships, so
  submissions must be tagged with which plan they were observed under.
- **Time-of-use (TOU) schedules** — price varies by hour-of-day / day-of-week
  (common for utility and some networks).
- **Surge / dynamic pricing** — real-time demand-based pricing (e.g. some EVgo
  markets). This is **ephemeral** — a value observed at 5pm Friday may not hold an
  hour later — so it must be stored as time-stamped observations and modeled
  statistically, never as a single fixed rate.
- **Currency, connector type, power level, effective/expiry dates.**

### 2.3 Data model sketch

Two layers:

1. **Price observation** (immutable, append-only, one row per report):
   `id, charger_id, connector_type, power_kw, observed_at (timestamp),
   submitted_by (user), membership_context, currency, energy_per_kwh,
   time_per_min, session_fee, idle_fee, source (manual | photo_ocr | telematics |
   network_api), photo_ref, geo (lat/lng at submission for fraud checks),
   confidence, verification_state`.

2. **Derived schedule / estimate** (computed, read-optimized):
   aggregate observations into a per-(charger, connector, membership) estimate,
   bucketed by **hour-of-week** for TOU, plus a **recent-window live estimate** for
   surge. Use robust stats (median, MAD-based outlier rejection), decay old data,
   and expose a **confidence + freshness** signal to the UI.

Storage: **PostgreSQL + PostGIS** (geo) with either **TimescaleDB** or partitioned
tables for the time-series of observations.

### 2.4 Crowdsourcing mechanics

- **Capture flows (best done natively — see §5):**
  - Geofence prompt: "You're at *Buck-ee's #62* — confirm/enter the price?"
  - **Photo of the price screen + OCR** to reduce typing and fraud.
  - Manual entry.
  - **Automatic post-session import** from OBD/telematics (Feature B) — detect a
    charging session ended, prompt to attach the price → highest-quality data.
- **Validation & trust:** cross-check against official network pricing where a feed
  exists; outlier rejection; dedup near-simultaneous reports; per-user reputation;
  geo-sanity (submitter was actually near the charger).
- **Moderation & anti-abuse:** accounts, rate limits, flagging, an admin review
  queue, ban/rollback tooling. Crowdsourced data invites spam and vandalism —
  this is ongoing operational work, not a one-time build.
- **Cold-start / incentives:** with no contributors there is no data and no value.
  Seed from OCM + any network APIs; consider gamification (contributor badges,
  leaderboards), and make WattWay's own routing quality the draw that attracts the
  users who then contribute.

---

## 3. Feature B — OBD / telematics integration

### 3.1 Goal

Replace *estimates* with the car's *real* data: actual state of charge, real
consumption, true range, charging power, battery temperature, odometer. This both
improves the plan (start from the real SoC, calibrate the consumption model to the
actual car) and **feeds Feature A** (auto-detect charging sessions to attach
prices).

### 3.2 Two integration paths (not mutually exclusive)

| Path | What it is | Pros | Cons |
|---|---|---|---|
| **Cloud telematics API** (Smartcar, Enode, Tesla Fleet API, automaker APIs) | User OAuths into their automaker account; we read standardized data server-side | No hardware; standardized SoC/odometer/charge state/location; works from the backend | Per-vehicle coverage gaps; per-call or per-vehicle cost; depends on automaker cooperation |
| **Direct OBD-II dongle** (ELM327 BLE) | App talks Bluetooth to a plug-in dongle | Cheap hardware; works offline; real-time | **EV SoC/battery PIDs are manufacturer-proprietary** and mostly *not* on the standard OBD-II PID set — requires per-make reverse engineering; needs native BLE (native app only) |

**Recommendation:** lead with **cloud telematics (Smartcar/Enode-style
aggregator)** for breadth and because it works from the server; treat the **OBD
dongle** as a later power-user path for makes/models the aggregators don't cover.

### 3.3 What we'd read

SoC %, usable battery capacity / health, estimated range, charging status + power,
odometer, GPS location, battery/cabin temperature.

### 3.4 Uses

- Seed the trip with the **real current SoC** instead of asking the user.
- **Calibrate the consumption model** to the specific car's observed efficiency.
- **Detect charging sessions** → prompt for / auto-attach a price observation.
- Validate range assumptions against reality over time.

### 3.5 Privacy, security, consent (non-negotiable)

Vehicle location + telematics is **sensitive personal data**. Requires: explicit,
revocable, per-scope consent; encryption in transit and at rest; strict retention
limits; a clear privacy policy and app-store privacy labels; and compliance review
(GDPR/CCPA-style). Getting this wrong is a legal and trust failure, not a bug.

---

## 4. Re-platforming I — Open maps (off Google)

### 4.1 Why leave Google Maps

- **Cost at data-collection scale** — a product that constantly loads maps and
  routes for many native-app users, plus geocoding of every submission, scales
  Google's per-call billing badly.
- **ToS on storing/caching/deriving** map data conflicts with building our own
  charger + pricing database on top of it.
- **Native SDK licensing** and the desire for **offline tiles** and self-hosting.

### 4.2 Proposed open stack

| Layer | Option(s) | Notes |
|---|---|---|
| **Rendering** | MapLibre GL JS (web) / MapLibre Native (React Native) | Open fork of Mapbox GL; shared style across web + native |
| **Tiles** | OpenStreetMap data via **Protomaps** (single `.pmtiles` file, very cheap to host) or MapTiler / self-hosted | Vector tiles |
| **Routing** | **Valhalla** (costing model, elevation-aware, good for EV-style routing) / OSRM / GraphHopper | Eventually want **range-aware** routing |
| **Geocoding / autocomplete** | **Photon** (OSM) or **Pelias** | Nominatim has a strict usage policy; self-host for volume |
| **Elevation** | Open DEM (SRTM / Copernicus) | Feeds the consumption model (climb/descent) |

### 4.3 Licensing

OpenStreetMap is **ODbL** — requires attribution and has **share-alike**
implications for a *derived database*. This forces an explicit decision about how
our **crowdsourced pricing database** is licensed and whether/how it is shared
back. Legal review needed before launch.

### 4.4 Parity gaps vs Google

Be honest about regressions: Google's place quality, POI coverage, business data,
and live traffic are hard to match. Expect a quality dip in geocoding/places and
plan mitigations (blend sources, let users correct data).

---

## 5. Re-platforming II — Hosting & backend

### 5.1 From static Pages → a real service

Everything above needs a server. Proposed shape (chosen to reuse the current
TypeScript skill set and keep scope contained):

| Concern | Proposal |
|---|---|
| **API** | TypeScript service (Fastify / NestJS), or a managed backend to compress scope |
| **Database** | PostgreSQL + PostGIS + TimescaleDB (or partitioned tables) for price observations |
| **Auth / accounts** | OAuth (Sign in with Apple / Google) + email; needed for reputation & moderation. Managed (Supabase Auth / Clerk / Auth0) to start |
| **Object storage** | Price-screen photos (S3-compatible) |
| **Background jobs** | Aggregation, telematics polling, moderation queue, data decay |
| **Hosting** | Managed PaaS (Fly.io / Render / Railway) or a cloud provider; **Supabase** (Postgres + Auth + storage + edge functions) is worth evaluating to collapse several boxes into one |
| **Ops** | Secrets management, backups, observability/logging, CI/CD, staging env |

### 5.2 Cost implications

This moves WattWay from **~$0/month** to a **real recurring cost floor** (server +
managed DB + object storage + telematics API fees + map tile hosting +
Apple/Google developer accounts). That directly ties into the earlier
**monetization** discussion (app-store distribution + ads / subscription) — the
crowdsourcing/OBD product needs a revenue model to be sustainable, whereas the
current static site does not.

---

## 6. Re-platforming III — Native apps

### 6.1 Why native is required

- **BLE** for OBD dongles.
- **Reliable background geolocation / geofencing** for "you're at a charger" prompts.
- **Camera + on-device OCR** for price-screen capture.
- **Push notifications.**
- App-store **distribution and trust** (and the ability to charge / show ads).

### 6.2 Framework

**React Native + Expo** — reuses the existing TypeScript/React skills and lets us
**share the domain core** (optimizer, EV database, cost model) between web and
native. **MapLibre Native** provides maps. (Alternative: Flutter, but that means a
full rewrite in Dart and no code reuse.)

### 6.3 Shared core

Extract the pure-TypeScript domain logic — the **optimizer**, **`evDatabase`**, and
**cost model** — into a standalone package consumed by both the Next.js web app and
the React Native app. This is valuable refactoring work that also de-risks the web
app, and it's a sensible **Phase 0** step regardless of the rest.

### 6.4 App-store realities

Apple Developer Program **$99/yr**, Google Play **$25 one-time**; app review
cycles; **privacy nutrition labels** (location + vehicle data will draw scrutiny);
slower update cadence than pushing to a static site.

---

## 7. Target architecture (state we'd be building toward)

```
  ┌─────────────┐     ┌──────────────────┐
  │  Web (Next) │     │ Native app (RN + │
  │  MapLibre GL│     │ MapLibre Native) │
  └──────┬──────┘     └────────┬─────────┘
         │   shared TS core (optimizer, EV DB, cost model)
         └──────────┬──────────┘
                    │  HTTPS API
             ┌──────▼───────┐
             │  Backend API │  auth · submissions · aggregation · moderation
             └──┬────────┬──┘
                │        │
     ┌──────────▼──┐  ┌──▼─────────────┐
     │ Postgres    │  │ Object storage │  (price-screen photos)
     │ PostGIS +   │  └────────────────┘
     │ Timescale   │
     └─────────────┘
                │  integrations
   ┌────────────┼──────────────┬───────────────┐
   ▼            ▼              ▼               ▼
 OSM tiles   Routing      Telematics       Open Charge Map
 (Protomaps) (Valhalla)   (Smartcar/…)   + network price APIs
```

---

## 8. Phasing / roadmap

Sequenced to de-risk and to keep the current free web app working throughout.

- **Phase 0 — Foundations (no user-visible change):** extract the shared TS domain
  core into a package; decide **data licensing** (ODbL implications, pricing-DB
  license); pick the backend + telematics stack.
- **Phase 1 — Backend + open maps on web:** stand up the server, DB, and accounts;
  migrate the **web app off Google Maps to the MapLibre/OSM stack** (de-risks the
  map move without any native work). Read-only pricing served from the API.
- **Phase 2 — Crowdsourced pricing MVP:** manual price entry + moderation on web,
  plus the **first React Native app**; basic per-charger aggregate pricing.
- **Phase 3 — Native capture + telematics:** geofence prompts, photo OCR, and
  **cloud telematics (Smartcar-style)** integration; auto-detect sessions to
  attach prices.
- **Phase 4 — Temporal pricing + OBD dongle + smarter routing:** time-of-day and
  surge modeling; the OBD-II dongle path for uncovered makes; range-aware routing
  on Valhalla.

---

## 9. Open questions / decisions needed

- **Data licensing:** is the crowdsourced pricing DB open (share-alike, community
  goodwill) or proprietary (a moat, but ODbL constraints from OSM apply)?
- **Telematics vs dongle priority** and which aggregator.
- **Budget / hosting appetite** — moving off $0 static hosting.
- **Monetization** to fund recurring cost (ties to the app-store + ads discussion).
- **Maintenance capacity** — moderation and abuse handling are ongoing, not one-off.

---

## 10. Risks

- **Cold-start:** no contributors → no pricing data → no added value. The single
  biggest risk.
- **Surge pricing is ephemeral** and hard to represent trustworthily.
- **EV OBD PID fragmentation** — proprietary, per-make, inconsistent.
- **OSM parity gaps** vs Google places/traffic/coverage.
- **Moderation / abuse burden** scales with success.
- **Cost sustainability** — real monthly floor vs today's ~$0.
- **App-store review** scrutiny for location + vehicle data.

---

## 11. Rough effort signal

This is a **multi-quarter, multi-workstream program**, not a feature. The cheapest
independently-valuable slice is **Phase 0 + the web-only open-maps migration
(Phase 1 maps)**, which can be done without any native or crowdsourcing work and
de-risks the biggest platform change. Everything past Phase 1 assumes a sustained
build + operate commitment and a funding model to match.
