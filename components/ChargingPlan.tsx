"use client";
import { TripPlan, ChargingStop } from "@/lib/types";

interface Props {
  plan: TripPlan;
  startingSoC: number;
  destinationAddress?: string;
}

function networkColor(network: string): string {
  const n = network.toLowerCase();
  if (n.includes("tesla")) return "bg-red-900/50 text-red-300 border-red-800";
  if (n.includes("electrify")) return "bg-purple-900/50 text-purple-300 border-purple-800";
  if (n.includes("chargepoint")) return "bg-blue-900/50 text-blue-300 border-blue-800";
  if (n.includes("evgo")) return "bg-orange-900/50 text-orange-300 border-orange-800";
  if (n.includes("blink")) return "bg-teal-900/50 text-teal-300 border-teal-800";
  return "bg-gray-800 text-gray-300 border-gray-700";
}

function SoCBar({ value }: { value: number }) {
  const color = value > 50 ? "#4ade80" : value > 20 ? "#facc15" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-xs tabular-nums" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

function StopCard({ stop, index }: { stop: ChargingStop; index: number }) {
  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)] font-bold text-sm shrink-0">
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{stop.station.name}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{stop.station.address}</p>
          </div>
        </div>
        <span
          className={`shrink-0 text-xs px-2 py-1 rounded-md border font-medium ${networkColor(stop.station.network)}`}
        >
          {stop.station.network.replace("Network", "").trim()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)]">Arrive at</p>
          <SoCBar value={stop.arrivalSoC} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)]">Depart at</p>
          <SoCBar value={stop.departureSoC} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--border)]">
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)]">Energy</p>
          <p className="font-semibold text-[var(--accent)]">${stop.energyCostUsd.toFixed(2)}</p>
          <p className="text-xs text-[var(--text-muted)]">{stop.kwhAdded} kWh</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)]">Charge time</p>
          <p className="font-semibold">{stop.chargeTimeMinutes} min</p>
          <p className="text-xs text-[var(--text-muted)]">
            {stop.station.maxPowerKw}kW × {stop.station.fastPortCount || 1}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)]">Rate</p>
          <p className="font-semibold">${stop.station.pricePerKwh.toFixed(2)}</p>
          <p className="text-xs text-[var(--text-muted)]">/kWh</p>
        </div>
      </div>

      {stop.detourMiles > 0.5 && (
        <p className="text-xs text-[var(--text-muted)]">
          ↗ {stop.detourMiles.toFixed(1)} mi detour
        </p>
      )}

      <div className="flex gap-4 pt-1 border-t border-[var(--border)] text-xs">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.station.name} ${stop.station.address}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] hover:underline"
        >
          Google reviews ↗
        </a>
        {(stop.station.stationUrl || stop.station.operatorUrl) && (
          <a
            href={(stop.station.stationUrl || stop.station.operatorUrl)!}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            {stop.station.stationUrl ? "Station site ↗" : "Operator site ↗"}
          </a>
        )}
      </div>
    </div>
  );
}

export default function ChargingPlan({ plan, startingSoC, destinationAddress }: Props) {
  const hrs = Math.floor(plan.routeDurationMinutes / 60);
  const mins = Math.round(plan.routeDurationMinutes % 60);
  const chargeHrs = Math.floor(plan.totalChargeTimeMinutes / 60);
  const chargeMins = plan.totalChargeTimeMinutes % 60;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Total cost</p>
            <p className="text-2xl font-bold text-[var(--accent)]">
              ${plan.totalEnergyCostUsd.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Charge stops</p>
            <p className="text-2xl font-bold">{plan.stops.length}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Charge time</p>
            <p className="text-2xl font-bold">
              {chargeHrs > 0 ? `${chargeHrs}h ` : ""}{chargeMins}m
            </p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[var(--border)] flex justify-between text-xs text-[var(--text-muted)]">
          <span>
            {plan.routeDistanceMiles} mi &bull; {hrs}h {mins}m drive
          </span>
          {plan.totalDetourMiles > 0 && (
            <span>{plan.totalDetourMiles.toFixed(1)} mi total detour</span>
          )}
        </div>
      </div>

      {/* Stops */}
      {plan.stops.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)] text-sm">
          <p>✅ No charging stops needed!</p>
          <p className="text-xs mt-1">
            You can complete this trip on your current charge.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
            Optimal charging sequence
          </p>
          {plan.stops.map((stop, i) => (
            <div key={stop.station.id} className="space-y-3">
              <p className="text-xs text-[var(--text-muted)] text-center tabular-nums">
                ↓ &nbsp;{stop.legDistanceMiles} mi
              </p>
              <StopCard stop={stop} index={i} />
            </div>
          ))}
        </div>
      )}

      {/* Destination */}
      {plan.stops.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] text-center tabular-nums">
          ↓ &nbsp;{plan.finalLegMiles} mi
        </p>
      )}
      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[var(--accent-dim)] flex items-center justify-center text-sm shrink-0">
            🏁
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">Destination</p>
            {destinationAddress && (
              <p className="text-xs text-[var(--text-muted)] truncate">{destinationAddress}</p>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)]">Arrive with</p>
          <SoCBar value={plan.arrivalSoC} />
        </div>
      </div>
    </div>
  );
}
