/**
 * Unblockable plan counter for WattWay.
 *
 * WHY THIS EXISTS
 * GA4's `plan_trip` event is the only detailed measure of "someone planned a
 * trip", but GA4 is a third-party tag and ad blockers erase it wholesale — on
 * 2026-08-01 two real visitors planned four trips and GA4 recorded zero events
 * all day. Cloudflare Web Analytics survives blockers but is a page-load beacon
 * with no custom events, so it cannot see an in-page action like pressing Plan.
 *
 * This Worker closes that gap: the app POSTs to a same-origin path on
 * wattway.net, so there is no third-party host for a blocker to reject.
 *
 * HOW IT IS COUNTED
 * By Worker invocation count (workersInvocationsAdaptive), not by a stored
 * value — this Worker deliberately has no bindings and no storage. Analytics
 * Engine would have allowed counting only well-formed POSTs, but enabling it on
 * this account repeatedly failed (API error 10089), and it is far more
 * machinery than a ~10/day counter warrants.
 *
 * CAVEAT that follows from that: every request to this path is counted,
 * including any crawler or scanner that finds it. robots.txt disallows /api/,
 * and the path is not linked from anywhere, so realistic noise is near zero —
 * but a sudden unexplained spike should be read as scanning, not popularity.
 *
 * PRIVACY: records that a request happened, nothing more. No IP, no user agent,
 * no route, no identifiers, no body is read.
 */

export default {
  async fetch(request) {
    // The app's beacon is always POST (navigator.sendBeacon). Anything else is
    // answered cheaply; it still counts as an invocation, hence the caveat above.
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }

    // 204, no body — the client uses sendBeacon and ignores the response.
    return new Response(null, { status: 204 });
  },
};
