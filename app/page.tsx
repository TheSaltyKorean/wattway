"use client";
import { useState, useCallback, useEffect } from "react";
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

export default function Home() {
  const [origin, setOrigin] = useState<Waypoint | null>(null);
  const [destination, setDestination] = useState<Waypoint | null>(null);
  const [vias, setVias] = useState<ViaStop[]>([]);
  const [ev, setEV] = useState<EVModel>(EV_DATABASE[1]); // Model Y default

  const [membershipIds, setMembershipIds] = useState<string[]>([]);

  // Remember the user's car and memberships across visits
  useEffect(() => {
    const savedId = localStorage.getItem("wattway.evId");
    if (savedId) {
      const saved = getEVById(savedId);
      if (saved) setEV(saved);
    }
    const savedMemberships = localStorage.getItem("wattway.memberships");
    if (savedMemberships) {
      try {
        const ids = JSON.parse(savedMemberships);
        if (Array.isArray(ids)) setMembershipIds(ids.filter((id) => getMembershipById(id)));
      } catch { /* ignore corrupt state */ }
    }
  }, []);

  const handleEVChange = useCallback((model: EVModel) => {
    setEV(model);
    localStorage.setItem("wattway.evId", model.id);
  }, []);

  const handleMembershipsChange = useCallback((ids: string[]) => {
    setMembershipIds(ids);
    localStorage.setItem("wattway.memberships", JSON.stringify(ids));
  }, []);
  const [startingSoC, setStartingSoC] = useState(80);
  const [arrivalSoC, setArrivalSoC] = useState(10);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [origin, destination, vias, ev, startingSoC, arrivalSoC, membershipIds]);

  const canPlan = origin && destination && !loading;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-full max-w-sm flex flex-col bg-[var(--surface)] border-r border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h1 className="text-lg font-bold text-[var(--text)]">WattWay</h1>
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
            <ChargingPlan plan={plan} startingSoC={startingSoC} destinationAddress={destination?.address} />
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

      {/* Map */}
      <div className="flex-1 relative">
        <MapView plan={plan} />
      </div>
    </div>
  );
}
