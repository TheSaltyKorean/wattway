// Thin wrapper over the GA4 gtag queue (see components/Analytics.tsx).
//
// Every call is a no-op unless the tag actually loaded: gtag is absent in local
// dev, in builds without NEXT_PUBLIC_GA_ID, and whenever an ad blocker drops
// the googletagmanager script. Analytics must never break planning, so this
// swallows errors rather than propagating them to the caller.
//
// Only aggregate, non-identifying parameters belong here — never addresses,
// coordinates, or anything derived from what the user typed.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, params?: Record<string, string | number | boolean>): void {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", event, params);
  } catch {
    /* best-effort: analytics failures must not surface to the user */
  }
}

// Same-origin plan counter (worker/plan-counter). GA4 is a third-party tag and
// ad blockers erase it wholesale — on 2026-08-01 two real visitors planned four
// trips and GA4 logged nothing at all. This POSTs to our own domain, so there
// is no third-party host for a blocker to reject, and it is the only plan count
// that can be trusted.
//
// sendBeacon rather than fetch: the browser queues it and sends it out of band,
// so it cannot delay rendering the plan the user is waiting for, and it still
// goes out if they navigate away immediately. No body — the endpoint counts
// requests and records nothing about the user or their route.
const PLAN_BEACON_PATH = "/api/plan";

export function countPlan(): void {
  if (typeof navigator === "undefined") return;
  try {
    navigator.sendBeacon?.(PLAN_BEACON_PATH);
  } catch {
    /* best-effort: never let a counter break planning */
  }
}

// Same-origin visit counter (worker/plan-counter, path /api/visit). Cloudflare
// Web Analytics samples 1 page load in 10 on the free plan, so at WattWay's
// volume its daily visit counts are noise; this is exact. The Worker also
// classifies the caller's network as human or data center, so crawler traffic
// from cloud hosts can be excluded from the visit count.
//
// Once per browser session (tab), like a GA "session", not once per page view:
// the sessionStorage flag survives in-site navigation and reloads but not a
// new tab. If storage is unavailable (private mode, blocked site data) it
// falls back to counting this page load, which over-counts slightly rather
// than dropping the visit.
const VISIT_BEACON_PATH = "/api/visit";
const VISIT_FLAG = "ww_visit_counted";

export function countVisit(): void {
  if (typeof navigator === "undefined") return;
  try {
    try {
      if (sessionStorage.getItem(VISIT_FLAG)) return;
      sessionStorage.setItem(VISIT_FLAG, "1");
    } catch {
      /* storage blocked — count this load anyway */
    }
    navigator.sendBeacon?.(VISIT_BEACON_PATH);
  } catch {
    /* best-effort: never let a counter break the page */
  }
}
