// Generates public/llms.txt and public/llms-full.txt from the live site data.
//
// llms.txt is the short index an AI answer engine reads to orient itself;
// llms-full.txt is the whole corpus as plain text, so an agent can ingest every
// price, spec and answer in one fetch instead of crawling 200 HTML pages (and
// without needing to execute the JavaScript the planner itself is built on).
//
// Run via `npm run generate:llms` (which uses tsx, since this imports the app's
// TypeScript modules directly so the numbers can never diverge from the ones the
// pages render). Regenerate whenever the vehicle database, network prices or
// guide content change; `npm run check:llms` regenerates and fails if the
// committed files have drifted from the data.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const { EV_DATABASE } = await import("../lib/evDatabase.ts");
const seo = await import("../lib/seo.ts");
const math = await import("../lib/chargingMath.ts");
const { MEMBERSHIP_PLANS } = await import("../lib/memberships.ts");
// guideMeta, not guides.tsx: the latter builds React elements at module scope.
const { GUIDE_META: GUIDES } = await import("../lib/guideMeta.ts");

const { SITE_URL, chargingNetworks, evName, evPath, networkPath, PRICING_YEAR } = seo;
const networks = chargingNetworks();
const makes = [...new Set(EV_DATABASE.map((e) => e.make))].sort();

const SUMMARY =
  "WattWay is a free, cost-optimized EV road-trip charging planner. Given an origin and " +
  "destination, it finds the cheapest realistic sequence of charging stops for a specific electric " +
  "vehicle — using charging-network prices, the driver's memberships, each charger's power and " +
  "reliability, and the car's real-world range.";

const CONTEXT = `WattWay runs entirely in the browser as a static site: there is no account, no login, and no server that stores user data. Routing, geocoding, and place search come from the Google Maps Platform; charger locations, connector types, power levels, and pricing come from Open Charge Map (a community-edited database). Every number WattWay shows — cost, range, energy used, charge time, number and location of stops, arrival state of charge — is a model-based estimate, not a quote or a measurement. See the legal disclaimer for the full data and accuracy notice.`;

// --- llms.txt ---------------------------------------------------------------

