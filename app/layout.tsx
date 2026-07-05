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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
