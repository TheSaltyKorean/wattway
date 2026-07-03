import {
  ChargerStation,
  ChargingStop,
  Coordinates,
  TripInput,
  TripPlan,
} from "./types";
import { decodePolyline } from "./googlePolyline";

const GOOGLE_MAPS_BASE = "https://maps.googleapis.com/maps/api";
const OCM_BASE = "https://api.openchargemap.io/v3";
const MIN_SOC = 0.10;
const CHARGE_TO_SOC = 0.80;
const MILES_TO_METERS = 1609.34;
const DETOUR_PENALTY_PER_MILE = 0.15;
const CORRIDOR_MILES = 10;

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

function pointToSegmentDistance(p: Coordinates, a: Coordinates, b: Coordinates): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversine(p, a);
  let t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return haversine(p, { lat: a.lat + t * dy, lng: a.lng + t * dx });
}

function minDistanceToRoute(point: Coordinates, routeCoords: Coordinates[]): number {
  let minDist = Infinity;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const d = pointToSegmentDistance(point, routeCoords[i], routeCoords[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function routeProgress(point: Coordinates, routeCoords: Coordinates[]): number {
  let bestT = 0, minDist = Infinity, totalLen = 0, cumLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const l = haversine(routeCoords[i], routeCoords[i + 1]);
    segLens.push(l);
    totalLen += l;
  }
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const a = routeCoords[i], b = routeCoords[i + 1];
    const dx = b.lng - a.lng, dy = b.lat - a.lat;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const d = haversine(point, { lat: a.lat + t * dy, lng: a.lng + t * dx });
    if (d < minDist) {
      minDist = d;
      bestT = (cumLen + t * segLens[i]) / totalLen;
    }
    cumLen += segLens[i];
  }
  return bestT;
}

// Parse OCM's free-text UsageCost field to get $/kWh
function parseOCMPrice(usageCost: string | null | undefined): number | null {
  if (!usageCost) return null;
  const s = usageCost.toLowerCase().trim();
  if (s === "free" || s === "$0" || s === "0") return 0;
  // Match "$0.43/kWh", "0.43 per kwh", "$0.43 per kw·h", etc.
  const kwhMatch = s.match(/\$?(\d+\.?\d*)\s*(?:per\s*kw[h·]?|\/kw[h·]?)/);
  if (kwhMatch) {
    const v = parseFloat(kwhMatch[1]);
    if (v >= 0 && v < 5) return v;
  }
  // Fallback: first dollar-like decimal in a reasonable range
  const numMatch = s.match(/\$(\d+\.\d+)/);
  if (numMatch) {
    const v = parseFloat(numMatch[1]);
    if (v > 0 && v < 5) return v;
  }
  return null;
}

export async function getRoute(
  origin: Coordinates,
  destination: Coordinates,
  googleKey: string
): Promise<{ geometry: GeoJSON.LineString; distanceMiles: number; durationMinutes: number }> {
  const url = `${GOOGLE_MAPS_BASE}/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${googleKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Google Directions API error");
  const data = await res.json();
  if (data.status !== "OK") throw new Error(`Directions: ${data.status} — ${data.error_message ?? ""}`);
  const route = data.routes[0];
  const leg = route.legs[0];

  // Decode the overview polyline
  const decoded = decodePolyline(route.overview_polyline.points);
  const geometry: GeoJSON.LineString = {
    type: "LineString",
    coordinates: decoded.map(([lat, lng]) => [lng, lat]),
  };

  return {
    geometry,
    distanceMiles: leg.distance.value / MILES_TO_METERS,
    durationMinutes: leg.duration.value / 60,
  };
}

export async function fetchChargersAlongRoute(
  routeCoords: Coordinates[],
  networkPrices: Record<string, number>,
  ocmApiKey?: string
): Promise<ChargerStation[]> {
  const lats = routeCoords.map((c) => c.lat);
  const lngs = routeCoords.map((c) => c.lng);
  const bufferDeg = CORRIDOR_MILES / 69;
  const minLat = Math.min(...lats) - bufferDeg;
  const maxLat = Math.max(...lats) + bufferDeg;
  const minLng = Math.min(...lngs) - bufferDeg;
  const maxLng = Math.max(...lngs) + bufferDeg;

  const params = new URLSearchParams({
    output: "json",
    levelid: "3",
    maxresults: "300",
    compact: "true",
    verbose: "false",
    latitude: String((minLat + maxLat) / 2),
    longitude: String((minLng + maxLng) / 2),
    distance: "400",
    distanceunit: "Miles",
    boundingbox: `(${minLat},${minLng}),(${maxLat},${maxLng})`,
    includecomments: "false",
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

    const network: string = poi.OperatorInfo?.Title ?? "Default";

    let maxPower = 0;
    const connectorTypes: string[] = [];
    if (poi.Connections) {
      for (const conn of poi.Connections) {
        if (conn.PowerKW && conn.PowerKW > maxPower) maxPower = conn.PowerKW;
        if (conn.ConnectionType?.Title) connectorTypes.push(conn.ConnectionType.Title);
      }
    }
    if (maxPower < 50) continue;

    // Use OCM's published UsageCost first, fall back to network defaults
    const publishedPrice = parseOCMPrice(poi.UsageCost ?? poi.AddressInfo?.UsageCost);
    const fallbackPrice = (() => {
      if (networkPrices[network] !== undefined) return networkPrices[network];
      for (const [key, price] of Object.entries(networkPrices)) {
        if (network.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(network.toLowerCase())) return price;
      }
      return networkPrices["Default"] ?? 0.35;
    })();

    stations.push({
      id: String(poi.ID),
      name: poi.AddressInfo.Title,
      network,
      coords,
      address: [poi.AddressInfo.AddressLine1, poi.AddressInfo.Town, poi.AddressInfo.StateOrProvince].filter(Boolean).join(", "),
      maxPowerKw: maxPower,
      pricePerKwh: publishedPrice ?? fallbackPrice,
      connectorTypes: [...new Set(connectorTypes)],
      distanceFromRouteMiles: distFromRoute,
      priceIsPublished: publishedPrice !== null,
    });
  }
  return stations;
}

export function optimizeStops(
  routeCoords: Coordinates[],
  routeDistanceMiles: number,
  stations: ChargerStation[],
  input: TripInput
): ChargingStop[] {
  const { ev, startingSoC, targetArrivalSoC } = input;
  const fullBattery = ev.batteryKwh;

  const withProgress = stations
    .map((s) => ({ ...s, progress: routeProgress(s.coords, routeCoords) }))
    .sort((a, b) => a.progress - b.progress);

  let currentKwh = (startingSoC / 100) * fullBattery;
  let currentProgress = 0;
  const stops: ChargingStop[] = [];

  while (true) {
    const usableKwh = currentKwh - MIN_SOC * fullBattery;
    const usableRangeMiles = usableKwh * ev.efficiencyMilesPerKwh;
    const remainingRouteMiles = (1 - currentProgress) * routeDistanceMiles;
    const kwhNeededForDest = remainingRouteMiles / ev.efficiencyMilesPerKwh + (targetArrivalSoC / 100) * fullBattery;

    if (currentKwh >= kwhNeededForDest) break;

    const reachable = withProgress.filter(
      (s) =>
        s.progress > currentProgress &&
        (s.progress - currentProgress) * routeDistanceMiles <= usableRangeMiles
    );

    if (reachable.length === 0) break;

    let bestStop = reachable[0];
    let bestScore = Infinity;
    for (const candidate of reachable) {
      const kwhToAdd = Math.min(CHARGE_TO_SOC * fullBattery - currentKwh, fullBattery - currentKwh);
      const detourMiles = candidate.distanceFromRouteMiles * 2;
      const score = kwhToAdd * candidate.pricePerKwh + detourMiles * DETOUR_PENALTY_PER_MILE;
      if (score < bestScore) { bestScore = score; bestStop = candidate; }
    }

    const milesFromHere = (bestStop.progress - currentProgress) * routeDistanceMiles;
    const arrivalKwh = currentKwh - milesFromHere / ev.efficiencyMilesPerKwh;
    const arrivalSoC = (arrivalKwh / fullBattery) * 100;

    const kwhForDest = ((1 - bestStop.progress) * routeDistanceMiles) / ev.efficiencyMilesPerKwh + (targetArrivalSoC / 100) * fullBattery;
    const chargeTarget = Math.min(CHARGE_TO_SOC * fullBattery, Math.max(kwhForDest, arrivalKwh + 0.1));
    const kwhAdded = Math.max(0, chargeTarget - arrivalKwh);
    const departureSoC = ((arrivalKwh + kwhAdded) / fullBattery) * 100;
    const effectiveChargekW = Math.min(bestStop.maxPowerKw, ev.maxChargekW) * 0.85;
    const chargeTimeMinutes = (kwhAdded / effectiveChargekW) * 60;
    const detourMiles = bestStop.distanceFromRouteMiles * 2;

    stops.push({
      station: bestStop,
      arrivalSoC: Math.round(arrivalSoC),
      departureSoC: Math.round(departureSoC),
      kwhAdded: Math.round(kwhAdded * 10) / 10,
      energyCostUsd: Math.round(kwhAdded * bestStop.pricePerKwh * 100) / 100,
      chargeTimeMinutes: Math.round(chargeTimeMinutes),
      detourMiles: Math.round(detourMiles * 10) / 10,
      totalCostUsd: Math.round((kwhAdded * bestStop.pricePerKwh + detourMiles * DETOUR_PENALTY_PER_MILE) * 100) / 100,
    });

    currentKwh = arrivalKwh + kwhAdded;
    currentProgress = bestStop.progress;
  }

  return stops;
}

export async function planTrip(input: TripInput): Promise<TripPlan> {
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!;
  const ocmKey = process.env.NEXT_PUBLIC_OCM_API_KEY;

  const { geometry, distanceMiles, durationMinutes } = await getRoute(
    input.origin.coords,
    input.destination.coords,
    googleKey
  );

  const routeCoords: Coordinates[] = (geometry.coordinates as [number, number][]).map(
    ([lng, lat]) => ({ lat, lng })
  );

  const stations = await fetchChargersAlongRoute(routeCoords, input.networkPrices, ocmKey);
  const stops = optimizeStops(routeCoords, distanceMiles, stations, input);

  return {
    stops,
    totalEnergyCostUsd: Math.round(stops.reduce((s, stop) => s + stop.energyCostUsd, 0) * 100) / 100,
    totalChargeTimeMinutes: stops.reduce((s, stop) => s + stop.chargeTimeMinutes, 0),
    totalDetourMiles: Math.round(stops.reduce((s, stop) => s + stop.detourMiles, 0) * 10) / 10,
    routeGeometry: geometry,
    routeDistanceMiles: Math.round(distanceMiles),
    routeDurationMinutes: Math.round(durationMinutes),
  };
}
