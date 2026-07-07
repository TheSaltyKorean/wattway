"use client";
import { useMemo } from "react";
import { EVModel } from "@/lib/types";
import { EV_DATABASE, getEVById } from "@/lib/evDatabase";

interface Props {
  value: string; // selected EV id
  onChange: (ev: EVModel) => void;
}

// Two cascading dropdowns (Make -> Model) so each carries far less text than a
// single combined list. The selected EV id is the single source of truth: the
// make dropdown is derived from it, so no extra local state is needed.
export default function EVSelector({ value, onChange }: Props) {
  const current = getEVById(value) ?? EV_DATABASE[0];

  const makes = useMemo(
    () => Array.from(new Set(EV_DATABASE.map((e) => e.make))),
    []
  );
  const variants = useMemo(
    () => EV_DATABASE.filter((e) => e.make === current.make),
    [current.make]
  );

  const selectClass =
    "w-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors";

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        Vehicle
      </label>
      <select
        aria-label="Vehicle make"
        value={current.make}
        onChange={(e) => {
          // Switching make selects that make's first variant
          const first = EV_DATABASE.find((v) => v.make === e.target.value);
          if (first) onChange(first);
        }}
        className={selectClass}
      >
        {makes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label="Vehicle model"
        value={current.id}
        onChange={(e) => {
          const ev = getEVById(e.target.value);
          if (ev) onChange(ev);
        }}
        className={selectClass}
      >
        {variants.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.model} ({ev.years}) — {ev.rangeMiles}mi
          </option>
        ))}
      </select>
    </div>
  );
}
