import { EV_DATABASE } from "./evDatabase";
import { chargingNetworks, perKwh } from "./seo";
import { CANDIDATE_WINDOW } from "./chargingMath";

export interface FAQ {
  q: string;
  a: string;
}

/**
 * The site-wide FAQ, as plain data.
 *
 * Kept free of JSX so both the /faq page and scripts/generate-llms.mjs can use
 * it — the generated corpus advertises that it contains every answer, and it
 * only actually does if the answers live somewhere Node can read without a
 * React runtime.
 */
export function siteFAQs(): FAQ[] {
  const networks = chargingNetworks();
  const cheapest = networks[0];
  const priciest = networks[networks.length - 1];
  const makes = new Set(EV_DATABASE.map((e) => e.make)).size;
  // Derived from the planner's own constant so the description can't drift.
  const farPct = Math.round((1 - CANDIDATE_WINDOW) * 100);
  const nearPct = Math.round(CANDIDATE_WINDOW * 100);

  return [
    {
      q: "What is WattWay?",
      a:
        "A free EV road-trip planner that optimizes for total charging cost. You give it an origin, " +
        "a destination and your car; it finds the cheapest workable sequence of charging stops " +
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
        "No and no. There is no sign-up, no login, no paywall and no account of any kind. The " +
        "planner runs entirely in your browser as a static site, with no application backend that " +
        "stores anything about you. There is one server-side piece — a counter: a successful plan " +
        "sends an empty same-origin beacon to /api/plan so the operator can see how often the tool " +
        "is used. That beacon has no body at all. Separately, if analytics is configured, Google " +
        "Analytics records a plan event — with its own cookie-based client and session ids. See " +
        "\"What does WattWay do with my data?\" below for exactly what each one collects.",
    },
    {
      q: "How does WattWay choose where to stop?",
      a:
        "It routes your trip, pulls chargers along the corridor in segments, then walks the route " +
        "keeping track of state of charge. At each step it works out how far the current charge " +
        `can reach and scores only the stations in the far ${farPct}% of that stretch — ` +
        "deliberately, so it stops as few times as possible — ranking them on effective price per " +
        "kWh after memberships, plus penalties for detour distance and for stalls under 150 kW, " +
        "then commits to the best one without revisiting it. Intermediate stops charge to 80% by " +
        "default because charging past that is disproportionately slow, going higher only when the " +
        "next gap demands it; the last stop takes only what the destination actually needs, so it " +
        "usually leaves well below 80%. Two limits follow from this: a cheap charger sitting early in the reachable " +
        `stretch (the near ${nearPct}%) is skipped rather than compared, and because whole stop ` +
        "sequences are never compared, this is a greedy heuristic rather than a global optimizer — " +
        "not guaranteed to find the theoretically cheapest plan, but it runs instantly and beats " +
        "nearest-charger planning by a wide margin.",
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
        `${EV_DATABASE.length} vehicle profiles across ${makes} makes, split by spec generation so a ` +
        `mid-cycle refresh with a different battery is a separate entry from the car it replaced. ` +
        `There is also a custom-vehicle option for entering your own usable battery, real-world ` +
        `range and peak charge rate — usually the better choice if you know your car's actual ` +
        `highway efficiency.`,
    },
    {
      q: "What does WattWay do with my data?",
      a:
        "It has nowhere to put it. Your car, memberships, excluded networks and custom specs live in " +
        "your browser's local storage. The origin and destination you type are sent to Google and " +
        "Open Charge Map to compute the route and find chargers, because that is the only way to " +
        "answer the question, and they are not retained by WattWay afterwards. Two things are " +
        "measured. First, an empty beacon to /api/plan on each successful plan — no body, no " +
        "content at all, just a count. Second, if analytics is configured for the deployment, a " +
        "Google Analytics 4 `plan_trip` event. WattWay attaches five fields to it: the number of " +
        "stops, the trip distance rounded to the nearest mile, how many intermediate stops you " +
        "added, the id of the vehicle profile you selected, and whether the plan came out " +
        "incomplete. No origin, destination, waypoint, address or coordinate is ever sent. " +
        "Those five are only what WattWay supplies, though — GA4 adds its own collection on top: " +
        "a pseudonymous client id stored in a cookie, a session id, the page URL and referrer, " +
        "your device, browser and language, and an approximate location derived from your IP " +
        "address. So a plan event is tied to your browser and session inside Google's data, even " +
        "though it carries no name, account or route from us. If you would rather not be counted, " +
        "any ad or tracking blocker stops the GA4 tag; the /api/plan beacon is same-origin and has " +
        "nothing in it to identify you.",
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
        "when the next charger is far enough that it has to — and it goes below, taking only what " +
        "is needed, at a final stop that already puts the destination in range.",
    },
  ];
}
