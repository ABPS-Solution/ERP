// ===========================================================================
// project/project-dashboard.js -- Project Department Dashboard (28 Sep 2026).
// Same shape as every other department dashboard: Row 1 live figures, Row 2
// figures for the selected period, Row 3 charts, Row 4 tables. Created
// empty on purpose; tiles are added as they are decided.
// ===========================================================================
let pjdCurrentPeriod     = "today";
let pjdCurrentCustomType = "customday";
const PJD_CUSTOM_TYPE_SUFFIX = {
  customday: "day", customrange: "range", custommonth: "month",
  customquarter: "quarter", customyear: "year",
};

function navigateToProjectDashboard() {
  document.getElementById("dashboard-view").style.display = "none";
  const wc = document.getElementById("module-workspace-container");
  if (wc) wc.style.display = "none";
  document.querySelectorAll(".workspace-panel").forEach(p => p.style.display = "none");
  const c = document.getElementById("canvas-module-project-dashboard");
  if (c) c.style.display = "block";
  showDashboardGlobalToolbar("Project Dashboard", "pjd-period-btns", pjdReturnToMain);
  if (typeof pjdLoadDashboard === "function") pjdLoadDashboard();
}

function pjdReturnToMain() {
  const c = document.getElementById("canvas-module-project-dashboard");
  if (c) c.style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

function pjdSetPeriod(btn) {
  document.querySelectorAll("#pjd-period-btns .dd-period-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  pjdCurrentPeriod = btn.dataset.period;
  const customZone = document.getElementById("pjd-custom-zone");
  if (pjdCurrentPeriod === "custom") { customZone.style.display = "flex"; requestAnimationFrame(syncDashboardCanvasTopPadding); return; }
  customZone.style.display = "none";
  requestAnimationFrame(syncDashboardCanvasTopPadding);
  pjdLoadDashboard();
}

// ERP convention: five dedicated inputs toggled with the `hidden`
// attribute, never an <input> whose `type` is mutated at runtime — that
// pattern leaves a ghosted native date-picker behind (Portal's 8-9 Sep
// 2026 landmine). Portal's own shared dashCustomTypeChange("pjd") /
// dashReadCustomVal("pjd") live in its marketing/marketing-dashboard.js
// and do not exist here; this is the same pjd-prefixed version every
// other ERP dashboard already uses.
function pjdCustomTypeChange() {
  const type = document.getElementById("pjd-custom-type").value;
  pjdCurrentCustomType = type;
  const activeSuffix = PJD_CUSTOM_TYPE_SUFFIX[type];
  Object.values(PJD_CUSTOM_TYPE_SUFFIX).forEach(suf => {
    const el = document.getElementById(`pjd-custom-val-${suf}`);
    if (el) el.hidden = (suf !== activeSuffix);
  });
}

function pjdReadCustomVal() {
  const type = document.getElementById("pjd-custom-type").value;
  if (type === "customday") {
    return document.getElementById("pjd-custom-val-day-input").value.trim();
  }
  if (type === "customrange") {
    const s = document.getElementById("pjd-custom-val-range-start").value.trim();
    const e = document.getElementById("pjd-custom-val-range-end").value.trim();
    return (s && e) ? `${s}_${e}` : "";
  }
  if (type === "custommonth") {
    const y = document.getElementById("pjd-custom-val-month-year").value;
    const m = document.getElementById("pjd-custom-val-month-month").value;
    return (y && m) ? `${y}-${String(m).padStart(2, "0")}` : "";
  }
  if (type === "customquarter") {
    const y = document.getElementById("pjd-custom-val-quarter-year").value;
    const q = document.getElementById("pjd-custom-val-quarter-q").value;
    return (y && q) ? `${y}-Q${q}` : "";
  }
  const el = document.getElementById(`pjd-custom-val-${PJD_CUSTOM_TYPE_SUFFIX[type]}`);
  return el ? el.value.trim() : "";
}

function pjdLoadCustom() {
  const val = pjdReadCustomVal();
  if (!val) return alert("Please enter a value for the custom period.");
  pjdCurrentPeriod = pjdCurrentCustomType;
  pjdLoadDashboard(val);
}

async function pjdLoadDashboard(customVal) {
  try {
    const data = await apFetch({
      action:      "fetchProjectDashboardData",
      periodType:  pjdCurrentPeriod,
      periodValue: customVal || "",
      todayOverride: localStorage.getItem("erpPtlTodayOverride") || ""
    });
    if (!data.success) { alert("Project Dashboard load failed: " + data.error); return; }
  } catch (e) {
    if (e.message !== "SESSION_EXPIRED") alert("Project Dashboard error: " + e.message);
  }
}
