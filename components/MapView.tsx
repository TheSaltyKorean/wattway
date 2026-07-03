"use client";
import { useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { TripPlan, ChargingStop } from "@/lib/types";

interface Props {
  plan: TripPlan | null;
}

let loaderInstance: Loader | null = null;

function getLoader(apiKey: string): Loader {
  if (!loaderInstance) {
    loaderInstance = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places", "geometry"],
    });
  }
  return loaderInstance;
}

export default function MapView({ plan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // Init map
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey || !containerRef.current) return;

    getLoader(apiKey)
      .importLibrary("maps")
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

    // Clear previous renderer
    if (rendererRef.current) {
      rendererRef.current.setMap(null);
      rendererRef.current = null;
    }

    getLoader(apiKey)
      .importLibrary("maps")
      .then(async ({ DirectionsRenderer, LatLngBounds }) => {
        // Re-request directions so we get a proper DirectionsResult for rendering
        const { DirectionsService } = await (getLoader(apiKey).importLibrary("routes") as Promise<{ DirectionsService: typeof google.maps.DirectionsService }>);

        // Extract origin and destination from route geometry
        const coords = plan.routeGeometry.coordinates as [number, number][];
        const origin = { lat: coords[0][1], lng: coords[0][0] };
        const dest = { lat: coords[coords.length - 1][1], lng: coords[coords.length - 1][0] };

        const ds = new DirectionsService();
        const result = await ds.route({
          origin,
          destination: dest,
          travelMode: google.maps.TravelMode.DRIVING,
        });

        const renderer = new DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: { strokeColor: "#4ade80", strokeWeight: 4, strokeOpacity: 0.8 },
        });
        renderer.setMap(map);
        renderer.setDirections(result);
        rendererRef.current = renderer;

        // Fit bounds
        const bounds = new LatLngBounds();
        coords.forEach(([lng, lat]) => bounds.extend({ lat, lng }));

        // Add charger stop markers
        const { AdvancedMarkerElement } = await (getLoader(apiKey).importLibrary("marker") as Promise<{ AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement }>);

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
            const infoWin = new google.maps.InfoWindow({
              content: `
                <div style="min-width:200px;font-family:system-ui,sans-serif;font-size:13px">
                  <p style="font-weight:600;margin:0 0 4px">${stop.station.name}</p>
                  <p style="margin:0 0 2px;opacity:0.7">${stop.station.network}${stop.station.priceIsPublished ? " ✓" : ""}</p>
                  <p style="margin:0 0 8px;opacity:0.6;font-size:11px">${stop.station.address}</p>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                    <div><span style="opacity:0.6">Rate</span><br><b>$${stop.station.pricePerKwh.toFixed(2)}/kWh${stop.station.priceIsPublished ? "" : "*"}</b></div>
                    <div><span style="opacity:0.6">Cost</span><br><b>$${stop.energyCostUsd.toFixed(2)}</b></div>
                    <div><span style="opacity:0.6">Energy</span><br><b>${stop.kwhAdded} kWh</b></div>
                    <div><span style="opacity:0.6">Time</span><br><b>${stop.chargeTimeMinutes} min</b></div>
                  </div>
                  ${!stop.station.priceIsPublished ? '<p style="margin:8px 0 0;opacity:0.5;font-size:11px">* estimated rate</p>' : ''}
                </div>
              `,
            });
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
