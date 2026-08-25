import { MembershipPlan, RideshareBenefit } from "./types";
import { getMembershipById, membershipCoversStation } from "./memberships";

// Uber and Lyft driver charging discounts.
//
// Unlike the Ionna discount (lib/ionnaDiscount), which is gated on WHICH CAR
// you drive, these are gated on WHO you drive for — so they are independent of
// the vehicle picker and span more than one network at once.
//
// Programs modeled (US, verified Aug 2026):
//
//  Uber Pro x EVgo
//    - Any Uber driver, regardless of tier, charges at EVgo's member rates with
//      no monthly fee.
//    - Gold/Platinum/Diamond are advertised at "up to 45% off" EVgo's Pay As You
//      Go rate. That 45% is a ceiling that varies by market and time of day.
//    - No Uber x Electrify America program exists.
//
//  Lyft Rewards x EVgo
//    - Gold/Platinum/Elite are advertised at "up to 40-45% off" standard rates,
//      again varying by region and time of day.
//
//  Lyft x Electrify America
//    - All drivers: 23% off. Gold/Platinum/Elite: 29% off. These are exact
//      published rates, not ceilings.
//    - Applied to prevailing EA Pass pricing, and only when the session is
//      started from the EA app ("Tap to start"/NFC) with the plan selected.
//      A card tap at the charger does NOT get it. Does not cover idle fees.
//
// WHAT THIS MODULE DELIBERATELY DOES NOT DO: it does not apply the 40-45% EVgo
// ceilings. Those are best-case marketing figures, and a planner that quotes
// the best case systematically under-quotes the trip. Instead EVgo is modeled
// at the floor the programs actually guarantee — EVgo Plus member rates, with
// the monthly fee waived. The Electrify America figures ARE exact, so those
// apply as published.
//
// This is the single source of truth: the planner, the discount UI, and the
// post-plan membership advice all read from here.

export type RidesharePlatform = "uber" | "lyft";

/**
 * Reward tier, collapsed to the boundaries the discounts actually turn on.
 * Uber Gold/Platinum/Diamond and Lyft Gold/Platinum/Elite behave identically
 * within their platform, so they share one "gold-plus" bucket.
 */
export type RideshareTier = "base" | "gold-plus";

export interface RideshareProgram {
  platform: RidesharePlatform;
  label: string;
  /** Tier options to show, in menu order. */
  tiers: { id: RideshareTier; label: string }[];
  /** How the driver must start the session for the discount to apply. */
  redemptionNote: string;
}

export const RIDESHARE_PROGRAMS: RideshareProgram[] = [
  {
    platform: "uber",
    label: "Uber",
    tiers: [
      { id: "base", label: "Blue / no tier" },
      { id: "gold-plus", label: "Gold, Platinum or Diamond" },
    ],
    redemptionNote:
      "Link your EVgo account from the Uber driver app and start sessions with Autocharge+ or the EVgo app.",
  },
  {
    platform: "lyft",
    label: "Lyft",
    tiers: [
      { id: "base", label: "No tier / Silver" },
      { id: "gold-plus", label: "Gold, Platinum or Elite" },
    ],
    redemptionNote:
      "Link EVgo from the Lyft driver app, and enroll the Electrify America plan with a Lyft code — EA sessions must be started in the EA app, not by tapping a card at the charger.",
  },
];

export function getRideshareProgram(platform: RidesharePlatform): RideshareProgram {
  // Every RidesharePlatform has an entry, so this cannot miss.
  return RIDESHARE_PROGRAMS.find((p) => p.platform === platform)!;
}

export type { RideshareBenefit };

/** EVgo Plus's own per-kWh discount — the rate these programs hand out free. */
function evgoPlusDiscountPerKwh(): number {
  return getMembershipById("evgo-plus")?.discountPerKwh ?? 0;
}

/**
 * Every network benefit a platform+tier earns.
 *
 * Uber's two tiers return the same modeled benefit on purpose: both get EVgo
 * member rates, and the extra the higher tiers get is the unmodelable "up to
 * 45%" ceiling. The tier is still asked for because it changes what the UI can
 * honestly tell the driver, and because it changes Lyft's EA rate.
 */
export function rideshareBenefits(
  platform: RidesharePlatform,
  tier: RideshareTier
): RideshareBenefit[] {
  const evgo: RideshareBenefit = {
    networkPlanId: "evgo-plus",
    discountPerKwh: evgoPlusDiscountPerKwh(),
    discountFraction: 0,
    rateLabel: "EVgo Plus rates, no monthly fee",
  };

  if (platform === "uber") return [evgo];

  return [
    evgo,
    {
      networkPlanId: "ea-pass-plus",
      discountPerKwh: 0,
      discountFraction: tier === "gold-plus" ? 0.29 : 0.23,
      rateLabel: `${tier === "gold-plus" ? 29 : 23}% off Electrify America`,
    },
  ];
}

/**
 * Whether the higher tier actually changes this platform's cost estimate.
 *
 * Used by the UI to say so plainly rather than implying the tier picker moved a
 * number it did not move.
 */
export function tierChangesEstimate(platform: RidesharePlatform): boolean {
  return platform === "lyft";
}

/**
 * The price of one kWh at `network`/`stationName` under a rideshare program,
 * or `basePrice` unchanged when no benefit covers the station.
 *
 * Station matching reuses membershipCoversStation via each benefit's plan, so a
 * rideshare benefit can never disagree with the membership of the same network
 * about which stops it covers.
 */
export function ridesharePrice(
  basePrice: number,
  network: string,
  stationName: string,
  benefits: RideshareBenefit[]
): number {
  for (const benefit of benefits) {
    const plan = getMembershipById(benefit.networkPlanId);
    if (!plan || !membershipCoversStation(plan, network, stationName)) continue;
    return Math.max(
      0,
      benefit.discountFraction > 0
        ? basePrice * (1 - benefit.discountFraction)
        : basePrice - benefit.discountPerKwh
    );
  }
  return basePrice;
}

/**
 * Whether a paid membership is made redundant by an active rideshare program.
 *
 * A rideshare driver already gets EVgo Plus rates for free, so recommending
 * they buy EVgo Plus is telling them to pay $6.99 a month for something they
 * hold. Electrify America is NOT redundant: EA Pass+ and the Lyft plan are
 * separate plans chosen per session, so whichever is cheaper wins — that is
 * handled by pricing, not by hiding the plan.
 */
export function rideshareSupersedes(
  plan: MembershipPlan,
  benefits: RideshareBenefit[]
): boolean {
  return benefits.some(
    (benefit) =>
      benefit.networkPlanId === plan.id && benefit.discountPerKwh >= plan.discountPerKwh
  );
}
