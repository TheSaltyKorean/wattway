"use client";
import { useEffect, useRef, useState } from "react";
import { ensureMapsConfigured, importLibrary } from "@/lib/maps";
import { Waypoint } from "@/lib/types";
import type { ViaStop } from "@/app/page";

interface GeocoderInputProps {
  label: string;
  value: Waypoint | null;
  onChange: (wp: Waypoint) => void;
  placeholder: string;
}

function GeocoderInput({ label, value, onChange, placeholder }: GeocoderInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey || !containerRef.current) return;

    ensureMapsConfigured(apiKey);
    importLibrary("places").then(({ PlaceAutocompleteElement }) => {
      if (autocompleteRef.current || !containerRef.current) return;
      const pac = new PlaceAutocompleteElement({
        includedRegionCodes: ["us"],
      });
      pac.style.width = "100%";
      pac.style.colorScheme = "dark";
      pac.addEventListener("gmp-select", async (event) => {
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
        }
      });
      containerRef.current.replaceChildren(pac);
      autocompleteRef.current = pac;
    });
  }, []);

  const hasKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </label>
      {hasKey ? (
        <div ref={containerRef} className="w-full [&_gmp-place-autocomplete]:w-full" />
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
  onOriginChange: (wp: Waypoint) => void;
  onDestinationChange: (wp: Waypoint) => void;
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
  onViasChange,
  onSoCChange,
  onArrivalSoCChange,
}: TripFormProps) {
  const addVia = () => {
    const nextId = vias.reduce((m, v) => Math.max(m, v.id), 0) + 1;
    onViasChange([...vias, { id: nextId, wp: null }]);
  };
  const removeVia = (id: number) => onViasChange(vias.filter((v) => v.id !== id));
  const setVia = (id: number, wp: Waypoint) =>
    onViasChange(vias.map((v) => (v.id === id ? { ...v, wp } : v)));

  const [locState, setLocState] = useState<"idle" | "locating" | "active" | "error">("idle");

  const useCurrentLocation = () => {
    setLocState("locating");
    const setFrom = (lat: number, lng: number, label: string) => {
      onOriginChange({ address: label, coords: { lat, lng } });
      setLocState("active");
    };
    // Rough city-level fallback for insecure origins (browsers block GPS on
    // plain http except localhost) or when the user denies the GPS prompt
    const ipFallback = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const d = await res.json();
        if (d.latitude && d.longitude) {
          setFrom(d.latitude, d.longitude, `Near ${d.city ?? "current location"} (approx.)`);
        } else setLocState("error");
      } catch {
        setLocState("error");
      }
    };
    if (window.isSecureContext && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setFrom(pos.coords.latitude, pos.coords.longitude, "Current location"),
        () => { void ipFallback(); },
        { enableHighAccuracy: false, timeout: 10000 }
      );
    } else {
      void ipFallback();
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <GeocoderInput label="From" value={origin} onChange={onOriginChange} placeholder="Starting city or address" />
        <button
          onClick={useCurrentLocation}
          className="absolute top-0 right-0 text-xs text-[var(--accent)] hover:opacity-80 transition-opacity"
        >
          {locState === "locating" ? "locating…"
            : locState === "active" ? `📍 ${origin?.address ?? "using current location"}`
            : locState === "error" ? "location unavailable"
            : "📍 current location"}
        </button>
      </div>

      {vias.map((via, i) => (
        <div key={via.id} className="relative">
          <GeocoderInput
            label={`Stop ${i + 1}`}
            value={via.wp}
            onChange={(wp) => setVia(via.id, wp)}
            placeholder="City or address along the way"
          />
          <button
            onClick={() => removeVia(via.id)}
            aria-label={`Remove stop ${i + 1}`}
            className="absolute top-0 right-0 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
          >
            ✕ remove
          </button>
        </div>
      ))}

      <GeocoderInput label="To" value={destination} onChange={onDestinationChange} placeholder="Destination city or address" />

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
          min={5}
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
