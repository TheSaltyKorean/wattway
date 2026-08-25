import Link from "next/link";
import { SITE_URL } from "@/lib/seo";
import SiteHeader from "@/components/SiteHeader";

export interface Crumb {
  name: string;
  /** Site-root-relative path. Omitted on the final (current-page) crumb. */
  href?: string;
}

/**
 * Serializes a JSON-LD graph into a script tag.
 *
 * Every caller passes a developer-authored object built from the vehicle/network
 * database — never user input — so there is no injection vector here. The `<`
 * escape is belt-and-braces against a future caller embedding a string that
 * could otherwise close the script element early.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** BreadcrumbList JSON-LD matching the visible breadcrumb trail. */
export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      ...(crumb.href ? { item: `${SITE_URL}${crumb.href}` } : {}),
    })),
  };
}

/**
 * Shell for every static content page: site nav, breadcrumbs, and the footer
 * disclaimer. Deliberately a server component with no client JS — these pages
 * exist to be read by crawlers and AI answer engines, most of which never run
 * JavaScript, so everything meaningful has to be in the served HTML.
 */
export default function ContentPage({
  crumbs,
  title,
  intro,
  children,
}: {
  crumbs: Crumb[];
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", href: "/" }, ...crumbs])} />

      <div className="min-h-screen flex flex-col">
        <SiteHeader />

        <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-[var(--text-muted)]">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-[var(--accent)] transition-colors">
                  Home
                </Link>
              </li>
              {crumbs.map((crumb) => (
                <li key={crumb.name} className="flex items-center gap-1.5">
                  <span aria-hidden="true">/</span>
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-[var(--accent)] transition-colors">
                      {crumb.name}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-[var(--text)]">
                      {crumb.name}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)]">{title}</h1>
          {intro && (
            <div className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{intro}</div>
          )}

          <div className="mt-8 space-y-10">{children}</div>
        </main>

        <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto max-w-4xl px-5 py-6 text-xs text-[var(--text-muted)] space-y-3">
            <p>
              <strong className="text-[var(--text)]">Everything on this page is an estimate.</strong>{" "}
              Costs, ranges, charge times and stop counts are produced by a model from EPA figures,
              manufacturer specs and community-contributed pricing — not quotes or measurements.
              Real-world results vary with weather, terrain, speed, battery age and live network
              pricing. Confirm charger availability and rates with the network before you travel.
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/" className="hover:text-[var(--accent)] transition-colors">
                Plan a trip
              </Link>
              <Link href="/ev" className="hover:text-[var(--accent)] transition-colors">
                All EVs
              </Link>
              <Link href="/charging-networks" className="hover:text-[var(--accent)] transition-colors">
                Charging networks
              </Link>
              <Link href="/guides" className="hover:text-[var(--accent)] transition-colors">
                Guides
              </Link>
              <Link href="/faq" className="hover:text-[var(--accent)] transition-colors">
                FAQ
              </Link>
              <Link href="/changelog" className="hover:text-[var(--accent)] transition-colors">
                Changelog
              </Link>
              <Link href="/legal" className="hover:text-[var(--accent)] transition-colors">
                Legal disclaimer
              </Link>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
