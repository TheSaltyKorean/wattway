// Reads Bing Webmaster Tools data for wattway.net.
//
// This is the REPORTING side of Bing. It is not IndexNow: scripts/indexnow.mjs
// pushes "this URL changed" and gets nothing back, while this pulls what Bing
// actually thinks of the site — crawl issues, index and traffic stats, the
// submission quota. Different protocol, different credential, no overlap.
//
// Protocol: JSON/REST.
//   https://ssl.bing.com/webmaster/api.svc/json/<Method>?apikey=<KEY>
// Deliberately NOT the SOAP or POX endpoints under the same api.svc — Microsoft
// retires those on 31 August 2026, days from this writing. The REST surface
// exposes the same methods and takes the same key, so there is nothing to
// migrate later.
//
// Errors come back as HTTP 400 with a JSON body: {"ErrorCode":3,"Message":
// "InvalidApiKey"} — not an HTTP-level auth failure, so a naive res.ok check
// reads a bad key as an empty result. Handled below.
//
// Credential: BING_WEBMASTER_API_KEY in the environment (or .env.local, which
// is gitignored). Generate it at Bing Webmaster Tools -> Settings -> API access
// -> API key. It is a secret, unlike the IndexNow key file, which is public by
// design.
//
// Usage:
//   node scripts/bing-webmaster.mjs            # crawl issues + traffic summary
//   node scripts/bing-webmaster.mjs --all      # every report below
//   node scripts/bing-webmaster.mjs --json     # machine-readable
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = "https://wattway.net";
const BASE = "https://ssl.bing.com/webmaster/api.svc/json";

function apiKey() {
  if (process.env.BING_WEBMASTER_API_KEY) return process.env.BING_WEBMASTER_API_KEY;
  // Fall back to .env.local so this runs the same way as the dev server does.
  try {
    const env = readFileSync(join(here, "..", ".env.local"), "utf8");
    const line = env.split("\n").find((l) => l.startsWith("BING_WEBMASTER_API_KEY="));
    if (line) return line.slice("BING_WEBMASTER_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  } catch { /* no .env.local — fall through */ }
  return null;
}

async function call(method, params = {}) {
  const key = apiKey();
  if (!key) throw new Error("BING_WEBMASTER_API_KEY is not set");
  const qs = new URLSearchParams({ apikey: key, ...params });
  const res = await fetch(`${BASE}/${method}?${qs}`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${method}: non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  // A bad key or unverified site is an HTTP 400 with an ErrorCode body, not a
  // 401/403 — check the body, not just the status.
  if (body?.ErrorCode !== undefined && body.ErrorCode !== 0) {
    throw new Error(`${method}: Bing error ${body.ErrorCode} — ${body.Message ?? "unknown"}`);
  }
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  return body?.d ?? body; // WCF JSON wraps payloads in `d`
}

// Bing serializes DateTime as /Date(1755820800000)/
function parseDate(v) {
  const m = typeof v === "string" && v.match(/\/Date\((\d+)/);
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : v;
}

const REPORTS = {
  // The one that answers "what has Bing flagged?"
  crawlIssues: () => call("GetCrawlIssues", { siteUrl: SITE }),
  crawlStats: () => call("GetCrawlStats", { siteUrl: SITE }),
  rankAndTraffic: () => call("GetRankAndTrafficStats", { siteUrl: SITE }),
  urlSubmissionQuota: () => call("GetUrlSubmissionQuota", { siteUrl: SITE }),
  queryStats: () => call("GetQueryStats", { siteUrl: SITE }),
  pageStats: () => call("GetPageStats", { siteUrl: SITE }),
  sites: () => call("GetUserSites"),
};

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const wanted = args.includes("--all")
  ? Object.keys(REPORTS)
  : ["sites", "crawlIssues", "rankAndTraffic"];

const out = {};
let failed = 0;
for (const name of wanted) {
  try {
    out[name] = await REPORTS[name]();
  } catch (e) {
    out[name] = { error: e.message };
    failed++;
  }
}

if (asJson) {
  console.log(JSON.stringify(out, null, 2));
} else {
  for (const [name, value] of Object.entries(out)) {
    console.log(`\n=== ${name}`);
    if (value?.error) { console.log(`  ! ${value.error}`); continue; }
    const rows = Array.isArray(value) ? value : [value];
    if (!rows.length) { console.log("  (nothing reported)"); continue; }
    for (const row of rows.slice(0, 25)) {
      const flat = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, parseDate(v)])
      );
      console.log("  " + JSON.stringify(flat));
    }
    if (rows.length > 25) console.log(`  … ${rows.length - 25} more`);
  }
}

process.exit(failed === wanted.length ? 1 : 0);
