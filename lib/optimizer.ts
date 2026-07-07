import {
  ChargerStation,
  ChargingStop,
  Coordinates,
  MembershipPlan,
  TripInput,
  TripPlan,
} from "./types";
import { decodePolyline } from "./googlePolyline";
import type { LineString } from "geojson";

const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
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

// A route with via stops can pass the same charger more than once (out-and-back
// legs, loops). Return one progress value per distinct pass within the corridor,
// so later passes stay eligible after the plan advances beyond the first one.
const PASS_SEPARATION_MILES = 25;

function routePasses(
  point: Coordinates,
  routeCoords: Coordinates[],
  corridorMiles: number
): { progress: number; dist: number }[] {
  const segLens: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const l = haversine(routeCoords[i], routeCoords[i + 1]);
    segLens.push(l);
    totalLen += l;
  }
  if (totalLen === 0) return [{ progress: 0, dist: 0 }];

  const cands: { progress: number; dist: number }[] = [];
  let cumLen = 0;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const a = routeCoords[i], b = routeCoords[i + 1];
    const dx = b.lng - a.lng, dy = b.lat - a.lat;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const d = haversine(point, { lat: a.lat + t * dy, lng: a.lng + t * dx });
    if (d <= corridorMiles) cands.push({ progress: (cumLen + t * segLens[i]) / totalLen, dist: d });
    cumLen += segLens[i];
  }
  if (cands.length === 0) return [];

  cands.sort((x, y) => x.progress - y.progress);
  const passes: { progress: number; dist: number }[] = [];
  let best = cands[0];
  let lastProgress = cands[0].progress;
  for (const c of cands.slice(1)) {
    if ((c.progress - lastProgress) * totalLen > PASS_SEPARATION_MILES) {
      passes.push(best);
      best = c;
    } else if (c.dist < best.dist) {
      best = c;
    }
    lastProgress = c.progress;
  }
  passes.push(best);
  return passes;
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
  waypoints: Coordinates[],
  googleKey: string,
  modifiers?: { avoidFerries?: boolean; avoidTolls?: boolean }
): Promise<{ geometry: LineString; distanceMiles: number; durationMinutes: number }> {
  const res = await fetch(`${ROUTES_API_URL}?key=${googleKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      intermediates: waypoints.map((w) => ({ location: { latLng: { latitude: w.lat, longitude: w.lng } } })),
      travelMode: "DRIVE",
      polylineQuality: "OVERVIEW",
      // Route modifiers are Google *preferences*, not hard constraints — a route
      // may still include a ferry/toll when no reasonable alternative exists
      // (e.g. an island destination). Good enough for the common case (a land
      // detour exists, as with Grand Rapids -> Wisconsin Dells); a "this route
      // still needs a ferry" warning is on the roadmap.
      routeModifiers: {
        avoidFerries: !!modifiers?.avoidFerries,
        avoidTolls: !!modifiers?.avoidTolls,
      },
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Routes API: ${data?.error?.message ?? `HTTP ${res.status}`}`);
  const route = data?.routes?.[0];
  if (!route) throw new Error("Routes API returned no route");

  // Decode the overview polyline
  const decoded = decodePolyline(route.polyline.encodedPolyline);
  const geometry: LineString = {
    type: "LineString",
    coordinates: decoded.map(([lat, lng]) => [lng, lat]),
  };

  return {
    geometry,
    distanceMiles: route.distanceMeters / MILES_TO_METERS,
    durationMinutes: parseInt(route.duration, 10) / 60, // duration is e.g. "5324s"
  };
}

// Long routes are queried in overlapping segments — a single query centered on
// the route midpoint hits OCM's result cap and starves the route's endpoints.
const SEGMENT_MILES = 120;
const SEGMENT_PARALLELISM = 4;

