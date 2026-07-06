// Generates public/og-image.png — the 1200x630 social share card used by the
// Open Graph / Twitter Card meta tags. Run with `node scripts/generate-og.mjs`.
// Rasterized from an inline SVG via sharp (already a dependency) so the asset
// is reproducible and reviewable in-repo. Text uses the default sans font that
// librsvg resolves; shapes (bolt, route, pins) are drawn as paths so branding
// doesn't depend on emoji/font availability.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "og-image.png");

const BG = "#0a0e14";
const SURFACE = "#12161f";
const ACCENT = "#4ade80";
const TEXT = "#e8eef5";
const MUTED = "#8a97a8";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="18%" cy="22%" r="60%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="route" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0.9"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="${BG}"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- route motif, kept in the clear right/bottom area -->
  <path d="M 880 590 C 970 560 955 470 1025 450 S 1120 360 1155 250"
        fill="none" stroke="url(#route)" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 22"/>
  <g>
    <circle cx="1005" cy="512" r="26" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="4"/>
    <text x="1005" y="521" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" font-weight="700" fill="${ACCENT}" text-anchor="middle">1</text>
    <circle cx="1085" cy="400" r="26" fill="${SURFACE}" stroke="${ACCENT}" stroke-width="4"/>
    <text x="1085" y="409" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" font-weight="700" fill="${ACCENT}" text-anchor="middle">2</text>
    <circle cx="1155" cy="250" r="18" fill="${ACCENT}"/>
  </g>

  <!-- lightning bolt mark -->
  <path d="M 118 132 L 96 236 L 150 224 L 128 320 L 214 196 L 156 210 L 178 132 Z"
        fill="${ACCENT}"/>

  <!-- wordmark -->
  <text x="240" y="240" font-family="DejaVu Sans, Arial, sans-serif" font-size="104" font-weight="700" fill="${TEXT}">WattWay</text>

  <!-- tagline -->
  <text x="122" y="360" font-family="DejaVu Sans, Arial, sans-serif" font-size="42" font-weight="700" fill="${TEXT}">Find the <tspan fill="${ACCENT}">cheapest</tspan> way to charge</text>
  <text x="122" y="416" font-family="DejaVu Sans, Arial, sans-serif" font-size="42" font-weight="700" fill="${TEXT}">on any EV road trip.</text>

  <!-- sub -->
  <text x="122" y="478" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="${MUTED}">Optimized for price, your range &amp; charger reliability</text>

  <!-- footer url -->
  <text x="122" y="560" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" font-weight="700" fill="${ACCENT}">wattway.net</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(OUT);
console.log("wrote", OUT);
