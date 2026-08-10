import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ContentPage, { JsonLd } from "@/components/ContentPage";
import { GUIDES, getGuideBySlug } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return {};

  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.description,
      url: `${SITE_URL}/guides/${guide.slug}`,
    },
    twitter: { card: "summary_large_image", title: guide.title, description: guide.description },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  const others = GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <ContentPage
      crumbs={[{ name: "Guides", href: "/guides" }, { name: guide.title }]}
      title={guide.title}
      intro={guide.intro}
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              headline: guide.title,
              description: guide.description,
              url: `${SITE_URL}/guides/${guide.slug}`,
              mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
              author: { "@type": "Organization", name: "WattWay", url: SITE_URL },
              publisher: { "@type": "Organization", name: "WattWay", url: SITE_URL },
              isAccessibleForFree: true,
            },
            ...(guide.schema ? [guide.schema] : []),
          ],
        }}
      />

      {guide.body}

      {others.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-[var(--text)]">More guides</h2>
          <ul className="mt-4 space-y-2">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/guides/${other.slug}`}
                  className="block bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 hover:border-[var(--accent)] transition-colors"
                >
                  <span className="text-sm font-medium text-[var(--text)]">{other.title}</span>
                  <span className="block text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                    {other.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-[var(--text)]">Plan your trip</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          WattWay applies all of this to your actual route: real charger locations and prices along
          your highway, your car&apos;s real battery and charge curve, and any memberships you hold.
          Free, no account.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          ⚡ Plan a trip
        </Link>
      </section>
    </ContentPage>
  );
}