export async function fetchChargersAlongRoute(
  routeCoords: Coordinates[],
  networkPrices: Record<string, number>,
  memberships: MembershipPlan[],
  ocmApiKey?: string
): Promise<ChargerStation[]> {
  // Split the route into segments of at most SEGMENT_MILES (interpolating cut
  // points — vertex snapping can leave gaps), then query each segment's
  // corridor bounding box. Boxes hug the corridor, so dense metro areas don't
  // blow past the per-request result cap the way big radius queries do; if a
  // segment still hits the cap, it is subdivided and re-queried.
  const segments: Coordinates[][] = [];
  let current: Coordinates[] = [routeCoords[0]];
  let sinceLast = 0;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    let a = routeCoords[i];
    const b = routeCoords[i + 1];
    let segLen = haversine(a, b);
    while (segLen > 0 && sinceLast + segLen >= SEGMENT_MILES) {
      const t = (SEGMENT_MILES - sinceLast) / segLen;
      a = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
      current.push(a);
      segments.push(current);
      current = [a]; // cut point belongs to both segments — no gaps
      segLen = haversine(a, b);
      sinceLast = 0;
    }
    sinceLast += segLen;
    current.push(b);
  }
  if (current.length > 1) segments.push(current);
  if (segments.length === 0) segments.push(routeCoords);

  const OCM_CAP = 1000;
  const fetchSegment = async (coords: Coordinates[], depth: number): Promise<any[]> => {
    const lats = coords.map((c) => c.lat);
    const lngs = coords.map((c) => c.lng);
    const buf = (CORRIDOR_MILES + 2) / 69;
    const params = new URLSearchParams({
      output: "json",
      levelid: "3",
      maxresults: String(OCM_CAP),
      compact: "false",
      verbose: "false",
      boundingbox: `(${Math.min(...lats) - buf},${Math.min(...lngs) - buf}),(${Math.max(...lats) + buf},${Math.max(...lngs) + buf})`,
      includecomments: "false",
    });
    if (ocmApiKey) params.set("key", ocmApiKey);
    const res = await fetch(`${OCM_BASE}/poi/?${params}`);
    if (!res.ok) throw new Error("Open Charge Map API error");
    const list: any[] = await res.json();
    // Cap hit → the box was too dense; halve the segment and recurse.
    // Two-point segments get an interpolated midpoint so they can still split.
    if (list.length >= OCM_CAP && depth < 3) {
      const pts = coords.length >= 3 ? coords : [
        coords[0],
        { lat: (coords[0].lat + coords[1].lat) / 2, lng: (coords[0].lng + coords[1].lng) / 2 },
        coords[1],
      ];
      const mid = Math.floor(pts.length / 2);
      const [a, b] = await Promise.all([
        fetchSegment(pts.slice(0, mid + 1), depth + 1),
        fetchSegment(pts.slice(mid), depth + 1),
      ]);
      return [...a, ...b];
    }
    return list;
  };

  const seen = new Set<number>();
  const data: any[] = [];
  for (let i = 0; i < segments.length; i += SEGMENT_PARALLELISM) {
    const batch = await Promise.all(
      segments.slice(i, i + SEGMENT_PARALLELISM).map((s) => fetchSegment(s, 0))
    );
    for (const list of batch) {
      for (const poi of list) {
        if (!seen.has(poi.ID)) {
          seen.add(poi.ID);
          data.push(poi);
        }
      }
    }
  }

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
    let fastPortCount = 0;
    const connectorTypes: string[] = [];
    if (poi.Connections) {
      for (const conn of poi.Connections) {
        if (conn.PowerKW && conn.PowerKW > maxPower) maxPower = conn.PowerKW;
        if (conn.PowerKW && conn.PowerKW >= 50) fastPortCount += conn.Quantity ?? 1;
        if (conn.ConnectionType?.Title) connectorTypes.push(conn.ConnectionType.Title);
      }
    }
    if (maxPower < 50) continue;

    // Use OCM's published UsageCost first, fall back to network defaults.
    // OCM often lacks OperatorInfo, so match against the station name too.
    const haystack = `${network} ${poi.AddressInfo.Title ?? ""}`.toLowerCase();
    const publishedPrice = parseOCMPrice(poi.UsageCost ?? poi.AddressInfo?.UsageCost);
    const fallbackPrice = (() => {
      if (networkPrices[network] !== undefined && network !== "Default") return networkPrices[network];
      for (const [key, price] of Object.entries(networkPrices)) {
        if (key === "Default") continue;
        if (haystack.includes(key.toLowerCase())) return price;
      }
      if (haystack.includes("supercharger")) return networkPrices["Tesla"] ?? 0.40;
      return networkPrices["Default"] ?? 0.45;
    })();

    // Apply member pricing for subscribed networks
    let effectivePrice = publishedPrice ?? fallbackPrice;
    for (const plan of memberships) {
      if (haystack.includes(plan.networkKey.toLowerCase()) ||
          (plan.networkKey === "Tesla" && haystack.includes("supercharger"))) {
        effectivePrice = Math.max(0, effectivePrice - plan.discountPerKwh);
        break;
      }
    }

    stations.push({
      id: String(poi.ID),
      name: poi.AddressInfo.Title,
      network,
      coords,
      address: [poi.AddressInfo.AddressLine1, poi.AddressInfo.Town, poi.AddressInfo.StateOrProvince].filter(Boolean).join(", "),
      maxPowerKw: maxPower,
      fastPortCount,
      recentlyVerified: poi.IsRecentlyVerified === true,
      operatorUrl: poi.OperatorInfo?.WebsiteURL ?? null,
      stationUrl: poi.AddressInfo?.RelatedURL || null,
      pricePerKwh: effectivePrice,
      connectorTypes: [...new Set(connectorTypes)],
      distanceFromRouteMiles: distFromRoute,
      priceIsPublished: publishedPrice !== null,
    });
  }
  return stations;
}

