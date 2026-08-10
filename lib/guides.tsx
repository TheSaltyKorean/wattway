import Link from "next/link";
import { GUIDE_META, type GuideMeta } from "./guideMeta";
import { MEMBERSHIP_PLANS } from "./memberships";
import { EV_DATABASE } from "./evDatabase";
import {
  chargingNetworks,
  evName,
  evPath,
  HOME_PRICE_PER_KWH,
  perKwh,
  PRICING_YEAR,
  usd,
} from "./seo";
import {
  costPer100Miles,
  fastChargeKwh,
  fastChargeMiles,
  fastChargeMinutes,
  stopsForTrip,
  enRouteEnergyCost,
  energyCostForMiles,
  CANDIDATE_WINDOW,
} from "./chargingMath";

export interface Guide extends GuideMeta {
  /** Rendered under the H1, above the body. */
  intro: React.ReactNode;
  body: React.ReactNode;
  /** Optional extra JSON-LD merged into the page's @graph. */
  schema?: Record<string, unknown>;
}

/** Look up shared metadata by slug; throws if the two lists fall out of sync. */
function meta(slug: string): GuideMeta {
  const found = GUIDE_META.find((g) => g.slug === slug);
  if (!found) throw new Error(`No GUIDE_META entry for guide slug "${slug}"`);
  return found;
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm leading-relaxed text-[var(--text-muted)]">{children}</p>
);

const H2 = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2 id={id} className="text-xl font-semibold text-[var(--text)] scroll-mt-4">
    {children}
  </h2>
);

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="text-[var(--accent)] hover:underline">
    {children}
  </Link>
);

/** Wording for the sub-150 kW penalty, which is applied in two tiers. */
const SLOW_CHARGER_PENALTY_TEXT =
  "a penalty for stalls under 150 kW and a double penalty under 100 kW, which buy the same energy at the price of your afternoon";

/** A reference mid-size EV used to make abstract numbers concrete in the prose. */
function referenceEV() {
  const sorted = [...EV_DATABASE].sort(
    (a, b) => a.batteryKwh - b.batteryKwh || a.id.localeCompare(b.id)
  );
  return sorted[Math.floor(sorted.length / 2)];
}

