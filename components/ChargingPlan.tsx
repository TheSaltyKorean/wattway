"use client";
import { TripPlan, ChargingStop, RideshareBenefit } from "@/lib/types";
import { membershipValues, membershipsToBuy, activeMembershipSummary } from "@/lib/membershipValue";

interface Props {
  plan: TripPlan;
  startingSoC: number;
  destinationAddress?: string;
  /** Memberships already applied to these prices, so the advice can separate
      "this is still earning its fee" from "this would start earning one". */
  membershipIds?: string[];
  /** Uber/Lyft driver discounts already applied to these prices, so the advice
      never recommends buying a plan the platform hands out free. */
  rideshareBenefits?: RideshareBenefit[];
  /** Select a membership and immediately re-price this route with it. Omitted
      on read-only renders; the button is hidden when it is. */
  onApplyMembership?: (planIds: string[]) => void;
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

// Station/operator URLs come from community-edited OCM data — only render http(s)
function safeUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

// The link's destination is attacker-controllable (community-edited), so show
// the bare hostname next to it — the user sees where an "Operator/Station site"
// link actually goes before trusting it. Returns null if the URL won't parse.
function urlHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
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
        {(() => {
          // Prefer the station link, but only if it's http(s) AND parseable —
          // a malformed station URL must fall back to the operator link rather
          // than suppress the community link entirely.
          const usable = (u: string | null) => (safeUrl(u) && urlHost(u!) ? u! : null);
          const stationU = usable(stop.station.stationUrl);
          const operatorU = usable(stop.station.operatorUrl);
          const url = stationU ?? operatorU;
          if (!url) return null;
          const host = urlHost(url)!; // non-null: url passed the usable() check
          const label = stationU ? "Station site" : "Operator site";
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={url}
              className="text-[var(--accent)] hover:underline truncate"
            >
              {label} <span className="text-[var(--text-muted)]">({host})</span> ↗
            </a>
          );
        })()}
      </div>
    </div>
  );
}

