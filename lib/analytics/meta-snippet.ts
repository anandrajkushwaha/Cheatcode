import { META_PIXEL_ID } from "@/lib/analytics/meta";

/**
 * Meta's base code, with our two exclusions in front of it. Rendered as a
 * plain <script> in the root layout's <head> so it is in the page source for
 * every visitor and every checker, and runs before anything else loads.
 */
export const META_PIXEL_SNIPPET = `
(function () {
  try {
    if (location.pathname.indexOf('/admin') === 0) return;
    if (document.cookie.split('; ').indexOf('cc_owner=1') !== -1) return;
  } catch (e) {}
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${META_PIXEL_ID}');
  fbq('track', 'PageView');
  (window.__metaQueue || []).splice(0).forEach(function (a) { fbq.apply(null, a); });
})();
`;
