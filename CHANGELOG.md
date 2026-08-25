# Changelog

Notable user-facing changes to [WattWay](https://wattway.net).

This is a curated list, not a commit log. Internal refactors, review-round
fixes, and content-only additions are left out unless they changed something a
user can see. WattWay ships continuously from `main` and has no version
numbers, so entries are grouped by the month they went live.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2026-08

### Added

- **Uber and Lyft driver charging discounts.** Pick your platform and reward
  tier and the planner prices EVgo at the member rate both programs hand out
  fee-free, plus Lyft's Electrify America discount (23%, or 29% for
  Gold/Platinum/Elite). Rates are modeled at the floor the programs guarantee
  rather than the "up to 45%" they advertise, so your real cost should land at
  or below the estimate.
- **Hyundai and Genesis Ionna discount.** 10% off every Ionna session for
  eligible vehicles, or 20% through September 30, 2026. Applied in the planner
  and explained on the vehicle pages, which read the same numbers so a quoted
  rate cannot drift from what the plan actually charges.
- **Is a membership worth it?** After each plan, WattWay shows what every
  charging subscription would have saved on that specific trip against its
  monthly fee — and now recommends every plan that clears its own fee, not just
  the best one.
- **One-click re-plan with a recommended membership.** Apply a suggested
  subscription and re-price the route without re-entering the trip.
- **A top menubar and a mobile-first planner layout**, including the collapsed
  form reading back as tappable chips so the inputs behind a price are never
  hidden.
- **200+ crawlable vehicle and network pages**, a generated sitemap, and an AI
  corpus at `/llms.txt`.

### Changed

- The mobile map shrank to 30% of the viewport so the form dominates the screen,
  and the plan button is pinned for real while you fill the form.
- The form now collapses after planning on desktop, not just on phones.

### Fixed

- Long routes no longer trip Open Charge Map's rate limit; segment queries retry
  instead of failing the whole plan.
- Members holding every worthwhile subscription were told "no membership pays
  for itself" — a true statement about what is left to buy and a misleading one
  about what they already own. They now see what their plans actually returned.
- Trailing-slash URLs 404'd for crawlers; every page title now fits the
  70-character search limit; Cloudflare Bot Fight Mode, which was quietly
  blocking crawlers, is disabled.
- Non-operational chargers are excluded from planning, and Walmart's network is
  priced.

## 2026-07

### Added

- **The initial cost-optimized EV trip planner** — routing, chargers along the
  corridor, and a greedy low-cost set of stops, deployed as a static site on
  GitHub Pages at [wattway.net](https://wattway.net).
- **Published pricing from Open Charge Map**, with segmented corridor queries so
  long routes do not starve their endpoints of candidate chargers.
- **Charging memberships and multi-stop routes**, on a realistic optimizer built
  on the current Google Routes API.
- **A large vehicle database**, split by generation and model-year range, across
  Tesla, Hyundai/Genesis, Kia, Ford, GM, Rivian, Lucid, BMW, Mercedes, Audi,
  Porsche, Volvo/Polestar, Toyota/Lexus/Subaru, Honda/Acura, Nissan, Jaguar,
  Mini and Jeep — plus a **custom vehicle** option for anything missing.
- **Per-stop control**: reorder stops, set an arrival charge per stop, and mark
  a stop as already charged.
- **Exclude charging networks** you do not want routed through.
- **A dockable route panel** — right, left, or floating and draggable, and it
  remembers where you left it.
- **NACS Supercharger access**, avoid ferries/tolls, current-location on every
  field, and an installable PWA.

### Fixed

- Community-edited Open Charge Map data could inject markup into the map popup;
  that DOM XSS path is closed.
- A Content-Security-Policy was added, and community links now show the
  destination host before you follow them.
- Two-point route segments interpolate a midpoint so charger-query subdivision
  always works.

[Unreleased]: https://github.com/TheSaltyKorean/wattway/commits/main
