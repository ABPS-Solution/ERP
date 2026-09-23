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
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      // A new version can get stuck "waiting" behind the old one and never
      // take over (seen live 23 Sep 2026: browsers pinned to an old cache for
      // hours). Tell any waiting worker to take over now; the reload below
      // then puts this tab onto the new code.
      const nudge = (w) => { if (w) w.postMessage("SKIP_WAITING"); };
      nudge(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        if (w) w.addEventListener("statechange", () => { if (w.state === "installed") nudge(reg.waiting || w); });
      });
    }).catch((err) => {
      // Registration failing is never fatal — the app works exactly as it
      // did before service workers existed, just with no offline shell.
      console.error("Service worker registration failed:", err);
    });
  });
}

// Once a new worker takes control, reload once so scripts come from it.
// Only when a controller already existed (a real update, not first install).
if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
  let swReloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (swReloaded) return;
    swReloaded = true;
    window.location.reload();
  });
}
