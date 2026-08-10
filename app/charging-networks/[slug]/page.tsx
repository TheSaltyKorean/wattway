import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EV_DATABASE } from "@/lib/evDatabase";
import ContentPage, { JsonLd } from "@/components/ContentPage";
import {
  chargingNetworks,
  evName,
  evPath,
  getNetworkBySlug,
  membershipForNetwork,
  networkPath,
  perKwh,
  PRICING_YEAR,
  SITE_URL,
  usd,
  pageSocialMetadata,
} from "@/lib/seo";
import {
  costPer100Miles,
  fastChargeCost,
  fastChargeKwh,
  enRouteEnergyCost,
  CHARGE_TO_SOC,
  MIN_SOC,
} from "@/lib/chargingMath";

export const dynamicParams = false;

export function generateStaticParams() {
  return chargingNetworks().map((n) => ({ slug: n.slug }));
}

/**
 * A stable, spread-out sample of the vehicle database for the "what it costs to
 * charge" table: the smallest pack, the largest, and evenly spaced picks in
 * between. Derived rather than hardcoded so removing a vehicle can't leave a
 * dangling reference.
 */
function sampleVehicles(count = 6) {
  const sorted = [...EV_DATABASE].sort(
    (a, b) => a.batteryKwh - b.batteryKwh || a.id.localeCompare(b.id)
  );
  const step = (sorted.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => sorted[Math.round(i * step)]);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const network = getNetworkBySlug(slug);
  if (!network) return {};

  const title = `${network.name} Charging Cost per kWh (${PRICING_YEAR})`;
  const description =
    `${network.name} DC fast charging costs about ${perKwh(network.pricePerKwh)}. See what that ` +
    `means per charge and per 100 miles for your EV, how it compares with every other US charging ` +
    `network, and whether the membership pays off.`;

  return {
    title,
    description,
    alternates: { canonical: networkPath(network) },
    ...pageSocialMetadata({ title, description, path: networkPath(network) }),
  };
}

