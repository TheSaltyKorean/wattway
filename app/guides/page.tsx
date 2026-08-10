import type { Metadata } from "next";
import Link from "next/link";
import ContentPage, { JsonLd } from "@/components/ContentPage";
import { SITE_URL, pageSocialMetadata } from "@/lib/seo";
import { GUIDES } from "@/lib/guides";

const TITLE = "EV Road Trip Guides — Charging Cost & Planning";
const DESCRIPTION =
  "Practical guides to what EV road-trip charging actually costs, how to plan stops that don't " +
  "waste money or time, and how WattWay's cost optimizer decides where to stop.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides" },
  ...pageSocialMetadata({ title: TITLE, description: DESCRIPTION, path: "/guides", type: "website" }),
};

export default function GuidesIndexPage() {
  return (
    <ContentPage
      crumbs={[{ name: "Guides" }]}
      title="EV Road Trip Guides"
      intro={
        <p>
          The reasoning behind the planner, written out. What charging on the road actually costs,
          why the cheapest charger is often the wrong stop, and how to plan a long trip without
          either overpaying or stranding yourself.
        </p>
      }
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: TITLE,
          description: DESCRIPTION,
          url: `${SITE_URL}/guides`,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: GUIDES.length,
            itemListElement: GUIDES.map((g, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: g.title,
              url: `${SITE_URL}/guides/${g.slug}`,
            })),
          },
        }}
      />

      <section>
        <ul className="space-y-4">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Link
                href={`/guides/${guide.slug}`}
                className="block bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--accent)] transition-colors"
              >
                <h2 className="text-lg font-semibold text-[var(--text)]">{guide.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  {guide.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </ContentPage>
  );
}
