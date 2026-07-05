"use client";
import { useEffect, useRef } from "react";
import { ensureMapsConfigured, importLibrary } from "@/lib/maps";
import { TripPlan, ChargingStop } from "@/lib/types";

interface Props {
  plan: TripPlan | null;
}

export default function MapView({ plan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // Init map
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey || !containerRef.current) return;

    ensureMapsConfigured(apiKey);
    importLibrary("maps")
      .then(({ Map }) => {
        if (mapRef.current) return;
        mapRef.current = new Map(containerRef.current!, {
          center: { lat: 39.8283, lng: -98.5795 },
          zoom: 4,
          mapId: "wattway_dark",
          colorScheme: "DARK" as never,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
      });
  }, []);

  // Update map when plan changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !plan) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey) return;

    // Clear markers
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];

    // Clear previous route line
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    ensureMapsConfigured(apiKey);
    importLibrary("maps")
      .then(async ({ Polyline }) => {
        const { LatLngBounds } = await importLibrary("core");
        const coords = plan.routeGeometry.coordinates as [number, number][];

        polylineRef.current = new Polyline({
          map,
          path: coords.map(([lng, lat]) => ({ lat, lng })),
          strokeColor: "#4ade80",
          strokeWeight: 4,
          strokeOpacity: 0.8,
        });

        // Fit bounds
        const bounds = new LatLngBounds();
        coords.forEach(([lng, lat]) => bounds.extend({ lat, lng }));

        // Add charger stop markers
        const { AdvancedMarkerElement } = await importLibrary("marker");

        plan.stops.forEach((stop: ChargingStop, i: number) => {
          const priceColor =
            stop.station.pricePerKwh < 0.30 ? "#4ade80"
              : stop.station.pricePerKwh < 0.40 ? "#facc15"
              : "#ef4444";

          const pin = document.createElement("div");
          pin.style.cssText = `
            width:32px;height:32px;border-radius:50%;
            background:${priceColor};color:#000;
            display:flex;align-items:center;justify-content:center;
            font-weight:bold;font-size:13px;cursor:pointer;
            border:2px solid rgba(255,255,255,0.3);
            box-shadow:0 2px 8px rgba(0,0,0,0.5);
          `;
          pin.textContent = String(i + 1);

          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: stop.station.coords.lat, lng: stop.station.coords.lng },
            content: pin,
            title: stop.station.name,
          });

          pin.addEventListener("click", () => {
            // Build the InfoWindow via DOM with textContent — OCM name/network/
            // address are community-editable, and InfoWindow string content is
            // parsed as HTML (an onerror payload would otherwise execute).
            const el = (tag: string, css: string, text?: string) => {
              const n = document.createElement(tag);
              n.style.cssText = css;
              if (text !== undefined) n.textContent = text;
              return n;
            };
            const stat = (labelText: string, valueText: string) => {
              const d = document.createElement("div");
              const l = el("span", "opacity:0.6", labelText);
              const b = document.createElement("b");
              b.textContent = valueText;
              d.append(l, document.createElement("br"), b);
              return d;
            };

            const root = el("div", "min-width:200px;font-family:system-ui,sans-serif;font-size:13px");
            root.append(
              el("p", "font-weight:600;margin:0 0 4px", stop.station.name),
              el("p", "margin:0 0 2px;opacity:0.7", stop.station.network + (stop.station.priceIsPublished ? " ✓" : "")),
              el("p", "margin:0 0 8px;opacity:0.6;font-size:11px", stop.station.address),
            );
            const grid = el("div", "display:grid;grid-template-columns:1fr 1fr;gap:6px");
            grid.append(
              stat("Rate", `$${stop.station.pricePerKwh.toFixed(2)}/kWh${stop.station.priceIsPublished ? "" : "*"}`),
              stat("Cost", `$${stop.energyCostUsd.toFixed(2)}`),
              stat("Energy", `${stop.kwhAdded} kWh`),
              stat("Time", `${stop.chargeTimeMinutes} min`),
            );
            root.append(grid);
            if (!stop.station.priceIsPublished) {
              root.append(el("p", "margin:8px 0 0;opacity:0.5;font-size:11px", "* estimated rate"));
            }

            const infoWin = new google.maps.InfoWindow({ content: root });
            infoWin.open({ anchor: marker, map });
          });

          bounds.extend({ lat: stop.station.coords.lat, lng: stop.station.coords.lng });
          markersRef.current.push(marker);
        });

        map.fitBounds(bounds, { top: 60, right: 40, bottom: 60, left: 40 });
      });
  }, [plan]);

  const hasKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!hasKey && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)] text-[var(--text-muted)] text-sm text-center p-8">
          <div>
            <p className="text-2xl mb-2">🗺️</p>
            <p className="font-medium text-[var(--text)]">Google Maps API key required</p>
            <p className="mt-1 text-xs">
              Add <code className="bg-[var(--surface-2)] px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> to{" "}
              <code className="bg-[var(--surface-2)] px-1 rounded">.env.local</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
