"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { EVModel, TripPlan, Waypoint } from "@/lib/types";
import { EV_DATABASE, DEFAULT_NETWORK_PRICES, getEVById } from "@/lib/evDatabase";
import { planTrip } from "@/lib/optimizer";
import TripForm from "@/components/TripForm";
import EVSelector from "@/components/EVSelector";
import MembershipSelector from "@/components/MembershipSelector";
import NetworkExcluder from "@/components/NetworkExcluder";
import ChargingPlan from "@/components/ChargingPlan";
import { getMembershipById } from "@/lib/memberships";
import { isIonnaEligible, ionnaDiscountRate, ionnaBonusActive } from "@/lib/ionnaDiscount";
import { useBusyCursor } from "@/lib/useBusyCursor";
import { track, countPlan } from "@/lib/analytics";
import SiteHeader from "@/components/SiteHeader";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export interface ViaStop {
  id: number;
  wp: Waypoint | null;
  arrivalSoC?: number; // min battery % desired on arrival at this stop
  rechargedHere?: boolean; // car is fully recharged here (hotel / destination / L2)
}

type PanelMode = "left" | "right" | "floating";

/** "Austin, TX, USA" -> "Austin, TX". Keeps the collapsed route summary on one
 *  line at phone widths; falls back to the full string if there's nothing to
 *  trim. The country tail is the only reliably droppable part — street
 *  addresses keep their leading components. */
function shortAddress(address: string | undefined): string {
  if (!address) return "";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return address;
  return parts.slice(-3, -1).join(", ");
}

// One-time migration for saved car ids whose meaning changed when the DB was
// split by generation. Legacy ids that were labeled as the latest model year in
// the old release are remapped to the current-generation profile so returning
// users keep planning with accurate specs. Applied once, then a flag is set so
// later (post-split) selections of the older-generation profiles still stick.
const EV_ID_MIGRATIONS: Record<string, string> = {
  "tesla-model-3-lr": "tesla-model-3-lr-highland",
  "tesla-model-y-lr": "tesla-model-y-lr-2024",
  "vw-id4-pro": "vw-id4-pro-2024",
};

// Ids for profiles that were removed outright because the config never existed
// (e.g. a phantom trim) and are NOT reused by any current profile. Unlike the
// generation-split remaps above, these are always safe to apply and must NOT be
// gated on the one-time migration flag — returning users already have that flag
// set, so a gated remap would never reach them and they'd silently fall back to
// the default car. Applied unconditionally on every load.
const REMOVED_EV_ID_REMAP: Record<string, string> = {
  // Phantom 88.3 kWh IONIQ 9 "SR" (no US config) -> the real base S RWD.
  "hyundai-ioniq9-std": "hyundai-ioniq9-lr-rwd",
};

