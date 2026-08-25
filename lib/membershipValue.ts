import { ChargingStop, MembershipPlan, RideshareBenefit, TripPlan } from "./types";
import { MEMBERSHIP_PLANS, membershipCoversStation } from "./memberships";
import { rideshareSupersedes } from "./rideshareDiscount";

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
 * `rideshareBenefits` are the Uber/Lyft driver discounts already priced into
 * the trip. They matter here for two reasons, and getting either wrong turns
 * this card into bad financial advice:
 *
 *  1. A plan the driver already gets FREE from the platform (EVgo Plus) is
 *     dropped outright — telling someone to buy what they hold is the same
 *     class of bug as telling a holder no membership pays for itself.
 *  2. On a network where the platform discount and the paid plan are rival
 *     choices made per session (Electrify America), the plan is only worth its
 *     INCREMENTAL saving over the rate the driver already gets — which is
 *     often nothing, and must never be quoted as the full per-kWh discount.
 *
 * Returned sorted by netUsd descending, so the caller can take the first entry
 * as the recommendation.
 */
export function membershipValues(
  trip: TripPlan,
  activeIds: string[] = [],
  rideshareBenefits: RideshareBenefit[] = []
): MembershipValue[] {
  const active = new Set(activeIds);

  return MEMBERSHIP_PLANS.filter(
    // Free from the platform: not a purchase, so not a recommendation.
    (plan) => active.has(plan.id) || !rideshareSupersedes(plan, rideshareBenefits)
  ).map((plan) => {
    const covered = trip.stops.filter((stop: ChargingStop) =>
      membershipCoversStation(plan, stop.station.network, stop.station.name)
    );
    const kwhOnNetwork = covered.reduce((sum, stop) => sum + stop.kwhAdded, 0);
    // An active plan's worth is simply the discount it is already applying.
    // An inactive one is worth what it would take off the price the driver
    // pays TODAY — which equals the flat per-kWh discount when nothing else
    // covers the network, and shrinks to the incremental gain when a rideshare
    // rate is already doing the work.
    const tripSavingsUsd = active.has(plan.id)
      ? kwhOnNetwork * plan.discountPerKwh
      : covered.reduce((sum, stop) => {
          const withPlan = Math.max(0, stop.station.basePricePerKwh - plan.discountPerKwh);
          return sum + Math.max(0, stop.station.pricePerKwh - withPlan) * stop.kwhAdded;
        }, 0);

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
 * Every plan worth buying for this trip, best first.
 *
 * Only INACTIVE plans that clear their own monthly fee on this trip alone —
 * the bar for telling someone to spend money should be that they come out
 * ahead on the trip in front of them, not that they might over a hypothetical
 * month of charging.
 *
 * A long route can cross two or three partner networks and clear the fee on
 * each; recommending only the first left real money on the table and made the
 * card look wrong next to its own savings list.
 */
export function membershipsToBuy(values: MembershipValue[]): MembershipValue[] {
  return values.filter((value) => !value.active && value.netUsd > 0);
}

/** Back-compat single-best accessor: the first of membershipsToBuy, or null. */
export function bestMembershipToBuy(values: MembershipValue[]): MembershipValue | null {
  return membershipsToBuy(values)[0] ?? null;
}

/**
 * What the memberships the user ALREADY holds did on this trip.
 *
 * Needed because "no membership pays for itself on this trip alone" is a true
 * statement about what is left to BUY and a badly misleading thing to show
 * someone whose two active plans just saved them $83 — which is exactly what
 * the card said before this existed. Once every plan worth holding is held,
 * the interesting number stops being the recommendation and becomes the
 * return on what they are already paying for.
 */
export interface ActiveMembershipSummary {
  values: MembershipValue[];
  /** Total taken off this trip by active plans. */
  savedUsd: number;
  /** Combined monthly cost of those plans. */
  monthlyFeeUsd: number;
  /** True when this one trip covers the whole monthly outlay. */
  paysForItself: boolean;
}

export function activeMembershipSummary(values: MembershipValue[]): ActiveMembershipSummary {
  const active = values.filter((value) => value.active);
  const savedUsd = active.reduce((sum, value) => sum + value.tripSavingsUsd, 0);
  const monthlyFeeUsd = active.reduce((sum, value) => sum + value.plan.monthlyFeeUsd, 0);
  return {
    values: active,
    savedUsd,
    monthlyFeeUsd,
    paysForItself: savedUsd > monthlyFeeUsd,
  };
}