const CANDIDATE_WINDOW = 0.55; // only consider stations in the far 45% of current reach
const COMFORT_ARRIVAL_SOC = 0.15;
const SLOW_CHARGER_PENALTY = 0.10; // $/kWh-equivalent penalty for <150 kW stations
const LOW_ARRIVAL_PENALTY = 0.15; // $/kWh-equivalent penalty for arriving under 15%
const ARRIVAL_PAD_SOC = 0.03;
const MAX_CHARGE_SOC = 0.95;
// Runaway-loop protection only — real infeasibility is detected by
// exhausting reachable stations. Low-range EVs on multi-thousand-mile
// trips can legitimately need 15+ stops.
const MAX_STOPS = 50;

export function optimizeStops(
  routeCoords: Coordinates[],
  routeDistanceMiles: number,
  stations: ChargerStation[],
  input: TripInput
): { stops: ChargingStop[]; arrivalSoC: number; finalLegMiles: number; planIncomplete: boolean } {
  const { ev, startingSoC, targetArrivalSoC } = input;
  const fullBattery = ev.batteryKwh;

  // Tesla-operated sites are unusable by other makes unless OCM explicitly
  // marks them open ("Tesla (including non-tesla)"). Plain "Tesla" operators
  // are assumed Tesla-only. Stations merely *named* "...Supercharger" under a
  // non-Tesla operator (e.g. Buc-ee's hosts) are left in. This already lets a
  // non-Tesla (incl. NACS) EV use OPEN Supercharger sites while excluding
  // Tesla-only ones — so no separate NACS handling is needed here.
  const usable = ev.make === "Tesla"
    ? stations
    : stations.filter((s) => {
        const n = s.network.toLowerCase();
        return !(n.includes("tesla") && !n.includes("non-tesla"));
      });

  // Each pass carries its own detour distance — a charger can be on-route
  // outbound but miles off-route on the return leg
  const withProgress = usable
    .flatMap((s) =>
      routePasses(s.coords, routeCoords, CORRIDOR_MILES).map((p) => ({
        ...s,
        progress: p.progress,
        distanceFromRouteMiles: p.dist,
      }))
    )
    .sort((a, b) => a.progress - b.progress);

  let currentKwh = (startingSoC / 100) * fullBattery;
  let currentProgress = 0;
  const stops: ChargingStop[] = [];

  // Greedy fewest-stops strategy: drive as far as comfortably possible, then
  // pick the best charger near the edge of range and charge only as much as needed.
  for (let iter = 0; iter < MAX_STOPS; iter++) {
    const remainingRouteMiles = (1 - currentProgress) * routeDistanceMiles;
    const kwhNeededForDest = remainingRouteMiles / ev.efficiencyMilesPerKwh + (targetArrivalSoC / 100) * fullBattery;

    if (currentKwh >= kwhNeededForDest) break;

    const usableKwh = currentKwh - MIN_SOC * fullBattery;
    const usableRangeMiles = Math.max(0, usableKwh) * ev.efficiencyMilesPerKwh;

    const reachable = withProgress.filter(
      (s) =>
        s.progress > currentProgress &&
        (s.progress - currentProgress) * routeDistanceMiles + s.distanceFromRouteMiles <= usableRangeMiles
    );

    if (reachable.length === 0) break;

    // Prefer stations deep into the reachable stretch so we stop as few times as possible
    const maxReach = Math.max(...reachable.map((s) => s.progress));
    const windowStart = currentProgress + (maxReach - currentProgress) * CANDIDATE_WINDOW;
    let candidates = reachable.filter((s) => s.progress >= windowStart);
    if (candidates.length === 0) candidates = reachable;

    let bestStop = candidates[0];
    let bestScore = Infinity;
    for (const candidate of candidates) {
      const milesTo = (candidate.progress - currentProgress) * routeDistanceMiles + candidate.distanceFromRouteMiles;
      const arrivalFrac = (currentKwh - milesTo / ev.efficiencyMilesPerKwh) / fullBattery;
      const effectiveKw = Math.min(candidate.maxPowerKw, ev.maxChargekW);
      let score = candidate.pricePerKwh + candidate.distanceFromRouteMiles * 2 * 0.02;
      // OCM power claims are optimistic — rural "50 kW" units often deliver less.
      if (effectiveKw < 100) score += SLOW_CHARGER_PENALTY * 2;
      else if (effectiveKw < 150) score += SLOW_CHARGER_PENALTY;
      if (candidate.fastPortCount < 2) score += 0.08; // single plug = queue/outage risk
      // Small nudge only — "not recently verified" on OCM often just means nobody
      // checked in lately (real networks like IONNA show up unverified), so this
      // must not cancel a genuine price advantage (e.g. a $0.05/kWh-cheaper site).
      if (!candidate.recentlyVerified) score += 0.02;
      // Supercharger records with no operator data may be Tesla-only; for
      // non-Tesla EVs deprioritize heavily rather than exclude, since many
      // are NACS-open sites with incomplete community data
      if (ev.make !== "Tesla" && candidate.network === "Default" && /supercharger/i.test(candidate.name)) {
        score += 0.20;
      }
      if (arrivalFrac < COMFORT_ARRIVAL_SOC) score += LOW_ARRIVAL_PENALTY;
      score -= candidate.progress * 0.05; // all else equal, farther along wins
      if (score < bestScore) { bestScore = score; bestStop = candidate; }
    }

    const milesFromHere = (bestStop.progress - currentProgress) * routeDistanceMiles + bestStop.distanceFromRouteMiles;
    const arrivalKwh = currentKwh - milesFromHere / ev.efficiencyMilesPerKwh;
    const arrivalSoC = (arrivalKwh / fullBattery) * 100;

    // Charge just enough to finish the trip (plus a small pad). Normally cap at
    // 80% (charging tapers hard above), but if going a bit past 80% at this stop
    // finishes the trip, do that instead of adding another stop.
    // Includes the return leg from an off-route station back to the route.
    const kwhForDest =
      ((1 - bestStop.progress) * routeDistanceMiles + bestStop.distanceFromRouteMiles) /
        ev.efficiencyMilesPerKwh +
      ((targetArrivalSoC / 100) + ARRIVAL_PAD_SOC) * fullBattery;
    // Mid-trip we normally charge to 80% (fast-charging tapers hard above that),
    // but if the next charger downstream is farther than an 80% charge can reach
    // — a rural "charging desert" — charge enough to bridge that gap (up to the
    // 95% cap) instead of stranding the plan with no reachable next stop. This is
    // what let long routes (e.g. Seattle -> Key West) give up after a few stops.
    const nextAhead = withProgress.find((s) => s.progress > bestStop.progress);
    let midChargeKwh = CHARGE_TO_SOC * fullBattery;
    if (nextAhead) {
      const gapMiles =
        (nextAhead.progress - bestStop.progress) * routeDistanceMiles +
        nextAhead.distanceFromRouteMiles;
      const kwhToReachNext =
        gapMiles / ev.efficiencyMilesPerKwh + (MIN_SOC + ARRIVAL_PAD_SOC) * fullBattery;
      midChargeKwh = Math.min(
        MAX_CHARGE_SOC * fullBattery,
        Math.max(CHARGE_TO_SOC * fullBattery, kwhToReachNext)
      );
    }
    const chargeTarget =
      kwhForDest <= MAX_CHARGE_SOC * fullBattery ? kwhForDest : midChargeKwh;
    const kwhAdded = Math.max(0, chargeTarget - arrivalKwh);

    // Tiny/zero charge here usually means we arrived still near the 80% cap
    // (e.g. high starting charge). Coast forward past this station and keep
    // planning instead of abandoning the trip; only give up when no charge
    // is possible at a low battery (genuine dead end).
    const finishesTrip = kwhForDest <= MAX_CHARGE_SOC * fullBattery;
    if (kwhAdded <= (finishesTrip ? 0.1 : 3)) {
      if (arrivalKwh > CHARGE_TO_SOC * fullBattery - 3) {
        // Coasting past: we never leave the route, so spend only the
        // on-route miles (no detour to a station we don't visit)
        const onRouteMiles = (bestStop.progress - currentProgress) * routeDistanceMiles;
        currentKwh -= onRouteMiles / ev.efficiencyMilesPerKwh;
        currentProgress = bestStop.progress;
        continue;
      }
      break;
    }

    const departureSoC = ((arrivalKwh + kwhAdded) / fullBattery) * 100;
    const effectiveChargekW = Math.min(bestStop.maxPowerKw, ev.maxChargekW) * 0.85;
    // Charging above 80% is much slower due to taper
    const kwhBelow80 = Math.max(0, Math.min(chargeTarget, CHARGE_TO_SOC * fullBattery) - arrivalKwh);
    const kwhAbove80 = kwhAdded - kwhBelow80;
    const chargeTimeMinutes = ((kwhBelow80 / effectiveChargekW) + (kwhAbove80 / (effectiveChargekW * 0.4))) * 60;
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
      legDistanceMiles: Math.round((bestStop.progress - currentProgress) * routeDistanceMiles),
    });

    // Departure charge minus the drive back from the station to the route
    currentKwh = arrivalKwh + kwhAdded - bestStop.distanceFromRouteMiles / ev.efficiencyMilesPerKwh;
    currentProgress = bestStop.progress;
  }

  const finalRemainingMiles = (1 - currentProgress) * routeDistanceMiles;
  const finalKwh = currentKwh - finalRemainingMiles / ev.efficiencyMilesPerKwh;
  const arrivalSoC = Math.round(Math.max(0, (finalKwh / fullBattery) * 100));
  // Flag plans that end below the requested arrival SoC (charger gaps or the
  // stop cap) instead of presenting them as complete.
  const planIncomplete = finalKwh < ((targetArrivalSoC / 100) - 0.01) * fullBattery;

  return { stops, arrivalSoC, finalLegMiles: Math.round(finalRemainingMiles), planIncomplete };
}

