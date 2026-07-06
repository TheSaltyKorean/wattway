import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WattWay — Cost-Optimized EV Trip Planner",
  description:
    "Plan your EV road trip with the cheapest possible charging stops. WattWay finds the optimal charging sequence so you spend less time and money on the road.",
  // Relative URLs so they resolve under a base path (e.g. GitHub Pages /wattway)
  icons: { icon: "icon-192.png", apple: "icon-192.png" },
  manifest: "manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "WattWay" },
};

export const viewport = {
  themeColor: "#0a0e14",
};

// Defense-in-depth CSP. This is a static site on GitHub Pages, which can't set
// response headers, so it ships as a meta tag. It's the backstop that would
// neutralize an injection if community-edited OCM data ever reached an HTML
// sink. The Google-domain allowances mirror Google's documented Maps JS API
// CSP allowlist — the weekly Maps/Places/Geocoding libraries pull modules and
// hit endpoints across *.googleapis.com / *.gstatic.com / *.google.com, so
// those are wildcarded to avoid blocking a code path we didn't exercise (e.g.
// geocoding, Street View, other regions). 'unsafe-inline'/'unsafe-eval' are
// required by the Maps loader and limit strictness, but the policy still
// blocks any non-Google/non-self script or connection, plus object/base.
// (frame-ancestors/sandbox are ignored in a meta CSP, so they're omitted.)
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com",
  "connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://api.openchargemap.io https://ipapi.co data: blob:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://*.google.com",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
