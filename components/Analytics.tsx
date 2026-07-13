// Google Analytics 4. Inert unless NEXT_PUBLIC_GA_ID is set to a valid
// G-XXXXXXXX measurement id at build time (from the GA_ID Actions secret), so
// local dev and un-configured builds send nothing. The id is not secret — GA
// measurement ids are visible in every page's source by design.
//
// Rendered as the canonical gtag snippet — a plain async <script src> plus an
// inline init — directly in <head> (see app/layout.tsx). This is deliberate:
// next/script's afterInteractive strategy only emits a <link rel="preload"> in
// the static HTML and injects the executing <script> at runtime, which fires
// for real browsers but is invisible to Google's HTML-fetch tag detector and
// Tag Assistant, so GA reports the tag as "not detected". The standard snippet
// below is what Google's detection expects.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
// The regex constrains GA_ID to G-[A-Z0-9]+, so interpolating it into the inline
// init script is not an injection vector (it is also a build-time constant).
const ENABLED = !!GA_ID && /^G-[A-Z0-9]+$/.test(GA_ID);

export default function Analytics() {
  if (!ENABLED) return null;
  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
      <script
        id="ga4-init"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`,
        }}
      />
    </>
  );
}
