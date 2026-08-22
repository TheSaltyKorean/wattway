import type { Metadata } from "next";
import "./globals.css";
import Analytics from "@/components/Analytics";
import Clarity from "@/components/Clarity";

const SITE_URL = "https://wattway.net/";
const OG_DESCRIPTION =
  "Find a cheap, realistic way to charge on any EV road trip — a short sequence of stops picked from published and per-network reference prices, your memberships, charger power and reliability, and your car's range.";

export const metadata: Metadata = {
  // Absolute base for social-card crawlers, which can't resolve relative URLs.
  // The site serves from the apex of wattway.net, so the OG image resolves to
  // the file at the site root (public/og-image.png -> {SITE_URL}og-image.png).
  metadataBase: new URL(SITE_URL),
  // Child pages set their own title; this template keeps the brand on the end
  // of every one without each page repeating it.
  title: {
    default: "WattWay — Cost-Optimized EV Trip Planner",
    template: "%s | WattWay",
  },
  description:
    "Plan your EV road trip around low-cost charging stops. WattWay scores chargers along your route on price, power and reliability so you spend less time and money on the road.",
  applicationName: "WattWay",
  authors: [{ name: "TheSaltyKorean", url: "https://thesaltykorean.com" }],
  creator: "TheSaltyKorean",
  publisher: "WattWay",
  category: "travel",
  // Opt in to the richest possible presentation in search results and AI answer
  // surfaces: full-length text snippets, large image previews, and unlimited
  // video preview. Without these Google caps snippet length on its own, which
  // costs visibility on exactly the long-tail queries these pages target.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
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
    locale: "en_US",
    url: SITE_URL,
    title: "WattWay — Cost-Optimized EV Trip Planner",
    description: OG_DESCRIPTION,
    images: [
      {
        url: "og-image.png",
        width: 1200,
        height: 630,
        alt: "WattWay — a cost-optimized charging plan for any EV road trip",
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
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com https://www.googletagmanager.com https://static.cloudflareinsights.com https://www.clarity.ms",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com https://*.google-analytics.com https://www.googletagmanager.com",
  "connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://api.openchargemap.io https://ipapi.co https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://cloudflareinsights.com https://*.clarity.ms data: blob:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://*.google.com",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

// Schema.org structured data so search engines and AI answer engines can
// understand what WattWay is, that it's a free web app, and what it does. This
// is a STATIC, developer-authored constant with no user input, so serializing
// it into the JSON-LD script tag is not an XSS vector.
//
// Emitted as an @graph of three linked nodes rather than a single WebApplication:
// the Organization is what an AI answer engine cites as the publisher, the
// WebSite carries site-level identity, and the WebApplication describes the tool
// itself. @id cross-references let a consumer resolve them as one entity.
const ORG_ID = `${SITE_URL}#organization`;
const SITE_ID = `${SITE_URL}#website`;

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "WattWay",
      url: SITE_URL,
      description: OG_DESCRIPTION,
      logo: `${SITE_URL}icon-512.png`,
      founder: { "@type": "Person", name: "TheSaltyKorean", url: "https://thesaltykorean.com" },
    },
    {
      "@type": "WebSite",
      "@id": SITE_ID,
      name: "WattWay",
      url: SITE_URL,
      description: OG_DESCRIPTION,
      publisher: { "@id": ORG_ID },
      inLanguage: "en-US",
    },
    {
      "@type": ["WebApplication", "SoftwareApplication"],
      "@id": `${SITE_URL}#webapp`,
      name: "WattWay",
      url: SITE_URL,
      description: OG_DESCRIPTION,
      applicationCategory: "TravelApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript.",
      isAccessibleForFree: true,
      publisher: { "@id": ORG_ID },
      isPartOf: { "@id": SITE_ID },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Cost-optimized EV charging stops along a road-trip route",
        "Community-published and per-network reference pricing, with membership-aware cost estimates",
        "~170 EV profiles plus custom vehicle battery/range/charge specs",
        "Charger power and reliability factored into stop selection",
      ],
    },
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
        <Clarity />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
