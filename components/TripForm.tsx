"use client";
import { useState, useCallback } from "react";
import { Waypoint } from "@/lib/types";

interface Props {
  label: string;
  value: Waypoint | null;
  onChange: (wp: Waypoint) => void;
  placeholder: string;
}

function GeocoderInput({ label, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value?.address ?? "");
  const [results, setResults] = useState<
    { place_name: string; center: [number, number] }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (q: string) => {
      setQuery(q);
      if (q.length < 3) { setResults([]); return; }
      setLoading(true);
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&country=us&types=place,address,poi`
        );
        const data = await res.json();
        setResults(data.features ?? []);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return (
    <div className="relative space-y-1">
      <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-muted)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
      />
      {loading && (
        <div className="absolute right-3 top-8 text-[var(--text-muted)]">
          <span className="text-xs">...</span>
        </div>
      )}
      {results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg overflow-hidden shadow-xl">
          {results.slice(0, 5).map((r, i) => (
            <li
              key={i}
              onClick={() => {
                setQuery(r.place_name);
                setResults([]);
                onChange({
                  address: r.place_name,
                  coords: { lng: r.center[0], lat: r.center[1] },
                });
              }}
              className="px-3 py-2.5 text-sm hover:bg-[var(--border)] cursor-pointer text-[var(--text)] truncate"
            >
              {r.place_name}
            </li>
          ))}
        </ul>
      )}
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
      <GeocoderInput
        label="From"
        value={origin}
        onChange={onOriginChange}
        placeholder="Starting city or address"
      />
      <GeocoderInput
        label="To"
        value={destination}
        onChange={onDestinationChange}
        placeholder="Destination city or address"
      />

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
