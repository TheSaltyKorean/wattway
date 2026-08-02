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
