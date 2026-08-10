import type { Metadata } from "next";
import Link from "next/link";
import { EV_DATABASE } from "@/lib/evDatabase";
import ContentPage, { JsonLd } from "@/components/ContentPage";
import { chargingNetworks, perKwh, SITE_URL } from "@/lib/seo";

const TITLE = "WattWay FAQ — EV Trip Planning Questions";
const DESCRIPTION =
  "How WattWay picks charging stops, where its prices and charger data come from, what it costs " +
  "(nothing), what it does with your data (nothing), and how accurate the estimates are.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/faq" },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/faq` },
};

export default function FAQPage() {
  const networks = chargingNetworks();
  const cheapest = networks[0];
  const priciest = networks[networks.length - 1];

  const faqs: { q: string; a: string }[] = [
    {
      q: "What is WattWay?",
      a:
        "A free EV road-trip planner that optimizes for total charging cost. You give it an origin, " +
        "a destination and your car; it finds the cheapest realistic sequence of charging stops " +
        "along that route, accounting for each network's price, your memberships, charger power and " +
        "reliability, and how far your car actually goes between stops.",
    },
    {
      q: "How is it different from the charging planner built into my car?",
      a:
        "Built-in planners optimize for arrival time and usually favor their own network. WattWay " +
        "optimizes for what you pay. It compares every operator along the route, applies discounts " +
        "from memberships you actually hold, penalizes detours and slow stalls, and will happily " +
        "route you past a closer charger to a cheaper one when the math works out.",
    },
    {
      q: "Does WattWay cost anything, or need an account?",
      a:
        "No and no. There is no sign-up, no login, no paywall and no account of any kind. It runs " +
        "entirely in your browser as a static site — there is no server holding user data because " +
        "there is no server.",
    },
    {
      q: "How does WattWay choose where to stop?",
      a:
        "It routes your trip, pulls chargers along the corridor in segments, then walks the route " +
        "keeping track of state of charge. At each point it scores reachable chargers on effective " +
        "price per kWh after memberships, plus penalties for detour distance and for stalls under " +
        "150 kW, and takes the best one. It charges to 80% by default because charging past that is " +
        "disproportionately slow, going higher only when the next gap demands it.",
    },
    {
      q: "Where does the charger and pricing data come from?",
      a:
        "Charger locations, connector types, power levels and much of the pricing come from Open " +
        "Charge Map, a community-edited database. Routing, geocoding and place search come from the " +
        "Google Maps Platform. When a station publishes its own rate, WattWay uses it; otherwise it " +
        "falls back to per-network reference rates. Coverage is best where Open Charge Map's " +
        "community data is complete.",
    },
    {
      q: "How accurate are the cost estimates?",
      a:
        "They are model-based estimates, not quotes. Real cost moves with live network pricing, " +
        "idle and session fees, taxes, weather, terrain, speed, vehicle load and battery condition. " +
        "Treat the numbers as a way to compare options against each other rather than as a bill you " +
        "will be handed. Always confirm availability and price with the network before you rely on " +
        "a specific stop.",
    },
    {
      q: "How much does fast charging actually cost?",
      a:
        `Across the networks WattWay prices, DC fast charging runs from ${perKwh(cheapest.pricePerKwh)} ` +
        `on ${cheapest.name} to ${perKwh(priciest.pricePerKwh)} on ${priciest.name}. Municipal and ` +
        `utility-run networks are cheapest but exist in only a few metros; national commercial ` +
        `networks cluster in the middle. Which one is on your route matters more than which one is ` +
        `cheapest in the abstract.`,
    },
    {
      q: "Which EVs does WattWay support?",
      a:
        `${EV_DATABASE.length} vehicle profiles across ${new Set(EV_DATABASE.map((e) => e.make)).size} ` +
        `makes, split by spec generation so a mid-cycle refresh with a different battery is a ` +
        `separate entry from the car it replaced. There is also a custom-vehicle option for entering ` +
        `your own usable battery, real-world range and peak charge rate — usually the better choice ` +
        `if you know your car's actual highway efficiency.`,
    },
    {
      q: "What does WattWay do with my data?",
      a:
        "It has nowhere to put it. Your car, memberships, excluded networks and custom specs live in " +
        "your browser's local storage. The origin and destination you type are sent to Google and " +
        "Open Charge Map to compute the route and find chargers, because that is the only way to " +
        "answer the question. Nothing is stored on a WattWay server, because there isn't one. " +
        "Aggregate, non-identifying usage counts are collected to know whether the thing is used.",
    },
    {
      q: "Can I exclude networks I don't want to use?",
      a:
        "Yes. If you refuse to use a particular operator — bad experiences, no adapter, whatever the " +
        "reason — exclude it and the planner will route around it entirely rather than proposing " +
        "stops you'd skip.",
    },
    {
      q: "Does it handle multi-stop trips and overnight charging?",
      a:
        "Yes. You can add intermediate stops, and mark any of them as a place where the car is fully " +
        "recharged — a hotel with a Level 2 charger, or home. The planner treats that as a reset and " +
        "plans the following leg from a full pack.",
    },
    {
      q: "Why does WattWay charge to 80% instead of 100%?",
      a:
        "Because the last 20% is where a DC fast charge stops being fast. The charge curve tapers " +
        "hard above 80%, so those final miles can take as long as the first 70% did. Adding another " +
        "stop is usually quicker overall than waiting out the taper. WattWay goes above 80% only " +
        "when the next charger is far enough that it has to.",
    },
  ];

  return (
    <ContentPage
      crumbs={[{ name: "FAQ" }]}
      title="Frequently Asked Questions"
      intro={
        <p>
          How WattWay works, where its data comes from, and how far to trust it. Short version: it
          is free, it needs no account, it optimizes for cost rather than time, and every number it
          prints is an estimate.
        </p>
      }
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />

      <section>
        <dl className="space-y-7">
          {faqs.map((faq) => (
            <div key={faq.q}>
              <dt>
                <h2 className="text-base font-semibold text-[var(--text)]">{faq.q}</h2>
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-[var(--text)]">Still have a question?</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          The{" "}
          <Link href="/guides" className="text-[var(--accent)] hover:underline">
            guides
          </Link>{" "}
          go deeper on cost and planning, each{" "}
          <Link href="/ev" className="text-[var(--accent)] hover:underline">
            vehicle page
          </Link>{" "}
          answers the same questions for a specific car, and the{" "}
          <Link href="/legal" className="text-[var(--accent)] hover:underline">
            legal disclaimer
          </Link>{" "}
          covers data sources and accuracy in full.
        </p>
      </section>
    </ContentPage>
  );
}
