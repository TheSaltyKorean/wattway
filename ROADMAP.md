# WattWay Feature Map

A living list of what's shipped and what's requested/planned. Updated as
community feedback comes in (Reddit, Show HN, GitHub issues).

## ✅ Shipped
- Cheapest-cost stop optimizer (fewest stops; price, detour, power/reliability aware)
- Multi-stop waypoints
- Required charge at arrival (destination state-of-charge target)
- Membership / discount plans applied to matching networks
- Charger quality heuristics (penalize slow, single-plug, unverified; exclude Tesla-only for non-Tesla)
- Published Open Charge Map pricing with per-network fallback estimates
- Per-stop details + Google reviews and operator/station links
- Current-location input in any From/To/stop field
- Saved car & memberships (localStorage)
- Dockable / tearable route panel (left / right / floating)
- From ⇄ To swap
- Installable PWA
- Custom domain (wattway.net) + social share card (OG/Twitter)
- **Route options: avoid ferries (default on) / avoid tolls** — ferry fix flagged by u/jdogsparky2626
- Wait cursor during route calculation and location lookup
- Google Analytics (usage measurement)
- **Per-stop arrival charge + "charged here"** — set a minimum battery % on
  arrival at each stop, or mark a stop as a full recharge (hotel / destination /
  overnight L2) — u/jdogsparky2626, u/Upset_Region8582
- **Reorder trip stops** (↑/↓) so a newly-added stop can be slotted between
  existing ones — u/Upset_Region8582
- **Deselect / exclude charging networks** — u/Jackpot777
- **Municipal / utility charging pricing** (Seattle City Light, Tacoma Power,
  OUC) so city networks aren't treated as the generic default — u/Upset_Region8582
- **Long-route charging-desert fix** — bridge sparse-charger gaps by charging up
  to 95% instead of giving up mid-route (Seattle → Key West) — u/Upset_Region8582
- **Dark-mode contrast fix** for the small charging-stop card text — u/Upset_Region8582

## 🗳️ Requested (from community feedback)
- **Cross-reference charger reliability with PlugShare ratings** — factor
  PlugShare's community reliability scores into charger selection alongside the
  current Open Charge Map signals. _(requested by u/element1311; note: PlugShare
  has no public API, so this needs a data source / partnership.)_
- **Model per-minute municipal networks** — some city networks bill per minute,
  not per kWh (e.g. Austin Energy at $0.21/min), so their effective $/kWh depends
  on the charger's power. Needs power-aware cost math to price them accurately;
  for now only per-kWh municipal networks are priced. _(surfaced by u/Upset_Region8582.)_
- _(add new requests here as they arrive)_

## 🏗️ Platform epics (big, re-platforming)
These are not incremental features — they require moving WattWay from a static,
client-only web app to a native-app + backend product on an open-maps stack. Fully
scoped in [docs/platform-evolution-crowdsourced-pricing-and-obd.md](docs/platform-evolution-crowdsourced-pricing-and-obd.md).
- **Crowdsourced pricing (time-of-day + surge aware)** — community-reported,
  verified charging prices that capture energy/time/session/idle fees, membership
  context, time-of-use schedules, and dynamic/surge pricing. Needs native capture
  (geofence prompts, price-screen OCR), user accounts + moderation, and a
  time-series backend.
- **OBD / telematics integration** — read real SoC, range, charge power, and
  odometer from the car (cloud telematics APIs first, OBD-II BLE dongle later) to
  replace estimates and auto-capture charging-session prices.
- **Enabling work:** move off Google Maps to an open-maps stack (MapLibre + OSM /
  Protomaps tiles / Valhalla routing / Photon geocoding); stand up a real backend
  (Postgres + PostGIS + time-series), accounts, and hosting; ship native apps
  (React Native + Expo) sharing the TypeScript domain core.

## 🔭 Planned / exploring
- Real-time charger availability (Google Places `evChargeOptions` — live
  `availableCount` / `outOfServiceCount` for participating networks)
- Real-time / time-of-use pricing (needs a commercial feed, e.g. Paren or Chargeprice)
- Multiple route alternatives with side-by-side cost comparison
- Shareable trip links
- Warn when a route still requires a ferry — Google's `avoidFerries` is a
  preference, not a guarantee, so surface a notice when the returned route still
  crosses water instead of silently treating ferry miles as drivable
- **Overnight / hotel slow-charge stop** — let a stop trade a longer dwell time
  (e.g. a hotel overnight on slower L2/AC) for a cheaper per-kWh rate, and factor
  that into the cost optimization. _(requested by u/dodiddle1987.)_

## 🙏 Thanks
Community feedback that shaped WattWay:
- **u/jdogsparky2626** — spotted the Lake Michigan ferry routing bug and
  requested per-stop leftover-charge targets.
- **u/element1311** — suggested cross-referencing charger reliability with
  PlugShare ratings.
- **u/ChrisRohn** — requested older model years (2020 IONIQ Electric, 2017 Bolt EV).
- **u/iovnow** — requested the 2026 Toyota bZ FWD XLE Plus.
- **u/Tymanthius** — suggested user-entered (custom) vehicle specs.
- **u/dodiddle1987** — suggested an overnight/hotel slow-charge stop for cheaper rates.
- **u/tuctrohs** — prompted adding a legal disclaimer / terms of use.
- **u/rb_stlouis** — requested the Chevrolet Equinox EV FWD.
- **u/diatonic** — requested the Volvo C40 Recharge (MY23).
- **u/salted_grapes** — requested the 2026 Toyota bZ AWD.
- **u/Jackpot777** — requested the ability to deselect/exclude charging networks.
- **u/Quiet_Reality_6612** — requested the F-150 Lightning Standard Range.
- **u/Upset_Region8582** — surfaced the dark-mode contrast and Seattle → Key West
  long-route bugs, and suggested metro/municipal charging pricing, per-stop
  "charged here" destination charging, and easier mid-list stop insertion.
