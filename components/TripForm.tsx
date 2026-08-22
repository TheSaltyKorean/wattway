"use client";
import { useEffect, useRef, useState } from "react";
import { ensureMapsConfigured, importLibrary } from "@/lib/maps";
import { Waypoint } from "@/lib/types";
import type { ViaStop } from "@/app/page";
import { useBusyCursor } from "@/lib/useBusyCursor";

interface GeocoderInputProps {
  label: string;
  value: Waypoint | null;
  onChange: (wp: Waypoint | null) => void;
  placeholder: string;
  onRemove?: () => void;
  /** Increment to force the field to display `value` as a filled box —
      used after programmatic changes (swap), since the Google autocomplete
      widget's text can't be set from code. */
  fillSignal?: number;
  /** Rail marker shown in the row's left gutter. `label` stays as the
      accessible name (sr-only) since the marker carries no text. */
  marker: React.ReactNode;
}

// Material "my location" crosshair
function LocationIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" />
    </svg>
  );
}

// Route-card row markers: a ring for the origin, a pin for the destination,
// a numbered dot for intermediate stops. They replace the uppercase From/To
// labels the fields used to carry — on a phone those labels cost a 16px row
// each to repeat what the marker and placeholder already say.
function RowMarker({ kind, index }: { kind: "origin" | "via" | "dest"; index?: number }) {
  if (kind === "origin") {
    return (
      <span
        className="w-2.5 h-2.5 rounded-full border-2 border-[var(--accent)]"
        aria-hidden="true"
      />
    );
  }
  if (kind === "dest") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-[var(--text-muted)]" aria-hidden="true">
        <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
      </svg>
    );
  }
  return (
    <span
      className="w-3.5 h-3.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[9px] font-semibold text-[var(--text-muted)] flex items-center justify-center tabular-nums"
      aria-hidden="true"
    >
      {index}
    </span>
  );
}

