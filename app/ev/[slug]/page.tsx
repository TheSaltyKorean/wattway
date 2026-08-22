import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EV_DATABASE } from "@/lib/evDatabase";
import ContentPage, { JsonLd } from "@/components/ContentPage";
import {
  chargingNetworks,
  evName,
  evPath,
  evSlug,
  evSlugsAreUnique,
  getEVBySlug,
  membershipForNetwork,
  perKwh,
  PRICING_YEAR,
  similarEVs,
  SITE_URL,
  duration,
  usd,
  pageSocialMetadata,
  fitTitle,
} from "@/lib/seo";
import {
  costPer100Miles,
  fastChargeCost,
  fastChargeKwh,
  fastChargeMiles,
  fastChargeMinutes,
  stopsForTrip,
  enRouteEnergyCost,
  enRouteChargeMinutes,
  CHARGE_TO_SOC,
  MIN_SOC,
  CHARGE_TAPER_FACTOR,
} from "@/lib/chargingMath";
import {
  isIonnaEligible,
  IONNA_BASE_DISCOUNT,
  IONNA_BONUS_DISCOUNT,
  IONNA_NETWORK,
} from "@/lib/ionnaDiscount";

// A collision would silently drop a vehicle from the static export, so fail the
// build instead. evSlug() is derived from make/model/years, which a future
// database edit could make ambiguous.
if (!evSlugsAreUnique()) {
  throw new Error(
    "evSlug() collision in EV_DATABASE — two vehicles share a URL slug. " +
      "Disambiguate their make/model/years before building."
  );
}

// Static export: every /ev/... URL is enumerated below, so an unknown slug is a
// 404 rather than an on-demand render.
export const dynamicParams = false;

export function generateStaticParams() {
  return EV_DATABASE.map((ev) => ({ slug: evSlug(ev) }));
}

/** Trip lengths the stop-count table covers. */
const TRIP_LENGTHS = [250, 500, 750, 1000];
/** Common stall power tiers, for the charge-time table. */
const STALL_TIERS = [50, 150, 250, 350];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ev = getEVBySlug(slug);
  if (!ev) return {};

  const networks = chargingNetworks();
  const cheapest = networks[0];
  // Vehicle names vary from 22 to 51 characters, so the suffix has to give way
  // rather than the name — see fitTitle in lib/seo.
  const title = fitTitle(evName(ev), [
    "Road Trip Charging Cost & Stops",
    "Charging Cost & Stops",
    "Charging Cost",
    // Last resort before the bare name: even the longest vehicle name still has
    // room for one keyword, and a title that is only a model name ranks for
    // nothing.
    "Charging",
  ]);
  const description =
    `${evName(ev)}: ${ev.batteryKwh} kWh battery, ${ev.rangeMiles} mi EPA range, ` +
    `${ev.maxChargekW} kW peak charging. A 10-80% fast charge costs about ` +
    `${usd(fastChargeCost(ev, cheapest.pricePerKwh))} on ${cheapest.name} and takes from ` +
    `${duration(fastChargeMinutes(ev))} on a full-power stall. Compare every charging network ` +
    `and see how many stops a long trip needs.`;

  return {
    title,
    description,
    alternates: { canonical: evPath(ev) },
    ...pageSocialMetadata({ title, description, path: evPath(ev) }),
  };
}

