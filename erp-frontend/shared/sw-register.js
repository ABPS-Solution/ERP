// Registers sw.js (offline app-shell caching). Its own file rather than an
// inline <script> in index.html, per this repo's no-inline-JS rule.
// Ported from Portal's abps-frontend/shared/sw-register.js (17 Sep 2026).
//
// The relative "sw.js" path matters: it resolves against /ERP/, so the
// registration's SCOPE is /ERP/ — this worker never intercepts requests for
// the sibling Portal app on the same origin. See sw.js's own header comment
// for the shared-origin hazard this (plus the erp-shell- cache prefix)
// guards against.
//
// updateViaCache:'none' matters: GitHub Pages sets its own Cache-Control
// and can't be configured, so without this the browser's HTTP cache could
// serve a stale sw.js and pin users to an old cache version.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch((err) => {
      // Registration failing is never fatal — the app works exactly as it
      // did before service workers existed, just with no offline shell.
      console.error("Service worker registration failed:", err);
    });
  });
}
