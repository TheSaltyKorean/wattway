"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { EVModel, TripPlan, Waypoint } from "@/lib/types";
import { EV_DATABASE, DEFAULT_NETWORK_PRICES, getEVById } from "@/lib/evDatabase";
import { planTrip } from "@/lib/optimizer";
import TripForm from "@/components/TripForm";
import EVSelector from "@/components/EVSelector";
import MembershipSelector from "@/components/MembershipSelector";
import NetworkExcluder from "@/components/NetworkExcluder";
import ChargingPlan from "@/components/ChargingPlan";
import { getMembershipById } from "@/lib/memberships";
import { useBusyCursor } from "@/lib/useBusyCursor";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export interface ViaStop {
  id: number;
  wp: Waypoint | null;
  arrivalSoC?: number; // min battery % desired on arrival at this stop
  rechargedHere?: boolean; // car is fully recharged here (hotel / destination / L2)
}

type PanelMode = "left" | "right" | "floating";

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

export default function Home() {
  const [origin, setOrigin] = useState<Waypoint | null>(null);
  const [destination, setDestination] = useState<Waypoint | null>(null);
  const [vias, setVias] = useState<ViaStop[]>([]);
  const [ev, setEV] = useState<EVModel>(getEVById("tesla-model-y-lr-2024") ?? EV_DATABASE[0]); // current Model Y default

  const [membershipIds, setMembershipIds] = useState<string[]>([]);
  const [excludedNetworks, setExcludedNetworks] = useState<string[]>([]);

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

  // Wait cursor while a route is being calculated
  useBusyCursor(loading);

  // Panel docking: right (default), left, or floating with a saved position
  const [panelMode, setPanelMode] = useState<PanelMode>("right");
  const [panelPos, setPanelPos] = useState({ x: 80, y: 60 });
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
      });
      setPlan(result);
      setPlannedDestAddress(destination.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [origin, destination, vias, ev, startingSoC, arrivalSoC, membershipIds, avoidFerries, avoidTolls, excludedNetworks]);

  // A custom vehicle with a zero/blank battery or range would make the route
  // math divide by zero, so require positive specs before planning.
  const evValid =
    ev.batteryKwh > 0 && ev.rangeMiles > 0 && ev.efficiencyMilesPerKwh > 0 && ev.maxChargekW > 0;
  const canPlan = origin && destination && !loading && evValid;

  // Single persistent panel element moved via CSS (order / fixed positioning)
  // so TripForm never remounts — remounting would blank the uncontrolled
  // Google autocomplete widgets even though the trip state survives.
  const panelClass =
    panelMode === "floating"
      ? "fixed z-20 w-[24rem] max-h-[88vh] flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
      : `w-full max-w-sm flex flex-col bg-[var(--surface)] overflow-hidden ${panelMode === "left" ? "order-1 border-r" : "order-3 border-l"} border-[var(--border)]`;

  const panel = (
    <div
      className={panelClass}
      style={panelMode === "floating" ? { left: panelPos.x, top: panelPos.y } : undefined}
    >
      {/* Header — drag handle when floating */}
      <div
        className={`px-5 py-4 border-b border-[var(--border)] shrink-0 ${panelMode === "floating" ? "cursor-move select-none" : ""}`}
        onPointerDown={panelMode === "floating" ? startPanelDrag : undefined}
      >
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h1 className="text-lg font-bold text-[var(--text)]">WattWay</h1>
            <div className="ml-auto flex items-center gap-1">
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
          <a
            href="https://venmo.com/u/TheSaltyKorean"
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className="neon-donate mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            Donate via Venmo
          </a>
        </div>

        {/* Form + results scroll together */}
        <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-5">
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
          <NetworkExcluder excluded={excludedNetworks} onChange={handleExcludedNetworksChange} />

          <button
            onClick={handlePlan}
            disabled={!canPlan}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all
              bg-[var(--accent)] text-black hover:opacity-90 active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Planning route…
              </span>
            ) : (
              "⚡ Find Cheapest Route"
            )}
          </button>

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

        {/* Footer: legal disclaimer at the bottom of the panel */}
        <div className="px-5 pb-5 pt-1 border-t border-[var(--border)]">
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            <a
              href="/legal"
              onPointerDown={(e) => e.stopPropagation()}
              className="underline hover:text-[var(--accent)] transition-colors"
            >
              Legal Disclaimer
            </a>{" "}
            · because u/tuctrohs is stupid and doesn&apos;t understand what an estimate is
          </p>
        </div>

        </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden relative">
      {panel}
      <div className="order-2 flex-1 relative">
        <MapView plan={plan} />
      </div>
    </div>
  );
}
