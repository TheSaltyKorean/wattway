import type { LineString } from "geojson";

export interface EVModel {
  id: string;
  make: string;
  model: string;
  years: string; // model-year range covered by this profile, e.g. "2022-2024"
  batteryKwh: number;
  rangeMiles: number;
  maxChargekW: number;
  efficiencyMilesPerKwh: number;
  // Custom vehicles set this to keep Tesla Supercharger eligibility (catalog
  // Teslas are detected by make === "Tesla").
  teslaAccess?: boolean;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Waypoint {
  coords: Coordinates;
  address: string;
  // Optional per-via routing hints (ignored on origin/destination):
  arrivalSoC?: number; // min battery % desired on arrival at this via stop
  rechargedHere?: boolean; // treat as a full recharge (hotel / destination / L2)
}

export interface ChargerStation {
  id: string;
  name: string;
  network: string;
  coords: Coordinates;
  address: string;
  maxPowerKw: number;
  fastPortCount: number;
  recentlyVerified: boolean;
  operatorUrl: string | null;
  stationUrl: string | null;
  pricePerKwh: number;
  /** Price before any membership or rideshare discount was applied. Kept so the
      post-plan membership advice can price a plan the user does NOT hold
      against the true undiscounted rate instead of trying to invert whatever
      discount already landed on pricePerKwh. */
  basePricePerKwh: number;
  priceIsPublished: boolean;
  connectorTypes: string[];
  distanceFromRouteMiles: number;
}

export interface ChargingStop {
  station: ChargerStation;
  arrivalSoC: number;
  departureSoC: number;
  kwhAdded: number;
  energyCostUsd: number;
  chargeTimeMinutes: number;
  detourMiles: number;
  totalCostUsd: number;
  legDistanceMiles: number;
}

export interface TripPlan {
  stops: ChargingStop[];
  arrivalSoC: number;
  finalLegMiles: number;
  planIncomplete: boolean;
  totalEnergyCostUsd: number;
  totalChargeTimeMinutes: number;
  totalDetourMiles: number;
  routeGeometry: LineString;
  routeDistanceMiles: number;
  routeDurationMinutes: number;
}

export interface NetworkPrices {
  [network: string]: number;
}

export interface MembershipPlan {
  id: string;
  label: string;
  /** Compact name for tight rows (the post-plan advice list), where the full
      label truncates and takes the "active" marker with it. */
  shortLabel: string;
  networkKey: string;
  discountPerKwh: number;
  monthlyFeeUsd: number;
}

/**
 * One network's discount under an Uber/Lyft driver program. Lives here rather
 * than in lib/rideshareDiscount so TripInput can reference it without the
 * types module importing back into a lib that imports types.
 */
export interface RideshareBenefit {
  /** Membership plan whose network matcher identifies the covered stations. */
  networkPlanId: string;
  /** Dollars off per kWh, or 0 when the benefit is a fraction instead. */
  discountPerKwh: number;
  /** Fraction (0..1) off the session price, or 0 when it is a per-kWh amount. */
  discountFraction: number;
  /** Human-readable rate for the UI, e.g. "EVgo Plus rates" or "29% off". */
  rateLabel: string;
}

export interface TripInput {
  origin: Waypoint;
  destination: Waypoint;
  waypoints?: Waypoint[];
  ev: EVModel;
  startingSoC: number;
  targetArrivalSoC: number;
  networkPrices: NetworkPrices;
  memberships?: MembershipPlan[];
  // Routes API route modifiers (default false). Avoiding ferries prevents
  // "driving" routes that cross open water (e.g. the Lake Michigan car ferry).
  avoidFerries?: boolean;
  avoidTolls?: boolean;
  // Networks the user has opted out of — stations on these are excluded from
  // planning (matched case-insensitively against the operator/name).
  excludedNetworks?: string[];
  // Fraction (0..1) taken off Ionna station prices for the Hyundai/Genesis
  // owner discount. Already gated in the UI on vehicle eligibility + opt-in +
  // date, so the optimizer just applies it to Ionna stations. 0 = no discount.
  ionnaDiscountFraction?: number;
  // Network discounts earned by driving for Uber/Lyft. Already resolved from
  // platform + reward tier in the UI, so the optimizer just applies them.
  // Empty/absent = no rideshare program.
  rideshareBenefits?: RideshareBenefit[];
}
