"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { EVModel, TripPlan, Waypoint } from "@/lib/types";
import { EV_DATABASE, DEFAULT_NETWORK_PRICES, getEVById } from "@/lib/evDatabase";
import { planTrip } from "@/lib/optimizer";
import TripForm from "@/components/TripForm";
import EVSelector from "@/components/EVSelector";
import MembershipSelector from "@/components/MembershipSelector";
import ChargingPlan from "@/components/ChargingPlan";
import { getMembershipById } from "@/lib/memberships";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export interface ViaStop {
  id: number;
  wp: Waypoint | null;
}

type PanelMode = "left" | "right" | "floating";

export default function Home() {
  const [origin, setOrigin] = useState<Waypoint | null>(null);
  const [destination, setDestination] = useState<Waypoint | null>(null);
  const [vias, setVias] = useState<ViaStop[]>([]);
  const [ev, setEV] = useState<EVModel>(EV_DATABASE[1]); // Model Y default

  const [membershipIds, setMembershipIds] = useState<string[]>([]);

  // Remember the user's car and memberships across visits.
  // Storage can throw in restricted contexts — persistence is best-effort.
  useEffect(() => {
    try {
      const savedId = localStorage.getItem("wattway.evId");
      if (savedId) {
        const saved = getEVById(savedId);
        if (saved) setEV(saved);
      }
      const savedMemberships = localStorage.getItem("wattway.memberships");
      if (savedMemberships) {
        const ids = JSON.parse(savedMemberships);
        if (Array.isArray(ids)) setMembershipIds(ids.filter((id) => getMembershipById(id)));
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
    } catch { /* storage unavailable or corrupt — run without persistence */ }
  }, []);

  const handleEVChange = useCallback((model: EVModel) => {
    setEV(model);
    try { localStorage.setItem("wattway.evId", model.id); } catch { /* best-effort */ }
  }, []);

  const handleMembershipsChange = useCallback((ids: string[]) => {
    setMembershipIds(ids);
    try { localStorage.setItem("wattway.memberships", JSON.stringify(ids)); } catch { /* best-effort */ }
  }, []);
  const [startingSoC, setStartingSoC] = useState(80);
  const [arrivalSoC, setArrivalSoC] = useState(10);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  // Captured at plan time so the destination card can't be relabeled by
  // input changes made after the plan was computed
  const [plannedDestAddress, setPlannedDestAddress] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        waypoints: vias.map((v) => v.wp).filter((w): w is Waypoint => w !== null),
        ev,
        startingSoC,
        targetArrivalSoC: arrivalSoC,
        networkPrices: DEFAULT_NETWORK_PRICES,
        memberships: membershipIds
          .map(getMembershipById)
          .filter((m): m is NonNullable<typeof m> => m !== undefined),
      });
      setPlan(result);
      setPlannedDestAddress(destination.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [origin, destination, vias, ev, startingSoC, arrivalSoC, membershipIds]);

  const canPlan = origin && destination && !loading;

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
            Cost-optimized EV trip planner
          </p>
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
            onViasChange={setVias}
            onSoCChange={setStartingSoC}
            onArrivalSoCChange={setArrivalSoC}
          />
          <EVSelector value={ev.id} onChange={handleEVChange} />
          <MembershipSelector selected={membershipIds} onChange={handleMembershipsChange} />

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
