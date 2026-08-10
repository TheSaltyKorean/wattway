import type { Metadata } from "next";
import Link from "next/link";
import ContentPage, { JsonLd } from "@/components/ContentPage";
import { SITE_URL, pageSocialMetadata } from "@/lib/seo";
import { siteFAQs } from "@/lib/faqs";

const TITLE = "WattWay FAQ — EV Trip Planning Questions";
const DESCRIPTION =
  "How WattWay picks charging stops, where its prices and charger data come from, what it costs " +
  "(nothing), exactly what data it and its analytics collect, and how accurate the estimates are.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/faq" },
  ...pageSocialMetadata({ title: TITLE, description: DESCRIPTION, path: "/faq", type: "website" }),
};

export default function FAQPage() {
  const faqs = siteFAQs();

  return (
    <ContentPage
      crumbs={[{ name: "FAQ" }]}
      title="Frequently Asked Questions"
      intro={
        <p>
          How WattWay works, where its data comes from, and how far to trust it. Short version: it
          is free, it needs no account, it optimizes for cost rather than time, and every number it
          prints is an estimate.
        </p>
      }
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />

      <section>
        <dl className="space-y-7">
          {faqs.map((faq) => (
            <div key={faq.q}>
              <dt>
                <h2 className="text-base font-semibold text-[var(--text)]">{faq.q}</h2>
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-[var(--text)]">Still have a question?</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          The{" "}
          <Link href="/guides" className="text-[var(--accent)] hover:underline">
            guides
          </Link>{" "}
          go deeper on cost and planning, each{" "}
          <Link href="/ev" className="text-[var(--accent)] hover:underline">
            vehicle page
          </Link>{" "}
          answers the same questions for a specific car, and the{" "}
          <Link href="/legal" className="text-[var(--accent)] hover:underline">
            legal disclaimer
          </Link>{" "}
          covers data sources and accuracy in full.
        </p>
      </section>
    </ContentPage>
  );
}
