"use client";
import { useEffect, useRef } from "react";
import { TripPlan, ChargingStop } from "@/lib/types";

interface Props {
  plan: TripPlan | null;
}

declare global {
  interface Window {
    mapboxgl: typeof import("mapbox-gl");
  }
}

export default function MapView({ plan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markersRef = useRef<import("mapbox-gl").Marker[]>([]);
  const popupsRef = useRef<import("mapbox-gl").Popup[]>([]);

  // Init map
  useEffect(() => {
    if (!containerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    import("mapbox-gl").then((mapboxgl) => {
      mapboxgl.default.accessToken = token;
      const map = new mapboxgl.default.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-98.5795, 39.8283],
        zoom: 3.5,
      });
      map.addControl(new mapboxgl.default.NavigationControl(), "top-right");
      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map when plan changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !plan) return;

    // Clear existing layers/sources/markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];

    const removeLayer = (id: string) => {
      if (map.getLayer(id)) map.removeLayer(id);
    };
    const removeSource = (id: string) => {
      if (map.getSource(id)) map.removeSource(id);
    };

    removeLayer("route-line");
    removeSource("route");

    import("mapbox-gl").then((mapboxgl) => {
      // Draw route
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: plan.routeGeometry },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#4ade80", "line-width": 3, "line-opacity": 0.8 },
      });

      // Fit bounds
      const coords = (plan.routeGeometry.coordinates as [number, number][]);
      if (coords.length > 0) {
        const bounds = coords.reduce(
          (b, [lng, lat]) => b.extend([lng, lat] as [number, number]),
          new mapboxgl.default.LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, { padding: 60, duration: 800 });
      }

      // Add stop markers
      plan.stops.forEach((stop: ChargingStop, i: number) => {
        const priceColor =
          stop.station.pricePerKwh < 0.30 ? "#4ade80"
            : stop.station.pricePerKwh < 0.40 ? "#facc15"
            : "#ef4444";

        const el = document.createElement("div");
        el.style.cssText = `
          width:32px;height:32px;border-radius:50%;
          background:${priceColor};color:#000;
          display:flex;align-items:center;justify-content:center;
          font-weight:bold;font-size:13px;cursor:pointer;
          border:2px solid rgba(255,255,255,0.3);
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
        `;
        el.textContent = String(i + 1);

        const popup = new mapboxgl.default.Popup({ offset: 20, closeButton: false })
          .setHTML(`
            <div style="min-width:180px">
              <p style="font-weight:600;margin:0 0 4px">${stop.station.name}</p>
              <p style="margin:0 0 2px;opacity:0.7;font-size:12px">${stop.station.network}</p>
              <p style="margin:0 0 6px;opacity:0.6;font-size:11px">${stop.station.address}</p>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
                <div><span style="opacity:0.6">Rate</span><br><b>$${stop.station.pricePerKwh.toFixed(2)}/kWh</b></div>
                <div><span style="opacity:0.6">Cost</span><br><b>$${stop.energyCostUsd.toFixed(2)}</b></div>
                <div><span style="opacity:0.6">Energy</span><br><b>${stop.kwhAdded} kWh</b></div>
                <div><span style="opacity:0.6">Time</span><br><b>${stop.chargeTimeMinutes} min</b></div>
              </div>
            </div>
          `);

        const marker = new mapboxgl.default.Marker({ element: el })
          .setLngLat([stop.station.coords.lng, stop.station.coords.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        popupsRef.current.push(popup);
      });
    });
  }, [plan]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)] text-[var(--text-muted)] text-sm text-center p-8">
          <div>
            <p className="text-2xl mb-2">🗺️</p>
            <p className="font-medium text-[var(--text)]">Mapbox token required</p>
            <p className="mt-1">
              Add <code className="bg-[var(--surface-2)] px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{" "}
              <code className="bg-[var(--surface-2)] px-1 rounded">.env.local</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
