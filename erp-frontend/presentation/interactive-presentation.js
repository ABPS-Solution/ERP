// Interactive Presentation (prototype, Admin): hosts the single-window demo page in an iframe.
function initializeInteractivePresentationPanel() {
  const f = document.getElementById("ip-frame");
  if (f && !f.getAttribute("src")) f.setAttribute("src", "presentation/interactive-demo.html");
}

function ipPseudoFullscreen(on) {
  const f = document.getElementById("ip-frame");
  if (!f) return;
  let b = document.getElementById("ip-exit-fs");
  if (on) {
    f.style.cssText += ";position:fixed;inset:0;width:100vw;height:100vh;min-height:0;z-index:99998;border-radius:0;";
    if (!b) {
      b = document.createElement("button");
      b.id = "ip-exit-fs";
      b.textContent = "Exit full screen";
      b.style.cssText = "position:fixed;top:10px;left:10px;z-index:99999;padding:8px 12px;border-radius:10px;border:1px solid #ffaa06;background:rgba(1,37,56,.9);color:#ffaa06;font-weight:700;opacity:.55;";
      b.onclick = () => ipPseudoFullscreen(false);
      document.body.appendChild(b);
    }
  } else {
    f.style.position = f.style.inset = f.style.width = f.style.height = f.style.minHeight = f.style.zIndex = f.style.borderRadius = "";
    f.style.cssText = "width:100%; height:calc(100vh - 330px); min-height:480px; border:0; border-radius:8px; background:#000;";
    if (b) b.remove();
  }
}

function interactivePresentationFullscreen() {
  const f = document.getElementById("ip-frame");
  if (!f) return;
  const req = f.requestFullscreen || f.webkitRequestFullscreen;
  if (!req) return ipPseudoFullscreen(true);
  let p;
  try { p = req.call(f); } catch (e) { return ipPseudoFullscreen(true); }
  if (p && p.catch) p.catch(() => ipPseudoFullscreen(true));
  else setTimeout(() => { if (!document.fullscreenElement && !document.webkitFullscreenElement) ipPseudoFullscreen(true); }, 400);
}

function exitInteractivePresentationBackToMenu() {
  const f = document.getElementById("ip-frame");
  ipPseudoFullscreen(false);
  if (f) f.removeAttribute("src");
  document.getElementById("canvas-module-interactive-presentation").style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}
