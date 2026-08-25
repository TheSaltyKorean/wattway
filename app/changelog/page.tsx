import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { pageSocialMetadata } from "@/lib/seo";
import { getChangelog, type Span } from "@/lib/changelog";

const TITLE = "WattWay Changelog — What's New";
const DESCRIPTION =
  "Notable user-facing changes to WattWay, newest first: rideshare and manufacturer charging " +
  "discounts, membership value per trip, vehicle coverage, and the fixes behind them.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/changelog" },
  ...pageSocialMetadata({ title: TITLE, description: DESCRIPTION, path: "/changelog", type: "website" }),
};

/** Colors the change-type heading so Added/Fixed are scannable at a glance. */
function typeClass(type: string): string {
  if (type === "Added") return "text-[var(--accent)] border-[var(--accent)]";
  if (type === "Fixed") return "text-amber-400 border-amber-400";
  return "text-[var(--text-muted)] border-[var(--border)]";
}

function Inline({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((span, i) => {
        if (span.kind === "strong")
          return (
            <strong key={i} className="font-semibold text-[var(--text)]">
              {span.text}
            </strong>
          );
        if (span.kind === "code")
          return (
            <code
              key={i}
              className="rounded bg-[var(--surface-2)] px-1 py-0.5 text-[0.85em] text-[var(--text)]"
            >
              {span.text}
            </code>
          );
        if (span.kind === "link")
          return (
            <a
              key={i}
              href={span.href}
              className="text-[var(--accent)] hover:underline"
              // External destinations only — the changelog links out to the
              // repo and the site itself, never to user-supplied URLs.
              rel="noopener noreferrer"
            >
              {span.text}
            </a>
          );
        return <span key={i}>{span.text}</span>;
      })}
    </>
  );
}

export default function ChangelogPage() {
  // Read at build time. The site is a static export, so this file is parsed
  // once during `next build` and never at request time.
  const releases = getChangelog();

  return (
    <ContentPage
      crumbs={[{ name: "Changelog" }]}
      title="Changelog"
      intro={
        <p>
          Notable user-facing changes, newest first. WattWay ships continuously and has no version
          numbers, so entries are grouped by the month they went live. This is a curated list rather
          than a commit log — internal refactors and review-round fixes are left out unless they
          changed something you can see.
        </p>
      }
    >
      {releases.map((release) => (
        <section key={release.heading} aria-labelledby={`rel-${release.heading}`}>
          <h2
            id={`rel-${release.heading}`}
            className="text-lg font-semibold text-[var(--text)] border-b border-[var(--border)] pb-2"
          >
            {release.label}
          </h2>

          <div className="mt-5 space-y-6">
            {release.groups.map((group) => (
              <div key={group.type}>
                <h3
                  className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider ${typeClass(
                    group.type
                  )}`}
                >
                  {group.type}
                </h3>
                <ul className="mt-3 space-y-2.5 pl-5 list-disc marker:text-[var(--text-muted)]">
                  {group.entries.map((entry, i) => (
                    <li key={i} className="text-sm leading-relaxed text-[var(--text-muted)]">
                      <Inline spans={entry} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </ContentPage>
  );
}
