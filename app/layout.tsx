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
// sink. The allowances are what the Google Maps JS API, Routes/OCM/ipapi
// fetches, and same-origin PWA assets need; 'unsafe-inline'/'unsafe-eval' are
// required by the Maps loader and limit strictness, but connect/img/object/
// base restrictions still hold. (frame-ancestors/sandbox are ignored in a meta
// CSP, so they're omitted.)
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com",
  "connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://api.openchargemap.io https://ipapi.co data: blob:",
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
