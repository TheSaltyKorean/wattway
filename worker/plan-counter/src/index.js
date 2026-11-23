/**
 * Unblockable visit + plan counter for WattWay.
 *
 * WHY THIS EXISTS
 * GA4's `plan_trip` event is the only detailed measure of "someone planned a
 * trip", but GA4 is a third-party tag and ad blockers erase it wholesale — on
 * 2026-08-01 two real visitors planned four trips and GA4 recorded zero events
 * all day. Cloudflare Web Analytics survives blockers, but on the free plan it
 * samples 1 page load in 10 (sampleInterval = 10), so at a handful of visits a
 * day its daily numbers are noise: it reported 0 visits for a whole week of
 * real traffic, and a single sampled load reads as 10.
 *
 * This Worker closes both gaps: the app POSTs to same-origin paths on
 * wattway.net, so there is no third-party host for a blocker to reject, and
 * Worker invocation counts are exact.
 *
 *   /api/visit  — once per browser session (components/VisitBeacon.tsx)
 *   /api/plan   — on every successful plan (countPlan in lib/analytics.ts)
 *
 * DATA-CENTER TRAFFIC
 * A large share of "visits" come from cloud networks (Ashburn, Singapore,
 * Frankfurt…) and never plan anything: headless crawlers, link previewers,
 * uptime/SEO scanners. Cloudflare tells us the client's network (request.cf.asn
 * / asOrganization) for free, so the Worker classifies each hit as human or
 * data-center and says so in the RESPONSE STATUS. The status is a dimension of
 * workersInvocationsAdaptive, so the daily report can split the counts with no
 * storage, no bindings and no extra token scope.
 *
 *   status  path         meaning
 *   204     /api/plan    plan, human network      (unchanged since PR #23)
 *   205     /api/plan    plan, data-center network
 *   202     /api/visit   visit, human network
 *   201     /api/visit   visit, data-center network
 *   405     any          not a POST (scanner noise; not counted by the report)
 *
 * The report (gcp_usage_notify.py, outside this repo) depends on this table —
 * change both together.
 *
 * Known imprecision: commercial VPN exits live in data centers, so a real
 * person on a VPN is counted as data-center; and crawlers on residential or
 * mobile networks are counted as human. Apple iCloud Private Relay and
 * Cloudflare WARP are deliberately NOT treated as data centers — those are
 * real browsers.
 *
 * PRIVACY: reads only the network number/name Cloudflare attaches to the
 * request, uses it to pick a status code, and discards it. Nothing is stored or
 * logged — no IP, no user agent, no route, no identifiers, no body.
 */

// Hosting / cloud ASNs seen sending crawler traffic. Matching by number is
// exact; the name pattern below catches the long tail of smaller hosts.
const DATACENTER_ASNS = new Set([
  16509, 14618, // Amazon AWS
  15169, 396982, 19527, // Google / Google Cloud
  8075, 8068, // Microsoft Azure
  14061, // DigitalOcean
  63949, // Linode (Akamai Connected Cloud — NOT 36183, which is Private Relay)
  16276, // OVH
  24940, 213230, // Hetzner
  45102, 37963, // Alibaba Cloud
  132203, 45090, // Tencent Cloud
  136907, 55990, // Huawei Cloud
  31898, // Oracle Cloud
  20473, // Vultr / Choopa
  51167, // Contabo
  60781, 16265, 28753, // Leaseweb
  9009, // M247
  12876, // Scaleway
  47583, // Hostinger
  212238, // Datacamp
  60068, // CDN77
  8560, // IONOS
  36352, // ColoCrossing
  40021, // Contabo US / Nubes
  32934, // Facebook (link previews)
]);

const DATACENTER_ORG =
  /amazon|aws|google cloud|googlebot|microsoft|azure|digitalocean|linode|ovh|hetzner|alibaba|aliyun|tencent|huawei cloud|oracle|vultr|choopa|contabo|leaseweb|m247|scaleway|hostinger|datacamp|cdn77|ionos|colocrossing|hosting|datacenter|data center|server|cloud|vps/i;

// Never classify these as data center even if the name matches: they carry
// real end users (Apple Private Relay egress, Cloudflare WARP, Fastly relay).
const USER_RELAY_ASNS = new Set([13335, 36183, 54113]);

function isDataCenter(cf) {
  if (!cf) return false;
  const asn = Number(cf.asn);
  if (USER_RELAY_ASNS.has(asn)) return false;
  if (DATACENTER_ASNS.has(asn)) return true;
  return DATACENTER_ORG.test(String(cf.asOrganization || ""));
}

const STATUS = {
  "/api/plan": { human: 204, datacenter: 205 },
  "/api/visit": { human: 202, datacenter: 201 },
};

export default {
  async fetch(request) {
    // The app's beacons are always POST (navigator.sendBeacon). Anything else
    // is answered cheaply with 405, which the report ignores.
    const codes = STATUS[new URL(request.url).pathname];
    if (request.method !== "POST" || !codes) {
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }
    const status = isDataCenter(request.cf) ? codes.datacenter : codes.human;
    // No body — the client uses sendBeacon and ignores the response.
    return new Response(null, { status });
  },
};

// Exported for tests.
export { isDataCenter };
