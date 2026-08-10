import { EVModel } from "./types";
import { EV_DATABASE, DEFAULT_NETWORK_PRICES } from "./evDatabase";
import { MEMBERSHIP_PLANS } from "./memberships";

export const SITE_URL = "https://wattway.net";
export const SITE_NAME = "WattWay";

/**
 * Year the published price/spec tables were last reviewed. Content pages print
 * it so a reader (and an AI answer engine citing us) can tell how fresh the
 * numbers are, and so the year in the copy can't silently rot.
 */
export const PRICING_YEAR = 2026;

/**
 * Date the site's content was last substantively revised, used as the sitemap's
 * lastmod. Bump it when pages change in a way a crawler should re-read; leaving
 * it pinned is deliberate, because a lastmod that moves on every deploy is noise
 * crawlers learn to ignore.
 */
export const CONTENT_LAST_MODIFIED = "2026-08-10";

/** Lowercase, hyphenated, URL-safe. Stable across builds for a given input. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    // Drop combining marks left behind by NFKD (e.g. é -> e + U+0301).
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

/**
 * Descriptive per-vehicle slug. Built from make + model + years rather than the
 * internal `id` so the URL reads as the car it describes. Verified collision-free
 * across the whole database by evSlugsAreUnique() below, which the page module
 * asserts at build time — a future DB edit that collides fails the build instead
 * of silently dropping a page from the static export.
 */
export function evSlug(ev: EVModel): string {
  return slugify(`${ev.make} ${ev.model} ${ev.years}`);
}

export function evPath(ev: EVModel): string {
  return `/ev/${evSlug(ev)}`;
}

/** Human title, e.g. "Tesla Model Y LR AWD (2024)". */
export function evName(ev: EVModel): string {
  return `${ev.make} ${ev.model} (${ev.years})`;
}

export function evSlugsAreUnique(): boolean {
  return new Set(EV_DATABASE.map(evSlug)).size === EV_DATABASE.length;
}

export function getEVBySlug(slug: string): EVModel | undefined {
  return EV_DATABASE.find((ev) => evSlug(ev) === slug);
}

/** All makes, alphabetical, each with its models sorted by name then years. */
export function evsByMake(): { make: string; evs: EVModel[] }[] {
  const groups = new Map<string, EVModel[]>();
  for (const ev of EV_DATABASE) {
    const list = groups.get(ev.make) ?? [];
    list.push(ev);
    groups.set(ev.make, list);
  }
  return [...groups.entries()]
    .map(([make, evs]) => ({
      make,
      evs: [...evs].sort(
        (a, b) => a.model.localeCompare(b.model) || a.years.localeCompare(b.years)
      ),
    }))
    .sort((a, b) => a.make.localeCompare(b.make));
}

/**
 * Vehicles closest to `ev` by EPA range, excluding `ev` itself and any other
 * profile of the same model (a different model year of the same car is not a
 * useful "similar vehicle" suggestion).
 */
export function similarEVs(ev: EVModel, count = 6): EVModel[] {
  return EV_DATABASE.filter((other) => other.id !== ev.id && other.model !== ev.model)
    .sort(
      (a, b) =>
        Math.abs(a.rangeMiles - ev.rangeMiles) - Math.abs(b.rangeMiles - ev.rangeMiles) ||
        a.make.localeCompare(b.make)
    )
    .slice(0, count);
}

// ---------------------------------------------------------------------------
// Charging networks
// ---------------------------------------------------------------------------

export interface ChargingNetwork {
  name: string;
  slug: string;
  pricePerKwh: number;
  /** Editorial context. Kept short and factual — these are published estimates. */
  blurb: string;
  kind: "national" | "regional" | "automaker" | "municipal";
}

/**
 * Editorial notes keyed by the operator names the planner prices. "Default" is
 * excluded — it is the planner's fallback rate for an unrecognized operator, not
 * a network a driver can pull into.
 */
