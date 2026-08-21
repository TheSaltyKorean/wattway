import Link from "next/link";

/**
 * Site-wide top menubar. Brand + primary nav, shared by the planner (app/page)
 * and every content page (components/ContentPage).
 *
 * Deliberately NO "use client": the mobile menu is a CSS-only <details>
 * disclosure, so this stays a zero-JS server component. That keeps the content
 * pages fully static (crawlers see every nav link in the served HTML), and it
 * also renders correctly when imported into the client-side planner.
 */
const NAV = [
  { href: "/", label: "Trip planner" },
  { href: "/ev", label: "EVs" },
  { href: "/charging-networks", label: "Charging networks" },
  { href: "/guides", label: "Guides" },
  { href: "/faq", label: "FAQ" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface)]/80">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-bold text-[var(--text)] shrink-0"
        >
          <span aria-hidden="true">⚡</span> WattWay
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main" className="hidden md:flex items-center gap-5 ml-auto text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile nav — CSS-only disclosure, no JS */}
        <details className="md:hidden ml-auto relative group">
          <summary
            className="list-none cursor-pointer p-2 -mr-2 rounded-lg text-[var(--text)] hover:bg-[var(--surface-2)] [&::-webkit-details-marker]:hidden"
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </summary>
          <nav
            aria-label="Main"
            className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden py-1"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-4 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--accent)] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
