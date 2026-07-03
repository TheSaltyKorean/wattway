export interface EVModel {
  id: string;
  make: string;
  model: string;
  year: number;
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
  pricePerKwh: number;
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
}

export interface TripPlan {
  stops: ChargingStop[];
  totalEnergyCostUsd: number;
  totalChargeTimeMinutes: number;
  totalDetourMiles: number;
  routeGeometry: GeoJSON.LineString;
  routeDistanceMiles: number;
  routeDurationMinutes: number;
}

export interface NetworkPrices {
  [network: string]: number;
}

export interface TripInput {
  origin: Waypoint;
  destination: Waypoint;
  ev: EVModel;
  startingSoC: number;
  targetArrivalSoC: number;
  networkPrices: NetworkPrices;
}
