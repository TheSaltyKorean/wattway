import { EVModel } from "./types";

// Hyundai / Genesis owner discount at Ionna "Rechargery" fast-charging stations.
//
// Terms (Hyundai Motor America, announced Aug 2026):
//  - A 10% discount on every Ionna session, ongoing/indefinite.
//  - An additional 10% bonus THROUGH Sept 30, 2026 — 20% combined during the
//    bonus window, dropping back to 10% on Oct 1, 2026.
//  - Applies ONLY at Ionna stations, and ONLY when the session is started via
//    Hyundai/Genesis in-app charging or Plug & Charge (MyHyundai with Bluelink /
//    the Genesis app) — a credit-card tap at the stall does NOT get the discount.
//  - Eligible: Hyundai IONIQ 5 (2022+), IONIQ 5 N (2025+), IONIQ 9 (2026+),
//    Kona Electric (2025+); Genesis GV60 (2026+), Electrified GV70 (2026+).
//    IONIQ 6 is NOT on the list. More models are expected to be enabled later.
//
// This is the single source of truth: the planner (lib/optimizer via a fraction
// passed at plan time) and the vehicle content pages both read from here, so a
// number shown on an /ev/ page can't drift from what the planner applies.

/** Ongoing base discount fraction. */
export const IONNA_BASE_DISCOUNT = 0.10;
/** Additional bonus fraction, stacked on the base until the bonus end date. */
export const IONNA_BONUS_DISCOUNT = 0.10;
/**
 * First day the bonus is NO LONGER active — the bonus runs "through Sept 30,
 * 2026", so it applies while the current date is before this Oct 1 boundary.
 * Local time is fine for an estimate; the exact hour of the cutover doesn't
 * change a plan materially.
 */
export const IONNA_BONUS_END = new Date(2026, 9, 1); // 2026-10-01 local (month is 0-indexed)

/** Operator/network name this discount applies to. */
export const IONNA_NETWORK = "Ionna";

/** Last model year covered by a profile's `years` string ("2022-2024" -> 2024). */
function lastModelYear(years: string): number {
  const trailing = years.match(/(\d{4})\s*$/) ?? years.match(/(\d{4})/);
  return trailing ? parseInt(trailing[1], 10) : 0;
}

/**
 * Whether a vehicle profile is eligible for the Ionna discount. Uses the profile's
 * latest covered model year against each model's "and newer" threshold, so a
 * profile whose range reaches the threshold (e.g. a "2024-2025" Kona) is treated
 * as eligible — the opt-in toggle then lets the actual owner confirm they qualify.
 */
export function isIonnaEligible(ev: EVModel): boolean {
  const year = lastModelYear(ev.years);
  if (ev.make === "Hyundai") {
    if (/\bIONIQ 5 N\b/.test(ev.model)) return year >= 2025;
    if (/\bIONIQ 5\b/.test(ev.model)) return year >= 2022;
    if (/\bIONIQ 9\b/.test(ev.model)) return year >= 2026;
    if (/Kona Electric/i.test(ev.model)) return year >= 2025;
    return false; // IONIQ 6, older IONIQ Electric, Gen-1 Kona: not on the list
  }
  if (ev.make === "Genesis") {
    if (/GV60/.test(ev.model)) return year >= 2026;
    if (/Electrified GV70/.test(ev.model)) return year >= 2026;
    return false; // Electrified G80: not on the list
  }
  return false;
}

/** Whether the bonus is still active at `at` (default now). */
export function ionnaBonusActive(at: Date = new Date()): boolean {
  return at.getTime() < IONNA_BONUS_END.getTime();
}

/**
 * The total discount fraction in effect at `at` (default now): 0.20 during the
 * bonus window, 0.10 after it. This is the fraction taken off the Ionna price.
 */
export function ionnaDiscountRate(at: Date = new Date()): number {
  return IONNA_BASE_DISCOUNT + (ionnaBonusActive(at) ? IONNA_BONUS_DISCOUNT : 0);
}

/** Ionna price after the discount fraction is applied. */
export function ionnaDiscountedPrice(basePrice: number, fraction: number): number {
  return Math.max(0, basePrice * (1 - fraction));
}

/**
 * Whether a charger is an Ionna station, from its operator name and/or POI title.
 * OCM often lacks OperatorInfo, so the title is checked too.
 */
export function isIonnaStation(network: string, title = ""): boolean {
  return network === IONNA_NETWORK || `${network} ${title}`.toLowerCase().includes("ionna");
}
