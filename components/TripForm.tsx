"use client";
import { useEffect, useRef, useState } from "react";
import { ensureMapsConfigured, importLibrary } from "@/lib/maps";
import { Waypoint } from "@/lib/types";
import type { ViaStop } from "@/app/page";

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
}

// Material "my location" crosshair
function LocationIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" />
    </svg>
  );
}

function GeocoderInput({ label, value, onChange, placeholder, onRemove, fillSignal }: GeocoderInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const [locState, setLocState] = useState<"idle" | "locating" | "error">("idle");
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
        locReqRef.current++; // manual selection supersedes any pending lookup
        const { placePrediction } = event as google.maps.places.PlacePredictionSelectEvent;
        const place = placePrediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "location"] });
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
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {label}
        </label>
        <span className="flex items-center gap-2.5">
          <button
            onClick={useCurrentLocation}
            title={locState === "error" ? "Location unavailable" : "Use my location"}
            aria-label="Use my location"
            className={
              locState === "error"
                ? "text-red-400"
                : "text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            }
          >
            <LocationIcon className={`w-4 h-4 ${locState === "locating" ? "animate-pulse text-[var(--accent)]" : ""}`} />
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              aria-label={`Remove ${label}`}
              className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
            >
              ✕
            </button>
          )}
        </span>
      </div>
      {hasKey ? (
        <>
          {/* Autocomplete stays mounted (hidden) — swapping it out loses its text */}
          <div
            ref={containerRef}
            className={`w-full [&_gmp-place-autocomplete]:w-full ${locApplied ? "hidden" : ""}`}
          />
          {locApplied && value && (
            <div className="flex items-center gap-2 w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm">
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
          className="w-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-muted)] rounded-lg px-3 py-2.5 text-sm"
        />
      )}
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
}: TripFormProps) {
  const addVia = () => {
    const nextId = vias.reduce((m, v) => Math.max(m, v.id), 0) + 1;
    onViasChange([...vias, { id: nextId, wp: null }]);
  };
  const removeVia = (id: number) => onViasChange(vias.filter((v) => v.id !== id));
  const setVia = (id: number, wp: Waypoint | null) =>
    onViasChange(vias.map((v) => (v.id === id ? { ...v, wp } : v)));

  // Bumped on swap so both fields re-display their (exchanged) values
  const [fillSignal, setFillSignal] = useState(0);
  const swap = () => {
    onSwap();
    setFillSignal((n) => n + 1);
  };

  return (
    <div className="space-y-4">
      {/* Stable keys: vias are inserted between From and To, and the
          uncontrolled autocomplete widgets blank out if React remounts them */}
      <div key="from">
        <GeocoderInput label="From" value={origin} onChange={onOriginChange} placeholder="Starting city or address" fillSignal={fillSignal} />
      </div>

      <div className="flex justify-end -my-2">
        <button
          onClick={swap}
          disabled={!origin || !destination}
          title="Swap From and To"
          aria-label="Swap From and To"
          className="text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-30 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3 5 6.99h3V14h2V6.99h3L9 3z" />
          </svg>
        </button>
      </div>

      {vias.map((via, i) => (
        <div key={via.id}>
          <GeocoderInput
            label={`Stop ${i + 1}`}
            value={via.wp}
            onChange={(wp) => setVia(via.id, wp)}
            placeholder="City or address along the way"
            onRemove={() => removeVia(via.id)}
          />
        </div>
      ))}

      <div key="to">
        <GeocoderInput label="To" value={destination} onChange={onDestinationChange} placeholder="Destination city or address" fillSignal={fillSignal} />
      </div>

      {vias.length < 10 && (
        <button
          onClick={addVia}
          className="text-xs text-[var(--accent)] hover:opacity-80 transition-opacity font-medium"
        >
          + Add stop
        </button>
      )}

      <div className="space-y-2">
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
          onChange={(e) => onSoCChange(Number(e.target.value))}
          className="w-full accent-[#4ade80]"
        />
        <div className="flex justify-between text-xs text-[var(--text-muted)]">
          <span>Low</span>
          <span>Full</span>
        </div>
      </div>

      <div className="space-y-2">
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
          onChange={(e) => onArrivalSoCChange(Number(e.target.value))}
          className="w-full accent-[#4ade80]"
        />
        <div className="flex justify-between text-xs text-[var(--text-muted)]">
          <span>Just arrive</span>
          <span>Ready to go</span>
        </div>
      </div>
    </div>
  );
}
