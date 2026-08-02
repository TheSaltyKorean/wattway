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
