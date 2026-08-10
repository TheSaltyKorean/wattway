// Writes out/llms.txt and out/llms-full.txt. Runs as a POST-BUILD step (see the
// "postbuild" script in package.json), because llms-full.txt is only honest if
// it contains the actual prose of the guides and FAQ — and the single place
// that prose exists is the JSX the build just rendered.
//
// So: the tabular data (vehicles, networks, memberships) comes from the app's
// own TypeScript modules, and the long-form text is extracted from the built
// HTML in out/. Nothing is transcribed by hand, so nothing can drift.
//
// Failing here fails the build on purpose. A silently missing llms.txt is worse
// than a broken deploy, because nobody would notice for months.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(root, "out");

// npm runs "postbuild" after every `npm run build`, including a plain dev build.
// Without GITHUB_PAGES=true, next.config.mjs leaves `output` unset and Next
// writes .next/ rather than out/, so there is nothing to generate from — skip
// rather than breaking the ordinary local build path.
if (process.env.GITHUB_PAGES !== "true") {
  console.log("llms: skipped (not a static-export build; set GITHUB_PAGES=true)");
  process.exit(0);
}

// On an export build the output must exist. Failing loudly here is deliberate:
// a silently missing llms.txt would go unnoticed for months.
if (!existsSync(outDir)) {
  throw new Error(
    `GITHUB_PAGES=true but no build output at ${outDir}. Run this after \`next build\`.`
  );
}

const { EV_DATABASE } = await import("../lib/evDatabase.ts");
const seo = await import("../lib/seo.ts");
const math = await import("../lib/chargingMath.ts");
const { MEMBERSHIP_PLANS } = await import("../lib/memberships.ts");
const { GUIDE_META } = await import("../lib/guideMeta.ts");
const { siteFAQs } = await import("../lib/faqs.ts");

const { SITE_URL, chargingNetworks, evName, evPath, networkPath, PRICING_YEAR } = seo;
const networks = chargingNetworks();
const makes = [...new Set(EV_DATABASE.map((e) => e.make))].sort();
const faqs = siteFAQs();

// --- HTML -> text -----------------------------------------------------------

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  "#39": "'", "#x27": "'", "#x2F": "/", mdash: "—", ndash: "–", hellip: "…",
};

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, name) => {
    if (ENTITIES[name] !== undefined) return ENTITIES[name];
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X"
        ? parseInt(name.slice(2), 16)
        : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return whole;
  });
}

/**
 * Extract the readable prose from a built page: everything inside <main>, minus
 * the nav/breadcrumb/footer chrome, with headings and list items kept on their
 * own lines so the result reads as a document rather than one long paragraph.
 */
