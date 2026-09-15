// ═══════════════════════════════════════════════════════════════════════
// project/admin-dashboard.js — Admin Dashboard. Same shape as every other
// department dashboard (qa/qa-dashboard.js is the closest twin — no
// Row 4 detail tables here, this screen is pure roll-up KPIs).
//
// Two figures are DELIBERATE APPROXIMATIONS, flagged in their own sub-
// label rather than presented as exact — see lib/adminDashboard.js's own
// header comment for the full reasoning (no FIFO/weighted-average
// costing exists anywhere in this schema):
//   - RM + Spare Store value = current quantity x last purchase rate.
//   - FG (in store) value = design-costed rate, not actual landed cost.
//
// Custom-period type helpers (dashCustomTypeChange/dashReadCustomVal in
// Portal) are kept LOCAL here with an "adm" prefix, following ERP's own
// established precedent for this port (accounts-dashboard.js's
// AD_CUSTOM_TYPE_SUFFIX/adCustomTypeChange/adReadCustomVal, mirrored again
// for Marketing's own MD_CUSTOM_TYPE_SUFFIX/mdCustomTypeChange/
// mdReadCustomVal) rather than the shared generic dashCustomTypeChange/
// dashReadCustomVal/ddShowAllWorkspaceEnclosures Portal's copy calls —
// none of those three exist in ERP (ERP's canvas panels are plain
// top-level .workspace-panel divs, no *-workspace-enclosure-panel
// wrapper to sweep). A future third+ dashboard needing this again is the
// right time to generalize, not before.
// ═══════════════════════════════════════════════════════════════════════
let admCurrentPeriod     = "today";
let admCurrentCustomType = "customday";
let admChartPoTrend = null;

const ADM_CUSTOM_TYPE_SUFFIX = {
  customday: "day", customrange: "range", custommonth: "month",
  customquarter: "quarter", customyear: "year",
};
let admYearSelectsPopulated = false;
function admPopulateYearSelects() {
  if (admYearSelectsPopulated) return;
  admYearSelectsPopulated = true;
  const now = new Date();
  const curCalYear = now.getFullYear();
  const curFY = now.getMonth() >= 3 ? curCalYear : curCalYear - 1; // FY starts April (month index 3)
  const EARLIEST_YEAR = 2026; // system went live 2026 — no real data before it
  const calYears = []; for (let y = curCalYear; y >= EARLIEST_YEAR; y--) calYears.push(y);
  const fyYears = []; for (let y = curFY; y >= EARLIEST_YEAR; y--) fyYears.push(y);
  document.querySelectorAll("#adm-body .dash-cal-year-select").forEach(sel => {
    sel.innerHTML = calYears.map(y => `<option value="${y}">${y}</option>`).join("");
  });
  document.querySelectorAll("#adm-body .dash-fy-year-select").forEach(sel => {
    sel.innerHTML = fyYears.map(y => `<option value="${y}">${y}-${String((y + 1) % 100).padStart(2, "0")}</option>`).join("");
  });
}
admPopulateYearSelects();

function navigateToAdminDashboard() {
  document.getElementById("dashboard-view").style.display = "none";
  document.getElementById("module-workspace-container").style.display = "none";
  document.querySelectorAll(".workspace-panel").forEach(p => p.style.display = "none");
  const c = document.getElementById("canvas-module-admin-dashboard");
  if (c) c.style.display = "block";
  showDashboardGlobalToolbar("Admin Dashboard", "adm-period-btns", admReturnToMain);
  if (typeof admLoadDashboard === "function") admLoadDashboard();
}

