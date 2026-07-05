# WattWay — agent instructions

## ALWAYS run a Codex review loop

Every substantive change to this repo MUST go through a Codex review loop
before it is considered done. No exceptions unless the owner explicitly waives
it for a specific change.

The loop:

1. Create a snapshot branch at the last-reviewed commit
   (`git branch codex-review-base <sha> && git push origin codex-review-base`).
2. Open a review-only PR: base `codex-review-base`, head `main`. Mark it
   review-only in the body — it is never merged.
3. Comment `@codex review` on the PR.
4. Poll every 5 minutes for Codex's response (reviews, inline comments, and
   reactions — the bot login is `chatgpt-codex-connector[bot]`; 👀 means
   in-progress, not a verdict).
5. Fix every legitimate finding; push; reply summarizing the fixes and
   re-tag `@codex review`. Findings may be contested instead of fixed, but
   only with concrete evidence (e.g. a live API call disproving the claim).
6. Repeat until Codex replies with the all-clear ("Didn't find any major
   issues") or reacts 👍.
7. Close the PR (do not merge) and delete the snapshot branch.

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
