// Strips the generated `.next/types/routes.d.ts` reference from next-env.d.ts.
//
// Next 15 rewrites next-env.d.ts on every build and re-adds that triple-slash
// reference. The file is committed, so the line ends up in the repo, and then a
// clean clone's `npx tsc --noEmit` fails with TS6053 because .next/ doesn't
// exist until something has been built.
//
// This was fixed once by hand (bfcacae) and regressed the moment someone ran a
// build and `git add -A`. Running it as part of the build lifecycle makes it
// self-healing rather than something to remember.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "next-env.d.ts");
const before = readFileSync(file, "utf8");
const after = before.replace(/^\/\/\/ <reference path="\.\/\.next\/types\/routes\.d\.ts" \/>\r?\n/m, "");

if (after !== before) {
  writeFileSync(file, after, "utf8");
  console.log("next-env.d.ts: dropped generated routes.d.ts reference");
}
