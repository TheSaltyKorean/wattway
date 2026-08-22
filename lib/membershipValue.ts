import { ChargingStop, MembershipPlan, TripPlan } from "./types";
import { MEMBERSHIP_PLANS, membershipCoversStation } from "./memberships";

/**
 * What each charging membership is worth on ONE planned trip.
 *
 * The vehicle pages already answer the generic question ("N sessions a month to
 * break even"), which requires the reader to guess how much they charge. This
 * answers the concrete one: for the route on screen, this plan would have taken
 * $X off, and it costs $Y a month. That is the number people actually decide on.
 */
export interface MembershipValue {
  plan: MembershipPlan;
  /** Energy this trip puts through stations the plan covers. */
  kwhOnNetwork: number;
  /** Number of this trip's stops the plan covers. */
  stopCount: number;
  /** Discount this trip is worth on that network. */
  tripSavingsUsd: number;
  /** tripSavingsUsd − monthlyFeeUsd. Positive means one trip pays for the month. */
  netUsd: number;
  /** True when the plan was already applied to the prices shown. */
  active: boolean;
}

/**
 * Rank memberships by what they're worth on `plan`.
 *
 * `activeIds` are the plans already selected, whose discounts are therefore
 * ALREADY in the plan's prices. Both cases are returned, because they answer
 * different questions and the honest UI shows both: an active plan needs
 * "is it still earning its fee?", an inactive one needs "would it start?".
 *
 * The savings figure is deliberately conservative for an inactive plan. It
 * prices the discount against THESE stops, but a member's optimizer run can
 * also pick different, better stops once that network gets cheaper — so real
 * savings can exceed this. Never present it as an upper bound.
 *
 * Returned sorted by netUsd descending, so the caller can take the first entry
 * as the recommendation.
 */
export function membershipValues(
  trip: TripPlan,
  activeIds: string[] = []
): MembershipValue[] {
  const active = new Set(activeIds);

  return MEMBERSHIP_PLANS.map((plan) => {
    const covered = trip.stops.filter((stop: ChargingStop) =>
      membershipCoversStation(plan, stop.station.network, stop.station.name)
    );
    const kwhOnNetwork = covered.reduce((sum, stop) => sum + stop.kwhAdded, 0);
    const tripSavingsUsd = kwhOnNetwork * plan.discountPerKwh;

    return {
      plan,
      kwhOnNetwork,
      stopCount: covered.length,
      tripSavingsUsd,
      netUsd: tripSavingsUsd - plan.monthlyFeeUsd,
      active: active.has(plan.id),
    };
  })
    .filter((value) => value.stopCount > 0) // a plan this route never uses is noise
    .sort((a, b) => b.netUsd - a.netUsd);
}

/**
 * The one plan worth recommending, or null.
 *
 * Only ever an INACTIVE plan that clears its own monthly fee on this trip
 * alone — the bar for telling someone to spend money should be that they come
 * out ahead on the trip in front of them, not that they might over a
 * hypothetical month of charging.
 */
export function bestMembershipToBuy(values: MembershipValue[]): MembershipValue | null {
  return values.find((value) => !value.active && value.netUsd > 0) ?? null;
}
