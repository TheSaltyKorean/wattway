// Makes trailing-slash URLs resolve on GitHub Pages.
//
// The static export writes one file per route: out/faq.html serves /faq. Pages
// maps /faq -> faq.html, but /faq/ -> faq/index.html, which does not exist, so
// every trailing-slash variant hard-404s. That is not hypothetical tidiness:
// inbound links, pasted URLs and other sites routinely add the slash, and a 404
// spends the link instead of banking it. Bing is stricter about it than Google.
//
// The fix is to ALSO emit faq/index.html with the same bytes, so both spellings
// return 200. Deliberately NOT `trailingSlash: true` in next.config: that flips
// which spelling is canonical and would move every already-indexed URL on the
// site. Here the slashless URL stays canonical — the sitemap is unchanged, and
// each page's self-referencing <link rel="canonical"> points at the slashless
// form, so the duplicate collapses to one indexed URL.
//
// Runs on the static export only (out/ exists after a GITHUB_PAGES build).
import { readdirSync, statSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "out");

if (!existsSync(outDir)) {
  console.log("mirror-trailing-slash: no out/ — not a static-export build, skipping");
  process.exit(0);
}

// 404.html is served by Pages for unmatched paths; mirroring it would create a
// real /404/ page. index.html already answers the directory it sits in.
const SKIP = new Set(["404.html", "index.html"]);

let created = 0;
let skipped = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "_next") continue; // build assets, never routes
      walk(path);
      continue;
    }
    if (!entry.endsWith(".html") || SKIP.has(entry)) continue;

    const target = join(dir, entry.slice(0, -".html".length), "index.html");
    if (existsSync(target)) {
      // A real route already owns that directory index — never clobber it.
      skipped++;
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(path, target);
    created++;
  }
}

walk(outDir);
console.log(
  `mirror-trailing-slash: ${created} directory index files written` +
    (skipped ? `, ${skipped} left alone (already present)` : "")
);