function GeocoderInput({ label, value, onChange, placeholder, onRemove, fillSignal, marker }: GeocoderInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true; // restore after Strict Mode's replayed cleanup
    return () => { mountedRef.current = false; };
  }, []);

  const [locState, setLocState] = useState<"idle" | "locating" | "error">("idle");
  // Wait cursor while resolving the user's current location
  useBusyCursor(locState === "locating");
  // When set, the box shows the resolved address instead of the autocomplete
  // (which has no API for setting its text). The widget stays mounted, hidden.
  const [locApplied, setLocApplied] = useState(false);
  // Monotonic token: any manual selection or newer lookup invalidates
  // still-pending location lookups so they can't overwrite fresher input
  const locReqRef = useRef(0);

  // Programmatic value changes (e.g. swap) also display as a filled box
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    if (!fillSignal) return; // skip mount (0/undefined)
    locReqRef.current++; // programmatic change supersedes in-flight lookups
    setLocState("idle"); // abandon any in-flight lookup so the busy cursor clears
    setLocApplied(valueRef.current !== null);
  }, [fillSignal]);

  const useCurrentLocation = () => {
    setLocState("locating");
    const reqId = ++locReqRef.current;
    const stale = () => !mountedRef.current || locReqRef.current !== reqId;
    const finish = async (lat: number, lng: number) => {
      // Fill the box with a real address, same as a typed selection
      let address: string | null = null;
      try {
        const { Geocoder } = await importLibrary("geocoding");
        const res = await new Geocoder().geocode({ location: { lat, lng } });
        address = res.results[0]?.formatted_address ?? null;
      } catch { /* fall through to coordinate label */ }
      if (stale()) return; // field removed, superseded, or manually edited
      onChangeRef.current({
        address: address ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        coords: { lat, lng },
      });
      setLocApplied(true);
      setLocState("idle");
    };
    // Rough city-level fallback for insecure origins (browsers block GPS on
    // plain http except localhost) or when the user denies the GPS prompt
    const ipFallback = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const d = await res.json();
        if (stale()) return;
        if (d.latitude && d.longitude) await finish(d.latitude, d.longitude);
        else setLocState("error");
      } catch {
        if (!stale()) setLocState("error");
      }
    };
    if (window.isSecureContext && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { void finish(pos.coords.latitude, pos.coords.longitude); },
        () => { void ipFallback(); },
        { enableHighAccuracy: false, timeout: 10000 }
      );
    } else {
      void ipFallback();
    }
  };

  // Creating a fresh widget is also the only way to reset its text (used by ✕)
  const mountAutocomplete = () => {
    importLibrary("places").then(({ PlaceAutocompleteElement }) => {
      if (!mountedRef.current || !containerRef.current) return;
      const pac = new PlaceAutocompleteElement({
        includedRegionCodes: ["us"],
      });
      pac.style.width = "100%";
      pac.style.colorScheme = "dark";
      pac.addEventListener("gmp-select", async (event) => {
        // Manual selection supersedes pending lookups — and may itself be
        // superseded before fetchFields resolves
        const reqId = ++locReqRef.current;
        setLocState("idle"); // abandon any in-flight location lookup (clears busy cursor)
        const { placePrediction } = event as google.maps.places.PlacePredictionSelectEvent;
        const place = placePrediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "location"] });
        if (!mountedRef.current || locReqRef.current !== reqId) return;
        if (place.location && place.formattedAddress) {
          onChangeRef.current({
            address: place.formattedAddress,
            coords: {
              lat: place.location.lat(),
              lng: place.location.lng(),
            },
          });
          setLocApplied(false);
          setLocState("idle");
        }
      });
      containerRef.current.replaceChildren(pac);
      autocompleteRef.current = pac;
    });
  };

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey || !containerRef.current || autocompleteRef.current) return;
    ensureMapsConfigured(apiKey);
    mountAutocomplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✕ on the filled box: truly clear the waypoint and reset the widget text
  const clearField = () => {
    locReqRef.current++;
    setLocApplied(false);
    setLocState("idle");
    onChangeRef.current(null);
    mountAutocomplete(); // fresh widget = empty text
  };

  const hasKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  return (
    /* One row of the route card: marker gutter · field · row actions. The
       field itself is borderless — the card supplies the border, so two
       inputs cost one outline instead of two. */
    <div className="flex items-center gap-2.5 min-h-[48px] px-3">
      <span className="w-3 shrink-0 flex justify-center">{marker}</span>
      <label className="sr-only">{label}</label>

      <div className="flex-1 min-w-0">
        {hasKey ? (
          <>
            {/* Autocomplete stays mounted (hidden) — swapping it out loses its text */}
            <div
              ref={containerRef}
              className={`w-full [&_gmp-place-autocomplete]:w-full ${locApplied ? "hidden" : ""}`}
            />
            {locApplied && value && (
              <div className="flex items-center gap-2 w-full text-sm py-1">
                <LocationIcon className="w-4 h-4 shrink-0 text-[var(--accent)]" />
                <span className="flex-1 truncate text-[var(--text)]" title={value.address}>
                  {value.address}
                </span>
                <button
                  onClick={clearField}
                  aria-label="Clear location"
                  className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
          </>
        ) : (
          <input
            type="text"
            disabled
            placeholder={placeholder}
            className="w-full bg-transparent text-[var(--text)] placeholder-[var(--text-muted)] py-2.5 text-sm"
          />
        )}
      </div>

      <span className="flex items-center gap-1 shrink-0">
        <button
          onClick={useCurrentLocation}
          title={locState === "error" ? "Location unavailable" : "Use my location"}
          aria-label={`Use my location for ${label}`}
          className={`flex items-center justify-center w-11 h-11 -mr-2 ${
            locState === "error"
              ? "text-red-400"
              : "text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          }`}
        >
          <LocationIcon className={`w-[18px] h-[18px] ${locState === "locating" ? "animate-pulse text-[var(--accent)]" : ""}`} />
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label={`Remove ${label}`}
            className="flex items-center justify-center w-11 h-11 -mr-2 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
          >
            ✕
          </button>
        )}
      </span>
    </div>
  );
}

