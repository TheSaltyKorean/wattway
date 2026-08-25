import type { MetadataRoute } from "next";
import { EV_DATABASE } from "@/lib/evDatabase";
import { GUIDES } from "@/lib/guides";
import { chargingNetworks, evPath, networkPath, SITE_URL, CONTENT_LAST_MODIFIED } from "@/lib/seo";

/**
 * Generated at build time so a new vehicle or network can never be missing from
 * the sitemap — the previous hand-maintained public/sitemap.xml listed two URLs
 * and a lastmod that had to be remembered.
 *
 * lastModified is a pinned constant rather than the build timestamp: stamping
 * every page as freshly modified on each deploy is noise, and crawlers learn to
 * ignore a lastmod that always says "now".
 */
// `output: export` requires metadata routes to declare themselves static — the
// sitemap has no request-time inputs, so it is emitted once at build time.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = CONTENT_LAST_MODIFIED;

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/ev`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/charging-networks`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/guides`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/faq`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    // Changes more often than the evergreen content pages, and its whole value
    // is being current, so it gets a weekly hint.
    { url: `${SITE_URL}/changelog`, lastModified, changeFrequency: "weekly", priority: 0.5 },
    ...GUIDES.map((guide) => ({
      url: `${SITE_URL}/guides/${guide.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...chargingNetworks().map((network) => ({
      url: `${SITE_URL}${networkPath(network)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...EV_DATABASE.map((ev) => ({
      url: `${SITE_URL}${evPath(ev)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${SITE_URL}/legal`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
