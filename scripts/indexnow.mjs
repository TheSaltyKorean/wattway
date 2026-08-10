// Pings IndexNow with every URL in the sitemap.
//
// IndexNow is a push protocol: instead of waiting for Bing, Yandex, Seznam and
// Naver to re-crawl on their own schedule, you tell them what changed and they
// fetch it. It matters here beyond Bing's own share, because Bing's index is
// what grounds Copilot and (in part) ChatGPT search — so this is one of the few
// levers that moves AI answer-engine visibility directly.
//
// Ownership is proven by hosting a key file at the site root containing exactly
// the key. That file is public by design; it is not a secret and is committed
// alongside this script on purpose.
//
// Usage: node scripts/indexnow.mjs [--dry-run]
// Requires the site to be deployed first — the key file has to be live, and the
// submitted URLs have to resolve, or the endpoint rejects the batch.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const HOST = "wattway.net";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const dryRun = process.argv.includes("--dry-run");

// The key is whatever <key>.txt sits in public/ — one source of truth, so
// rotating the key is just swapping the file.
const keyFiles = readdirSync(join(root, "public")).filter((f) => /^[0-9a-f]{8,128}\.txt$/.test(f));
if (keyFiles.length !== 1) {
  throw new Error(
    `Expected exactly one IndexNow key file in public/, found ${keyFiles.length}: ${keyFiles.join(", ")}`
  );
}
const key = keyFiles[0].replace(/\.txt$/, "");
const keyContents = readFileSync(join(root, "public", keyFiles[0]), "utf8").trim();
if (keyContents !== key) {
  throw new Error(`public/${keyFiles[0]} must contain exactly "${key}", found "${keyContents}"`);
}

// Read the generated sitemap rather than re-deriving the URL list, so this can
// never disagree with what the crawlers were pointed at.
const sitemap = readFileSync(join(root, "out", "sitemap.xml"), "utf8");
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urlList.length === 0) throw new Error("No <loc> entries in out/sitemap.xml — build first.");

console.log(`IndexNow: ${urlList.length} URLs, key ${key}`);
if (dryRun) {
  console.log(urlList.slice(0, 5).join("\n"), `\n... and ${urlList.length - 5} more`);
  process.exit(0);
}

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList }),
});

// 200 = accepted, 202 = accepted but key still being validated. Both are fine.
const body = await response.text();
console.log(`IndexNow responded ${response.status} ${response.statusText}${body ? ` — ${body}` : ""}`);
if (![200, 202].includes(response.status)) process.exit(1);
