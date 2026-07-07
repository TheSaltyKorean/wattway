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
- **Route options: avoid ferries (default on) / avoid tolls**
- Wait cursor during route calculation and location lookup
- Google Analytics (usage measurement)

## 🗳️ Requested (from community feedback)
- **Per-stop leftover charge target** — let the user set the battery % they want
  remaining on arrival at *each* stop, not just the final destination (e.g.
  "reach the mid-trip stop with 40%"). Today there's a single arrival target for
  the destination. _(Reddit request.)_
- _(add new requests here as they arrive)_

## 🔭 Planned / exploring
- Real-time charger availability (Google Places `evChargeOptions` — live
  `availableCount` / `outOfServiceCount` for participating networks)
- Real-time / time-of-use pricing (needs a commercial feed, e.g. Paren or Chargeprice)
- Multiple route alternatives with side-by-side cost comparison
- Shareable trip links
