// Microsoft Clarity — heatmaps and session replay. Inert unless
// NEXT_PUBLIC_CLARITY_ID is set at build time (from the CLARITY_ID Actions
// secret), so local dev and un-configured builds send nothing. The id is not
// secret; it ships in every page's source by design, same as the GA4 id.
//
// Why Clarity alongside GA4: GA4 answers how many and from where, Clarity
// answers what people actually did on the page — where they gave up in the
// trip form, whether anyone scrolls to the membership advice. It also feeds
// Bing's understanding of the site, which is the half of search this project
// has the most room to gain in.
//
// PRIVACY — read before changing anything here.
//
// This site's users type where they live and where they are going. Clarity's
// default masking covers form INPUT VALUES, which is not enough on its own:
// once an address is selected, WattWay renders it as ordinary page text (the
// filled box reads "Austin, TX, USA"), and rendered text is not an input. So
// the address rows carry data-clarity-mask in components/TripForm, and the
// planned-route summary carries it in app/page. If you add another surface
// that displays a user's origin, destination or stops, mask it there too.
//
// The Ionna/membership selections and the vehicle are deliberately NOT masked:
// they are product choices, not personal location data, and they are the
// interactions worth watching.
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;
// Clarity project ids are lowercase alphanumeric. The regex keeps the
// interpolation below from being an injection vector (it is also a build-time
// constant, not user input).
const ENABLED = !!CLARITY_ID && /^[a-z0-9]{6,20}$/.test(CLARITY_ID);

export default function Clarity() {
  if (!ENABLED) return null;
  return (
    <script
      id="clarity-init"
      dangerouslySetInnerHTML={{
        __html:
          `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};` +
          `t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;` +
          `y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);` +
          `})(window,document,"clarity","script","${CLARITY_ID}");`,
      }}
    />
  );
}
