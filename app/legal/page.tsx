import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal Disclaimer — WattWay",
  description: "Legal disclaimer, terms of use, and data notice for WattWay.",
  alternates: { canonical: "/legal" },
};

export default function LegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-[var(--text)]">
      <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
        ← Back to WattWay
      </Link>

      <h1 className="mt-6 text-2xl font-bold">Legal Disclaimer &amp; Terms of Use</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Last updated: July 2026. Please read this before relying on WattWay.
      </p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold">1. Estimates only — no guarantees</h2>
          <p className="mt-2">
            WattWay is a free, informational trip-planning tool. Every number it
            shows — charging costs, driving range, energy used, charge times,
            price per kWh, number and location of stops, detours, and arrival
            state of charge — is an <strong>estimate produced by a model</strong>,
            not a measurement or a quote. These estimates are derived from
            published EPA range figures, manufacturer specifications,
            community-contributed data, and simplifying assumptions. Real-world
            results <strong>will differ</strong>, sometimes significantly, due to
            weather, temperature, terrain, speed, driving style, vehicle load,
            battery age and condition, charger availability and real-time
            pricing, network fees, taxes, and other factors outside our control.
            Do not rely on WattWay as your sole basis for any trip, purchase, or
            other decision. Always confirm charger locations, availability, and
            pricing with the charging network before you travel.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Not professional advice</h2>
          <p className="mt-2">
            WattWay does not provide legal, financial, investment, engineering,
            safety, or professional advice of any kind, and nothing it outputs is
            a representation, warranty, certification, or statement of fact for
            any legal or commercial purpose. It is provided for general
            informational and entertainment purposes only.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Third-party data &amp; services</h2>
          <p className="mt-2">
            Charger locations, connector types, power levels, and pricing come in
            part from <strong>Open Charge Map</strong>, a community-edited
            database that may be incomplete, outdated, or inaccurate. Mapping,
            routing, geocoding, and places data are provided by{" "}
            <strong>Google Maps Platform</strong> and are subject to Google&apos;s
            terms. WattWay is not affiliated with, endorsed by, or sponsored by
            any vehicle manufacturer, charging network, or data provider. All
            product names, logos, and trademarks are the property of their
            respective owners and are used for identification only.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Data you provide</h2>
          <p className="mt-2">
            WattWay runs in your browser. To plan a route, the origin,
            destination, and stop locations you enter are sent to third-party
            services (e.g. Google Maps and Open Charge Map) to compute the route
            and find chargers. Your selected vehicle, memberships, excluded
            networks, and custom specs are stored locally in your browser. The
            site uses privacy-preserving analytics to measure aggregate usage.
            <strong>
              {" "}By using WattWay you consent to this processing and agree that
              any information you submit or share through the app may be
              transmitted to and processed by those third-party services under
              their own terms and privacy policies.
            </strong>{" "}
            Do not enter sensitive personal information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. No warranty</h2>
          <p className="mt-2">
            WattWay is provided <strong>&quot;as is&quot; and &quot;as
            available,&quot;</strong> without warranties of any kind, express or
            implied, including but not limited to accuracy, completeness,
            merchantability, fitness for a particular purpose, and
            non-infringement. We do not warrant that the service will be
            uninterrupted, error-free, or that any estimate will be accurate.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Limitation of liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, the creators and operators of
            WattWay shall not be liable for any direct, indirect, incidental,
            consequential, special, or exemplary damages — including but not
            limited to a stranded vehicle, missed charging, wasted time, extra
            cost, or any loss or injury — arising from or related to your use of,
            or inability to use, WattWay or its estimates. Your sole and
            exclusive remedy is to stop using the app.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Changes</h2>
          <p className="mt-2">
            WattWay and this disclaimer may change at any time without notice.
            Your continued use constitutes acceptance of the then-current terms.
          </p>
        </section>
      </div>

      <Link
        href="/"
        className="mt-8 inline-block text-sm text-[var(--accent)] hover:underline"
      >
        ← Back to WattWay
      </Link>
    </main>
  );
}
