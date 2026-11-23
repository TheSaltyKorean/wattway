"use client";

import { useEffect } from "react";
import { countVisit } from "@/lib/analytics";

// Fires the same-origin visit beacon once per browser session (see countVisit).
// Rendered once in the root layout so every page counts, including the SEO
// content pages that never mount the planner.
export default function VisitBeacon() {
  useEffect(() => {
    countVisit();
  }, []);
  return null;
}
