import type { Metadata } from "next";
import "./globals.css";
import Analytics from "@/components/Analytics";

const SITE_URL = "https://wattway.net/";
const OG_DESCRIPTION =
  "Find the cheapest realistic way to charge on any EV road trip — a minimal sequence of stops picked from live network prices, your memberships, charger power and reliability, and your car's range.";

export const metadata: Metadata = {
  // Absolute base for social-card crawlers, which can't resolve relative URLs.
  // The site serves from the apex of wattway.net, so the OG image resolves to
  // the file at the site root (public/og-image.png -> {SITE_URL}og-image.png).
  metadataBase: new URL(SITE_URL),
  title: "WattWay — Cost-Optimized EV Trip Planner",
  description:
    "Plan your EV road trip with the cheapest possible charging stops. WattWay finds the optimal charging sequence so you spend less time and money on the road.",
  // Self-referencing canonical so search/AI crawlers index one URL for the home
  // page (resolves against metadataBase to https://wattway.net/).
  alternates: { canonical: "/" },
  // Relative URLs so they resolve under a base path (e.g. GitHub Pages /wattway)
  icons: { icon: "icon-192.png", apple: "icon-192.png" },
  manifest: "manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "WattWay" },
  openGraph: {
    type: "website",
    siteName: "WattWay",
    url: SITE_URL,
    title: "WattWay — Cost-Optimized EV Trip Planner",
    description: OG_DESCRIPTION,
    images: [
      {
        url: "og-image.png",
        width: 1200,
        height: 630,
        alt: "WattWay — find the cheapest way to charge on any EV road trip",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WattWay — Cost-Optimized EV Trip Planner",
    description: OG_DESCRIPTION,
    images: ["og-image.png"],
  },
};

export const viewport = {
  themeColor: "#0a0e14",
};

// Defense-in-depth CSP for a static GitHub Pages site (no response headers, so
// it ships as a meta tag).
//
// IMPORTANT — this is NOT a full XSS backstop. The Google Maps JS API requires
// 'unsafe-inline' and 'unsafe-eval' in script-src (it injects inline scripts and
// uses eval), and a static host can't mint per-request nonces to replace them.
// Because 'unsafe-inline' is present, an inline-handler payload (e.g. an OCM
// field rendered into raw HTML with an onerror=) would still execute. Runtime
// XSS protection therefore lives at the code level and must stay there: React
// escaping, safeUrl() http(s) gating, and the InfoWindow built via textContent.
//
// What this policy DOES buy: it blocks loading external scripts from any
// non-Google/non-self origin, restricts connect-src/img-src to known hosts
// (limiting exfiltration if injection ever occurred), and locks down
// object-src/base-uri. The Google-domain entries mirror Google's documented
// Maps JS API allowlist (developers.google.com/maps/documentation/javascript/
// content-security-policy) so no Maps code path — geocoding, Street View, other
// regions, weekly builds — is blocked. googletagmanager.com (gtag loader) and
// google-analytics.com / analytics.google.com (GA4 collect beacons) are allowed
// for the optional Google Analytics tag. static.cloudflareinsights.com (the
// Cloudflare Web Analytics beacon script) and cloudflareinsights.com (its RUM
// POST endpoint) are allowed for Cloudflare's analytics, which the CDN injects
// when the site is proxied through Cloudflare.
// (frame-ancestors/sandbox are ignored in a meta CSP, so they're omitted.)
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com https://www.googletagmanager.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com https://*.google-analytics.com https://www.googletagmanager.com",
  "connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://api.openchargemap.io https://ipapi.co https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://cloudflareinsights.com data: blob:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://*.google.com",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

// Schema.org structured data so search engines and AI answer engines can
// understand what WattWay is, that it's a free web app, and what it does. This
// is a STATIC, developer-authored constant with no user input, so serializing
// it into the JSON-LD script tag is not an XSS vector.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": ["WebApplication", "SoftwareApplication"],
  name: "WattWay",
  url: SITE_URL,
  description: OG_DESCRIPTION,
  applicationCategory: "TravelApplication",
  operatingSystem: "Any (web browser)",
  browserRequirements: "Requires JavaScript.",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Cost-optimized EV charging stops along a road-trip route",
    "Live charging-network pricing and membership-aware cost estimates",
    "~170 EV profiles plus custom vehicle battery/range/charge specs",
    "Charger power and reliability factored into stop selection",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        {/* JSON-LD from a static trusted constant (no user input) — safe to inline. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        {/* Canonical gtag snippet in <head> so Google's tag detector finds it. */}
        <Analytics />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
