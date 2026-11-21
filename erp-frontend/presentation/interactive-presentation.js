// Interactive Presentation (prototype, Admin): hosts the single-window demo page in an iframe.
function initializeInteractivePresentationPanel() {
  const f = document.getElementById("ip-frame");
  if (f && !f.getAttribute("src")) f.setAttribute("src", "presentation/interactive-demo.html");
}

function interactivePresentationFullscreen() {
  const f = document.getElementById("ip-frame");
  if (f && f.requestFullscreen) f.requestFullscreen().catch(() => {});
}

function exitInteractivePresentationBackToMenu() {
  const f = document.getElementById("ip-frame");
  if (f) f.removeAttribute("src");
  document.getElementById("canvas-module-interactive-presentation").style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}
