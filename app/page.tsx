"use client";
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { EVModel, TripPlan, Waypoint } from "@/lib/types";
import { EV_DATABASE, DEFAULT_NETWORK_PRICES } from "@/lib/evDatabase";
import { planTrip } from "@/lib/optimizer";
import TripForm from "@/components/TripForm";
import EVSelector from "@/components/EVSelector";
import ChargingPlan from "@/components/ChargingPlan";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const [origin, setOrigin] = useState<Waypoint | null>(null);
  const [destination, setDestination] = useState<Waypoint | null>(null);
  const [ev, setEV] = useState<EVModel>(EV_DATABASE[1]); // Model Y default
  const [startingSoC, setStartingSoC] = useState(80);
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
        ev,
        startingSoC,
        targetArrivalSoC: 10,
        networkPrices: DEFAULT_NETWORK_PRICES,
      });
      setPlan(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [origin, destination, ev, startingSoC]);

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

        {/* Form */}
        <div className="px-5 py-4 space-y-5 shrink-0">
          <TripForm
            origin={origin}
            destination={destination}
            startingSoC={startingSoC}
            onOriginChange={setOrigin}
            onDestinationChange={setDestination}
            onSoCChange={setStartingSoC}
          />
          <EVSelector value={ev.id} onChange={setEV} />

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
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {plan ? (
            <ChargingPlan plan={plan} startingSoC={startingSoC} />
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

      {/* Map */}
      <div className="flex-1 relative">
        <MapView plan={plan} />
      </div>
    </div>
  );
}