function CostGuide() {
  const networks = chargingNetworks();
  const cheapest = networks[0];
  const priciest = networks[networks.length - 1];
  const commercial = networks.filter((n) => n.kind !== "municipal");
  const avgCommercial =
    commercial.reduce((sum, n) => sum + n.pricePerKwh, 0) / commercial.length;
  const ev = referenceEV();

  // Shared with the rest of the site so the home-vs-road contrast is one number.
  const HOME_RATE = HOME_PRICE_PER_KWH;

  return (
    <>
      <section className="space-y-3">
        <H2 id="short-answer">The short answer</H2>
        <P>
          On a US road trip, DC fast charging costs roughly{" "}
          <strong className="text-[var(--text)]">
            {usd(costPer100Miles(ev, avgCommercial))} per 100 miles
          </strong>{" "}
          for a mid-size EV — call it {usd(costPer100Miles(ev, cheapest.pricePerKwh))} if you can
          stick to the cheapest networks and {usd(costPer100Miles(ev, priciest.pricePerKwh))} if you
          stop wherever is convenient. A {ev.batteryKwh} kWh car covering 500 miles burns about{" "}
          {usd(energyCostForMiles(ev, 500, avgCommercial))} of electricity at that rate, across{" "}
          {stopsForTrip(ev, 500)} charging stops — less in practice, because the first{" "}
          {Math.round(fastChargeMiles(ev))} miles run on the cheap charge you left home with.
        </P>
        <P>
          The number that catches people out is the comparison with home. At a typical{" "}
          {perKwh(HOME_RATE)} residential rate, the same 100 miles costs{" "}
          {usd(costPer100Miles(ev, HOME_RATE))}. Fast charging on the road is therefore roughly{" "}
          <strong className="text-[var(--text)]">
            {(avgCommercial / HOME_RATE).toFixed(1)}× the price of charging in your driveway
          </strong>
          . An EV that costs almost nothing to run around town is a different vehicle on a
          cross-country drive, and the gap is entirely down to which chargers you use.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="what-drives-cost">What actually drives the cost</H2>
        <P>
          Three things, in descending order of how much control you have over them.
        </P>
        <P>
          <strong className="text-[var(--text)]">1. Which network you stop at.</strong> This is the
          big one and the one you can change. Across the networks WattWay prices, rates run from{" "}
          {perKwh(cheapest.pricePerKwh)} to {perKwh(priciest.pricePerKwh)} — a{" "}
          {Math.round((priciest.pricePerKwh / cheapest.pricePerKwh - 1) * 100)}% spread for the same
          electricity. Over the {stopsForTrip(ev, 1000)} stops a 1,000-mile trip needs, choosing
          well is worth about{" "}
          {usd(
            enRouteEnergyCost(ev, 1000, priciest.pricePerKwh) -
              enRouteEnergyCost(ev, 1000, cheapest.pricePerKwh)
          )}
          . See the full{" "}
          <A href="/charging-networks">network price comparison</A>.
        </P>
        <P>
          <strong className="text-[var(--text)]">2. Your car&apos;s efficiency.</strong> Cost per
          mile is price per kWh divided by miles per kWh, so an efficient sedan and a heavy truck
          pay wildly different amounts for the same trip on the same network. Across the{" "}
          {EV_DATABASE.length} vehicles in the{" "}
          <A href="/ev">database</A>, efficiency ranges from{" "}
          {Math.min(...EV_DATABASE.map((e) => e.efficiencyMilesPerKwh)).toFixed(2)} to{" "}
          {Math.max(...EV_DATABASE.map((e) => e.efficiencyMilesPerKwh)).toFixed(2)} mi/kWh — better
          than a 2× difference in fuel cost between the extremes.
        </P>
        <P>
          <strong className="text-[var(--text)]">3. Memberships.</strong> Some networks sell a
          subscription that trades a monthly fee for a lower rate. WattWay models four of them —{" "}
          {MEMBERSHIP_PLANS.map((m) => m.label).join(", ")} — and applies no discount to the other{" "}
          {chargingNetworks().length - MEMBERSHIP_PLANS.length}. That is not the same as pricing
          those at a flat rate: a station that publishes its own price through Open Charge Map keeps
          it either way, and the per-network figure is only the fallback when it doesn&apos;t. For
          the four plans that are modeled, a single week of road-tripping usually clears the
          break-even; for daily driving on home charging, they mostly don&apos;t pay.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="by-network">Cost per 100 miles by network</H2>
        <P>
          What each network costs to drive 100 miles in the {evName(ev)}, a representative mid-size
          EV at {ev.efficiencyMilesPerKwh.toFixed(2)} mi/kWh. Reference rates for {PRICING_YEAR}.
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Cost per 100 miles by charging network</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th scope="col" className="py-2 pr-4 font-medium">Network</th>
                <th scope="col" className="py-2 pr-4 font-medium">Rate</th>
                <th scope="col" className="py-2 pr-4 font-medium">Per 100 mi</th>
                <th scope="col" className="py-2 font-medium">500 mi, all at this rate</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--border)]">
                <th scope="row" className="py-2 pr-4 font-normal text-left text-[var(--text)]">
                  Home charging (reference)
                </th>
                <td className="py-2 pr-4 text-[var(--text-muted)]">{perKwh(HOME_RATE)}</td>
                <td className="py-2 pr-4 text-[var(--text)]">
                  {usd(costPer100Miles(ev, HOME_RATE))}
                </td>
                <td className="py-2 text-[var(--text-muted)]">
                  {usd(energyCostForMiles(ev, 500, HOME_RATE))}
                </td>
              </tr>
              {networks.map((n) => (
                <tr key={n.slug} className="border-t border-[var(--border)]">
                  <th scope="row" className="py-2 pr-4 font-normal text-left">
                    <A href={`/charging-networks/${n.slug}`}>{n.name}</A>
                  </th>
                  <td className="py-2 pr-4 text-[var(--text-muted)]">{perKwh(n.pricePerKwh)}</td>
                  <td className="py-2 pr-4 text-[var(--text)]">
                    {usd(costPer100Miles(ev, n.pricePerKwh))}
                  </td>
                  <td className="py-2 text-[var(--text-muted)]">
                    {usd(energyCostForMiles(ev, 500, n.pricePerKwh))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          The home-charging row is there for scale, not as an option on the road. Note also that the
          municipal entries at the top are real rates but geographically tiny — you cannot plan a
          cross-country trip around {networks.filter((n) => n.kind === "municipal").map((n) => n.name).join(" or ")}.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="hidden-costs">Costs that don&apos;t show up in the per-kWh rate</H2>
        <P>
          <strong className="text-[var(--text)]">Idle fees.</strong> Most networks charge by the
          minute once your car is done and still plugged in. It is the easiest money to waste on a
          road trip: walk away for a 40-minute lunch after a 20-minute charge and you can pay more
          in idle fees than for the electricity.
        </P>
        <P>
          <strong className="text-[var(--text)]">Session and connection fees.</strong> Some operators
          add a flat charge per session. These make short top-ups disproportionately expensive and
          quietly reward fewer, longer stops — the opposite of what the charging curve wants.
        </P>
        <P>
          <strong className="text-[var(--text)]">Per-minute billing.</strong> A handful of networks
          and most of the ones in states that historically barred non-utilities from selling
          electricity bill by time rather than energy. That penalizes any car that charges slowly,
          and it penalizes charging past 80% brutally. WattWay models per-kWh pricing and can&apos;t
          represent per-minute networks accurately, so treat those stations with suspicion.
        </P>
        <P>
          <strong className="text-[var(--text)]">Detours.</strong> A charger 12 miles off the
          highway costs 24 miles of range plus about 25 minutes of driving. At highway efficiency
          that is roughly {usd((24 / ev.efficiencyMilesPerKwh) * avgCommercial)} of electricity
          before you have bought anything — often more than the saving that lured you off the
          interstate. WattWay prices detours explicitly for exactly this reason.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="cutting-cost">How to actually spend less</H2>
        <P>
          <strong className="text-[var(--text)]">Arrive low, leave at 80%.</strong> The cheapest
          energy is the energy you buy in the fat part of the charging curve. Rolling in at 10-15%
          and leaving at 80% keeps you there and minimizes both time and idle exposure.
        </P>
        <P>
          <strong className="text-[var(--text)]">Charge at home before you leave.</strong> The first{" "}
          {Math.round(fastChargeMiles(ev))} miles of the trip can come out of your driveway at{" "}
          {perKwh(HOME_RATE)} instead of {perKwh(avgCommercial)}. That is worth up to{" "}
          {usd(
            (fastChargeMiles(ev) / ev.efficiencyMilesPerKwh) * (avgCommercial - HOME_RATE)
          )}{" "}
          and costs nothing — though only on a trip long enough to actually spend that whole
          window. A trip shorter than {Math.round(fastChargeMiles(ev))} miles saves proportionally
          less, because you only avoid buying the energy you actually use.
        </P>
        <P>
          <strong className="text-[var(--text)]">Buy the membership for the month you travel.</strong>{" "}
          Subscribe before a long trip, cancel after. The fees are small and the discounts are real.
        </P>
        <P>
          <strong className="text-[var(--text)]">Slow down.</strong> Aerodynamic drag rises with the
          square of speed, so 75 mph can consume 15-20% more energy than 65 mph. On a 500-mile trip
          that is both money and, frequently, an entire extra charging stop.
        </P>
        <P>
          <strong className="text-[var(--text)]">Look further than the next charger.</strong>{" "}
          Stopping at whatever is closest when the battery gets low is how you end up paying premium
          rates at 8% state of charge with no alternative in reach. Scoring the chargers deep in
          what you can still reach — rather than taking the first one you pass — is the core of{" "}
          <A href="/guides/how-wattway-plans-your-trip">how WattWay plans a trip</A>.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="your-car">What it costs for your car specifically</H2>
        <P>
          Every vehicle in the database has its own page with the full network-by-network cost
          table, charge times at each stall power, and stop counts by trip length. A few to start
          from:
        </P>
        <ul className="grid sm:grid-cols-2 gap-2">
          {[...EV_DATABASE]
            .sort((a, b) => b.rangeMiles - a.rangeMiles)
            .slice(0, 6)
            .map((v) => (
              <li key={v.id}>
                <Link
                  href={evPath(v)}
                  className="block bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 hover:border-[var(--accent)] transition-colors"
                >
                  <span className="text-sm text-[var(--text)]">{evName(v)}</span>
                  <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                    {usd(costPer100Miles(v, avgCommercial))}/100 mi · {v.rangeMiles} mi range
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}

function HowItWorksGuide() {
  const ev = referenceEV();
  const networks = chargingNetworks();
  const cheapest = networks[0];

  return (
    <>
      <section className="space-y-3">
        <H2 id="problem">The problem it solves</H2>
        <P>
          Picking charging stops looks like a routing problem and is actually a cost problem with a
          routing constraint bolted on. You have a fixed distance, a battery that buys about{" "}
          {Math.round(fastChargeMiles(ev))} miles per charge in a typical mid-size EV, and dozens of
          candidate chargers along the way at prices that differ by more than{" "}
          {Math.round(
            (networks[networks.length - 1].pricePerKwh / cheapest.pricePerKwh - 1) * 100
          )}
          %. Any sequence that never runs the battery flat is a valid answer; most of them cost
          significantly more than the best one.
        </P>
        <P>
          Stopping at the first reachable charger every time is what makes it expensive: you
          regularly end up buying premium electricity because you are at 8% with nothing else in
          range. The stop that saves you money is frequently one you have to pass a closer charger
          to reach.
        </P>
        <P>
          <strong className="text-[var(--text)]">To be precise about what WattWay does:</strong> it
          is a greedy heuristic, not a global optimizer, and it narrows the field twice. At each
          step it works out how far the current charge can reach, then scores only the stations in
          the far {Math.round((1 - CANDIDATE_WINDOW) * 100)}% of that stretch — deliberately, to
          push toward fewer stops, though without guaranteeing the fewest — and commits to the
          best-scoring one without revisiting it. Two consequences worth knowing: a cheap charger sitting early in the reachable stretch
          is skipped rather than compared, and because whole stop sequences are never compared, a
          locally cheap stop that leads into an expensive stretch can still come out worse than the
          true optimum. In exchange it runs instantly in your browser and beats nearest-charger
          planning by a wide margin.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="steps">How WattWay does it</H2>
        <ol className="space-y-4 text-sm leading-relaxed text-[var(--text-muted)] list-decimal pl-5">
          <li>
            <strong className="text-[var(--text)]">Route the trip.</strong> Your origin,
            destination and any intermediate stops go to the Google Routes API, which returns the
            driving route geometry — honoring your ferry and toll preferences.
          </li>
          <li>
            <strong className="text-[var(--text)]">Find chargers along the corridor.</strong> The
            route is walked in segments and Open Charge Map is queried around each one. Segmenting
            matters: a single query centered on the route&apos;s midpoint returns dense results in
            the middle and nothing near the endpoints, which is exactly where a long trip needs
            options. Stations reported non-operational are dropped.
          </li>
          <li>
            <strong className="text-[var(--text)]">Price every candidate.</strong> Each station gets
            an effective cost per kWh: its published rate when it has one, otherwise the reference
            rate for its operator, minus any discount from memberships you hold. Networks you have
            excluded are removed outright.
          </li>
          <li>
            <strong className="text-[var(--text)]">Walk the route tracking state of charge.</strong>{" "}
            Starting from your actual battery level, the planner advances along the route keeping
            track of remaining energy, and considers only chargers it can genuinely reach with the
            reserve intact.
          </li>
          <li>
            <strong className="text-[var(--text)]">Score the far candidates and commit.</strong>{" "}
            Of everything still reachable, only stations in the far{" "}
            {Math.round((1 - CANDIDATE_WINDOW) * 100)}% of that range are scored, which pushes
            toward fewer stops without guaranteeing the fewest — within that window a cheaper or
            more reliable earlier station can still win on score and cost you an extra stop later.
            Each candidate is ranked on effective price per kWh, then adjusted by: a penalty per
            mile of detour (a charger off the highway costs range and time in both directions);
            {" "}{SLOW_CHARGER_PENALTY_TEXT}; a penalty for a single fast port, which means queue
            and outage risk; a small penalty for a station not recently verified on Open Charge
            Map; a penalty for arriving below 15% state of charge; a heavy penalty for an
            operator-less &quot;Supercharger&quot; record when the car isn&apos;t Tesla-eligible;
            and a mild preference for stations farther along the route. The best-scoring station
            wins and the planner moves on — it does not revisit that choice later.
          </li>
          <li>
            <strong className="text-[var(--text)]">Charge to 80% — or less, or more.</strong>{" "}
            Intermediate stops top up to 80% by default. When the next gap demands more, the planner
            charges higher and prices the taper honestly — energy above 80% arrives at roughly 40%
            of the rate below it. The last stop goes the other way: once the destination is in
            range it takes only the energy needed to get there, so it commonly leaves well under
            80%.
          </li>
          <li>
            <strong className="text-[var(--text)]">Repeat to the destination.</strong> The result is
            a full sequence of stops with per-stop cost, energy added, charge time, detour distance
            and arrival state of charge, plus totals for the trip.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <H2 id="assumptions">The assumptions, stated plainly</H2>
        <P>
          <strong className="text-[var(--text)]">A 10% floor.</strong> The planner never plans to
          arrive at a <em>charger</em> below 10%, and 10% is the default target for your
          destination. That reserve is what absorbs a closed charger, a headwind or a
          miscalculation. The one exception is deliberate: if you set an intermediate stop&apos;s
          own arrival target below 10%, the planner honors the number you typed rather than
          overriding it — so that stop can be planned below the reserve.
        </P>
        <P>
          <strong className="text-[var(--text)]">85% of nameplate power.</strong> No car holds its
          headline kW across a whole session — it ramps, holds, then tapers. Averaging 85% of peak
          below 80% state of charge is realistic; assuming the peak figure would promise charge
          times nobody achieves.
        </P>
        <P>
          <strong className="text-[var(--text)]">EPA efficiency.</strong> Range comes from the EPA
          figure for that exact spec generation. EPA numbers are optimistic at sustained highway
          speed, in cold weather, and with a loaded vehicle. If you know your car&apos;s real
          highway efficiency, the custom-vehicle option will plan against it instead — and it will
          plan better.
        </P>
        <P>
          <strong className="text-[var(--text)]">Community pricing data.</strong> Rates come from
          Open Charge Map where a station publishes one and from per-network reference rates
          otherwise. Both drift. The output is a comparison between options, not a bill.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="what-it-wont-do">What it deliberately doesn&apos;t do</H2>
        <P>
          It does not search for the globally cheapest stop sequence, and it does not consider
          chargers in the near {Math.round(CANDIDATE_WINDOW * 100)}% of what it can reach — see the
          caveats above.
          It does not model per-minute billing, idle fees or session fees, because those vary by
          site and by how long you linger — things the planner cannot know. It does not check live
          stall availability, so a station shown as available may be occupied or broken when you
          arrive. It does not account for weather or elevation, both of which move real-world range
          more than most drivers expect. And it optimizes for cost, not arrival time: if you want
          the fastest trip rather than the cheapest one, it will not give you that.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="try-it">Try it on a real route</H2>
        <P>
          The abstract version is only so useful.{" "}
          <A href="/">Put in your own origin and destination</A>, pick your car, tick any
          memberships you hold, and see the actual stops. It is free, needs no account, and runs
          entirely in your browser.
        </P>
      </section>
    </>
  );
}

function FastChargingGuide() {
  const networks = chargingNetworks();
  const avg = networks.reduce((s, n) => s + n.pricePerKwh, 0) / networks.length;
  // By modeled 10-80% time, not nameplate kW — a 205 kWh truck at 350 kW takes
  // roughly twice as long as an 89 kWh car at 300 kW, so ranking on peak power
  // would contradict the time column right next to it.
  const fastCars = [...EV_DATABASE]
    .sort((a, b) => fastChargeMinutes(a) - fastChargeMinutes(b) || a.id.localeCompare(b.id))
    .slice(0, 8);

  return (
    <>
      <section className="space-y-3">
        <H2 id="curve">Why charging slows down as the battery fills</H2>
        <P>
          A DC fast charger does not deliver constant power. It ramps up, holds a peak for a while,
          then tapers — steeply. The battery&apos;s internal resistance rises as it fills, and
          pushing high current into a nearly-full lithium-ion pack degrades it, so the car&apos;s
          management system throttles the rate to protect it.
        </P>
        <P>
          The practical consequence: the last 20% of a charge can take as long as the first 60%. A
          car advertised at 350 kW might be down to 50 kW by the time it reaches 90%. That is why
          the standard road-trip session is 10% to 80% — you leave when the curve stops being worth
          waiting for.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="eighty-percent">The 80% rule</H2>
        <P>
          Charging to 100% on a road trip is almost always a mistake. Two shorter stops beat one
          long one, because the time spent above 80% buys fewer miles per minute than simply
          driving to the next charger and charging in the fat part of the curve again.
        </P>
        <P>
          The exception is a genuine charging desert. If the next reliable station is 180 miles away
          and your car does 200 on a full pack, you sit there and wait out the taper. That is the
          one case where charging to 90-100% is correct, and it is why WattWay charges past 80% only
          when the following gap actually requires it.
        </P>
        <P>
          There is a battery-longevity argument for the 80% rule too, but on a road trip the time
          argument alone settles it.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="kw">What the kW numbers mean</H2>
        <P>
          Charging speed is capped by the <em>lower</em> of two figures: what the stall can deliver
          and what the car will accept. A 350 kW stall does nothing extra for a car that peaks at
          150 kW. A 50 kW stall throttles everything on the lot, no matter what it&apos;s plugged
          into.
        </P>
        <P>
          Rough tiers: 50 kW is a legacy fast charger and a road-trip liability; 150 kW is the
          modern baseline; 250-350 kW is what current high-voltage architectures can exploit. The
          fastest-charging vehicles in the database:
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Fastest-charging EVs by peak DC power</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th scope="col" className="py-2 pr-4 font-medium">Vehicle</th>
                <th scope="col" className="py-2 pr-4 font-medium">Peak</th>
                <th scope="col" className="py-2 pr-4 font-medium">10-80% time</th>
                <th scope="col" className="py-2 font-medium">Miles added</th>
              </tr>
            </thead>
            <tbody>
              {fastCars.map((v) => (
                <tr key={v.id} className="border-t border-[var(--border)]">
                  <th scope="row" className="py-2 pr-4 font-normal text-left">
                    <A href={evPath(v)}>{evName(v)}</A>
                  </th>
                  <td className="py-2 pr-4 text-[var(--text-muted)]">{v.maxChargekW} kW</td>
                  <td className="py-2 pr-4 text-[var(--text)]">
                    {Math.round(fastChargeMinutes(v))} min
                  </td>
                  <td className="py-2 text-[var(--text-muted)]">
                    {Math.round(fastChargeMiles(v))} mi
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          Those times are best cases — full-power stall, warm battery, and the car averaging about
          85% of its peak across the window. Real sessions commonly run half again to twice as long,
          especially in cars whose curves taper early. Peak kW is also a poor predictor of real
          charging speed on its own: a big efficient pack at 150 kW can add more miles per minute
          than a thirsty one at 250 kW. Miles added per minute is the number that matters, and it is
          shown on every <A href="/ev">vehicle page</A>, alongside the raw time.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="preconditioning">Preconditioning: the free speed most drivers skip</H2>
        <P>
          A cold battery charges slowly — sometimes at a third of its rated speed. Most modern EVs
          will pre-warm the pack on the way to a charger if you navigate to it using the car&apos;s
          own navigation, and many will not do it if you simply drive there. In winter this is the
          single largest difference between a 25-minute stop and a 50-minute one, and it costs
          nothing but remembering to set the destination in the car.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="cost">Speed and cost are different questions</H2>
        <P>
          A faster charger is not a cheaper one — at roughly {perKwh(avg)} on average, you buy the
          same kilowatt-hours either way. What speed buys is time, and what a cheaper network buys
          is money. WattWay weighs both: it penalizes stalls under 150 kW because the time cost is
          real, but it will not pay a large premium for speed you don&apos;t need. See{" "}
          <A href="/guides/ev-road-trip-charging-cost">what road-trip charging costs</A> for the
          money side, and{" "}
          <A href="/charging-networks">network pricing</A> for the full spread.
        </P>
      </section>
    </>
  );
}

export const GUIDES: Guide[] = [
  {
    ...meta("ev-road-trip-charging-cost"),
    intro: (
      <p>
        Fast charging on the road costs several times what the same energy costs in your driveway,
        and which network you happen to stop at moves the bill more than anything about your car.
        Here is where the money actually goes, with the numbers.
      </p>
    ),
    body: <CostGuide />,
  },
  {
    ...meta("how-wattway-plans-your-trip"),
    intro: (
      <p>
        No black box. This is exactly how WattWay turns an origin and a destination into a sequence
        of charging stops, what it optimizes for, and every assumption baked into the answer.
      </p>
    ),
    body: <HowItWorksGuide />,
    schema: {
      "@type": "HowTo",
      name: "How to plan a cost-optimized EV road trip",
      description:
        "Plan an EV road trip that minimizes total charging cost by routing the trip, finding " +
        "chargers along the corridor, pricing each against your memberships, and choosing stops on " +
        "total cost rather than proximity.",
      step: [
        { "@type": "HowToStep", name: "Route the trip", text: "Compute the driving route between origin, destination and any intermediate stops, honoring ferry and toll preferences." },
        { "@type": "HowToStep", name: "Find chargers along the corridor", text: "Query charger data in segments along the route rather than from a single midpoint, so the endpoints of a long route get options too, and drop stations reported non-operational." },
        { "@type": "HowToStep", name: "Price every candidate", text: "Give each station an effective cost per kWh from its published rate or its operator's reference rate, minus discounts from memberships you hold, and remove excluded networks." },
        { "@type": "HowToStep", name: "Track state of charge along the route", text: "Advance along the route from your actual starting battery level, considering only chargers reachable with the reserve intact." },
        { "@type": "HowToStep", name: "Score the far candidates on total cost", text: `Of the stations still reachable, keep only those in the far ${Math.round((1 - CANDIDATE_WINDOW) * 100)}% of that range, which pushes toward fewer stops without guaranteeing the fewest. Rank those candidates on effective price per kWh, adjusted by penalties for detour distance, for stalls below 150 kW (doubled below 100 kW), for a single fast port, for a station not recently verified, for arriving below 15% state of charge, and for an operator-less Supercharger record when the vehicle is not Tesla-eligible, plus a mild preference for stations farther along the route. Commit to the best without revisiting it.` },
        { "@type": "HowToStep", name: "Charge to 80 percent", text: "Top up to 80% at intermediate stops, charging higher only when the next gap requires it, because charging past 80% is disproportionately slow; the final stop takes only the energy the destination needs and usually leaves below 80%." },
        { "@type": "HowToStep", name: "Repeat to the destination", text: "Continue until the destination is reachable, producing per-stop cost, energy, charge time, detour and arrival state of charge." },
      ],
    },
  },
  {
    ...meta("dc-fast-charging-explained"),
    intro: (
      <p>
        Charging speed is the least intuitive part of driving an EV long distance. It is not
        constant, the advertised kW rarely describes your experience, and the reason everyone stops
        at 80% is arithmetic rather than superstition.
      </p>
    ),
    body: <FastChargingGuide />,
  },
];

export function getGuideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
