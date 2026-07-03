"use client";
import { useState, useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { Waypoint } from "@/lib/types";

interface GeocoderInputProps {
  label: string;
  value: Waypoint | null;
  onChange: (wp: Waypoint) => void;
  placeholder: string;
}

function GeocoderInput({ label, value, onChange, placeholder }: GeocoderInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [text, setText] = useState(value?.address ?? "");

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey || !inputRef.current) return;

    const loader = new Loader({ apiKey, version: "weekly", libraries: ["places"] });
    loader.importLibrary("places").then(({ Autocomplete }) => {
      if (autocompleteRef.current || !inputRef.current) return;
      const ac = new Autocomplete(inputRef.current, {
        types: ["(cities)", "address"],
        componentRestrictions: { country: "us" },
        fields: ["geometry", "formatted_address"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (place.geometry?.location && place.formatted_address) {
          setText(place.formatted_address);
          onChange({
            address: place.formatted_address,
            coords: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            },
          });
        }
      });
      autocompleteRef.current = ac;
    });
  }, [onChange]);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </label>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-muted)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
        autoComplete="off"
      />
    </div>
  );
}

interface TripFormProps {
  origin: Waypoint | null;
  destination: Waypoint | null;
  startingSoC: number;
  onOriginChange: (wp: Waypoint) => void;
  onDestinationChange: (wp: Waypoint) => void;
  onSoCChange: (soc: number) => void;
}

export default function TripForm({
  origin,
  destination,
  startingSoC,
  onOriginChange,
  onDestinationChange,
  onSoCChange,
}: TripFormProps) {
  const socColor =
    startingSoC > 50 ? "var(--accent)" : startingSoC > 20 ? "#facc15" : "#ef4444";

  return (
    <div className="space-y-4">
      <GeocoderInput label="From" value={origin} onChange={onOriginChange} placeholder="Starting city or address" />
      <GeocoderInput label="To" value={destination} onChange={onDestinationChange} placeholder="Destination city or address" />
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Current battery
          </label>
          <span className="text-sm font-semibold tabular-nums" style={{ color: socColor }}>
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
    </div>
  );
}