export default function ChargingPlan({ plan, startingSoC, destinationAddress, membershipIds = [], rideshareBenefits = [], onApplyMembership }: Props) {
  const hrs = Math.floor(plan.routeDurationMinutes / 60);
  const mins = Math.round(plan.routeDurationMinutes % 60);
  const chargeHrs = Math.floor(plan.totalChargeTimeMinutes / 60);
  const chargeMins = plan.totalChargeTimeMinutes % 60;
  const membershipAdvice = membershipValues(plan, membershipIds, rideshareBenefits);
  const recommended = membershipsToBuy(membershipAdvice);
  const recommendedSavings = recommended.reduce((sum, v) => sum + v.tripSavingsUsd, 0);
  const recommendedFees = recommended.reduce((sum, v) => sum + v.plan.monthlyFeeUsd, 0);
  const held = activeMembershipSummary(membershipAdvice);

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

      {/* Membership advice — the trip-specific answer to "is a subscription
          worth it?", which the vehicle pages can only answer generically. */}
      {membershipAdvice.length > 0 && (
        <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Membership check
          </p>

          {recommended.length > 0 ? (
            <>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
              {recommended.length === 1 ? (
                <>
                  <span className="font-semibold text-[var(--accent)]">
                    {recommended[0].plan.label}
                  </span>{" "}
                  would take{" "}
                  <span className="font-semibold text-[var(--accent)]">
                    ${recommended[0].tripSavingsUsd.toFixed(2)}
                  </span>{" "}
                  off this trip — more than its ${recommended[0].plan.monthlyFeeUsd.toFixed(2)}/mo
                  fee, so it pays for itself on this route alone
                  {" "}(net ${recommended[0].netUsd.toFixed(2)}).
                </>
              ) : (
                /* A long route can cross several partner networks and clear the
                   fee on each. Naming only the best one leaves money on the
                   table and contradicts the savings list right below it. */
                <>
                  <span className="font-semibold text-[var(--accent)]">
                    {recommended.length} memberships
                  </span>{" "}
                  each pay for themselves on this trip:{" "}
                  {recommended.map((value, i) => (
                    <span key={value.plan.id}>
                      {i > 0 && (i === recommended.length - 1 ? " and " : ", ")}
                      {value.plan.shortLabel} (${value.tripSavingsUsd.toFixed(2)} vs $
                      {value.plan.monthlyFeeUsd.toFixed(2)}/mo)
                    </span>
                  ))}
                  . Together they would take{" "}
                  <span className="font-semibold text-[var(--accent)]">
                    ${recommendedSavings.toFixed(2)}
                  </span>{" "}
                  off this trip against ${recommendedFees.toFixed(2)}/mo in fees.
                </>
              )}
            </p>
            {onApplyMembership && (
              <button
                onClick={() => onApplyMembership(recommended.map((v) => v.plan.id))}
                className="mt-2 h-7 px-2.5 rounded-md border border-[var(--accent)] text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black active:scale-[0.98] transition-colors"
              >
                {recommended.length === 1
                  ? "Re-plan with this membership"
                  : `Re-plan with all ${recommended.length}`}
              </button>
            )}
            </>
          ) : held.values.length > 0 ? (
            /* Everything worth buying is already held. The useful number is now
               the return on what they pay for, not an upsell — saying "no
               membership pays for itself" here reads as false to someone whose
               active plans just saved them real money. */
            <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
              Your {held.values.length === 1 ? "membership" : "memberships"} took{" "}
              <span className="font-semibold text-[var(--accent)]">
                ${held.savedUsd.toFixed(2)}
              </span>{" "}
              off this trip
              {held.paysForItself ? (
                <>
                  {" "}— more than the ${held.monthlyFeeUsd.toFixed(2)}/mo they cost, so this trip
                  alone covers them.
                </>
              ) : (
                <>
                  , against ${held.monthlyFeeUsd.toFixed(2)}/mo in fees. This trip does not cover
                  them on its own.
                </>
              )}{" "}
              No other plan pays for itself here.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              No membership pays for itself on this trip alone. The savings below are what each
              would be worth here, against its monthly fee.
            </p>
          )}

          <ul className="mt-3 space-y-1.5">
            {membershipAdvice.map((value) => (
              <li key={value.plan.id} className="flex items-baseline gap-2 text-xs">
                {/* shortLabel, not label: the full names truncate in this row
                    and took the "active" marker with them. The marker is now a
                    sibling of the truncating element, so it always shows. */}
                <span className="min-w-0 truncate text-[var(--text)]">{value.plan.shortLabel}</span>
                {value.active && (
                  <span className="shrink-0 text-[var(--accent)]">· active</span>
                )}
                <span className="flex-1" />
                <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                  {value.stopCount} stop{value.stopCount === 1 ? "" : "s"} ·{" "}
                  {Math.round(value.kwhOnNetwork)} kWh
                </span>
                <span
                  className={`shrink-0 tabular-nums font-semibold ${
                    value.netUsd > 0 ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  {value.active ? "saved " : ""}${value.tripSavingsUsd.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
            Savings are priced against these exact stops. Joining can also change which stops are
            cheapest, so the real figure can be higher — never lower.
          </p>
        </div>
      )}

      {/* Stops */}
      {plan.stops.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)] text-sm">
          {plan.planIncomplete ? (
            <>
              <p>⚠️ No usable fast chargers found in range.</p>
              <p className="text-xs mt-1">
                This trip can&apos;t reach your arrival target as planned.
              </p>
            </>
          ) : (
            <>
              <p>✅ No charging stops needed!</p>
              <p className="text-xs mt-1">
                You can complete this trip on your current charge.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
            Optimal charging sequence
          </p>
          {plan.stops.map((stop, i) => (
            // A round trip can stop at the same station twice — key by index too
            <div key={`${stop.station.id}-${i}`} className="space-y-3">
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
              // The user's own destination — masked from session replay, same
              // as the form fields. See components/Clarity.
              <p className="text-xs text-[var(--text-muted)] truncate" data-clarity-mask="true">{destinationAddress}</p>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)]">Arrive with</p>
          <SoCBar value={plan.arrivalSoC} />
        </div>
        {plan.planIncomplete && (
          <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2">
            ⚠️ Couldn&apos;t meet your arrival charge target — not enough fast chargers
            found along part of this route. Arrival estimate above is best-effort.
          </p>
        )}
      </div>
    </div>
  );
}
