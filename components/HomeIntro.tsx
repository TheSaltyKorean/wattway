import Link from "next/link";
import { JsonLd } from "@/components/ContentPage";
import {
  chargingNetworks,
  networkPath,
  perKwh,
  PRICING_YEAR,
  usd,
} from "@/lib/seo";

/** Battery fill the price examples are sized against, in kWh. */
const EXAMPLE_KWH = 70;

/**
 * Indexable prose for the home page.
 *
 * The planner above it renders nothing a crawler can read — it is a form and a
 * lazily-loaded map — which is why the home page sat in Google's "discovered,
 * currently not indexed" bucket while carrying the site's only real authority.
 * This section gives the URL something to actually rank for, and states the
 * price spread that every other page's numbers derive from.
 *
 * The rates come from the same DEFAULT_NETWORK_PRICES the optimizer prices
 * routes with, so this copy cannot drift from what the planner charges you.
 */
export default function HomeIntro() {
  const networks = chargingNetworks();
  const cheapest = networks[0];
  const priciest = networks[networks.length - 1];
  const spread = priciest.pricePerKwh / cheapest.pricePerKwh;

  // `a` is the plain-text answer the schema carries; `body` is the same answer
  // with the internal links a reader gets. Keep them saying the same thing.
  const faqs: { q: string; a: string; body?: React.ReactNode }[] = [
    {
      q: "How much does it cost to charge an EV on a road trip?",
      a:
        `On DC fast chargers, roughly ${usd(EXAMPLE_KWH * cheapest.pricePerKwh)} to ` +
        `${usd(EXAMPLE_KWH * priciest.pricePerKwh)} per full-ish charge, depending ` +
        `entirely on which network you stop at.`,
      body: (
        <>
          On DC fast chargers, roughly {usd(EXAMPLE_KWH * cheapest.pricePerKwh)} to{" "}
          {usd(EXAMPLE_KWH * priciest.pricePerKwh)} per full-ish charge, depending
          entirely on which network you stop at. See{" "}
          <Link href="/ev" className="text-[var(--accent)] hover:underline">
            the per-vehicle cost database
          </Link>{" "}
          for your exact car.
        </>
      ),
    },
    {
      q: "Which EV charging network is cheapest?",
      a:
        `Of the ${networks.length} networks WattWay tracks, ${cheapest.name} at ` +
        `${perKwh(cheapest.pricePerKwh)} per kWh. Availability is regional, so the ` +
        `cheapest network on your actual route is usually a different question.`,
      body: (
        <>
          Of the {networks.length} networks WattWay tracks, {cheapest.name} at{" "}
          {perKwh(cheapest.pricePerKwh)} per kWh. Availability is regional, so the
          cheapest network on your actual route is usually a different question —{" "}
          <Link href="/charging-networks" className="text-[var(--accent)] hover:underline">
            compare all {networks.length}
          </Link>
          .
        </>
      ),
    },
    {
      q: "Is WattWay free?",
      a:
        "Yes — no account, no paywall, no ads, and your trip data is not sold to " +
        "anyone. It runs entirely in your browser.",
      body: (
        <>
          Yes — no account, no paywall, no ads, and your trip data is not sold to
          anyone. It runs entirely in your browser.{" "}
          <Link href="/faq" className="text-[var(--accent)] hover:underline">
            More in the FAQ
          </Link>
          .
        </>
      ),
    },
  ];

  return (
    <section
      aria-labelledby="what-wattway-does"
      className="px-5 pb-5 pt-4 border-t border-[var(--border)] space-y-6"
    >
      <div>
        <h2
          id="what-wattway-does"
          className="text-lg font-semibold text-[var(--text)]"
        >
          The same electricity, at {spread.toFixed(1)}× the price
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          Every DC fast charger pushes identical electrons into your battery.
          What they charge for them is not identical at all. Across the{" "}
          {networks.length} networks WattWay tracks, the rate runs from{" "}
          <span className="text-[var(--text)] font-medium">
            {perKwh(cheapest.pricePerKwh)}
          </span>{" "}
          on{" "}
          <Link href={networkPath(cheapest)} className="text-[var(--accent)] hover:underline">
            {cheapest.name}
          </Link>{" "}
          to{" "}
          <span className="text-[var(--text)] font-medium">
            {perKwh(priciest.pricePerKwh)}
          </span>{" "}
          on{" "}
          <Link href={networkPath(priciest)} className="text-[var(--accent)] hover:underline">
            {priciest.name}
          </Link>
          . On a single {EXAMPLE_KWH} kWh fill-up that is the difference between{" "}
          {usd(EXAMPLE_KWH * cheapest.pricePerKwh)} and{" "}
          {usd(EXAMPLE_KWH * priciest.pricePerKwh)} — and almost nobody knows
          which stall they are pulling into until they are already plugged in.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          WattWay is a free EV trip planner that routes around it. Give it two
          addresses and your car, and it pulls the real driving route, looks at
          every fast charger in a ten-mile corridor along it, and picks the
          stops that make the trip <em>cheapest</em> — not the ones that happen
          to be closest. No account, no ads, and nothing about your trip leaves
          your browser.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Fast charging prices by network ({PRICING_YEAR})
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">
              Typical non-member DC fast charging price per kWh, by network, and
              the cost of a {EXAMPLE_KWH} kWh charge on each.
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th scope="col" className="py-2 pr-4 font-medium">Network</th>
                <th scope="col" className="py-2 pr-4 font-medium">Per kWh</th>
                <th scope="col" className="py-2 font-medium">
                  {EXAMPLE_KWH} kWh charge
                </th>
              </tr>
            </thead>
            <tbody>
              {networks.map((n) => (
                <tr key={n.slug} className="border-t border-[var(--border)]">
                  <th scope="row" className="py-2 pr-4 font-normal text-left">
                    <Link href={networkPath(n)} className="text-[var(--accent)] hover:underline">
                      {n.name}
                    </Link>
                  </th>
                  <td className="py-2 pr-4 text-[var(--text-muted)]">
                    {perKwh(n.pricePerKwh)}
                  </td>
                  <td className="py-2 text-[var(--text)]">
                    {usd(EXAMPLE_KWH * n.pricePerKwh)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
          Typical non-member pricing for {PRICING_YEAR}; real rates vary by site
          and state, and several networks sell a membership that cuts the
          per-kWh rate. After it plans a route, WattWay tells you whether any of
          those memberships would have paid for itself on that specific trip.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Common questions
        </h2>
        {/* Rendered from the same array the FAQPage schema below is built from,
            so the visible answer and the structured one cannot diverge —
            Google treats a mismatch as a rich-result violation. */}
        <dl className="mt-3 space-y-3 text-sm leading-relaxed">
          {faqs.map(({ q, a, body }) => (
            <div key={q}>
              <dt className="font-medium text-[var(--text)]">{q}</dt>
              <dd className="mt-1 text-[var(--text-muted)]">{body ?? a}</dd>
            </div>
          ))}
        </dl>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map(({ q, a }) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }}
      />
    </section>
  );
}