function pageText(relativePath) {
  const file = join(outDir, relativePath);
  if (!existsSync(file)) throw new Error(`Expected built page missing: ${file}`);
  let html = readFileSync(file, "utf8");

  html = html.replace(/<script[\s\S]*?<\/script>/g, "");
  html = html.replace(/<style[\s\S]*?<\/style>/g, "");

  const main = html.match(/<main[^>]*>([\s\S]*)<\/main>/);
  if (!main) throw new Error(`No <main> found in ${file}`);
  let body = main[1];

  // Drop the breadcrumb trail — it is navigation, not content.
  body = body.replace(/<nav[^>]*aria-label="Breadcrumb"[\s\S]*?<\/nav>/g, "");
  // Screen-reader-only table captions duplicate the visible heading.
  body = body.replace(/<caption[^>]*class="[^"]*sr-only[^"]*"[^>]*>[\s\S]*?<\/caption>/g, "");

  // Structure -> line breaks, so headings and rows don't run together.
  body = body.replace(/<\/(h[1-6]|p|li|dt|dd|tr|section|div|ol|ul|dl|table)>/g, "\n");
  body = body.replace(/<(h[1-6])[^>]*>/g, "\n## ");
  body = body.replace(/<\/(td|th)>/g, " | ");
  body = body.replace(/<li[^>]*>/g, "- ");

  const text = decodeEntities(body.replace(/<[^>]+>/g, ""));

  return text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").replace(/ \| $/, "").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

// --- llms.txt ---------------------------------------------------------------

const SUMMARY =
  "WattWay is a free, cost-optimized EV road-trip charging planner. Given an origin and " +
  "destination, it picks a low-cost set of charging stops for a specific electric " +
  "vehicle — using charging-network prices, the driver's memberships, each charger's power and " +
  "reliability, and the car's real-world range.";

const CONTEXT = `WattWay runs entirely in the browser as a static site: there is no account, no login, and no server that stores user data. Routing, geocoding, and place search come from the Google Maps Platform; charger locations, connector types, power levels, and pricing come from Open Charge Map (a community-edited database). Every number WattWay shows — cost, range, energy used, charge time, number and location of stops, arrival state of charge — is a model-based estimate, not a quote or a measurement. See the legal disclaimer for the full data and accuracy notice.`;

const llms = `# WattWay

> ${SUMMARY}

${CONTEXT}

## Key facts

- **What it does**: Plans an EV road trip to keep charging **cost** low, by choosing a cheap, short set of charging stops along the route. It is a cost-oriented heuristic, not a minimizer: it scores individual stations on a per-kWh-equivalent basis and never compares total plan cost or complete stop sequences, so a route with a cheaper early charger or a better downstream sequence can beat what it returns. Time is a secondary heuristic, not an optimized objective: the score applies flat penalties to stalls under 100 kW and under 150 kW, but never compares modeled charge duration, so two stations above 150 kW score identically on speed however differently they would actually charge.
- **How it differs from a generic map**: It steers toward lower-cost *stops* — not just "any charger nearby" — factoring in each network's pricing, the driver's membership plans, charger speed (kW), and reliability, plus the vehicle's usable battery and range. It never computes or compares a total plan cost.
- **Method**: A greedy heuristic, not a global optimizer. It walks the route once and, at each step, scores only the stations in the far ${Math.round((1 - math.CANDIDATE_WINDOW) * 100)}% of what the current charge can reach (which pushes toward fewer stops but does not guarantee the fewest), then commits to the best without revisiting it. A cheap charger early in the reachable stretch is skipped rather than compared, and whole stop sequences are never compared.
- **Vehicles supported**: ${EV_DATABASE.length} EV profiles across ${makes.length} makes (${makes.join(", ")}), split by spec generation, plus a custom-vehicle option for entering real-world battery/range/charge specs.
- **Charging networks priced**: ${networks.length} (${networks.map((n) => n.name).join(", ")}), from ${seo.perKwh(networks[0].pricePerKwh)} to ${seo.perKwh(networks[networks.length - 1].pricePerKwh)} per kWh as of ${PRICING_YEAR}.
- **Cost to use**: Free. No sign-up or account required.
- **Privacy**: Runs client-side. The selected vehicle, memberships, excluded networks, and custom specs are stored locally in the browser; origin/destination are sent to Google and Open Charge Map only to compute the route and find chargers. If "use my location" falls back from browser GPS (denied, or an insecure origin), the browser calls ipapi.co, which sees the visitor's IP address and returns an approximate location.
- **Coverage**: Charger data is strongest where Open Charge Map's community data is complete; availability and pricing should always be confirmed with the charging network before travel.

## Pages

- [WattWay trip planner](${SITE_URL}/): The main tool — enter an origin, destination, and vehicle to get a cost-optimized charging plan with stops, costs, and charge times. Requires JavaScript; the reference pages below do not.
- [EV charging cost & range database](${SITE_URL}/ev): Charging cost, range, battery size and DC fast-charge rate for all ${EV_DATABASE.length} supported vehicles, each with its own page.
- [Charging network prices compared](${SITE_URL}/charging-networks): Per-kWh rates for all ${networks.length} priced networks, membership break-evens, and why the cheapest network is often the wrong stop.
- [Guides](${SITE_URL}/guides): Long-form explanations of road-trip charging cost, the planning algorithm, and DC fast-charging behavior.
${GUIDE_META.map((g) => `  - [${g.title}](${SITE_URL}/guides/${g.slug}): ${g.description}`).join("\n")}
- [FAQ](${SITE_URL}/faq): How WattWay picks stops, where its data comes from, what it costs, and how accurate it is.
- [Legal disclaimer & terms](${SITE_URL}/legal): Estimates-only notice, third-party data sources (Google Maps Platform, Open Charge Map), privacy notice, and terms of use.

## Optional

- [Full text corpus](${SITE_URL}/llms-full.txt): Every vehicle spec, network price, guide and FAQ answer as plain text, in one file.
`;

// --- llms-full.txt ----------------------------------------------------------

const REFERENCE_RATE = networks[Math.floor(networks.length / 2)].pricePerKwh;
const lines = [];
const w = (s = "") => lines.push(s);

w("# WattWay — full text corpus");
w();
w(`> ${SUMMARY}`);
w();
w(`Source: ${SITE_URL} · Reference pricing year: ${PRICING_YEAR} · Last updated: ${seo.CONTENT_LAST_MODIFIED}`);
w();
w(CONTEXT);
w();
w("All figures below are model-based estimates, not quotes. Charge times assume a full-power");
w("stall and a warm battery and are best cases; real sessions commonly run 1.5-2x longer.");
w();

w("## Charging model");
w();
const pctMin = Math.round(math.MIN_SOC * 100);
const pctMax = Math.round(math.CHARGE_TO_SOC * 100);
w(`- Planning window: charge from ${pctMin}% to ${pctMax}% state of charge; the planner goes above ${pctMax}% only when the next gap requires it.`);
w(`- Average power below ${pctMax}%: ${Math.round(math.CHARGE_TAPER_FACTOR * 100)}% of the vehicle's nameplate peak kW, capped by the stall's output.`);
w(`- Average power above ${pctMax}%: ${Math.round(math.ABOVE_80_TAPER_FACTOR * 100)}% of the below-${pctMax}% rate.`);
w(`- Candidate filter: only stations in the far ${Math.round((1 - math.CANDIDATE_WINDOW) * 100)}% of the currently reachable stretch are scored; the near ${Math.round(math.CANDIDATE_WINDOW * 100)}% is skipped. This pushes toward fewer stops but does not guarantee the fewest — an earlier station inside the window can still win on score and force an extra stop later.`);
w(`- Stop scoring: effective price per kWh after memberships, then adjusted by a penalty per mile of detour; a penalty for stalls under 150 kW, doubled under 100 kW; a penalty for a single fast port; a small penalty for a station not recently verified on Open Charge Map; a penalty for arriving below 15% state of charge; a heavy penalty for an operator-less "Supercharger" record when the vehicle is not Tesla-eligible; and a mild preference for stations farther along the route. Any of these can outweigh a price difference.`);
w(`- Commitment: greedy. The best-scoring candidate is taken and never revisited, and complete stop sequences are never compared against each other.`);
w(`- Failure mode: if no reachable charger remains, or a 50-stop guard trips, the planner returns the partial sequence it has and flags the plan as incomplete rather than failing outright.`);
w(`- NOT modeled: connector compatibility. Vehicle profiles carry no connector type, and stations are selected on power, price and reliability without checking whether the car can physically plug in. A CCS-only vehicle can therefore be routed to a CHAdeMO-only site, and vice versa. Verify the connector before relying on any specific stop.`);
w(`- Pricing: a station's own published rate (via Open Charge Map) wins; the per-network reference rate is only a fallback. Unrecognized operators are priced at ${seo.perKwh(seo.DEFAULT_PRICE_PER_KWH)}.`);
w(`- Home charging is referenced at ${seo.perKwh(seo.HOME_PRICE_PER_KWH)} for the road-vs-driveway comparison.`);
w();

w("## Charging networks");
w();
w("| Network | $/kWh | Type | Membership |");
w("| --- | --- | --- | --- |");
for (const n of networks) {
  const plan = seo.membershipForNetwork(n.name);
  w(
    `| ${n.name} | ${n.pricePerKwh.toFixed(2)} | ${n.kind} | ` +
      `${plan ? `${plan.label}, ${seo.usd(plan.monthlyFeeUsd)}/mo, -${seo.perKwh(plan.discountPerKwh)}` : "none"} |`
  );
}
w();
for (const n of networks) {
  w(`### ${n.name} — ${seo.perKwh(n.pricePerKwh)}`);
  w(`URL: ${SITE_URL}${networkPath(n)}`);
  w();
  w(n.blurb);
  w();
}

w("## Charging memberships");
w();
w(
  `WattWay models ${MEMBERSHIP_PLANS.length} subscription plans, covering ` +
    `${MEMBERSHIP_PLANS.length} of the ${networks.length} priced networks. No membership discount ` +
    `is applied to the rest — which is not the same as pricing them at a flat rate, since a ` +
    `station that publishes its own rate through Open Charge Map keeps it either way and the ` +
    `per-network figure is only the fallback.`
);
w();
for (const plan of MEMBERSHIP_PLANS) {
  w(
    `- **${plan.label}** (${plan.networkKey}): ${seo.usd(plan.monthlyFeeUsd)}/month, ` +
      `${seo.perKwh(plan.discountPerKwh)} off the per-kWh rate. Break-even at a 55 kWh session: ` +
      `${Math.ceil(plan.monthlyFeeUsd / (55 * plan.discountPerKwh))} sessions/month.`
  );
}
w();

w("## Vehicles");
w();
w(
  `${EV_DATABASE.length} profiles across ${makes.length} makes, split by spec generation. ` +
    `Columns: usable battery (kWh), EPA range (mi), peak DC charge rate (kW), efficiency (mi/kWh), ` +
    `energy moved in a ${pctMin}-${pctMax}% charge (kWh), miles added by that charge, best-case ` +
    `charge time (min), and cost per 100 miles at a mid-pack ${seo.perKwh(REFERENCE_RATE)}.`
);
w();
w("| Vehicle | Years | kWh | Range | Peak kW | mi/kWh | Charge kWh | Charge mi | Charge min | $/100mi | URL |");
w("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const ev of [...EV_DATABASE].sort(
  (a, b) =>
    a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.years.localeCompare(b.years)
)) {
  w(
    `| ${ev.make} ${ev.model} | ${ev.years} | ${ev.batteryKwh} | ${ev.rangeMiles} | ${ev.maxChargekW} | ` +
      `${ev.efficiencyMilesPerKwh.toFixed(2)} | ${math.fastChargeKwh(ev).toFixed(1)} | ` +
      `${Math.round(math.fastChargeMiles(ev))} | ${Math.round(math.fastChargeMinutes(ev))} | ` +
      `${math.costPer100Miles(ev, REFERENCE_RATE).toFixed(2)} | ${SITE_URL}${evPath(ev)} |`
  );
}
w();

w("## Frequently asked questions");
w();
w(`Source: ${SITE_URL}/faq`);
w();
for (const faq of faqs) {
  w(`### ${faq.q}`);
  w();
  w(faq.a);
  w();
}

w("## Guides");
w();
for (const guide of GUIDE_META) {
  w(`### ${guide.title}`);
  w(`URL: ${SITE_URL}/guides/${guide.slug}`);
  w();
  w(guide.description);
  w();
  // Full prose, lifted from the page the build just rendered.
  w(pageText(join("guides", `${guide.slug}.html`)));
  w();
}

const full = lines.join("\n");
writeFileSync(join(outDir, "llms.txt"), llms, "utf8");
writeFileSync(join(outDir, "llms-full.txt"), full, "utf8");

console.log(
  `llms.txt: ${llms.length} bytes · llms-full.txt: ${full.length} bytes ` +
    `(${EV_DATABASE.length} vehicles, ${networks.length} networks, ${GUIDE_META.length} guides, ${faqs.length} FAQs)`
);
