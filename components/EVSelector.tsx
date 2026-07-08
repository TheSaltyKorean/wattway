"use client";
import { useMemo } from "react";
import { EVModel } from "@/lib/types";
import { EV_DATABASE } from "@/lib/evDatabase";

interface Props {
  value: EVModel; // the currently selected EV (may be a "custom" one)
  onChange: (ev: EVModel) => void;
}

const CUSTOM = "Custom";

// Alphabetical, numeric-aware ordering so "IONIQ 5" < "IONIQ 6" < "IONIQ 9"
// and "EQB 300" < "EQE 350" sort the way a human reads them.
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

// Variants of one make, sorted by model name then model-year range.
function sortedVariantsFor(make: string): EVModel[] {
  return EV_DATABASE.filter((e) => e.make === make).sort(
    (a, b) =>
      collator.compare(a.model, b.model) || collator.compare(a.years, b.years)
  );
}

const CUSTOM_DEFAULT: EVModel = {
  id: "custom",
  make: CUSTOM,
  model: "My EV",
  years: "",
  batteryKwh: 75,
  rangeMiles: 280,
  maxChargekW: 150,
  efficiencyMilesPerKwh: 3.73,
};

// Restore the user's last-entered custom specs (falls back to defaults).
function loadSavedCustom(): EVModel {
  try {
    const raw = localStorage.getItem("wattway.customEv");
    if (raw) {
      const c = JSON.parse(raw);
      if (c && typeof c.batteryKwh === "number" && c.batteryKwh > 0) {
        return { ...CUSTOM_DEFAULT, ...c, id: "custom", make: CUSTOM };
      }
    }
  } catch {
    /* storage unavailable */
  }
  return CUSTOM_DEFAULT;
}

// Two cascading dropdowns (Make -> Model), plus a "Custom" make that lets the
// user type their own battery / range / charge specs — real-world numbers can
// differ from EPA figures, so let people override them.
export default function EVSelector({ value, onChange }: Props) {
  const current = value;
  const isCustom = current.id === "custom";

  const makes = useMemo(
    () => [
      ...Array.from(new Set(EV_DATABASE.map((e) => e.make))).sort((a, b) =>
        collator.compare(a, b)
      ),
      CUSTOM,
    ],
    []
  );
  const variants = useMemo(() => sortedVariantsFor(current.make), [current.make]);

  const selectClass =
    "w-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors";
  const numClass =
    "w-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] rounded-lg px-2 py-2 text-sm tabular-nums focus:outline-none focus:border-[var(--accent)] transition-colors";

  // Update one custom field, re-deriving efficiency (range / usable battery).
  const setCustom = (patch: Partial<EVModel>) => {
    const base = isCustom ? current : loadSavedCustom();
    const next = { ...base, ...patch, id: "custom", make: CUSTOM };
    next.efficiencyMilesPerKwh =
      next.rangeMiles > 0 && next.batteryKwh > 0
        ? Math.round((next.rangeMiles / next.batteryKwh) * 100) / 100
        : 0;
    onChange(next);
  };

  const invalid =
    isCustom &&
    (current.batteryKwh <= 0 || current.rangeMiles <= 0 || current.maxChargekW <= 0);

  const numField = (
    label: string,
    val: number,
    key: "batteryKwh" | "rangeMiles" | "maxChargekW"
  ) => (
    <label className="flex-1 space-y-1">
      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
      <input
        type="number"
        min={0}
        value={val || ""}
        onChange={(e) => setCustom({ [key]: Math.max(0, Number(e.target.value)) })}
        className={numClass}
      />
    </label>
  );

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        Vehicle
      </label>
      <select
        aria-label="Vehicle make"
        value={isCustom ? CUSTOM : current.make}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            // Restore saved custom specs; keep Supercharger access if switching
            // from a Tesla so a Tesla owner's custom profile stays eligible.
            const base = loadSavedCustom();
            onChange({
              ...base,
              // Don't infer Tesla access from the previously selected vehicle —
              // the user picks the "This is a Tesla" checkbox explicitly.
              teslaAccess: base.teslaAccess === true,
            });
            return;
          }
          const first = sortedVariantsFor(e.target.value)[0];
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

      {isCustom ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            {numField("Battery kWh", current.batteryKwh, "batteryKwh")}
            {numField("Range mi", current.rangeMiles, "rangeMiles")}
            {numField("Max kW", current.maxChargekW, "maxChargekW")}
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!current.teslaAccess}
              onChange={(e) => setCustom({ teslaAccess: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            This is a Tesla (full Supercharger access)
          </label>
          <p className="text-[10px] text-[var(--text-muted)] -mt-1">
            Non-Tesla NACS cars already get open Superchargers automatically.
          </p>
          {invalid ? (
            <p className="text-[10px] text-amber-400">
              Enter a battery size and range above 0 to plan a route.
            </p>
          ) : (
            <p className="text-[10px] text-[var(--text-muted)]">
              Your car&apos;s real numbers ({current.efficiencyMilesPerKwh} mi/kWh).
            </p>
          )}
        </div>
      ) : (
        <select
          aria-label="Vehicle model"
          value={current.id}
          onChange={(e) => {
            const ev = EV_DATABASE.find((v) => v.id === e.target.value);
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
      )}
    </div>
  );
}