export default function Home() {
  const [origin, setOrigin] = useState<Waypoint | null>(null);
  const [destination, setDestination] = useState<Waypoint | null>(null);
  const [vias, setVias] = useState<ViaStop[]>([]);
  const [ev, setEV] = useState<EVModel>(getEVById("tesla-model-y-lr-2024") ?? EV_DATABASE[0]); // current Model Y default

  const [membershipIds, setMembershipIds] = useState<string[]>([]);
  const [excludedNetworks, setExcludedNetworks] = useState<string[]>([]);
  // Opt-in for the Hyundai/Genesis Ionna Plug & Charge discount. Only applied
  // when the selected car is also eligible (see ionnaEligible below).
  const [ionnaDiscount, setIonnaDiscount] = useState(false);

  // Remember the user's car and memberships across visits.
  // Storage can throw in restricted contexts — persistence is best-effort.
  useEffect(() => {
    try {
      // One-time remap of legacy ids to their current-generation profile. The
      // migrated flag is set on first run regardless of whether a car is saved,
      // so a later fresh selection of an older-generation profile (which reuses a
      // legacy id) is not remapped on the next load.
      const alreadyMigrated = localStorage.getItem("wattway.evIdMigrated");
      let savedId = localStorage.getItem("wattway.evId");
      // Always remap ids for removed/phantom profiles, regardless of the
      // one-time flag (those ids are never reused, so there's no risk of
      // bumping a deliberately re-selected legacy profile).
      if (savedId && REMOVED_EV_ID_REMAP[savedId]) {
        savedId = REMOVED_EV_ID_REMAP[savedId];
        try { localStorage.setItem("wattway.evId", savedId); } catch { /* best-effort */ }
      }
      if (savedId && !alreadyMigrated && EV_ID_MIGRATIONS[savedId]) {
        savedId = EV_ID_MIGRATIONS[savedId];
        try { localStorage.setItem("wattway.evId", savedId); } catch { /* best-effort */ }
      }
      if (!alreadyMigrated) {
        try { localStorage.setItem("wattway.evIdMigrated", "1"); } catch { /* best-effort */ }
      }
      if (savedId === "custom") {
        // A user-entered vehicle: restore the full spec object.
        const raw = localStorage.getItem("wattway.customEv");
        if (raw) {
          const c = JSON.parse(raw);
          if (c && typeof c.batteryKwh === "number" && typeof c.rangeMiles === "number") {
            setEV({ ...c, id: "custom", make: "Custom" });
          }
        }
      } else if (savedId) {
        const saved = getEVById(savedId);
        if (saved) setEV(saved);
      }
      const savedMemberships = localStorage.getItem("wattway.memberships");
      if (savedMemberships) {
        const ids = JSON.parse(savedMemberships);
        if (Array.isArray(ids)) setMembershipIds(ids.filter((id) => getMembershipById(id)));
      }
      const savedExcluded = localStorage.getItem("wattway.excludedNetworks");
      if (savedExcluded) {
        const nets = JSON.parse(savedExcluded);
        if (Array.isArray(nets)) setExcludedNetworks(nets.filter((n) => typeof n === "string"));
      }
      if (localStorage.getItem("wattway.ionnaDiscount") === "1") setIonnaDiscount(true);
      const savedPanel = localStorage.getItem("wattway.panel");
      if (savedPanel) {
        const p = JSON.parse(savedPanel);
        if (p.mode === "left" || p.mode === "right" || p.mode === "floating") setPanelMode(p.mode);
        if (typeof p.x === "number" && typeof p.y === "number") {
          setPanelPos({
            x: Math.min(Math.max(0, p.x), window.innerWidth - 200),
            y: Math.min(Math.max(0, p.y), window.innerHeight - 100),
          });
        }
      }
      const savedRouteOpts = localStorage.getItem("wattway.routeOpts");
      if (savedRouteOpts) {
        const o = JSON.parse(savedRouteOpts);
        if (typeof o.avoidFerries === "boolean") setAvoidFerries(o.avoidFerries);
        if (typeof o.avoidTolls === "boolean") setAvoidTolls(o.avoidTolls);
      }
    } catch { /* storage unavailable or corrupt — run without persistence */ }
  }, []);

  const handleEVChange = useCallback((model: EVModel) => {
    setEV(model);
    try {
      localStorage.setItem("wattway.evId", model.id);
      // Custom vehicles aren't in the DB, so persist the whole spec object.
      if (model.id === "custom") localStorage.setItem("wattway.customEv", JSON.stringify(model));
    } catch { /* best-effort */ }
  }, []);

  const handleMembershipsChange = useCallback((ids: string[]) => {
    setMembershipIds(ids);
    try { localStorage.setItem("wattway.memberships", JSON.stringify(ids)); } catch { /* best-effort */ }
  }, []);

  const handleExcludedNetworksChange = useCallback((nets: string[]) => {
    setExcludedNetworks(nets);
    try { localStorage.setItem("wattway.excludedNetworks", JSON.stringify(nets)); } catch { /* best-effort */ }
  }, []);

  const handleIonnaDiscountChange = useCallback((on: boolean) => {
    setIonnaDiscount(on);
    try { localStorage.setItem("wattway.ionnaDiscount", on ? "1" : "0"); } catch { /* best-effort */ }
  }, []);
  const [startingSoC, setStartingSoC] = useState(80);
  const [arrivalSoC, setArrivalSoC] = useState(10);
  // Route options. Ferries are avoided by default so "driving" routes never
  // cross open water (e.g. the Lake Michigan car ferry); tolls are allowed.
  const [avoidFerries, setAvoidFerries] = useState(true);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const persistRouteOpts = useCallback((ferries: boolean, tolls: boolean) => {
    try {
      localStorage.setItem("wattway.routeOpts", JSON.stringify({ avoidFerries: ferries, avoidTolls: tolls }));
    } catch { /* best-effort */ }
  }, []);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  // Captured at plan time so the destination card can't be relabeled by
  // input changes made after the plan was computed
  const [plannedDestAddress, setPlannedDestAddress] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once a plan comes back on a phone, the trip form collapses to a one-line
  // route summary so the results own the panel; tapping it reopens the whole
  // form. Desktop never collapses — the docked column has room for both.
  // Collapsing is CSS-only (`hidden`): unmounting TripForm would blank the
  // uncontrolled Google autocomplete widgets, same reason the panel never
  // remounts on a dock change.
  const [formCollapsed, setFormCollapsed] = useState(false);

  // Wait cursor while a route is being calculated
  useBusyCursor(loading);

  // Panel docking: right (default), left, or floating with a saved position
  const [panelMode, setPanelMode] = useState<PanelMode>("right");
  const [panelPos, setPanelPos] = useState({ x: 80, y: 60 });
  // On phones the dock/float modes don't apply — the panel and map stack
  // vertically instead (see the layout below), so track a mobile breakpoint.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const panelPosRef = useRef(panelPos);
  panelPosRef.current = panelPos;

  const savePanel = useCallback((mode: PanelMode, pos: { x: number; y: number }) => {
    try { localStorage.setItem("wattway.panel", JSON.stringify({ mode, ...pos })); } catch { /* best-effort */ }
  }, []);

  const handlePanelMode = useCallback((mode: PanelMode) => {
    setPanelMode(mode);
    savePanel(mode, panelPosRef.current);
  }, [savePanel]);

  const startPanelDrag = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const origin = { ...panelPosRef.current };
    const onMove = (ev: PointerEvent) => {
      setPanelPos({
        x: Math.min(Math.max(0, origin.x + ev.clientX - start.x), window.innerWidth - 200),
        y: Math.min(Math.max(0, origin.y + ev.clientY - start.y), window.innerHeight - 80),
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      savePanel("floating", panelPosRef.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [savePanel]);

  const handlePlan = useCallback(async () => {
    if (!origin || !destination) return;
    setLoading(true);
    setError(null);
    try {
      const result = await planTrip({
        origin,
        destination,
        waypoints: vias
          .map((v): Waypoint | null =>
            v.wp
              ? { ...v.wp, arrivalSoC: v.arrivalSoC, rechargedHere: v.rechargedHere }
              : null
          )
          .filter((w): w is Waypoint => w !== null),
        ev,
        startingSoC,
        targetArrivalSoC: arrivalSoC,
        networkPrices: DEFAULT_NETWORK_PRICES,
        memberships: membershipIds
          .map(getMembershipById)
          .filter((m): m is NonNullable<typeof m> => m !== undefined),
        avoidFerries,
        avoidTolls,
        excludedNetworks,
        ionnaDiscountFraction:
          ionnaDiscount && isIonnaEligible(ev) ? ionnaDiscountRate() : 0,
      });
      setPlan(result);
      setPlannedDestAddress(destination.address);
      if (isMobile) setFormCollapsed(true);
      // Real "plans planned" signal for the usage report. Before this, plans
      // were inferred from Routes API call counts, which double-count retries
      // and miss nothing-but-also-tell-nothing about failures. Aggregate,
      // non-identifying params only — no addresses or coordinates.
      // Counted twice on purpose, because each source has a blind spot the
      // other covers: GA4 carries the detail but dies to ad blockers, while the
      // same-origin beacon is bare but unblockable.
      countPlan();
      track("plan_trip", {
        stops: result.stops.length,
        distance_miles: Math.round(result.routeDistanceMiles),
        via_count: vias.filter((v) => v.wp).length,
        ev_id: ev.id,
        plan_incomplete: result.planIncomplete,
        // Ionna discount applied this plan: 0 = off/ineligible, 0.1 or 0.2 = rate.
        // Measures adoption of the Hyundai/Genesis discount feature; non-identifying.
        ionna_discount: ionnaDiscount && isIonnaEligible(ev) ? ionnaDiscountRate() : 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      track("plan_trip_error");
    } finally {
      setLoading(false);
    }
  }, [origin, destination, vias, ev, startingSoC, arrivalSoC, membershipIds, avoidFerries, avoidTolls, excludedNetworks, ionnaDiscount, isMobile]);

  // A custom vehicle with a zero/blank battery or range would make the route
  // math divide by zero, so require positive specs before planning.
  const evValid =
    ev.batteryKwh > 0 && ev.rangeMiles > 0 && ev.efficiencyMilesPerKwh > 0 && ev.maxChargekW > 0;
  const canPlan = origin && destination && !loading && evValid;

  // Single persistent panel element moved via CSS (order / fixed positioning)
  // so TripForm never remounts — remounting would blank the uncontrolled
  // Google autocomplete widgets even though the trip state survives.
  // Floating is a desktop-only power feature; on phones the panel always stacks
  // under the map (see below), so coerce the effective mode to a docked one.
  const floating = panelMode === "floating" && !isMobile;
  const panelClass = floating
    ? "fixed z-20 w-[24rem] max-h-[88vh] flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
    : [
        // Mobile: full-width, stacked below the map (order-2), takes the
        // remaining height and scrolls. Desktop: fixed-width docked column.
        "w-full md:max-w-sm flex flex-col bg-[var(--surface)] overflow-hidden",
        "order-2 flex-1 min-h-0 md:flex-none md:min-h-0",
        "border-t md:border-t-0 border-[var(--border)]",
        panelMode === "left" ? "md:order-1 md:border-r" : "md:order-3 md:border-l",
      ].join(" ");

  // Rendered twice — in flow on desktop, in the phone's pinned footer — so the
  // primary action is always reachable in both the expanded and collapsed
  // states. Once a plan exists it drops to an outlined button: the results are
  // already on screen and a full-strength green block competes with them.
  const planButton = (
    <button
      onClick={handlePlan}
      disabled={!canPlan}
      className={`w-full py-3 rounded-xl font-semibold text-sm transition-all
        active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100
        ${plan && !loading
          ? "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--text-muted)]"
          : "bg-[var(--accent)] text-black hover:opacity-90"}`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          Planning route…
        </span>
      ) : plan ? (
        "⚡ Re-plan trip"
      ) : (
        "⚡ Find Cheapest Route"
      )}
    </button>
  );

  const panel = (
    <div
      className={panelClass}
      style={floating ? { left: panelPos.x, top: panelPos.y } : undefined}
    >
      {/* Header — drag handle when floating */}
      <div
        className={`px-5 py-2.5 md:py-4 border-b border-[var(--border)] shrink-0 ${floating ? "cursor-move select-none" : ""}`}
        onPointerDown={floating ? startPanelDrag : undefined}
      >
          <div className="flex items-center gap-2">
            {/* The brand lives in the top menubar; this is the planner page's
                own H1. The visible text is descriptive and the sr-only tail
                keeps the keyword-rich phrasing for search/AI crawlers. */}
            <h1 className="text-base md:text-lg font-bold text-[var(--text)]">
              Plan your EV road trip
              <span className="sr-only">
                {" "}— WattWay cost-optimized charging planner
              </span>
            </h1>
            <div className="ml-auto hidden md:flex items-center gap-1">
              {([["left", "◧", "Dock left"], ["floating", "❐", "Float (drag by header)"], ["right", "◨", "Dock right"]] as const).map(([mode, icon, label]) => (
                <button
                  key={mode}
                  title={label}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => handlePanelMode(mode)}
                  className={`px-1.5 py-0.5 rounded text-sm transition-colors ${panelMode === mode ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Cost-optimized EV trip planner · by{" "}
            <a
              href="https://thesaltykorean.com"
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              className="underline hover:text-[var(--accent)] transition-colors"
            >
              TheSaltyKorean
            </a>
          </p>
          {/* Donate moved to the top menubar (components/SiteHeader) — as a
              full-width block here it pushed the form below the fold on a
              phone, and it is now visible on every page instead of just this
              one. */}
        </div>

        {/* Form + results scroll together */}
        <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-5">
          {/* Collapsed route summary — the expanded card's twin (same border,
              radius and origin marker), so it reads as the card folding shut
              rather than a different screen. */}
          {formCollapsed && (
            <button
              onClick={() => setFormCollapsed(false)}
              aria-expanded={false}
              className="flex items-center gap-2.5 w-full h-12 px-3 border border-[var(--border)] rounded-xl bg-[var(--surface-2)] text-left hover:border-[var(--text-muted)] transition-colors"
            >
              <span className="w-2.5 h-2.5 shrink-0 rounded-full border-2 border-[var(--accent)]" aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[var(--text)]">
                {shortAddress(origin?.address)} → {shortAddress(destination?.address)}
              </span>
              <span className="shrink-0 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                Edit
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
          )}

          {/* CSS-hidden, never unmounted: the Google autocomplete widgets are
              uncontrolled and lose their text if React drops them. */}
          <div className={`space-y-5 ${formCollapsed ? "hidden" : ""}`}>
          <TripForm
            origin={origin}
            destination={destination}
            vias={vias}
            startingSoC={startingSoC}
            arrivalSoC={arrivalSoC}
            onOriginChange={setOrigin}
            onDestinationChange={setDestination}
            onSwap={() => {
              setOrigin(destination);
              setDestination(origin);
              // A→B→C→D reversed is D→C→B→A: intermediate stops flip too
              setVias([...vias].reverse());
            }}
            onViasChange={setVias}
            onSoCChange={setStartingSoC}
            onArrivalSoCChange={setArrivalSoC}
            avoidFerries={avoidFerries}
            avoidTolls={avoidTolls}
            onAvoidFerriesChange={(v) => { setAvoidFerries(v); persistRouteOpts(v, avoidTolls); }}
            onAvoidTollsChange={(v) => { setAvoidTolls(v); persistRouteOpts(avoidFerries, v); }}
          />
          <EVSelector value={ev} onChange={handleEVChange} />
          <MembershipSelector selected={membershipIds} onChange={handleMembershipsChange} />
          {isIonnaEligible(ev) && (
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ionnaDiscount}
                onChange={(e) => handleIonnaDiscountChange(e.target.checked)}
                className="mt-0.5 accent-[var(--accent)] w-4 h-4 shrink-0"
              />
              <span className="text-xs leading-relaxed text-[var(--text-muted)]">
                <span className="font-medium text-[var(--text)]">
                  Ionna discount — {ionnaBonusActive() ? "20%" : "10%"} off
                </span>{" "}
                on Ionna stations for eligible Hyundai/Genesis owners.
                {ionnaBonusActive() && " Includes the +10% bonus through Sep 30, 2026."}{" "}
                Requires MyHyundai/Genesis Plug &amp; Charge or in-app charging — not
                a credit-card tap at the stall.
              </span>
            </label>
          )}
          <NetworkExcluder excluded={excludedNetworks} onChange={handleExcludedNetworksChange} />

          </div>

          {/* Desktop keeps the button in flow; the phone gets it as a real
              panel footer below (a `sticky` element here would drift up into
              the middle of the panel once the form collapses, since sticky
              only holds an element whose natural position is off-screen). */}
          <div className="hidden md:block">{planButton}</div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Results */}
        <div className="px-5 pb-5">
          {plan ? (
            <ChargingPlan plan={plan} startingSoC={startingSoC} destinationAddress={plannedDestAddress} />
          ) : (
            !loading && (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <p className="text-3xl mb-3">🗺️</p>
                <p className="text-sm font-medium text-[var(--text)]">
                  Plan your EV trip
                </p>
                <p className="text-xs mt-1 leading-relaxed">
                  Enter a starting point and destination to find the cheapest
                  charging stops along the way.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  {[
                    ["💰", "Lowest cost", "Finds cheapest $/kWh along route"],
                    ["🔋", "Smart stops", "Avoids range anxiety with SoC tracking"],
                    ["⏱️", "Time-aware", "Penalizes long detours"],
                  ].map(([icon, title, desc]) => (
                    <div
                      key={title}
                      className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-2.5"
                    >
                      <p className="text-lg mb-1">{icon}</p>
                      <p className="font-medium text-[var(--text)]">{title}</p>
                      <p className="text-[var(--text-muted)] mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer: reference-content nav + legal disclaimer. The nav is also how
            crawlers reach the static /ev, /charging-networks, /guides and /faq
            pages — the planner itself renders nothing indexable, so without
            these links that content would be orphaned from the home page. */}
        <div className="px-5 pb-5 pt-4 border-t border-[var(--border)] space-y-3">
          <nav aria-label="Reference" className="text-[11px] text-[var(--text-muted)]">
            <p className="font-medium text-[var(--text)] mb-1.5">Charging cost reference</p>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/ev"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="underline hover:text-[var(--accent)] transition-colors"
                >
                  EV charging cost &amp; range database
                </Link>{" "}
                — every model&apos;s cost per charge
              </li>
              <li>
                <Link
                  href="/charging-networks"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="underline hover:text-[var(--accent)] transition-colors"
                >
                  Charging network prices
                </Link>{" "}
                — what each network costs per kWh
              </li>
              <li>
                <Link
                  href="/guides/ev-road-trip-charging-cost"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="underline hover:text-[var(--accent)] transition-colors"
                >
                  What an EV road trip costs
                </Link>{" "}
                — and how to pay less
              </li>
              <li>
                <Link
                  href="/guides/how-wattway-plans-your-trip"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="underline hover:text-[var(--accent)] transition-colors"
                >
                  How WattWay picks your stops
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="underline hover:text-[var(--accent)] transition-colors"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </nav>
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            <a
              href="/legal"
              onPointerDown={(e) => e.stopPropagation()}
              className="underline hover:text-[var(--accent)] transition-colors"
            >
              Legal Disclaimer
            </a>{" "}
            · because{" "}
            <a
              href="https://www.reddit.com/user/tuctrohs"
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              className="underline hover:text-[var(--accent)] transition-colors"
            >
              u/tuctrohs
            </a>{" "}
            is stupid and doesn&apos;t understand what an estimate is
          </p>
        </div>

        </div>

        {/* Phone-only pinned footer: a sibling of the scroll area, so the
            primary action holds the bottom of the panel whether the form is
            expanded or collapsed. Desktop renders the button in flow instead. */}
        <div className="md:hidden shrink-0 px-5 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
          {planButton}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <SiteHeader />
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
        {panel}
        {/* Map: on mobile a fixed slice of the viewport at the top so it's
            always clearly visible; on desktop it fills the remaining width. */}
        <div className="order-1 md:order-2 relative w-full h-[30vh] shrink-0 md:h-auto md:flex-1 md:shrink border-b md:border-b-0 border-[var(--border)]">
          <MapView plan={plan} />
        </div>
      </div>
    </div>
  );
}