export default async function NetworkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const network = getNetworkBySlug(slug);
  if (!network) notFound();

  const all = chargingNetworks();
  // Rank by how many networks are strictly cheaper, not by list index: the list
  // breaks price ties alphabetically, which would otherwise present two networks
  // at the same rate as "4th" and "5th cheapest" and imply a difference.
  const rank = all.filter((n) => n.pricePerKwh < network.pricePerKwh).length + 1;
  const tiedCount = all.filter((n) => n.pricePerKwh === network.pricePerKwh).length;
  const cheapest = all[0];
  const priciest = all[all.length - 1];
  const average = all.reduce((sum, n) => sum + n.pricePerKwh, 0) / all.length;
  const plan = membershipForNetwork(network.name);
  const vehicles = sampleVehicles();
  const windowPct = `${Math.round(MIN_SOC * 100)}-${Math.round(CHARGE_TO_SOC * 100)}%`;
  const vsAverage = network.pricePerKwh - average;
  // The average is unrounded (e.g. $0.435), so a network half a cent away has a
  // real but sub-cent delta that usd() prints as "$0.00" — which then reads as
  // "$0.00/kWh above the average". Anything that rounds to zero is "at the
  // average" instead.
  const atAverage = Math.abs(vsAverage) < 0.005;

  const faqs = [
    {
      q: `How much does ${network.name} charging cost per kWh?`,
      a:
        `WattWay prices ${network.name} at about ${perKwh(network.pricePerKwh)} for DC fast ` +
        `charging, which makes it the ${rank}${ordinal(rank)} cheapest of the ${all.length} networks ` +
        `it tracks${tiedCount > 1 ? ` (tied with ${tiedCount - 1} other at the same rate)` : ""} and ` +
        `${atAverage ? `right at the ${perKwh(average)} average` : `${vsAverage < 0 ? "below" : "above"} the ${perKwh(average)} average by ${usd(Math.abs(vsAverage))} per kWh`}. ` +
        `Actual rates vary by site, time of day and local ` +
        `taxes; when a station publishes its own price, the planner uses that instead.`,
    },
    {
      q: `Is ${network.name} expensive compared with other networks?`,
      a:
        `Across the networks WattWay prices, rates run from ${perKwh(cheapest.pricePerKwh)} ` +
        `(${cheapest.name}) to ${perKwh(priciest.pricePerKwh)} (${priciest.name}). At ` +
        `${perKwh(network.pricePerKwh)}, ${network.name} sits ${describePosition(rank, all.length)}. ` +
        `On a 500-mile trip, the charging you buy en route differs by roughly ` +
        `${usd(Math.abs(enRouteEnergyCost(vehicles[3], 500, network.pricePerKwh) - enRouteEnergyCost(vehicles[3], 500, average)))} ` +
        `versus an average-priced network for a mid-size EV.`,
    },
    plan
      ? {
          q: `Is the ${plan.label} membership worth it?`,
          a:
            `It costs ${usd(plan.monthlyFeeUsd)} a month and takes ${perKwh(plan.discountPerKwh)} off ` +
            `the rate, bringing ${network.name} to about ` +
            `${perKwh(network.pricePerKwh - plan.discountPerKwh)}. At a typical 55 kWh road-trip ` +
            `session you save ${usd(55 * plan.discountPerKwh)} per stop, so it pays for itself after ` +
            `${Math.ceil(plan.monthlyFeeUsd / (55 * plan.discountPerKwh))} sessions in a month — ` +
            `easily cleared by one road trip, rarely cleared by home charging alone.`,
        }
      : {
          q: `Does ${network.name} have a membership or subscription?`,
          a:
            `WattWay doesn't model a subscription for ${network.name}, so no membership discount is ` +
            `applied to its sessions. That does not mean every stop is priced at ` +
            `${perKwh(network.pricePerKwh)}: when a station publishes its own rate through Open ` +
            `Charge Map the planner uses that, and this reference rate is only the fallback for ` +
            `stations that don't. If the network introduces a plan worth modeling it will be added ` +
            `to the planner's membership list.`,
        },
  ];

  return (
    <ContentPage
      crumbs={[{ name: "Charging networks", href: "/charging-networks" }, { name: network.name }]}
      title={`${network.name} Charging Cost per kWh`}
      intro={
        <p>
          {network.name} DC fast charging runs about {perKwh(network.pricePerKwh)} — the {rank}
          {ordinal(rank)} cheapest of the {all.length} networks WattWay prices, and{" "}
          {atAverage
            ? "right at"
            : `${usd(Math.abs(vsAverage))}/kWh ${vsAverage < 0 ? "below" : "above"}`}{" "}
          the {perKwh(average)} average.{" "}
          <Link href="/" className="text-[var(--accent)] hover:underline">
            Plan a route
          </Link>{" "}
          and WattWay will tell you whether stopping here actually beats the alternatives on your
          highway.
        </p>
      }
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: network.name,
              url: `${SITE_URL}${networkPath(network)}`,
              description: network.blurb,
            },
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ],
        }}
      />

      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">About {network.name}</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{network.blurb}</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            [perKwh(network.pricePerKwh), "Reference rate"],
            [
              `#${rank} of ${all.length}`,
              tiedCount > 1 ? `Cheapest ranking (${tiedCount}-way tie)` : "Cheapest ranking",
            ],
            [
              plan ? perKwh(network.pricePerKwh - plan.discountPerKwh) : "—",
              plan ? "With membership" : "No membership",
            ],
            [
              atAverage ? "—" : `${vsAverage < 0 ? "−" : "+"}${usd(Math.abs(vsAverage))}`,
              atAverage ? "At the network average" : "vs network average",
            ],
          ].map(([value, label]) => (
            <div
              key={label}
              className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3"
            >
              <p className="text-lg font-semibold text-[var(--text)]">{value}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          What a charge costs at {network.name}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          A {windowPct} DC fast charge at {perKwh(network.pricePerKwh)}, across a spread of pack
          sizes. Bigger battery, bigger bill — but also more miles per stop.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">
              Cost to charge various EVs at {network.name}
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th scope="col" className="py-2 pr-4 font-medium">Vehicle</th>
                <th scope="col" className="py-2 pr-4 font-medium">Battery</th>
                <th scope="col" className="py-2 pr-4 font-medium">{windowPct} charge</th>
                <th scope="col" className="py-2 font-medium">Per 100 mi</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((ev) => (
                <tr key={ev.id} className="border-t border-[var(--border)]">
                  <th scope="row" className="py-2 pr-4 font-normal text-left">
                    <Link href={evPath(ev)} className="text-[var(--accent)] hover:underline">
                      {evName(ev)}
                    </Link>
                  </th>
                  <td className="py-2 pr-4 text-[var(--text-muted)]">
                    {ev.batteryKwh} kWh ({fastChargeKwh(ev).toFixed(0)} kWh added)
                  </td>
                  <td className="py-2 pr-4 text-[var(--text)]">
                    {usd(fastChargeCost(ev, network.pricePerKwh))}
                  </td>
                  <td className="py-2 text-[var(--text)]">
                    {usd(costPer100Miles(ev, network.pricePerKwh))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Your car not here? Every one of the {EV_DATABASE.length} vehicles in the{" "}
          <Link href="/ev" className="text-[var(--accent)] hover:underline">
            EV database
          </Link>{" "}
          has its own page with the full network-by-network cost table.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          {network.name} vs other networks
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Network price comparison</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th scope="col" className="py-2 pr-4 font-medium">Network</th>
                <th scope="col" className="py-2 pr-4 font-medium">Rate</th>
                <th scope="col" className="py-2 font-medium">vs {network.name}</th>
              </tr>
            </thead>
            <tbody>
              {all.map((n) => {
                const delta = n.pricePerKwh - network.pricePerKwh;
                const isSelf = n.slug === network.slug;
                return (
                  <tr
                    key={n.slug}
                    className={`border-t border-[var(--border)] ${isSelf ? "bg-[var(--surface-2)]" : ""}`}
                  >
                    <th scope="row" className="py-2 pr-4 font-normal text-left">
                      {isSelf ? (
                        <span className="text-[var(--text)] font-semibold">{n.name} (this page)</span>
                      ) : (
                        <Link href={networkPath(n)} className="text-[var(--accent)] hover:underline">
                          {n.name}
                        </Link>
                      )}
                    </th>
                    <td className="py-2 pr-4 text-[var(--text)]">{perKwh(n.pricePerKwh)}</td>
                    <td className="py-2 text-[var(--text-muted)]">
                      {isSelf
                        ? "—"
                        : delta === 0
                          ? "same rate"
                          : `${delta > 0 ? "+" : "−"}${usd(Math.abs(delta))}/kWh`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          {network.name} charging questions
        </h2>
        <dl className="mt-4 space-y-5">
          {faqs.map((faq) => (
            <div key={faq.q}>
              <dt className="text-sm font-semibold text-[var(--text)]">{faq.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Find out if {network.name} is on your route
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          A rate only matters if you drive past it. WattWay looks at the chargers actually along
          your route — any operator, not just this one — and picks a low-cost set of stops
          for your car. You can also exclude networks you&apos;d rather not use.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          ⚡ Plan a trip — free, no sign-up
        </Link>
      </section>
    </ContentPage>
  );
}

/** Ordinal suffix for a positive integer: 1 -> "st", 2 -> "nd", 11 -> "th". */
function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

/** Plain-language placement within the ranked list. */
function describePosition(rank: number, total: number): string {
  if (rank === 1) return "at the bottom of the range — the cheapest WattWay tracks";
  if (rank === total) return "at the top of the range — the most expensive WattWay tracks";
  if (rank <= total / 3) return "toward the cheap end";
  if (rank >= (total * 2) / 3) return "toward the expensive end";
  return "in the middle of the pack";
}
