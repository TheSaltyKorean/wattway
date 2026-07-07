"use client";
import { useState } from "react";
import { DEFAULT_NETWORK_PRICES } from "@/lib/evDatabase";

interface Props {
  excluded: string[];
  onChange: (networks: string[]) => void;
}

// Networks the planner knows about, minus the catch-all "Default" bucket.
const NETWORKS = Object.keys(DEFAULT_NETWORK_PRICES).filter((n) => n !== "Default");

// Let the user opt out of networks they can't or won't use — checked here means
// "exclude this network from planning".
export default function NetworkExcluder({ excluded, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const toggle = (n: string) =>
    onChange(excluded.includes(n) ? excluded.filter((e) => e !== n) : [...excluded, n]);

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--text)] transition-colors"
        aria-expanded={open}
      >
        <span>{open ? "▾" : "▸"}</span>
        Exclude networks{excluded.length > 0 ? ` (${excluded.length})` : ""}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {NETWORKS.map((n) => (
            <label
              key={n}
              className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer hover:bg-[var(--surface-2)] rounded px-1.5 py-1 -mx-1 transition-colors"
            >
              <input
                type="checkbox"
                checked={excluded.includes(n)}
                onChange={() => toggle(n)}
                className="accent-[#4ade80]"
              />
              <span className="flex-1 truncate">{n}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