const NETWORK_NOTES: Record<string, { blurb: string; kind: ChargingNetwork["kind"] }> = {
  Tesla: {
    kind: "automaker",
    blurb:
      "The Supercharger network — the largest and most reliable DC fast-charging network in North America, and now open to many non-Tesla EVs via NACS adapters and native NACS ports. Rates vary by site and time of day, and a Supercharging Membership cuts roughly $0.10/kWh off the per-session rate.",
  },
  "Electrify America": {
    kind: "national",
    blurb:
      "A national CCS network built out of Volkswagen's dieselgate settlement, with heavy coverage along interstate corridors and in retail parking lots. Its Pass+ subscription trades a small monthly fee for a lower per-kWh rate.",
  },
  ChargePoint: {
    kind: "national",
    blurb:
      "Less a single network than a platform: most ChargePoint hardware is owned and priced by the site host, so the rate you pay varies far more site-to-site than on an operator-run network. Coverage is broad but heavily weighted toward Level 2.",
  },
  Blink: {
    kind: "national",
    blurb:
      "A national operator with a mix of owned and host-owned equipment. Historically among the more expensive per-kWh options, and its DC fast-charging footprint is thinner than its Level 2 footprint.",
  },
  EVgo: {
    kind: "national",
    blurb:
      "One of the older US DC fast-charging networks, concentrated in metro areas and retail lots rather than along rural interstates. Its EVgo Plus subscription lowers the per-kWh rate.",
  },
  "Francis Energy": {
    kind: "regional",
    blurb:
      "A regional operator concentrated in Oklahoma and the surrounding states, built to fill in fast-charging gaps across rural corridors that the national networks skipped. Typically prices below the national average.",
  },
  Ionna: {
    kind: "automaker",
    blurb:
      "The joint venture backed by eight automakers (BMW, GM, Honda, Hyundai, Kia, Mercedes-Benz, Stellantis and Toyota), building high-power \"Rechargery\" sites with both NACS and CCS cables. Newer and smaller than the incumbents, but priced aggressively.",
  },
  "Shell Recharge": {
    kind: "national",
    blurb:
      "Shell's EV charging arm, often co-located with fuel retail. Its Shell Recharge Plus subscription trims roughly $0.07/kWh off the standard rate.",
  },
  Volta: {
    kind: "national",
    blurb:
      "An advertising-subsidized network now owned by Shell, concentrated at retail and grocery sites. Historically known for free Level 2 charging; its DC fast chargers are paid.",
  },
  Rivian: {
    kind: "automaker",
    blurb:
      "The Rivian Adventure Network, sited toward outdoor and recreational destinations rather than pure interstate coverage. Rivian has been opening sites to other CCS and NACS vehicles.",
  },
  "bp pulse": {
    kind: "national",
    blurb:
      "BP's charging network, expanding through fuel-retail sites and its acquisition of the former AMPLY and TravelCenters of America locations, which puts it on long-haul truck-stop corridors.",
  },
  "Buc-ee's": {
    kind: "regional",
    blurb:
      "Travel-center chargers at Buc-ee's locations across Texas and the Southeast. Notable for road trips because the amenities are genuinely worth the 20 minutes a charge takes.",
  },
  Walmart: {
    kind: "national",
    blurb:
      "Walmart's own in-house fast-charging network, distinct from the Electrify America stalls long sited in Walmart parking lots. It rarely publishes a public rate, so WattWay prices it from reported market rates, which run roughly $0.40-$0.57/kWh.",
  },
  "Seattle City Light": {
    kind: "municipal",
    blurb:
      "Municipal utility chargers in the Seattle area. Utility-run networks usually undercut commercial operators; WattWay prices the daytime (higher) tier so a plan never overstates the saving.",
  },
  "Tacoma Power": {
    kind: "municipal",
    blurb:
      "Tacoma's municipal utility network, among the cheapest per-kWh DC fast charging in the country. Priced here at the daytime tier.",
  },
  OUC: {
    kind: "municipal",
    blurb:
      "Orlando Utilities Commission chargers across central Florida, priced well below commercial networks. Priced here at the daytime tier.",
  },
};

/** Every priced network, cheapest first. Excludes the "Default" fallback rate. */
export function chargingNetworks(): ChargingNetwork[] {
  return Object.entries(DEFAULT_NETWORK_PRICES)
    .filter(([name]) => name !== "Default")
    .map(([name, pricePerKwh]) => ({
      name,
      slug: slugify(name),
      pricePerKwh,
      blurb: NETWORK_NOTES[name]?.blurb ?? "",
      kind: NETWORK_NOTES[name]?.kind ?? "national",
    }))
    .sort((a, b) => a.pricePerKwh - b.pricePerKwh || a.name.localeCompare(b.name));
}

export function getNetworkBySlug(slug: string): ChargingNetwork | undefined {
  return chargingNetworks().find((n) => n.slug === slug);
}

export function networkPath(network: ChargingNetwork): string {
  return `/charging-networks/${network.slug}`;
}

/** The membership plan that discounts a given network, if one exists. */
export function membershipForNetwork(networkName: string) {
  return MEMBERSHIP_PLANS.find((m) => m.networkKey === networkName);
}

/** The planner's fallback rate for operators it doesn't recognize. */
export const DEFAULT_PRICE_PER_KWH = DEFAULT_NETWORK_PRICES["Default"];

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function usd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function perKwh(value: number): string {
  return `$${value.toFixed(2)}/kWh`;
}

/** Minutes as "48 min" or "1 hr 12 min". */
export function duration(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function miles(value: number): string {
  return `${Math.round(value)} mi`;
}