function admReturnToMain() {
  const c = document.getElementById("canvas-module-admin-dashboard");
  if (c) c.style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

function admSetPeriod(btn) {
  document.querySelectorAll("#adm-period-btns .dd-period-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  admCurrentPeriod = btn.dataset.period;
  const customZone = document.getElementById("adm-custom-zone");
  if (admCurrentPeriod === "custom") { customZone.style.display = "flex"; requestAnimationFrame(syncDashboardCanvasTopPadding); return; }
  customZone.style.display = "none";
  requestAnimationFrame(syncDashboardCanvasTopPadding);
  admLoadDashboard();
}

function admCustomTypeChange() {
  const type = document.getElementById("adm-custom-type").value;
  admCurrentCustomType = type;
  const activeSuffix = ADM_CUSTOM_TYPE_SUFFIX[type];
  Object.values(ADM_CUSTOM_TYPE_SUFFIX).forEach(suf => {
    const el = document.getElementById(`adm-custom-val-${suf}`);
    if (el) el.hidden = (suf !== activeSuffix);
  });
}

function admReadCustomVal() {
  const type = document.getElementById("adm-custom-type").value;
  if (type === "customday") {
    return document.getElementById("adm-custom-val-day-input").value.trim();
  }
  if (type === "customrange") {
    const s = document.getElementById("adm-custom-val-range-start").value.trim();
    const e = document.getElementById("adm-custom-val-range-end").value.trim();
    return (s && e) ? `${s}_${e}` : "";
  }
  if (type === "custommonth") {
    const y = document.getElementById("adm-custom-val-month-year").value;
    const m = document.getElementById("adm-custom-val-month-month").value;
    return (y && m) ? `${y}-${String(m).padStart(2, "0")}` : "";
  }
  if (type === "customquarter") {
    const y = document.getElementById("adm-custom-val-quarter-year").value;
    const q = document.getElementById("adm-custom-val-quarter-q").value;
    return (y && q) ? `${y}-Q${q}` : "";
  }
  const el = document.getElementById(`adm-custom-val-${ADM_CUSTOM_TYPE_SUFFIX[type]}`);
  return el ? el.value.trim() : "";
}

function admLoadCustom() {
  const val = admReadCustomVal();
  if (!val) return alert("Please enter a value for the custom period.");
  admCurrentPeriod = admCurrentCustomType;
  admLoadDashboard(val);
}

function admFmtInr(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// erpPtlTodayOverride — same admin-only, client-side-only "today" override
// every other dashboard's Due/Overdue panels already respect (Project
// Timeline itself writes it) — this screen's "live" tiles (on-order
// value, late POs, LD exposure) agree with whatever test scenario an
// admin has set up there.
async function admLoadDashboard(customVal) {
  ["adm-s-stockrm", "adm-s-stockfg", "adm-s-onorder", "adm-s-ldexposure", "adm-s-latepo",
   "adm-s-poorder", "adm-s-delivered", "adm-s-cashbox", "adm-s-advances"].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = "…";
  });
  try {
    const data = await apFetch({
      action:      "fetchAdminDashboardData",
      periodType:  admCurrentPeriod,
      periodValue: customVal || "",
      todayOverride: localStorage.getItem("erpPtlTodayOverride") || "",
    });
    if (!data.success) { alert("Admin Dashboard load failed: " + data.error); return; }
    admRenderDashboard(data);
  } catch (e) {
    alert("Admin Dashboard error: " + e.message);
  }
}

function admRenderDashboard(data) {
  const { stockValue, poOrderValue, deliveredValue, onOrderValue, latePo, ldExposure, cash, poTrend } = data;

  // Row 1 — live
  document.getElementById("adm-s-stockrm").textContent = admFmtInr(stockValue.rmSpare);
  document.getElementById("adm-s-stockfg").textContent = admFmtInr(stockValue.fg);
  document.getElementById("adm-s-onorder").textContent = admFmtInr(onOrderValue);
  document.getElementById("adm-s-ldexposure").textContent = admFmtInr(ldExposure.total);
  document.getElementById("adm-s-ldexposure-sub").textContent = ldExposure.atRiskCount > 0
    ? `${ldExposure.atRiskCount} project(s) at risk` : "";
  document.getElementById("adm-s-latepo").textContent = admFmtInr(latePo.value);
  document.getElementById("adm-s-latepo-sub").textContent = latePo.poCount > 0
    ? `${latePo.poCount} PO(s) late` : "";

  // Row 2 — mixed live/period
  document.getElementById("adm-s-poorder").textContent = admFmtInr(poOrderValue.value);
  document.getElementById("adm-s-poorder-sub").textContent = `${poOrderValue.count} PO(s)`;
  document.getElementById("adm-s-delivered").textContent = admFmtInr(deliveredValue);
  document.getElementById("adm-s-cashbox").textContent = admFmtInr(cash.cashBoxTotal);
  document.getElementById("adm-s-advances").textContent = admFmtInr(cash.advancesOutstanding);

  // Chart — RM PO Order Value Over Time (single-day period -> one bar,
  // same reasoning as every other dashboard's own trend chart).
  if (admChartPoTrend) admChartPoTrend.destroy();
  const ctx = document.getElementById("adm-chart-po-trend").getContext("2d");
  if (poTrend.length === 0) {
    admChartPoTrend = new Chart(ctx, { type: "line", data: { labels: ["No data"], datasets: [{ data: [0], borderColor: "#f1f5f9" }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } else if (poTrend.length === 1) {
    admChartPoTrend = new Chart(ctx, {
      type: "bar",
      data: {
        labels: poTrend.map(t => t.label),
        datasets: [{ label: "PO Value", data: poTrend.map(t => t.value), backgroundColor: "rgba(37,99,235,0.75)", borderRadius: 4, barThickness: 40 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { grid: { color: "#f1f5f9" }, ticks: { callback: v => admFmtInr(v) } }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } }
      }
    });
  } else {
    admChartPoTrend = new Chart(ctx, {
      type: "line",
      data: {
        labels: poTrend.map(t => t.label),
        datasets: [{ label: "PO Value", data: poTrend.map(t => t.value),
          borderColor: "rgba(37,99,235,0.8)", backgroundColor: "rgba(37,99,235,0.08)",
          pointRadius: 3, fill: true, tension: 0.3 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { grid: { color: "#f1f5f9" }, ticks: { callback: v => admFmtInr(v) } }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } }
      }
    });
  }
}
