import type { Metadata } from "next";
import Link from "next/link";
import ContentPage, { JsonLd } from "@/components/ContentPage";
import {
  chargingNetworks,
  DEFAULT_PRICE_PER_KWH,
  membershipForNetwork,
  networkPath,
  perKwh,
  PRICING_YEAR,
  SITE_URL,
  usd,
  pageSocialMetadata,
} from "@/lib/seo";
import { MEMBERSHIP_PLANS } from "@/lib/memberships";

const TITLE = `EV Charging Network Prices Compared (${PRICING_YEAR})`;
const DESCRIPTION =
  "What every major US DC fast-charging network costs per kWh — Tesla Supercharger, Electrify " +
  "America, EVgo, ChargePoint, Ionna, bp pulse and more — plus which memberships are worth the " +
  "monthly fee and how much the spread costs you on a road trip.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/charging-networks" },
  ...pageSocialMetadata({ title: TITLE, description: DESCRIPTION, path: "/charging-networks", type: "website" }),
};

const KIND_LABEL: Record<string, string> = {
  national: "National",
  regional: "Regional",
  automaker: "Automaker-backed",
  municipal: "Municipal / utility",
};

export default function ChargingNetworksPage() {
  const networks = chargingNetworks();
  const cheapest = networks[0];
  const priciest = networks[networks.length - 1];
  const commercial = networks.filter((n) => n.kind !== "municipal");
  const averageCommercial =
    commercial.reduce((sum, n) => sum + n.pricePerKwh, 0) / commercial.length;

  return (
    <ContentPage
      crumbs={[{ name: "Charging networks" }]}
      title={`EV Charging Network Prices Compared (${PRICING_YEAR})`}
      intro={
        <p>
          DC fast charging is not one price. Across the networks WattWay prices, the same kilowatt-hour
          runs from {perKwh(cheapest.pricePerKwh)} on {cheapest.name} to{" "}
          {perKwh(priciest.pricePerKwh)} on {priciest.name} — a{" "}
          {Math.round((priciest.pricePerKwh / cheapest.pricePerKwh - 1) * 100)}% spread for identical
          electricity. Commercial networks average about {perKwh(averageCommercial)}. These are the
          reference rates the planner starts from when a station doesn&apos;t publish its own.
        </p>
      }
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: TITLE,
          description: DESCRIPTION,
          url: `${SITE_URL}/charging-networks`,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: networks.length,
            itemListElement: networks.map((n, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: n.name,
              url: `${SITE_URL}${networkPath(n)}`,
            })),
          },
        }}
      />

      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          Cost per kWh, cheapest first
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">DC fast-charging price per kWh by network</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th scope="col" className="py-2 pr-4 font-medium">Network</th>
                <th scope="col" className="py-2 pr-4 font-medium">Rate</th>
                <th scope="col" className="py-2 pr-4 font-medium">Type</th>
                <th scope="col" className="py-2 font-medium">Membership</th>
              </tr>
            </thead>
            <tbody>
              {networks.map((n) => {
                const plan = membershipForNetwork(n.name);
                return (
                  <tr key={n.slug} className="border-t border-[var(--border)]">
                    <th scope="row" className="py-2 pr-4 font-normal text-left">
                      <Link href={networkPath(n)} className="text-[var(--accent)] hover:underline">
                        {n.name}
                      </Link>
                    </th>
                    <td className="py-2 pr-4 text-[var(--text)]">{perKwh(n.pricePerKwh)}</td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">{KIND_LABEL[n.kind]}</td>
                    <td className="py-2 text-[var(--text-muted)]">
                      {plan
                        ? `${plan.label} — ${usd(plan.monthlyFeeUsd)}/mo, −${perKwh(plan.discountPerKwh)}`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
          When a station publishes its own rate through Open Charge Map, WattWay uses that instead of
          these reference figures. For an operator it doesn&apos;t recognize at all, it assumes{" "}
          {perKwh(DEFAULT_PRICE_PER_KWH)} — deliberately mid-pack, so an unknown station is never
          made to look artificially attractive.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          Why the cheapest network isn&apos;t always the right stop
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--text-muted)]">
          <p>
            The municipal and utility networks at the top of that table —{" "}
            {networks
              .filter((n) => n.kind === "municipal")
              .map((n) => n.name)
              .join(", ")}{" "}
            — genuinely are the cheapest electricity you can buy on the road. They are also
            confined to a handful of metro areas, so on a cross-country route you will pass zero of
            them. A rate you can&apos;t reach is worth nothing.
          </p>
          <p>
            The real decision is per-stop, and it trades three things off at once: the rate, the
            detour to get there, and the stall power. A 350 kW stall at{" "}
            {perKwh(priciest.pricePerKwh)} can beat a 50 kW stall at {perKwh(cheapest.pricePerKwh)}{" "}
            once you price your own time, and a station 12 miles off the highway costs you 24 miles
            of range plus the driving. WattWay scores all three together rather than sorting by
            price.
          </p>
          <p>
            Reliability matters too. A cheap charger that is broken when you arrive costs far more
            than the few dollars it saved, which is why the planner weights recently-verified
            stations and skips ones reported non-operational.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          Are charging memberships worth it?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          Each plan is a fixed monthly fee against a per-kWh discount, so the break-even is purely a
          function of how much you charge on that network. At a typical 55 kWh road-trip session:
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Charging membership break-even</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th scope="col" className="py-2 pr-4 font-medium">Plan</th>
                <th scope="col" className="py-2 pr-4 font-medium">Fee</th>
                <th scope="col" className="py-2 pr-4 font-medium">Discount</th>
                <th scope="col" className="py-2 font-medium">Break-even</th>
              </tr>
            </thead>
            <tbody>
              {MEMBERSHIP_PLANS.map((plan) => {
                const savedPerSession = 55 * plan.discountPerKwh;
                return (
                  <tr key={plan.id} className="border-t border-[var(--border)]">
                    <th scope="row" className="py-2 pr-4 font-normal text-left text-[var(--text)]">
                      {plan.label}
                    </th>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">
                      {usd(plan.monthlyFeeUsd)}/mo
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">
                      −{perKwh(plan.discountPerKwh)}
                    </td>
                    <td className="py-2 text-[var(--text)]">
                      {Math.ceil(plan.monthlyFeeUsd / savedPerSession)} sessions/month
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
          A single week-long road trip usually clears every one of these break-evens on its own,
          which is the case for subscribing for the month you travel and cancelling after. For
          day-to-day driving on home charging, most of them don&apos;t pay. Select the plans you hold
          in the planner and it applies the discounts when pricing each stop. Per-vehicle
          break-evens are on each{" "}
          <Link href="/ev" className="text-[var(--accent)] hover:underline">
            EV page
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">All networks</h2>
        <ul className="mt-4 grid sm:grid-cols-2 gap-2">
          {networks.map((n) => (
            <li key={n.slug}>
              <Link
                href={networkPath(n)}
                className="block bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 hover:border-[var(--accent)] transition-colors"
              >
                <span className="text-sm text-[var(--text)]">{n.name}</span>
                <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                  {perKwh(n.pricePerKwh)} · {KIND_LABEL[n.kind]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </ContentPage>
  );
}