export async function planTrip(input: TripInput): Promise<TripPlan> {
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!;
  const ocmKey = process.env.NEXT_PUBLIC_OCM_API_KEY;

  const { geometry, distanceMiles, durationMinutes } = await getRoute(
    input.origin.coords,
    input.destination.coords,
    (input.waypoints ?? []).map((w) => w.coords),
    googleKey,
    { avoidFerries: input.avoidFerries, avoidTolls: input.avoidTolls }
  );

  const routeCoords: Coordinates[] = (geometry.coordinates as [number, number][]).map(
    ([lng, lat]) => ({ lat, lng })
  );

  const stations = await fetchChargersAlongRoute(routeCoords, input.networkPrices, input.memberships ?? [], ocmKey);
  const { stops, arrivalSoC, finalLegMiles, planIncomplete } = optimizeStops(routeCoords, distanceMiles, stations, input);

  return {
    stops,
    arrivalSoC,
    finalLegMiles,
    planIncomplete,
    totalEnergyCostUsd: Math.round(stops.reduce((s, stop) => s + stop.energyCostUsd, 0) * 100) / 100,
    totalChargeTimeMinutes: stops.reduce((s, stop) => s + stop.chargeTimeMinutes, 0),
    totalDetourMiles: Math.round(stops.reduce((s, stop) => s + stop.detourMiles, 0) * 10) / 10,
    routeGeometry: geometry,
    routeDistanceMiles: Math.round(distanceMiles),
    routeDurationMinutes: Math.round(durationMinutes),
  };
}
