"use client";
import {
  RIDESHARE_PROGRAMS,
  RidesharePlatform,
  RideshareTier,
  getRideshareProgram,
  rideshareBenefits,
  tierChangesEstimate,
} from "@/lib/rideshareDiscount";

interface Props {
  platform: RidesharePlatform | null;
  tier: RideshareTier;
  onChange: (platform: RidesharePlatform | null, tier: RideshareTier) => void;
}

const selectClass =
  "h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--text-muted)]";

export default function RideshareSelector({ platform, tier, onChange }: Props) {
  const program = platform ? getRideshareProgram(platform) : null;
  const benefits = platform ? rideshareBenefits(platform, tier) : [];

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        Rideshare driver discounts
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Rideshare platform"
          value={platform ?? ""}
          onChange={(e) =>
            onChange((e.target.value || null) as RidesharePlatform | null, tier)
          }
          className={selectClass}
        >
          <option value="">Not a rideshare driver</option>
          {RIDESHARE_PROGRAMS.map((p) => (
            <option key={p.platform} value={p.platform}>
              I drive for {p.label}
            </option>
          ))}
        </select>

        {program && (
          <select
            aria-label={`${program.label} reward tier`}
            value={tier}
            onChange={(e) => onChange(platform, e.target.value as RideshareTier)}
            className={selectClass}
          >
            {program.tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {program && (
        <div className="text-xs leading-relaxed text-[var(--text-muted)] space-y-1">
          <ul className="space-y-0.5">
            {benefits.map((benefit) => (
              <li key={benefit.networkPlanId}>
                <span className="text-[var(--text)]">{benefit.rateLabel}</span>
              </li>
            ))}
          </ul>
          <p>{program.redemptionNote}</p>
          {/* Saying this out loud matters: the platforms advertise "up to 45%
              off" EVgo, and a planner that quoted the ceiling would under-quote
              nearly every real trip. */}
          <p>
            {program.label} advertises up to 45% off EVgo, but the real rate
            varies by market and time of day. Estimates here use the EVgo Plus
            member rate these programs guarantee, so your cost should land at or
            below what is shown.
            {!tierChangesEstimate(program.platform) &&
              " Both tiers get that rate, so the tier does not change this estimate."}
          </p>
        </div>
      )}
    </div>
  );
}
