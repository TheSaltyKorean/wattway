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
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Waypoint {
  coords: Coordinates;
  address: string;
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
  networkKey: string;
  discountPerKwh: number;
  monthlyFeeUsd: number;
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
}