const llms = `# WattWay

> ${SUMMARY}

${CONTEXT}

## Key facts

- **What it does**: Plans an EV road trip to minimize total charging cost and time by choosing an optimal, minimal set of charging stops along the route.
- **How it differs from a generic map**: It optimizes for total charging *cost* — not just "any charger nearby" — factoring in each network's pricing, the driver's membership plans, charger speed (kW), and reliability, plus the vehicle's usable battery and range.
- **Vehicles supported**: ${EV_DATABASE.length} EV profiles across ${makes.length} makes (${makes.join(", ")}), split by spec generation, plus a custom-vehicle option for entering real-world battery/range/charge specs.
- **Charging networks priced**: ${networks.length} (${networks.map((n) => n.name).join(", ")}), from ${seo.perKwh(networks[0].pricePerKwh)} to ${seo.perKwh(networks[networks.length - 1].pricePerKwh)} per kWh as of ${PRICING_YEAR}.
- **Cost to use**: Free. No sign-up or account required.
- **Privacy**: Runs client-side. The selected vehicle, memberships, excluded networks, and custom specs are stored locally in the browser; origin/destination are sent to Google and Open Charge Map only to compute the route and find chargers.
- **Coverage**: Charger data is strongest where Open Charge Map's community data is complete; availability and pricing should always be confirmed with the charging network before travel.

## Pages

- [WattWay trip planner](${SITE_URL}/): The main tool — enter an origin, destination, and vehicle to get a cost-optimized charging plan with stops, costs, and charge times. Requires JavaScript; the reference pages below do not.
- [EV charging cost & range database](${SITE_URL}/ev): Charging cost, range, battery size and DC fast-charge rate for all ${EV_DATABASE.length} supported vehicles, each with its own page.
- [Charging network prices compared](${SITE_URL}/charging-networks): Per-kWh rates for all ${networks.length} priced networks, membership break-evens, and why the cheapest network is often the wrong stop.
- [Guides](${SITE_URL}/guides): Long-form explanations of road-trip charging cost, the planning algorithm, and DC fast-charging behavior.
${GUIDES.map((g) => `  - [${g.title}](${SITE_URL}/guides/${g.slug}): ${g.description}`).join("\n")}
- [FAQ](${SITE_URL}/faq): How WattWay picks stops, where its data comes from, what it costs, and how accurate it is.
- [Legal disclaimer & terms](${SITE_URL}/legal): Estimates-only notice, third-party data sources (Google Maps Platform, Open Charge Map), privacy notice, and terms of use.

## Optional

- [Full text corpus](${SITE_URL}/llms-full.txt): Every vehicle spec, network price and answer on the site as plain text, in one file.
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
w(`- Planning window: charge from ${Math.round(math.MIN_SOC * 100)}% to ${Math.round(math.CHARGE_TO_SOC * 100)}% state of charge; the planner goes above ${Math.round(math.CHARGE_TO_SOC * 100)}% only when the next gap requires it.`);
w(`- Average power below ${Math.round(math.CHARGE_TO_SOC * 100)}%: ${Math.round(math.CHARGE_TAPER_FACTOR * 100)}% of the vehicle's nameplate peak kW, capped by the stall's output.`);
w(`- Average power above ${Math.round(math.CHARGE_TO_SOC * 100)}%: ${Math.round(math.ABOVE_80_TAPER_FACTOR * 100)}% of the below-${Math.round(math.CHARGE_TO_SOC * 100)}% rate.`);
w(`- Stop scoring: effective price per kWh after memberships, plus a penalty per mile of detour, plus a penalty for stalls under 150 kW.`);
w(`- Unrecognized operators are priced at ${seo.perKwh(seo.DEFAULT_PRICE_PER_KWH)}.`);
w();

w("## Charging networks");
w();
w("| Network | $/kWh | Type | Membership |");
w("| --- | --- | --- | --- |");
for (const n of networks) {
  const plan = seo.membershipForNetwork(n.name);
  const m = plan
    ? `${plan.label}, ${seo.usd(plan.monthlyFeeUsd)}/mo, -${seo.perKwh(plan.discountPerKwh)}`
    : "none";
  w(`| ${n.name} | ${n.pricePerKwh.toFixed(2)} | ${n.kind} | ${m} |`);
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
    `energy moved in a ${Math.round(math.MIN_SOC * 100)}-${Math.round(math.CHARGE_TO_SOC * 100)}% ` +
    `charge (kWh), miles added by that charge, best-case charge time (min), and cost per 100 miles ` +
    `at a mid-pack ${seo.perKwh(REFERENCE_RATE)}.`
);
w();
w("| Vehicle | Years | kWh | Range | Peak kW | mi/kWh | Charge kWh | Charge mi | Charge min | $/100mi | URL |");
w("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const ev of [...EV_DATABASE].sort(
  (a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.years.localeCompare(b.years)
)) {
  w(
    `| ${ev.make} ${ev.model} | ${ev.years} | ${ev.batteryKwh} | ${ev.rangeMiles} | ${ev.maxChargekW} | ` +
      `${ev.efficiencyMilesPerKwh.toFixed(2)} | ${math.fastChargeKwh(ev).toFixed(1)} | ` +
      `${Math.round(math.fastChargeMiles(ev))} | ${Math.round(math.fastChargeMinutes(ev))} | ` +
      `${math.costPer100Miles(ev, REFERENCE_RATE).toFixed(2)} | ${SITE_URL}${evPath(ev)} |`
  );
}
w();

w("## Guides");
w();
for (const g of GUIDES) {
  w(`### ${g.title}`);
  w(`URL: ${SITE_URL}/guides/${g.slug}`);
  w();
  w(g.description);
  w();
}

w("## Frequently asked questions");
w();
w(`The canonical answers live at ${SITE_URL}/faq. Each vehicle page carries the same questions`);
w("answered for that specific car, and each network page for that specific network.");
w();

writeFileSync(join(root, "public/llms.txt"), llms, "utf8");
writeFileSync(join(root, "public/llms-full.txt"), lines.join("\n"), "utf8");

console.log(
  `llms.txt: ${llms.length} bytes · llms-full.txt: ${lines.join("\n").length} bytes ` +
    `(${EV_DATABASE.length} vehicles, ${networks.length} networks, ${GUIDES.length} guides)`
);
