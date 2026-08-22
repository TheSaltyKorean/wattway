import { MembershipPlan } from "./types";

// Typical member savings vs non-member DCFC rates, 2026
export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: "tesla-membership",
    label: "Tesla Supercharging Membership",
    networkKey: "Tesla",
    discountPerKwh: 0.10,
    monthlyFeeUsd: 12.99,
  },
  {
    id: "ea-pass-plus",
    label: "Electrify America Pass+",
    networkKey: "Electrify America",
    discountPerKwh: 0.10,
    monthlyFeeUsd: 4,
  },
  {
    id: "evgo-plus",
    label: "EVgo Plus",
    networkKey: "EVgo",
    discountPerKwh: 0.10,
    monthlyFeeUsd: 6.99,
  },
  {
    id: "shell-recharge-plus",
    label: "Shell Recharge Plus",
    networkKey: "Shell Recharge",
    discountPerKwh: 0.07,
    monthlyFeeUsd: 4.99,
  },
];

export function getMembershipById(id: string): MembershipPlan | undefined {
  return MEMBERSHIP_PLANS.find((m) => m.id === id);
}

/**
 * Does this plan's discount apply at this station?
 *
 * Shared with the optimizer on purpose. The optimizer decides what a session
 * COSTS by matching the plan against the station, and membershipValue decides
 * what a plan WOULD SAVE by matching the same way. If those two matchers ever
 * disagree, the planner tells the user a membership saves money on stops it
 * never actually discounted — so there is exactly one of them.
 *
 * OCM frequently omits OperatorInfo, so the station's own title is matched too:
 * a "Tesla Supercharger — Waco" row often arrives with no operator at all.
 */
export function membershipCoversStation(
  plan: MembershipPlan,
  network: string,
  stationName: string
): boolean {
  const haystack = `${network} ${stationName}`.toLowerCase();
  return (
    haystack.includes(plan.networkKey.toLowerCase()) ||
    // Tesla's stations are branded "Supercharger" far more often than "Tesla".
    (plan.networkKey === "Tesla" && haystack.includes("supercharger"))
  );
}
