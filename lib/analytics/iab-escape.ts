/**
 * Escaping Meta's in-app browser.
 *
 * A tap on a Facebook or Instagram ad opens the link inside Meta's own
 * webview, not Chrome or Safari. Google refuses OAuth in an embedded webview
 * (`disallowed_useragent`), so the Google button on /signin cannot work for
 * anybody arriving from an ad.
 *
 * Android gets a silent hop into Chrome via an `intent://` URL, keeping the
 * path and query so the UTM parameters survive the jump. iOS has no such
 * escape — Apple gives a webview no way to hand a URL to Safari — so it gets
 * a dismissible line at the bottom of the screen and nothing else. Every
 * other browser sees nothing at all.
 *
 * Inline in <head> rather than a module: it has to run before anything can
 * reach the sign-in button, and a deferred bundle is already too late.
 */
export const IAB_ESCAPE_SNIPPET = `
(function () {
  'use strict';
  try {
    var ua = navigator.userAgent || '';

    // 1) Detect Meta in-app browsers only
    if (!/FBAN|FBAV|FBIOS|FB_IAB|FBSV|Instagram|Messenger/i.test(ua)) return;

    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPhone|iPad|iPod/i.test(ua) ||
      (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);

    // sessionStorage can throw in some webviews
    function get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
    function set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

    // 2) Android: jump to Chrome via intent://
    if (isAndroid) {
      if (!get('cc_intent_tried')) {
        set('cc_intent_tried', '1'); // never loop
        var loc = window.location;
        // Keep path + query exactly as-is (already encoded). Escape ';'
        // because it ends fields in intent URIs. Hash is dropped on purpose.
        var rest = (loc.pathname + loc.search).replace(/;/g, '%3B');
        var intentUrl = 'intent://' + loc.host + rest +
          '#Intent;scheme=' + loc.protocol.replace(':', '') +
          ';package=com.android.chrome;end';
        window.location.href = intentUrl;
      }
      // If we are still here after 1.5s, the intent did not work
      // (no Chrome, or blocked): show the banner instead.
      setTimeout(function () { showBanner('android'); }, 1500);
      return;
    }

    // 3) iOS: banner only, never blocks the page
    if (isIOS) showBanner('ios');

    function showBanner(platform) {
      if (get('cc_banner_closed') || document.getElementById('cc-iab-banner')) return;
      function build() {
        if (!document.body || document.getElementById('cc-iab-banner')) return;
        var msg = platform === 'ios'
          ? 'To sign in with Google, tap the share or \\u22EF menu and choose \\u201COpen in Safari\\u201D.'
          : 'To sign in with Google, tap the \\u22EE menu and choose \\u201COpen in Chrome\\u201D or \\u201COpen in browser\\u201D.';
        var bar = document.createElement('div');
        bar.id = 'cc-iab-banner';
        bar.setAttribute('role', 'status');
        bar.style.cssText =
          'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;' +
          'background:#000;color:#f5efe6;border-radius:12px;padding:12px 14px;' +
          'display:flex;align-items:center;gap:12px;box-sizing:border-box;' +
          'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
          'box-shadow:0 4px 16px rgba(0,0,0,.25);';
        var t = document.createElement('span');
        t.style.cssText = 'flex:1;';
        t.textContent = msg;
        var x = document.createElement('button');
        x.type = 'button';
        x.setAttribute('aria-label', 'Close');
        x.textContent = '\\u00D7';
        x.style.cssText =
          'background:none;border:0;color:#f5efe6;font-size:22px;line-height:1;' +
          'padding:4px 8px;cursor:pointer;';
        x.onclick = function () {
          set('cc_banner_closed', '1');
          if (bar.parentNode) bar.parentNode.removeChild(bar);
        };
        bar.appendChild(t);
        bar.appendChild(x);
        document.body.appendChild(bar);
      }
      if (document.body) build();
      else document.addEventListener('DOMContentLoaded', build);
    }
  } catch (e) { /* never break the page */ }
})();
`;