interface TripFormProps {
  origin: Waypoint | null;
  destination: Waypoint | null;
  vias: ViaStop[];
  startingSoC: number;
  arrivalSoC: number;
  onOriginChange: (wp: Waypoint | null) => void;
  onDestinationChange: (wp: Waypoint | null) => void;
  onSwap: () => void;
  onViasChange: (vias: ViaStop[]) => void;
  onSoCChange: (soc: number) => void;
  onArrivalSoCChange: (soc: number) => void;
  avoidFerries: boolean;
  avoidTolls: boolean;
  onAvoidFerriesChange: (v: boolean) => void;
  onAvoidTollsChange: (v: boolean) => void;
}

function socColor(v: number): string {
  return v > 50 ? "var(--accent)" : v > 20 ? "#facc15" : "#ef4444";
}

export default function TripForm({
  origin,
  destination,
  vias,
  startingSoC,
  arrivalSoC,
  onOriginChange,
  onDestinationChange,
  onSwap,
  onViasChange,
  onSoCChange,
  onArrivalSoCChange,
  avoidFerries,
  avoidTolls,
  onAvoidFerriesChange,
  onAvoidTollsChange,
}: TripFormProps) {
  const addVia = () => {
    const nextId = vias.reduce((m, v) => Math.max(m, v.id), 0) + 1;
    onViasChange([...vias, { id: nextId, wp: null }]);
  };
  const removeVia = (id: number) => onViasChange(vias.filter((v) => v.id !== id));
  const setVia = (id: number, wp: Waypoint | null) =>
    onViasChange(vias.map((v) => (v.id === id ? { ...v, wp } : v)));
  const setViaField = (id: number, patch: Partial<ViaStop>) =>
    onViasChange(vias.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  // Reorder a stop so users can slot a newly-added stop between existing ones
  const moveVia = (id: number, dir: -1 | 1) => {
    const idx = vias.findIndex((v) => v.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= vias.length) return;
    const next = [...vias];
    [next[idx], next[j]] = [next[j], next[idx]];
    onViasChange(next);
  };

  // Bumped on swap so both fields re-display their (exchanged) values
  const [fillSignal, setFillSignal] = useState(0);
  const swap = () => {
    onSwap();
    setFillSignal((n) => n + 1);
  };

  return (
    <div className="space-y-4">
      {/* Route card — From, any stops, To and "+ Add stop" share one bordered
          box joined by a rail, so the whole route reads as a single object
          instead of a stack of separately-outlined fields. Worth ~150px above
          the fold on a phone. */}
      <div className="relative border border-[var(--border)] rounded-xl bg-[var(--surface-2)]">
        {/* Stable keys: vias are inserted between From and To, and the
            uncontrolled autocomplete widgets blank out if React remounts them */}
        <div key="from">
          <GeocoderInput
            label="From"
            value={origin}
            onChange={onOriginChange}
            placeholder="Starting city or address"
            fillSignal={fillSignal}
            marker={<RowMarker kind="origin" />}
          />
        </div>

        {/* Swap rides the rail, on the divider between From and the next row.
            The right edge is out: a 44px hit area there would overlap the
            rows' own location/remove buttons above and below it. The rail
            gutter is empty between rows, so nothing collides. */}
        <button
          onClick={swap}
          disabled={!origin || !destination}
          title="Swap From and To"
          aria-label="Swap From and To"
          className="absolute left-0 top-[26px] w-11 h-11 flex items-center justify-center disabled:opacity-30 group"
        >
          <span className="w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-[15px] h-[15px]" aria-hidden="true">
              <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3 5 6.99h3V14h2V6.99h3L9 3z" />
            </svg>
          </span>
        </button>

      {vias.map((via, i) => (
        <div key={via.id} className="border-t border-[var(--border)] ml-9">
          <div className="-ml-9">
          <GeocoderInput
            label={`Stop ${i + 1}`}
            value={via.wp}
            onChange={(wp) => setVia(via.id, wp)}
            placeholder="City or address along the way"
            onRemove={() => removeVia(via.id)}
            marker={<RowMarker kind="via" index={i + 1} />}
          />
          </div>
          {/* Per-stop extras hang off the rail, inside the card */}
          {(via.wp || vias.length > 1) && (
            <div className="flex items-center gap-4 pb-2.5 pr-3 text-xs flex-wrap">
              {vias.length > 1 && (
                <div className="flex items-center gap-1 text-[var(--text-muted)]">
                  <button
                    type="button"
                    onClick={() => moveVia(via.id, -1)}
                    disabled={i === 0}
                    aria-label={`Move stop ${i + 1} up`}
                    className="hover:text-[var(--accent)] disabled:opacity-30 transition-colors"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveVia(via.id, 1)}
                    disabled={i === vias.length - 1}
                    aria-label={`Move stop ${i + 1} down`}
                    className="hover:text-[var(--accent)] disabled:opacity-30 transition-colors"
                  >
                    ↓
                  </button>
                </div>
              )}
              {via.wp && (
                <>
              <label className="flex items-center gap-1.5 text-[var(--text-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!via.rechargedHere}
                  onChange={(e) =>
                    setViaField(via.id, {
                      rechargedHere: e.target.checked,
                      // clear any stale arrival target when recharging here
                      ...(e.target.checked ? { arrivalSoC: undefined } : {}),
                    })
                  }
                  className="accent-[var(--accent)]"
                />
                Charged here
              </label>
              {!via.rechargedHere && (
                <label className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  Arrive with ≥
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={via.arrivalSoC ?? ""}
                    placeholder="—"
                    onChange={(e) =>
                      setViaField(via.id, {
                        arrivalSoC:
                          e.target.value === ""
                            ? undefined
                            : Math.max(0, Math.min(90, Number(e.target.value))),
                      })
                    }
                    className="w-12 bg-[var(--surface-2)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text)] tabular-nums"
                  />
                  %
                </label>
              )}
                </>
              )}
            </div>
          )}
        </div>
      ))}

      <div key="to" className="border-t border-[var(--border)] ml-9">
        <div className="-ml-9">
          <GeocoderInput
            label="To"
            value={destination}
            onChange={onDestinationChange}
            placeholder="Destination city or address"
            fillSignal={fillSignal}
            marker={<RowMarker kind="dest" />}
          />
        </div>
      </div>

      {vias.length < 10 && (
        <button
          onClick={addVia}
          className="w-full h-10 flex items-center border-t border-[var(--border)] pl-9 pr-3 text-[13px] text-[var(--accent)] hover:opacity-80 transition-opacity font-medium"
        >
          + Add stop
        </button>
      )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Current battery
          </label>
          <span className="text-sm font-semibold tabular-nums" style={{ color: socColor(startingSoC) }}>
            {startingSoC}%
          </span>
        </div>
        <input
          type="range"
          min={11}
          max={100}
          step={1}
          value={startingSoC}
          aria-label="Current battery charge, percent"
          onChange={(e) => onSoCChange(Number(e.target.value))}
          className="w-full accent-[#4ade80]"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Charge needed at arrival
          </label>
          <span className="text-sm font-semibold tabular-nums" style={{ color: socColor(arrivalSoC) }}>
            {arrivalSoC}%
          </span>
        </div>
        <input
          type="range"
          min={10} /* matches the optimizer's 10% reserve floor */
          max={80}
          step={1}
          value={arrivalSoC}
          aria-label="Charge needed at arrival, percent"
          onChange={(e) => onArrivalSoCChange(Number(e.target.value))}
          className="w-full accent-[#4ade80]"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Route options
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text)]">
          <input
            type="checkbox"
            checked={avoidFerries}
            onChange={(e) => onAvoidFerriesChange(e.target.checked)}
            className="accent-[#4ade80]"
          />
          <span>Avoid ferries</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text)]">
          <input
            type="checkbox"
            checked={avoidTolls}
            onChange={(e) => onAvoidTollsChange(e.target.checked)}
            className="accent-[#4ade80]"
          />
          <span>Avoid tolls</span>
        </label>
      </div>
    </div>
  );
}
