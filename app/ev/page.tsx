import type { Metadata } from "next";
import Link from "next/link";
import { EV_DATABASE } from "@/lib/evDatabase";
import ContentPage, { JsonLd } from "@/components/ContentPage";
import {
  chargingNetworks,
  evName,
  evPath,
  evsByMake,
  slugify,
  SITE_URL,
  usd,
} from "@/lib/seo";
import { costPer100Miles, fastChargeMiles } from "@/lib/chargingMath";

const TITLE = "EV Charging Cost & Range Database — Every Model";
const DESCRIPTION =
  `Charging cost, range, battery size and DC fast-charge rate for ${EV_DATABASE.length} electric ` +
  `vehicles across ${new Set(EV_DATABASE.map((e) => e.make)).size} makes. See what a fast charge ` +
  `costs on every major network and how many stops each car needs on a road trip.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/ev" },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/ev` },
};

export default function EVIndexPage() {
  const groups = evsByMake();
  const networks = chargingNetworks();
  // Median-ish reference rate for the at-a-glance cost column: the planner's own
  // fallback for an unrecognized operator sits close to the middle of the pack.
  const midPrice = networks[Math.floor(networks.length / 2)].pricePerKwh;

  const longestRange = [...EV_DATABASE].sort((a, b) => b.rangeMiles - a.rangeMiles).slice(0, 5);
  const cheapestPer100 = [...EV_DATABASE]
    .sort((a, b) => b.efficiencyMilesPerKwh - a.efficiencyMilesPerKwh)
    .slice(0, 5);
  const fastest = [...EV_DATABASE].sort((a, b) => b.maxChargekW - a.maxChargekW).slice(0, 5);

  return (
    <ContentPage
      crumbs={[{ name: "EVs" }]}
      title="EV Charging Cost & Range Database"
      intro={
        <p>
          Every vehicle WattWay can plan a trip for — {EV_DATABASE.length} profiles across{" "}
          {groups.length} makes. Each page shows what a fast charge costs on every major network,
          how long it takes at 50/150/250/350 kW, how far it gets you, and how many stops a long
          trip needs. Profiles are split by spec generation, so a 2024 refresh with a different
          battery is listed separately from the model it replaced.
        </p>
      }
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: TITLE,
          description: DESCRIPTION,
          url: `${SITE_URL}/ev`,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: EV_DATABASE.length,
            itemListElement: EV_DATABASE.map((ev, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: evName(ev),
              url: `${SITE_URL}${evPath(ev)}`,
            })),
          },
        }}
      />

      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">Standouts</h2>
        <div className="mt-4 grid sm:grid-cols-3 gap-4">
          {[
            { heading: "Longest EPA range", evs: longestRange, stat: (ev: (typeof EV_DATABASE)[number]) => `${ev.rangeMiles} mi` },
            { heading: "Cheapest per mile", evs: cheapestPer100, stat: (ev: (typeof EV_DATABASE)[number]) => `${usd(costPer100Miles(ev, midPrice))}/100 mi` },
            { heading: "Fastest charging", evs: fastest, stat: (ev: (typeof EV_DATABASE)[number]) => `${ev.maxChargekW} kW` },
          ].map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-semibold text-[var(--text)]">{col.heading}</h3>
              <ol className="mt-2 space-y-1.5 text-sm">
                {col.evs.map((ev) => (
                  <li key={ev.id} className="flex justify-between gap-2">
                    <Link href={evPath(ev)} className="text-[var(--accent)] hover:underline truncate">
                      {ev.make} {ev.model}
                    </Link>
                    <span className="text-[var(--text-muted)] shrink-0">{col.stat(ev)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Cost per 100 miles shown at {usd(midPrice)}/kWh, a mid-pack DC fast-charging rate. See{" "}
          <Link href="/charging-networks" className="text-[var(--accent)] hover:underline">
            network pricing
          </Link>{" "}
          for the full spread.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--text)]">Browse by make</h2>
        <nav aria-label="Jump to make" className="mt-3 flex flex-wrap gap-2">
          {groups.map((group) => (
            <a
              key={group.make}
              href={`#${slugify(group.make)}`}
              className="px-2.5 py-1 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
            >
              {group.make}
            </a>
          ))}
        </nav>
      </section>

      {groups.map((group) => (
        <section key={group.make} id={slugify(group.make)} className="scroll-mt-4">
          <h2 className="text-xl font-semibold text-[var(--text)]">
            {group.make} <span className="text-sm font-normal text-[var(--text-muted)]">
              ({group.evs.length} {group.evs.length === 1 ? "profile" : "profiles"})
            </span>
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <caption className="sr-only">{group.make} electric vehicle charging specs</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <th scope="col" className="py-2 pr-4 font-medium">Model</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Range</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Battery</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Peak kW</th>
                  <th scope="col" className="py-2 font-medium">Miles per charge</th>
                </tr>
              </thead>
              <tbody>
                {group.evs.map((ev) => (
                  <tr key={ev.id} className="border-t border-[var(--border)]">
                    <th scope="row" className="py-2 pr-4 font-normal text-left">
                      <Link href={evPath(ev)} className="text-[var(--accent)] hover:underline">
                        {ev.model}
                      </Link>{" "}
                      <span className="text-[var(--text-muted)] text-xs">({ev.years})</span>
                    </th>
                    <td className="py-2 pr-4 text-[var(--text)]">{ev.rangeMiles} mi</td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">{ev.batteryKwh} kWh</td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">{ev.maxChargekW} kW</td>
                    <td className="py-2 text-[var(--text-muted)]">
                      {Math.round(fastChargeMiles(ev))} mi
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-[var(--text)]">Driving something not listed?</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          The planner has a custom-vehicle option — enter your own usable battery, real-world range
          and peak charge rate and it plans against those instead of an EPA figure. That is usually
          the better choice anyway if you know your car&apos;s actual highway efficiency.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          ⚡ Plan a trip
        </Link>
      </section>
    </ContentPage>
  );
}
