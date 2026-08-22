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

        {/* Donate lives here rather than inside the planner panel: on a phone
            the panel is the scarce surface, and a full-width neon block at the
            top of it pushed the form below the fold. `neon-donate-pill` keeps
            the same blue but a calmer glow — the full-strength pulse is a lot
            in a bar that never scrolls away. */}
        <a
          href="https://venmo.com/u/TheSaltyKorean"
          target="_blank"
          rel="noopener noreferrer"
          className="neon-donate-pill flex items-center gap-1.5 shrink-0 h-[30px] px-3 rounded-full text-[13px] font-semibold text-white hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          Donate
        </a>

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
