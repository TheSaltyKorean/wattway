import { useEffect } from "react";

// Shows a global "wait" mouse cursor while any async work is in flight (route
// calculation, "use my location" lookup). Ref-counted at module scope so
// multiple concurrent sources — and multiple GeocoderInput fields — compose
// correctly: the class is only removed once every source has cleared.
let busyCount = 0;

function apply() {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("app-busy", busyCount > 0);
}

export function useBusyCursor(active: boolean) {
  useEffect(() => {
    if (!active) return;
    busyCount++;
    apply();
    return () => {
      busyCount = Math.max(0, busyCount - 1);
      apply();
    };
  }, [active]);
}
