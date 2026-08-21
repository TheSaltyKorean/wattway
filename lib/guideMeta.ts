/**
 * Guide metadata — slug, title, description — with no JSX.
 *
 * Kept separate from lib/guides.tsx (which holds the rendered bodies) so that
 * plain Node tooling, notably scripts/generate-llms.mjs, can import the guide
 * list without evaluating React elements at module scope.
 */
export interface GuideMeta {
  slug: string;
  title: string;
  /** Meta description and index-page blurb. */
  description: string;
}

export const GUIDE_META: GuideMeta[] = [
  {
    slug: "hyundai-genesis-ionna-discount",
    title: "Hyundai & Genesis Ionna Discount: 20% Off Charging Through Sept 30, 2026",
    description:
      "Eligible Hyundai and Genesis EV owners get 10% off every Ionna fast-charging session — 20% " +
      "through September 30, 2026. Who qualifies (IONIQ 5, IONIQ 5 N, IONIQ 9, Kona Electric, " +
      "Genesis GV60/GV70), exactly how much you save per charge by model, and how to activate it " +
      "with Plug & Charge.",
  },
  {
    slug: "ev-road-trip-charging-cost",
    title: "How Much Does It Cost to Charge an EV on a Road Trip?",
    description:
      "What DC fast charging actually costs per 100 miles, why it runs several times your home " +
      "electricity rate, the fees that don't show up in the per-kWh price, and the handful of " +
      "decisions that genuinely lower the bill.",
  },
  {
    slug: "how-wattway-plans-your-trip",
    title: "How WattWay Plans a Cost-Optimized EV Trip",
    description:
      "The full method: how WattWay routes a trip, finds chargers along the corridor, prices each " +
      "one against your memberships, and greedily picks a low-cost set of stops — plus every " +
      "assumption it makes, the candidates it never looks at, and what it deliberately doesn't " +
      "model.",
  },
  {
    slug: "dc-fast-charging-explained",
    title: "DC Fast Charging Explained: Curves, kW and the 80% Rule",
    description:
      "Why EV charging slows down as the battery fills, what the kW numbers on a stall actually " +
      "mean for your car, why road-trip charges stop at 80%, and how preconditioning can halve a " +
      "winter charging stop.",
  },
];

export function getGuideMeta(slug: string): GuideMeta | undefined {
  return GUIDE_META.find((g) => g.slug === slug);
}