export default async function EVPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = getEVBySlug(slug);
  if (!ev) notFound();

  const networks = chargingNetworks();
  const cheapest = networks[0];
  const priciest = networks[networks.length - 1];
  const kwhPerCharge = fastChargeKwh(ev);
  const milesPerCharge = fastChargeMiles(ev);
  const chargeMinutes = fastChargeMinutes(ev);
  const similar = similarEVs(ev);
  const windowPct = `${Math.round(MIN_SOC * 100)}-${Math.round(CHARGE_TO_SOC * 100)}%`;

  // Networks that sell a subscription, paired with it. Built here rather than
  // inline so the JSX stays readable and the plan is non-null by construction.
  const membershipRows = networks.flatMap((network) => {
    const plan = membershipForNetwork(network.name);
    return plan ? [{ network, plan }] : [];
  });

  const faqs = [
    {
      q: `How much does it cost to fast-charge a ${evName(ev)}?`,
      a:
        `A ${windowPct} DC fast charge moves about ${kwhPerCharge.toFixed(1)} kWh into the ` +
        `${ev.batteryKwh} kWh pack. At ${cheapest.name}'s ${perKwh(cheapest.pricePerKwh)} that is ` +
        `about ${usd(fastChargeCost(ev, cheapest.pricePerKwh))}; at ${priciest.name}'s ` +
        `${perKwh(priciest.pricePerKwh)} it is about ${usd(fastChargeCost(ev, priciest.pricePerKwh))}. ` +
        `Which network you stop at therefore changes the price of the same electricity by roughly ` +
        `${usd(fastChargeCost(ev, priciest.pricePerKwh) - fastChargeCost(ev, cheapest.pricePerKwh))} per stop.`,
    },
    {
      q: `How long does a ${evName(ev)} take to charge on a road trip?`,
      a:
        `From about ${duration(chargeMinutes)} for ${windowPct} on a stall that can deliver the ` +
        `car's full ${ev.maxChargekW} kW with a warm battery — that is the best case, and real ` +
        `sessions are commonly half again to twice as long once the charge curve tapers, the pack ` +
        `is cold, or the stall is shared. Charging past 80% is slower still, which is why the ` +
        `cheapest plan is usually more short stops rather than fewer long ones.`,
    },
    {
      q: `How far can a ${evName(ev)} go between charging stops?`,
      a:
        `Roughly ${Math.round(milesPerCharge)} miles of highway driving per ${windowPct} charge, ` +
        `from ${ev.rangeMiles} miles of EPA range and ${ev.efficiencyMilesPerKwh.toFixed(2)} mi/kWh. ` +
        `Cold weather, sustained high speed, headwinds, elevation gain and a loaded vehicle all cut ` +
        `that figure, sometimes by 30% or more.`,
    },
    {
      q: `How many charging stops does a ${evName(ev)} need on a 500-mile trip?`,
      a:
        `About ${stopsForTrip(ev, 500)} DC fast-charge stops, assuming you leave at ` +
        `${Math.round(CHARGE_TO_SOC * 100)}% and arrive on the ${Math.round(MIN_SOC * 100)}% reserve. ` +
        `The charging you buy on the way costs roughly ` +
        `${usd(enRouteEnergyCost(ev, 500, cheapest.pricePerKwh))} on ${cheapest.name} and ` +
        `${usd(enRouteEnergyCost(ev, 500, priciest.pricePerKwh))} on ${priciest.name}. That excludes ` +
        `the first ${Math.round(fastChargeMiles(ev))} miles, which come out of the charge you left ` +
        `home with at a residential rate.`,
    },
  ];

  return (
    <ContentPage
      crumbs={[{ name: "EVs", href: "/ev" }, { name: evName(ev) }]}
      title={`${evName(ev)} — Road Trip Charging Cost & Stops`}
      intro={
        <p>
          What it actually costs to drive the {ev.make} {ev.model} long-distance: a{" "}
          {windowPct} fast charge moves {kwhPerCharge.toFixed(1)} kWh, buys about{" "}
          {Math.round(milesPerCharge)} miles, takes upwards of {duration(chargeMinutes)} on a stall
          that can deliver its full {ev.maxChargekW} kW, and costs anywhere from{" "}
          {usd(fastChargeCost(ev, cheapest.pricePerKwh))} to{" "}
          {usd(fastChargeCost(ev, priciest.pricePerKwh))} depending on which network you pull into.{" "}
          <Link href="/" className="text-[var(--accent)] hover:underline">
            Plan a real route with this car
          </Link>{" "}
          to see which stops score best along your actual highway.
        </p>
      }
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Car",
              name: evName(ev),
              url: `${SITE_URL}${evPath(ev)}`,
              manufacturer: { "@type": "Organization", name: ev.make },
              model: ev.model,
              // Schema.org types vehicleModelDate as a Date, so a range like
              // "2021-2023" is not valid there — emit the first covered model
              // year and carry the full range in a text property instead.
              vehicleModelDate: ev.years.slice(0, 4),
              fuelType: "Electric",
              vehicleEngine: {
                "@type": "EngineSpecification",
                engineType: "Electric motor",
              },
              additionalProperty: [
                { "@type": "PropertyValue", name: "Usable battery capacity", value: ev.batteryKwh, unitCode: "KWH" },
                { "@type": "PropertyValue", name: "EPA range", value: ev.rangeMiles, unitCode: "SMI" },
                { "@type": "PropertyValue", name: "Peak DC charging power", value: ev.maxChargekW, unitText: "kW" },
                { "@type": "PropertyValue", name: "Efficiency", value: ev.efficiencyMilesPerKwh, unitText: "mi/kWh" },
                { "@type": "PropertyValue", name: "Model years covered", value: ev.years },
              ],
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

      {/* --- Specs --------------------------------------------------------- */}
      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          {evName(ev)} charging specs
        </h2>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            [`${ev.batteryKwh} kWh`, "Usable battery"],
            [`${ev.rangeMiles} mi`, "EPA range"],
            [`${ev.maxChargekW} kW`, "Peak DC charge rate"],
            [`${ev.efficiencyMilesPerKwh.toFixed(2)} mi/kWh`, "Efficiency"],
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
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
          WattWay treats {ev.batteryKwh} kWh as the <em>usable</em> pack — the energy you can
          actually spend — and derives {ev.efficiencyMilesPerKwh.toFixed(2)} mi/kWh from the EPA
          range against it. Profiles are split by spec generation, so this entry covers only the{" "}
          {ev.years} model years, where the battery, range and charge rate are constant. Other model
          years of the {ev.model} are listed separately on the{" "}
          <Link href="/ev" className="text-[var(--accent)] hover:underline">
            all-EVs page
          </Link>
          .
        </p>
      </section>

      {/* --- Hyundai/Genesis Ionna discount (eligible cars only) ----------- */}
      {isIonnaEligible(ev) &&
        (() => {
          const ionna = networks.find((n) => n.name === IONNA_NETWORK);
          if (!ionna) return null;
          const rate10 = ionna.pricePerKwh * (1 - IONNA_BASE_DISCOUNT);
          const rate20 = ionna.pricePerKwh * (1 - IONNA_BASE_DISCOUNT - IONNA_BONUS_DISCOUNT);
          return (
            <section className="border border-[var(--accent)]/40 bg-[var(--accent)]/5 rounded-xl p-5">
              <h2 className="text-xl font-semibold text-[var(--text)]">
                {ev.make} owners: discounted Ionna charging
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                The {ev.make} {ev.model} is eligible for Ionna&apos;s owner discount:{" "}
                <strong className="text-[var(--text)]">10% off every Ionna session</strong>{" "}
                ongoing, plus an extra 10% bonus{" "}
                <strong className="text-[var(--text)]">through September 30, 2026</strong> —{" "}
                <strong className="text-[var(--text)]">20% off</strong> during the bonus window.
                That takes Ionna&apos;s {perKwh(ionna.pricePerKwh)} down to{" "}
                {perKwh(rate10)} (or {perKwh(rate20)} through Sep 30), so a {windowPct} charge on
                this car runs {usd(fastChargeCost(ev, rate10))} instead of{" "}
                {usd(fastChargeCost(ev, ionna.pricePerKwh))} — {usd(fastChargeCost(ev, rate20))}{" "}
                during the bonus.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
                The discount applies only at Ionna stations, and only when you start the session
                with {ev.make === "Genesis" ? "the Genesis app" : "MyHyundai"} Plug &amp; Charge or
                in-app charging — a credit-card tap at the stall does not get it. Eligible models:
                Hyundai IONIQ 5 (2022+), IONIQ 5 N (2025+), IONIQ 9 (2026+), Kona Electric (2025+);
                Genesis GV60 and Electrified GV70 (2026+).{" "}
                <Link href="/" className="text-[var(--accent)] hover:underline">
                  Plan a trip
                </Link>{" "}
                with the Ionna discount toggle on to see it factored into your stops.
              </p>
            </section>
          );
        })()}

      {/* --- Cost by network ----------------------------------------------- */}
      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          What a charge costs on each network
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          A {windowPct} session on this car moves {kwhPerCharge.toFixed(1)} kWh. Below is what that
          same energy costs on every network WattWay prices, cheapest first, using its{" "}
          {PRICING_YEAR} reference rates.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">
              {evName(ev)} charging cost by network
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th scope="col" className="py-2 pr-4 font-medium">Network</th>
                <th scope="col" className="py-2 pr-4 font-medium">Rate</th>
                <th scope="col" className="py-2 pr-4 font-medium">{windowPct} charge</th>
                <th scope="col" className="py-2 font-medium">Per 100 mi</th>
              </tr>
            </thead>
            <tbody>
              {networks.map((n) => (
                <tr key={n.slug} className="border-t border-[var(--border)]">
                  <th scope="row" className="py-2 pr-4 font-normal text-left">
                    <Link
                      href={`/charging-networks/${n.slug}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {n.name}
                    </Link>
                  </th>
                  <td className="py-2 pr-4 text-[var(--text-muted)]">{perKwh(n.pricePerKwh)}</td>
                  <td className="py-2 pr-4 text-[var(--text)]">
                    {usd(fastChargeCost(ev, n.pricePerKwh))}
                  </td>
                  <td className="py-2 text-[var(--text)]">
                    {usd(costPer100Miles(ev, n.pricePerKwh))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
          The spread is the whole point: the same {kwhPerCharge.toFixed(1)} kWh costs{" "}
          {usd(fastChargeCost(ev, cheapest.pricePerKwh))} on {cheapest.name} and{" "}
          {usd(fastChargeCost(ev, priciest.pricePerKwh))} on {priciest.name} — a difference of{" "}
          {usd(fastChargeCost(ev, priciest.pricePerKwh) - fastChargeCost(ev, cheapest.pricePerKwh))}{" "}
          for identical electricity. Over the {stopsForTrip(ev, 1000)} stops a 1,000-mile trip
          needs, picking well is worth about{" "}
          {usd(
            enRouteEnergyCost(ev, 1000, priciest.pricePerKwh) -
              enRouteEnergyCost(ev, 1000, cheapest.pricePerKwh)
          )}
          . Municipal and utility-run networks are cheapest but exist only in a few metros, so a
          realistic plan mixes them with whatever is actually on your route.
        </p>
      </section>

      {/* --- Charge time ---------------------------------------------------- */}
      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          How long a {ev.make} {ev.model} takes to charge
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          Charge time is set by the slower of two things: the car&apos;s {ev.maxChargekW} kW ceiling
          and the stall&apos;s output. A {ev.maxChargekW} kW car gains nothing from a 350 kW stall
          beyond {ev.maxChargekW} kW, and a 50 kW stall throttles every car on the lot. The power
          column is the <em>average</em> the model assumes across the whole window —{" "}
          {Math.round(CHARGE_TAPER_FACTOR * 100)}% of whichever limit binds — not the peak either
          side can hit, which is why the times below follow from it directly.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">
              {evName(ev)} {windowPct} charge time by stall power
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th scope="col" className="py-2 pr-4 font-medium">Stall power</th>
                <th scope="col" className="py-2 pr-4 font-medium">Modeled average power</th>
                <th scope="col" className="py-2 pr-4 font-medium">{windowPct} time</th>
                <th scope="col" className="py-2 font-medium">Miles per minute</th>
              </tr>
            </thead>
            <tbody>
              {STALL_TIERS.map((kw) => (
                <tr key={kw} className="border-t border-[var(--border)]">
                  <th scope="row" className="py-2 pr-4 font-normal text-left text-[var(--text)]">
                    {kw} kW
                  </th>
                  <td className="py-2 pr-4 text-[var(--text-muted)]">
                    {(Math.min(kw, ev.maxChargekW) * CHARGE_TAPER_FACTOR).toFixed(0)} kW
                    {kw > ev.maxChargekW ? " (car-limited)" : ""}
                  </td>
                  <td className="py-2 pr-4 text-[var(--text)]">
                    {duration(fastChargeMinutes(ev, kw))}
                  </td>
                  <td className="py-2 text-[var(--text)]">
                    {(milesPerCharge / fastChargeMinutes(ev, kw)).toFixed(1)} mi/min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
          Miles per minute is the figure to compare across cars: it folds charge rate and
          efficiency together, so a big efficient pack at 150 kW can beat a thirsty one at 250 kW.{" "}
          <strong className="text-[var(--text)]">Read these as a best case.</strong> They assume the
          car averages about 85% of its nameplate power for the whole {windowPct} window, on a warm
          battery, at a stall running at full output. Real sessions are commonly 1.5-2× longer:
          cars with steep charge curves fall well below their peak long before 80%, a cold pack can
          halve the rate if you haven&apos;t preconditioned, and shared or derated stalls are
          routine. Use these to compare cars against each other, not to schedule your arrival.
        </p>
      </section>

      {/* --- Trip planning -------------------------------------------------- */}
      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          Stops and cost by trip length
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          Leaving at {Math.round(CHARGE_TO_SOC * 100)}% and arriving on the{" "}
          {Math.round(MIN_SOC * 100)}% reserve, each charge buys about{" "}
          {Math.round(milesPerCharge)} miles in this car. Cost columns show the cheapest and most
          expensive networks as a realistic range.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">
              {evName(ev)} charging stops and energy cost by trip distance
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th scope="col" className="py-2 pr-4 font-medium">Trip</th>
                <th scope="col" className="py-2 pr-4 font-medium">Charging stops</th>
                <th scope="col" className="py-2 pr-4 font-medium">Time charging (best case)</th>
                <th scope="col" className="py-2 font-medium">Charging bought en route</th>
              </tr>
            </thead>
            <tbody>
              {TRIP_LENGTHS.map((distance) => {
                const stops = stopsForTrip(ev, distance);
                return (
                  <tr key={distance} className="border-t border-[var(--border)]">
                    <th scope="row" className="py-2 pr-4 font-normal text-left text-[var(--text)]">
                      {distance.toLocaleString()} mi
                    </th>
                    <td className="py-2 pr-4 text-[var(--text)]">{stops}</td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">
                      {duration(enRouteChargeMinutes(ev, distance))}
                    </td>
                    <td className="py-2 text-[var(--text)]">
                      {usd(enRouteEnergyCost(ev, distance, cheapest.pricePerKwh))} –{" "}
                      {usd(enRouteEnergyCost(ev, distance, priciest.pricePerKwh))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
          Charging time is computed from the energy actually bought, not from whole sessions — the
          last stop is nearly always a partial top-up, so counting it as a full {windowPct} charge
          would overstate the total. The cost column is likewise what you buy <em>at chargers</em>:
          the first{" "}
          {Math.round(milesPerCharge)} miles run on the charge you left home with, so a trip shorter
          than that shows nothing bought en route. This is also the idealized version — evenly
          spaced chargers, every one working, no detours. A
          real route has gaps, and the charger 40 miles ahead may be cheaper than the one you can
          just barely reach.{" "}
          <Link href="/" className="text-[var(--accent)] hover:underline">
            Run your actual route through WattWay
          </Link>{" "}
          to get stops placed against real charger locations and prices.
        </p>
      </section>

      {/* --- Memberships ---------------------------------------------------- */}
      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          Do charging memberships pay off for this car?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          Every subscription is the same bet: a fixed monthly fee against a per-kWh discount. For
          the {ev.model}, here is how many {windowPct} sessions per month it takes to break even.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">
              Charging membership break-even for the {evName(ev)}
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th scope="col" className="py-2 pr-4 font-medium">Plan</th>
                <th scope="col" className="py-2 pr-4 font-medium">Monthly fee</th>
                <th scope="col" className="py-2 pr-4 font-medium">Saved per charge</th>
                <th scope="col" className="py-2 font-medium">Break-even</th>
              </tr>
            </thead>
            <tbody>
              {membershipRows.map(({ network, plan }) => {
                  const savedPerCharge = kwhPerCharge * plan.discountPerKwh;
                  const breakEven = Math.ceil(plan.monthlyFeeUsd / savedPerCharge);
                  return (
                    <tr key={plan.id} className="border-t border-[var(--border)]">
                      <th scope="row" className="py-2 pr-4 font-normal text-left">
                        <Link
                          href={`/charging-networks/${network.slug}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          {plan.label}
                        </Link>
                      </th>
                      <td className="py-2 pr-4 text-[var(--text-muted)]">
                        {usd(plan.monthlyFeeUsd)}
                      </td>
                      <td className="py-2 pr-4 text-[var(--text)]">{usd(savedPerCharge)}</td>
                      <td className="py-2 text-[var(--text)]">
                        {breakEven} charge{breakEven === 1 ? "" : "s"}/month
                      </td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
          Break-even counts assume you charge on that network exclusively, which nobody does. Treat
          them as a floor: if a road trip alone clears the break-even, the plan is worth buying for
          that month. WattWay applies whichever memberships you select when it prices a route.
        </p>
      </section>

      {/* --- Similar vehicles ------------------------------------------------ */}
      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          EVs with similar range
        </h2>
        <ul className="mt-4 grid sm:grid-cols-2 gap-2">
          {similar.map((other) => (
            <li key={other.id}>
              <Link
                href={evPath(other)}
                className="block bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 hover:border-[var(--accent)] transition-colors"
              >
                <span className="text-sm text-[var(--text)]">{evName(other)}</span>
                <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                  {other.rangeMiles} mi range · {other.batteryKwh} kWh · {other.maxChargekW} kW
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* --- FAQ ------------------------------------------------------------- */}
      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">
          {evName(ev)} charging questions
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
          Plan a real trip in your {ev.model}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          The tables above assume an average network on an idealized route. WattWay&apos;s planner
          uses your actual origin and destination, real charger locations and prices along that
          highway, your memberships, and this car&apos;s battery, efficiency and peak charge rate to
          pick a low-cost set of stops. (It approximates the charge curve from that peak
          rate — it does not carry a measured per-vehicle curve.)
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
