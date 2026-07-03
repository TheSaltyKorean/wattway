"use client";
import { EVModel } from "@/lib/types";
import { EV_DATABASE } from "@/lib/evDatabase";

interface Props {
  value: string;
  onChange: (ev: EVModel) => void;
}

export default function EVSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        Vehicle
      </label>
      <select
        value={value}
        onChange={(e) => {
          const ev = EV_DATABASE.find((v) => v.id === e.target.value);
          if (ev) onChange(ev);
        }}
        className="w-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
      >
        {EV_DATABASE.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.make} {ev.model} ({ev.year}) — {ev.rangeMiles}mi
          </option>
        ))}
      </select>
    </div>
  );
}
