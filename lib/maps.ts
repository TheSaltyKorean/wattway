import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let configured = false;

// setOptions must be called exactly once, before the first importLibrary call
export function ensureMapsConfigured(apiKey: string) {
  if (!configured) {
    setOptions({ key: apiKey, v: "weekly" });
    configured = true;
  }
}

export { importLibrary };
