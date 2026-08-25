import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Parses CHANGELOG.md into the structure the /changelog page renders.
 *
 * CHANGELOG.md is the single source of truth: it is what shows on GitHub and
 * what the site page renders, so a release note can never say two different
 * things in two places. Editing the markdown is the whole workflow — there is
 * no second list to keep in sync.
 *
 * Deliberately hand-rolled rather than pulling in a markdown library. This runs
 * at build time only (the site is a static export, so there is no server to
 * read files at request time), the input is a file we author ourselves, and the
 * subset of markdown in play is three constructs: `##` month headings, `###`
 * change-type headings, and `-` bullets with bold/link/code spans. A parser
 * dependency would be more code to audit than the forty lines below.
 *
 * Anything it does not understand is passed through as plain text rather than
 * dropped, so a future bullet using an unsupported construct degrades to
 * readable prose instead of vanishing from the page.
 */

/** An inline run of text within a bullet. */
export type Span =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export interface ChangeGroup {
  /** "Added", "Changed", "Fixed" — the ### heading. */
  type: string;
  entries: Span[][];
}

export interface ChangelogRelease {
  /** The ## heading, e.g. "2026-08". */
  heading: string;
  /** Human month label, e.g. "August 2026". Falls back to the raw heading. */
  label: string;
  groups: ChangeGroup[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-08" -> "August 2026"; anything else is returned unchanged. */
export function monthLabel(heading: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(heading.trim());
  if (!m) return heading;
  const month = MONTHS[parseInt(m[2], 10) - 1];
  return month ? `${month} ${m[1]}` : heading;
}

/**
 * Splits one bullet's text into inline spans.
 *
 * Order matters: code spans are taken first so a backticked string containing
 * asterisks or brackets is never re-parsed as emphasis or a link.
 */
export function parseInline(text: string): Span[] {
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  const spans: Span[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      spans.push({ kind: "text", text: text.slice(last, match.index) });
    }
    if (match[1] !== undefined) spans.push({ kind: "code", text: match[1] });
    else if (match[2] !== undefined) spans.push({ kind: "strong", text: match[2] });
    else spans.push({ kind: "link", text: match[3], href: match[4] });
    last = match.index + match[0].length;
  }
  if (last < text.length) spans.push({ kind: "text", text: text.slice(last) });
  return spans;
}

/** Parses changelog markdown. Exported separately so it is testable without fs. */
export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let release: ChangelogRelease | null = null;
  let group: ChangeGroup | null = null;
  // Bullets wrap across lines; a continuation line is indented and belongs to
  // the bullet above it rather than starting a new entry.
  let buffer: string | null = null;

  const flushEntry = () => {
    if (buffer !== null && group) group.entries.push(parseInline(buffer.trim()));
    buffer = null;
  };

  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) {
      flushEntry();
      group = null;
      const heading = line.slice(3).trim();
      release = { heading, label: monthLabel(heading), groups: [] };
      releases.push(release);
    } else if (line.startsWith("### ") && release) {
      flushEntry();
      group = { type: line.slice(4).trim(), entries: [] };
      release.groups.push(group);
    } else if (/^- /.test(line) && group) {
      flushEntry();
      buffer = line.slice(2);
    } else if (buffer !== null && /^\s+\S/.test(line)) {
      buffer += " " + line.trim();
    } else if (line.trim() === "") {
      flushEntry();
    }
  }
  flushEntry();

  // Link-reference definitions and the intro prose produce no groups.
  return releases.filter((r) => r.groups.length > 0);
}

/** Reads and parses CHANGELOG.md from the repo root. Build time only. */
export function getChangelog(): ChangelogRelease[] {
  return parseChangelog(readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8"));
}
