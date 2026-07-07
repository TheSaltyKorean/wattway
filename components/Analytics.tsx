import Script from "next/script";

// Google Analytics 4. Inert unless NEXT_PUBLIC_GA_ID is set to a valid
// G-XXXXXXXX measurement id at build time (from the GA_ID Actions secret), so
// local dev and un-configured builds send nothing. The id is not secret — GA
// measurement ids are visible in every page's source by design.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const ENABLED = !!GA_ID && /^G-[A-Z0-9]+$/.test(GA_ID);

export default function Analytics() {
  if (!ENABLED) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
