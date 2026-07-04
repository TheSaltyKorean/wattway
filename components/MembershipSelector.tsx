"use client";
import { MEMBERSHIP_PLANS } from "@/lib/memberships";

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function MembershipSelector({ selected, onChange }: Props) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        Charging memberships
      </label>
      <div className="space-y-1">
        {MEMBERSHIP_PLANS.map((plan) => (
          <label
            key={plan.id}
            className="flex items-center gap-2.5 text-sm text-[var(--text)] cursor-pointer hover:bg-[var(--surface-2)] rounded-lg px-2 py-1.5 -mx-2 transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.includes(plan.id)}
              onChange={() => toggle(plan.id)}
              className="accent-[#4ade80]"
            />
            <span className="flex-1">{plan.label}</span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              −${plan.discountPerKwh.toFixed(2)}/kWh
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
