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
