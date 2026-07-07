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

## 🗳️ Requested (from community feedback)
- **Per-stop leftover charge target** — let the user set the battery % they want
  remaining on arrival at *each* stop, not just the final destination (e.g.
  "reach the mid-trip stop with 40%"). Today there's a single arrival target for
  the destination. _(requested by u/jdogsparky2626.)_
- **Cross-reference charger reliability with PlugShare ratings** — factor
  PlugShare's community reliability scores into charger selection alongside the
  current Open Charge Map signals. _(requested by u/element1311; note: PlugShare
  has no public API, so this needs a data source / partnership.)_
- **Deselect / exclude charging networks** — let the user turn off networks they
  don't want to use (a broken, disliked, or inaccessible network) so the
  optimizer skips them entirely, alongside the existing membership selection.
  _(requested by u/Jackpot777.)_
- _(add new requests here as they arrive)_

## 🔭 Planned / exploring
- Real-time charger availability (Google Places `evChargeOptions` — live
  `availableCount` / `outOfServiceCount` for participating networks)
- Real-time / time-of-use pricing (needs a commercial feed, e.g. Paren or Chargeprice)
- Multiple route alternatives with side-by-side cost comparison
- Shareable trip links
- Warn when a route still requires a ferry — Google's `avoidFerries` is a
  preference, not a guarantee, so surface a notice when the returned route still
  crosses water instead of silently treating ferry miles as drivable

## 🙏 Thanks
Community feedback that shaped WattWay:
- **u/jdogsparky2626** — spotted the Lake Michigan ferry routing bug and
  requested per-stop leftover-charge targets.
- **u/element1311** — suggested cross-referencing charger reliability with
  PlugShare ratings.
- **u/rb_stlouis** — requested the Chevrolet Equinox EV FWD.
- **u/diatonic** — requested the Volvo C40 Recharge (MY23).
- **u/salted_grapes** — requested the 2026 Toyota bZ AWD.
- **u/Jackpot777** — requested the ability to deselect/exclude charging networks.
- **u/Quiet_Reality_6612** — requested the F-150 Lightning Standard Range.
