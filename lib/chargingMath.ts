import { EVModel } from "./types";

// Single source of truth for the charging model. The optimizer (which powers the
// live planner) and the static content pages both import from here, so a number
// printed on an /ev/... page can never drift from what the planner would compute
// for the same car.

/** Floor the planner never charges below — the reserve it keeps in the pack. */
export const MIN_SOC = 0.10;
/** Normal DC fast-charge ceiling. Above this the curve tapers hard. */
export const CHARGE_TO_SOC = 0.80;
/**
 * Average delivered power below 80% as a fraction of the nameplate peak. No car
 * holds its peak rate across the whole window — it ramps up, holds, then tapers.
 */
export const CHARGE_TAPER_FACTOR = 0.85;
/** Average power above 80% as a fraction of the below-80% rate. */
export const ABOVE_80_TAPER_FACTOR = 0.4;
/**
 * Of the stretch the car can still reach, only stations past this fraction of it
 * are scored — the planner deliberately pushes each stop as far down the route as
 * it safely can, to minimize the number of stops. Shared with the content pages
 * so they describe the real candidate filter rather than "every reachable
 * charger", which would overstate what the planner considers.
 */
export const CANDIDATE_WINDOW = 0.55;

/** kWh moved in a standard 10% -> 80% DC fast-charge session. */
export function fastChargeKwh(ev: EVModel): number {
  return (CHARGE_TO_SOC - MIN_SOC) * ev.batteryKwh;
}

/**
 * Minutes for a 10% -> 80% DC fast charge. `stationKw` caps the car's own
 * maximum, mirroring the planner: a 350 kW stall can't push a 150 kW car faster,
 * and a 50 kW stall throttles everything.
 */
export function fastChargeMinutes(ev: EVModel, stationKw = ev.maxChargekW): number {
  const effectiveKw = Math.min(stationKw, ev.maxChargekW) * CHARGE_TAPER_FACTOR;
  if (effectiveKw <= 0) return 0;
  return (fastChargeKwh(ev) / effectiveKw) * 60;
}

/** Miles added by a 10% -> 80% session, at the car's EPA efficiency. */
export function fastChargeMiles(ev: EVModel): number {
  return fastChargeKwh(ev) * ev.efficiencyMilesPerKwh;
}

/** Cost of one 10% -> 80% session at a given $/kWh. */
export function fastChargeCost(ev: EVModel, pricePerKwh: number): number {
  return fastChargeKwh(ev) * pricePerKwh;
}

/** Energy cost to drive `miles`, pricing every kWh at the same rate. */
export function energyCostForMiles(ev: EVModel, miles: number, pricePerKwh: number): number {
  if (ev.efficiencyMilesPerKwh <= 0) return 0;
  return (miles / ev.efficiencyMilesPerKwh) * pricePerKwh;
}

/** Energy cost to drive 100 miles at a given $/kWh. */
export function costPer100Miles(ev: EVModel, pricePerKwh: number): number {
  return energyCostForMiles(ev, 100, pricePerKwh);
}

/**
 * How many DC fast-charge stops a trip of `tripMiles` needs, starting at 80%
 * and arriving at the 10% floor.
 *
 * Each stop restores the 10% -> 80% window, so it buys `fastChargeMiles(ev)` of
 * driving. The car leaves home with the same usable window (80% -> 10%), so the
 * first leg is free of charge stops; every leg after that has to be bought.
 */
export function stopsForTrip(ev: EVModel, tripMiles: number): number {
  const legMiles = fastChargeMiles(ev);
  if (legMiles <= 0) return 0;
  return Math.max(0, Math.ceil(tripMiles / legMiles) - 1);
}

/**
 * Cost of the energy bought *at chargers on the way* for a trip of `tripMiles`.
 *
 * This is deliberately not the total energy cost of the trip: the first leg
 * comes out of the battery you left home with, which was paid for at a
 * residential rate, not a DC fast-charging one. So a trip shorter than one
 * charge returns 0 — correct for "what the road costs you", and the reason
 * every caller must label it as en-route charging rather than trip energy.
 *
 * Use `tripEnergyCost` when the home charge should be priced in too.
 */
export function enRouteEnergyCost(ev: EVModel, tripMiles: number, pricePerKwh: number): number {
  const legMiles = fastChargeMiles(ev);
  if (legMiles <= 0 || ev.efficiencyMilesPerKwh <= 0) return 0;
  const purchasedMiles = Math.max(0, tripMiles - legMiles);
  return (purchasedMiles / ev.efficiencyMilesPerKwh) * pricePerKwh;
}

/**
 * Total energy cost for a trip of `tripMiles`, counting both the charge you
 * left home with (at `homePricePerKwh`) and everything bought en route (at
 * `pricePerKwh`).
 */
export function tripEnergyCost(
  ev: EVModel,
  tripMiles: number,
  pricePerKwh: number,
  homePricePerKwh: number
): number {
  if (ev.efficiencyMilesPerKwh <= 0) return 0;
  const legMiles = fastChargeMiles(ev);
  const homeMiles = Math.min(tripMiles, Math.max(0, legMiles));
  return (
    (homeMiles / ev.efficiencyMilesPerKwh) * homePricePerKwh +
    enRouteEnergyCost(ev, tripMiles, pricePerKwh)
  );
}

/**
 * Best-case minutes spent charging on a trip of `tripMiles`.
 *
 * Derived from the energy actually bought en route rather than
 * `stops x full-session time`: the last stop is almost always a partial top-up,
 * so multiplying by whole sessions materially overstates the total. A car that
 * needs 14 more miles buys about a minute of charging, not a full 10-80% window.
 */
export function enRouteChargeMinutes(
  ev: EVModel,
  tripMiles: number,
  stationKw = ev.maxChargekW
): number {
  const effectiveKw = Math.min(stationKw, ev.maxChargekW) * CHARGE_TAPER_FACTOR;
  if (effectiveKw <= 0 || ev.efficiencyMilesPerKwh <= 0) return 0;
  const purchasedMiles = Math.max(0, tripMiles - fastChargeMiles(ev));
  return ((purchasedMiles / ev.efficiencyMilesPerKwh) / effectiveKw) * 60;
}
