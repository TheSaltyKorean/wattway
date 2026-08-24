# WattWay — agent instructions

## Build / deploy

- Local dev: `npm run dev` (keys from `.env.local`; never commit keys).
- Type-check with `npx tsc --noEmit` and build before every deploy.
- Public site (the only deployment): GitHub Pages via
  `.github/workflows/pages.yml`, auto-deploys on push to `main`; keys come
  from Actions secrets `GOOGLE_MAPS_KEY` and `OCM_API_KEY` (note: NOT
  prefixed) and are inlined into the public bundle by design — the Google
  key's HTTP-referrer restriction is the protection. No Docker; no servers.

## Hard-won facts (do not re-litigate)

- The Routes API accepts browser calls with website-restricted keys; the
  legacy web-service restriction Codex sometimes cites does not apply.
  Verified live multiple times.
- Legacy Google APIs (Directions, Places Autocomplete class) are unavailable
  to this project — use Routes API and PlaceAutocompleteElement.
- OCM queries must be segmented along the route (see fetchChargersAlongRoute);
  single midpoint-centered queries starve long-route endpoints. OCM requires
  an API key; `compact=true` strips OperatorInfo and must not be used.
- `main` has branch protection: no force pushes, no deletions.
