import {
  ChargerStation,
  ChargingStop,
  Coordinates,
  TripInput,
  TripPlan,
} from "./types";

const MAPBOX_BASE = "https://api.mapbox.com";
const OCM_BASE = "https://api.openchargemap.io/v3";
const MIN_SOC = 0.10; // never go below 10%
const CHARGE_TO_SOC = 0.80; // charge to 80% by default (optimal for DCFC)
const MILES_TO_METERS = 1609.34;
const DETOUR_PENALTY_PER_MILE = 0.15; // $ per mile of detour (time + fuel equivalent)
const CORRIDOR_MILES = 10; // search within 10 miles of route

// Haversine distance between two coords in miles
function haversine(a: Coordinates, b: Coordinates): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng *
      sinLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// Minimum distance from a point to a line segment (route segment)
function pointToSegmentDistance(
  p: Coordinates,
  a: Coordinates,
  b: Coordinates
): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversine(p, a);
  let t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nearest = { lat: a.lat + t * dy, lng: a.lng + t * dx };
  return haversine(p, nearest);
}

// Find minimum distance from point to entire route polyline
function minDistanceToRoute(
  point: Coordinates,
  routeCoords: Coordinates[]
): number {
  let minDist = Infinity;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const d = pointToSegmentDistance(point, routeCoords[i], routeCoords[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// Get bounding box that covers the entire route + corridor
function getRouteBBox(
  routeCoords: Coordinates[],
  bufferMiles: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const bufferDeg = bufferMiles / 69;
  const lats = routeCoords.map((c) => c.lat);
  const lngs = routeCoords.map((c) => c.lng);
  return {
    minLat: Math.min(...lats) - bufferDeg,
    maxLat: Math.max(...lats) + bufferDeg,
    minLng: Math.min(...lngs) - bufferDeg,
    maxLng: Math.max(...lngs) + bufferDeg,
  };
}

// Progress along route (0–1) for a given point (nearest route fraction)
function routeProgress(
  point: Coordinates,
  routeCoords: Coordinates[]
): number {
  let bestT = 0;
  let minDist = Infinity;
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const l = haversine(routeCoords[i], routeCoords[i + 1]);
    segLens.push(l);
    totalLen += l;
  }
  let cumLen = 0;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const a = routeCoords[i];
    const b = routeCoords[i + 1];
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const lenSq = dx * dx + dy * dy;
    let t =
      lenSq === 0
        ? 0
        : ((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const nearest = { lat: a.lat + t * dy, lng: a.lng + t * dx };
    const d = haversine(point, nearest);
    if (d < minDist) {
      minDist = d;
      bestT = (cumLen + t * segLens[i]) / totalLen;
    }
    cumLen += segLens[i];
  }
  return bestT;
}

export async function getRoute(
  origin: Coordinates,
  destination: Coordinates,
  mapboxToken: string
): Promise<{ geometry: GeoJSON.LineString; distanceMiles: number; durationMinutes: number }> {
  const url = `${MAPBOX_BASE}/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Mapbox Directions API error");
  const data = await res.json();
  const route = data.routes[0];
  return {
    geometry: route.geometry,
    distanceMiles: route.distance / MILES_TO_METERS,
    durationMinutes: route.duration / 60,
  };
}

export async function fetchChargersAlongRoute(
  routeCoords: Coordinates[],
  ocmApiKey?: string
): Promise<ChargerStation[]> {
  const bbox = getRouteBBox(routeCoords, CORRIDOR_MILES);
  const params = new URLSearchParams({
    output: "json",
    levelid: "3", // DC Fast only
    maxresults: "200",
    compact: "true",
    verbose: "false",
    latitude: String((bbox.minLat + bbox.maxLat) / 2),
    longitude: String((bbox.minLng + bbox.maxLng) / 2),
    distance: "300",
    distanceunit: "Miles",
    boundingbox: `(${bbox.minLat},${bbox.minLng}),(${bbox.maxLat},${bbox.maxLng})`,
  });
  if (ocmApiKey) params.set("key", ocmApiKey);

  const res = await fetch(`${OCM_BASE}/poi/?${params}`);
  if (!res.ok) throw new Error("Open Charge Map API error");
  const data = await res.json();

  const stations: ChargerStation[] = [];
  for (const poi of data) {
    if (!poi.AddressInfo?.Latitude || !poi.AddressInfo?.Longitude) continue;
    const coords: Coordinates = {
      lat: poi.AddressInfo.Latitude,
      lng: poi.AddressInfo.Longitude,
    };
    const distFromRoute = minDistanceToRoute(coords, routeCoords);
    if (distFromRoute > CORRIDOR_MILES) continue;

    const network: string =
      poi.OperatorInfo?.Title || "Default";

    // Get max power from connections
    let maxPower = 0;
    const connectorTypes: string[] = [];
    if (poi.Connections) {
      for (const conn of poi.Connections) {
        if (conn.PowerKW && conn.PowerKW > maxPower) maxPower = conn.PowerKW;
        if (conn.ConnectionType?.Title) connectorTypes.push(conn.ConnectionType.Title);
      }
    }
    if (maxPower < 50) continue; // skip slow chargers

    stations.push({
      id: String(poi.ID),
      name: poi.AddressInfo.Title,
      network,
      coords,
      address: [
        poi.AddressInfo.AddressLine1,
        poi.AddressInfo.Town,
        poi.AddressInfo.StateOrProvince,
      ]
        .filter(Boolean)
        .join(", "),
      maxPowerKw: maxPower,
      pricePerKwh: 0, // filled below
      connectorTypes: [...new Set(connectorTypes)],
      distanceFromRouteMiles: distFromRoute,
    });
  }
  return stations;
}

function getPriceForNetwork(
  network: string,
  networkPrices: Record<string, number>
): number {
  // Exact match first
  if (networkPrices[network] !== undefined) return networkPrices[network];
  // Partial match
  for (const [key, price] of Object.entries(networkPrices)) {
    if (
      network.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(network.toLowerCase())
    ) {
      return price;
    }
  }
  return networkPrices["Default"] ?? 0.35;
}

export function optimizeStops(
  routeCoords: Coordinates[],
  routeDistanceMiles: number,
  stations: ChargerStation[],
  input: TripInput
): ChargingStop[] {
  const { ev, startingSoC, targetArrivalSoC, networkPrices } = input;

  // Assign prices
  const priced = stations.map((s) => ({
    ...s,
    pricePerKwh: getPriceForNetwork(s.network, networkPrices),
  }));

  // Sort stations by route progress
  const withProgress = priced.map((s) => ({
    ...s,
    progress: routeProgress(s.coords, routeCoords),
  }));
  withProgress.sort((a, b) => a.progress - b.progress);

  // Convert SoC to kWh
  const fullBattery = ev.batteryKwh;
  let currentKwh = (startingSoC / 100) * fullBattery;
  let currentProgress = 0;
  const stops: ChargingStop[] = [];

  while (true) {
    // How much range do we have from here?
    const currentRangeMiles = (currentKwh / fullBattery) * ev.rangeMiles * (currentKwh / fullBattery > 0 ? 1 : 0);
    const usableKwh = currentKwh - MIN_SOC * fullBattery;
    const usableRangeMiles = usableKwh * ev.efficiencyMilesPerKwh;
    const remainingRouteMiles = (1 - currentProgress) * routeDistanceMiles;

    // Can we reach destination?
    const kwhNeededForDest =
      remainingRouteMiles / ev.efficiencyMilesPerKwh +
      (targetArrivalSoC / 100) * fullBattery;
    if (currentKwh >= kwhNeededForDest) break; // we're good, no more stops needed

    // Find all reachable stations ahead of us
    const reachable = withProgress.filter(
      (s) =>
        s.progress > currentProgress &&
        s.progress * routeDistanceMiles - currentProgress * routeDistanceMiles <=
          usableRangeMiles
    );

    if (reachable.length === 0) {
      // No reachable stations — trip impossible with current parameters
      break;
    }

    // Score each candidate stop
    // Cost = energy_cost + detour_penalty - "value" of cheap charging now vs later
    // Strategy: find lowest total cost stop, considering:
    //   1. Price at this charger × kWh we need to add
    //   2. Detour penalty
    // We want to "bank" cheap kWh and skip expensive chargers if we can reach a cheaper one

    let bestStop = reachable[0];
    let bestScore = Infinity;

    for (const candidate of reachable) {
      // How much do we charge here? Just enough to reach next cheapest option, or 80%
      const kwhToAdd = Math.min(
        (CHARGE_TO_SOC * fullBattery) - currentKwh,
        fullBattery - currentKwh
      );
      const detourMiles = candidate.distanceFromRouteMiles * 2; // round trip
      const energyCost = kwhToAdd * candidate.pricePerKwh;
      const detourCost = detourMiles * DETOUR_PENALTY_PER_MILE;
      const score = energyCost + detourCost;

      if (score < bestScore) {
        bestScore = score;
        bestStop = candidate;
      }
    }

    // Calculate charge amount: enough to reach destination comfortably or next stop
    const milesFromHere =
      (bestStop.progress - currentProgress) * routeDistanceMiles;
    const kwhToReachStop = milesFromHere / ev.efficiencyMilesPerKwh;
    const arrivalKwh = currentKwh - kwhToReachStop;
    const arrivalSoC = (arrivalKwh / fullBattery) * 100;

    // Charge to 80% or just enough to reach destination
    const kwhForDest =
      ((1 - bestStop.progress) * routeDistanceMiles) / ev.efficiencyMilesPerKwh +
      (targetArrivalSoC / 100) * fullBattery;
    const chargeTarget = Math.min(
      CHARGE_TO_SOC * fullBattery,
      Math.max(kwhForDest, arrivalKwh + 0.1)
    );
    const kwhAdded = Math.max(0, chargeTarget - arrivalKwh);
    const departureSoC = ((arrivalKwh + kwhAdded) / fullBattery) * 100;

    // Charge time: simplified — actual charge rate tapers above 80% but we approximate
    const effectiveChargekW = Math.min(bestStop.maxPowerKw, ev.maxChargekW) * 0.85;
    const chargeTimeMinutes = (kwhAdded / effectiveChargekW) * 60;

    const detourMiles = bestStop.distanceFromRouteMiles * 2;
    const energyCostUsd = kwhAdded * bestStop.pricePerKwh;
    const detourCostUsd = detourMiles * DETOUR_PENALTY_PER_MILE;

    stops.push({
      station: bestStop,
      arrivalSoC: Math.round(arrivalSoC),
      departureSoC: Math.round(departureSoC),
      kwhAdded: Math.round(kwhAdded * 10) / 10,
      energyCostUsd: Math.round(energyCostUsd * 100) / 100,
      chargeTimeMinutes: Math.round(chargeTimeMinutes),
      detourMiles: Math.round(detourMiles * 10) / 10,
      totalCostUsd: Math.round((energyCostUsd + detourCostUsd) * 100) / 100,
    });

    currentKwh = arrivalKwh + kwhAdded;
    currentProgress = bestStop.progress;
  }

  return stops;
}

export async function planTrip(input: TripInput): Promise<TripPlan> {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
  const ocmKey = process.env.NEXT_PUBLIC_OCM_API_KEY;

  const { geometry, distanceMiles, durationMinutes } = await getRoute(
    input.origin.coords,
    input.destination.coords,
    mapboxToken
  );

  const routeCoords: Coordinates[] = (
    geometry.coordinates as [number, number][]
  ).map(([lng, lat]) => ({ lat, lng }));

  const stations = await fetchChargersAlongRoute(routeCoords, ocmKey);

  const stops = optimizeStops(routeCoords, distanceMiles, stations, input);

  return {
    stops,
    totalEnergyCostUsd:
      Math.round(stops.reduce((s, stop) => s + stop.energyCostUsd, 0) * 100) /
      100,
    totalChargeTimeMinutes: stops.reduce(
      (s, stop) => s + stop.chargeTimeMinutes,
      0
    ),
    totalDetourMiles:
      Math.round(
        stops.reduce((s, stop) => s + stop.detourMiles, 0) * 10
      ) / 10,
    routeGeometry: geometry,
    routeDistanceMiles: Math.round(distanceMiles),
    routeDurationMinutes: Math.round(durationMinutes),
  };
}
