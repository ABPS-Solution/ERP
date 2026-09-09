// ═══════════════════════════════════════════════════════
// ACCOUNTS DASHBOARD ENGINE — same engine shape as
// purchase/purchase-dashboard.js, `ad` prefix. 3 tile rows (15 tiles) +
// 3 charts, no list-panel row (see CLAUDE.md's Accounts Dashboard plan
// for why the layout differs from the other 4 dashboards).
// ═══════════════════════════════════════════════════════
let adCurrentPeriod = "today";
let adCurrentCustomType = "customday";
let adChartTrend = null, adChartTourType = null, adChartDailyType = null;

// ── Minimal shared dashboard shell ──────────────────────────────────
// Portal's version of this (marketing/marketing-dashboard.js) is
// generalized across 5 department dashboards with a lot of
// enclosure-panel bookkeeping ERP doesn't have (ERP's canvas panels are
// plain top-level .workspace-panel divs, no *-workspace-enclosure-panel
// wrapper). Trimmed to exactly what the one Accounts Dashboard needs;
// if a second ERP dashboard is ever added, generalize this the same way
// Portal's own history did, not before.
let activeDashboardReturnFn = null;
function dashboardGlobalReturnClick() {
  document.getElementById("dashboard-global-toolbar").style.display = "none";
  const appHeader = document.querySelector('header');
  if (appHeader) appHeader.style.display = "";
  document.querySelectorAll('.workspace-panel[id^="canvas-module-"][id*="dashboard"]').forEach(c => c.style.paddingTop = "");
  if (activeDashboardReturnFn) activeDashboardReturnFn();
  activeDashboardReturnFn = null;
}

// Recomputes the visible dashboard canvas's top padding from the shared
// toolbar's real current height (it grows when the Custom row opens) —
// self-correcting measurement, never a hardcoded assumption about any
// ancestor's own padding. See Portal's marketing-dashboard.js for the
// full reasoning behind this approach.
function syncDashboardCanvasTopPadding() {
  const toolbar = document.getElementById("dashboard-global-toolbar");
  if (!toolbar || toolbar.style.display === "none") return;
  const GAP_BELOW_TOOLBAR = 10;
  const toolbarBottom = toolbar.getBoundingClientRect().bottom;
  document.querySelectorAll('.workspace-panel[id^="canvas-module-"][id*="dashboard"]').forEach(c => {
    if (c.style.display !== "block") return;
    c.style.paddingTop = "0px";
    const naturalTop = c.getBoundingClientRect().top;
    const needed = Math.max(0, toolbarBottom + GAP_BELOW_TOOLBAR - naturalTop);
    c.style.paddingTop = needed + "px";
  });
}

function showDashboardGlobalToolbar(title, returnFn) {
  activeDashboardReturnFn = returnFn;
  const toolbar = document.getElementById("dashboard-global-toolbar");
  toolbar.style.display = "block";
  const appHeader = document.querySelector('header');
  if (appHeader) appHeader.style.display = "none";
  requestAnimationFrame(syncDashboardCanvasTopPadding);
  document.getElementById("dash-global-title").textContent = title;
}

function navigateToAccountsDashboard() {
  document.getElementById("dashboard-view").style.display = "none";
  document.querySelectorAll(".workspace-panel").forEach(p => p.style.display = "none");
  const c = document.getElementById("canvas-module-accounts-dashboard");
  if (c) c.style.display = "block";
  showDashboardGlobalToolbar("Accounts Dashboard", adReturnToMain);
  adLoadDashboard();
}

function adReturnToMain() {
  const c = document.getElementById("canvas-module-accounts-dashboard");
  if (c) c.style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

function adSetPeriod(btn) {
  document.querySelectorAll("#ad-period-btns .dd-period-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  adCurrentPeriod = btn.dataset.period;
  const cz = document.getElementById("ad-custom-zone");
  if (adCurrentPeriod === "custom") { cz.style.display = "flex"; requestAnimationFrame(syncDashboardCanvasTopPadding); return; }
  cz.style.display = "none";
  requestAnimationFrame(syncDashboardCanvasTopPadding);
  adLoadDashboard();
}

// 9 Sep 2026: replaced the old single-input-with-mutated-.type approach
// (which left the browser's native date-picker chrome visually stuck on
// top of the wrong widget whenever the type flipped — the exact bug
// Portal's 7 dashboards hit and fixed the same way earlier this week) with
// dedicated, always-present controls per granularity, toggled via the
// `hidden` attribute instead of ever touching `.type`. Also switched
// Month/Quarter/Year from typed/native-picker input to pick-from-options
// <select>s, and renamed "Week" (pick one day, snapped to its Mon-Sun
// week) to "Date Range" (two real date inputs, no snapping) — ported from
// Portal's shared marketing/marketing-dashboard.js helpers, kept local
// here since ERP only has this one dashboard so far.
const AD_CUSTOM_TYPE_SUFFIX = {
  customday: "day", customrange: "range", custommonth: "month",
  customquarter: "quarter", customyear: "year",
};
let adYearSelectsPopulated = false;
function adPopulateYearSelects() {
  if (adYearSelectsPopulated) return;
  adYearSelectsPopulated = true;
  const now = new Date();
  const curCalYear = now.getFullYear();
  const curFY = now.getMonth() >= 3 ? curCalYear : curCalYear - 1; // FY starts April (month index 3)
  const calYears = []; for (let y = curCalYear; y >= curCalYear - 5; y--) calYears.push(y);
  const fyYears = []; for (let y = curFY; y >= curFY - 5; y--) fyYears.push(y);
  document.querySelectorAll(".dash-cal-year-select").forEach(sel => {
    sel.innerHTML = calYears.map(y => `<option value="${y}">${y}</option>`).join("");
  });
  document.querySelectorAll(".dash-fy-year-select").forEach(sel => {
    sel.innerHTML = fyYears.map(y => `<option value="${y}">${y}-${String((y + 1) % 100).padStart(2, "0")}</option>`).join("");
  });
}
adPopulateYearSelects();

function adCustomTypeChange() {
  const type = document.getElementById("ad-custom-type").value;
  adCurrentCustomType = type;
  const activeSuffix = AD_CUSTOM_TYPE_SUFFIX[type];
  Object.values(AD_CUSTOM_TYPE_SUFFIX).forEach(suf => {
    const el = document.getElementById(`ad-custom-val-${suf}`);
    if (el) el.hidden = (suf !== activeSuffix);
  });
}

function adReadCustomVal() {
  const type = document.getElementById("ad-custom-type").value;
  if (type === "customrange") {
    const s = document.getElementById("ad-custom-val-range-start").value.trim();
    const e = document.getElementById("ad-custom-val-range-end").value.trim();
    return (s && e) ? `${s}_${e}` : "";
  }
  if (type === "custommonth") {
    const y = document.getElementById("ad-custom-val-month-year").value;
    const m = document.getElementById("ad-custom-val-month-month").value;
    return (y && m) ? `${y}-${String(m).padStart(2, "0")}` : "";
  }
  if (type === "customquarter") {
    const y = document.getElementById("ad-custom-val-quarter-year").value;
    const q = document.getElementById("ad-custom-val-quarter-q").value;
    return (y && q) ? `${y}-Q${q}` : "";
  }
  const el = document.getElementById(`ad-custom-val-${AD_CUSTOM_TYPE_SUFFIX[type]}`);
  return el ? el.value.trim() : "";
}

function adLoadCustom() {
  const val = adReadCustomVal();
  if (!val) return alert("Please enter a value for the custom period.");
  adCurrentPeriod = adCurrentCustomType;
  adLoadDashboard(val);
}

async function adLoadDashboard(customVal) {
  ["ad-s-unchecked","ad-s-openadv","ad-s-unactioned","ad-s-cashbox","ad-s-outstanding",
   "ad-s-totalexp","ad-s-tourpaid","ad-s-dailyspent","ad-s-travelpaid","ad-s-advpaid",
   "ad-s-vouchers","ad-s-checktime","ad-s-variance","ad-s-overlimit","ad-s-topups"].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = "…";
  });
  try {
    const data = await apFetch({
      action:      "fetchAccountsDashboardData",
      periodType:  adCurrentPeriod,
      periodValue: customVal || "",
    });
    if (!data.success) { alert("Dashboard load failed: " + data.error); return; }
    adRenderDashboard(data);
  } catch (e) {
    alert("Dashboard error: " + e.message);
  }
}

function adFmtINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// Mirrors pdFormatPct's null->"—" shape, for the Avg Voucher Check Time
// tile — null means zero vouchers were checked in the period, not zero
// days.
function adFormatDays(n) {
  return n === null || n === undefined ? "—" : n + (n === 1 ? " day" : " days");
}

function adRenderDashboard(data) {
  const { stats, expenseTrend, tourSpendByType, dailySpendByType } = data;

  // Row 1 — live backlog
  document.getElementById("ad-s-unchecked").textContent = stats.uncheckedVouchers;
  document.getElementById("ad-s-unchecked-sub").textContent = stats.uncheckedVouchers === 0
    ? "queue clear" : `oldest ${stats.oldestUncheckedDays ?? 0}d waiting`;

  document.getElementById("ad-s-openadv").textContent = stats.openAdvances;
  document.getElementById("ad-s-openadv-sub").textContent = adFmtINR(stats.openAdvanceAmount) + " out";

  document.getElementById("ad-s-unactioned").textContent = stats.unactionedTravellers;
  document.getElementById("ad-s-unactioned-sub").textContent = adFmtINR(stats.unactionedTravelAmount) + " unreconciled"
    + ` (${stats.unactionedTicketCount} ticket${stats.unactionedTicketCount === 1 ? '' : 's'} · ${stats.unactionedHotelCount} hotel${stats.unactionedHotelCount === 1 ? '' : 's'})`;

  const cashBoxEl = document.getElementById("ad-s-cashbox");
  cashBoxEl.textContent = adFmtINR(stats.cashBoxCombined);
  cashBoxEl.style.color = stats.cashBoxInRange ? "var(--text)" : "#b91c1c";
  document.getElementById("ad-s-cashbox-sub").textContent = stats.cashBoxInRange
    ? `Cash ${adFmtINR(stats.cashBalance)} · UPI ${adFmtINR(stats.upiBalance)}`
    : `⚠ outside ₹3,000–₹10,000 target`;

  document.getElementById("ad-s-outstanding").textContent = adFmtINR(stats.outstandingAmount);
  document.getElementById("ad-s-outstanding-sub").textContent =
    `${stats.outstandingEmployees} employee${stats.outstandingEmployees === 1 ? '' : 's'}`
    + (stats.outstandingFromAdvances > 0 ? ` · incl. ${adFmtINR(stats.outstandingFromAdvances)} open advances` : '');

  // Row 2 — money out
  document.getElementById("ad-s-totalexp").textContent = adFmtINR(stats.totalExpense);
  document.getElementById("ad-s-tourpaid").textContent = adFmtINR(stats.tourPaid);
  document.getElementById("ad-s-dailyspent").textContent = adFmtINR(stats.cashSpent);
  document.getElementById("ad-s-dailyspent-sub").textContent = stats.onlineSpent > 0 ? `${adFmtINR(stats.onlineSpent)} online` : '';
  document.getElementById("ad-s-travelpaid").textContent = adFmtINR(stats.travelPaid);
  document.getElementById("ad-s-travelpaid-sub").textContent =
    `${stats.travelTicketCount} ticket${stats.travelTicketCount === 1 ? '' : 's'} · ${stats.travelHotelCount} hotel${stats.travelHotelCount === 1 ? '' : 's'}`;
  document.getElementById("ad-s-advpaid").textContent = adFmtINR(stats.advancesPaid);
  document.getElementById("ad-s-advpaid-sub").textContent = `${stats.advanceCount} advance${stats.advanceCount === 1 ? '' : 's'}`;

  // Row 3 — activity & control
  document.getElementById("ad-s-vouchers").textContent = stats.vouchersChecked;
  document.getElementById("ad-s-checktime").textContent = adFormatDays(stats.avgCheckDays);

  const varianceEl = document.getElementById("ad-s-variance");
  varianceEl.textContent = stats.claimVariancePct === null ? "—" : stats.claimVariancePct + "%";
  varianceEl.style.color = stats.claimVariancePct === null ? "var(--text)" : (stats.claimVariancePct < 0 ? "#b91c1c" : "#15803d");

  document.getElementById("ad-s-overlimit").textContent = adFmtINR(stats.overLimitAmount);
  document.getElementById("ad-s-overlimit-sub").textContent = `${stats.overLimitLines} line${stats.overLimitLines === 1 ? '' : 's'} flagged`;

  document.getElementById("ad-s-topups").textContent = adFmtINR(stats.topups);

  // Chart 1 — Expense Trend. Single-bucket period renders as a bar (a
  // 1-point line chart is an invisible dot), same convention as
  // Purchase's RM PO trend chart.
  if (adChartTrend) adChartTrend.destroy();
  const ctx1 = document.getElementById("ad-chart-trend").getContext("2d");
  if (expenseTrend.length === 0) {
    adChartTrend = new Chart(ctx1, { type: "line", data: { labels: ["No data"], datasets: [{ data: [0], borderColor: "#f1f5f9" }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } else if (expenseTrend.length === 1) {
    adChartTrend = new Chart(ctx1, {
      type: "bar",
      data: { labels: expenseTrend.map(t => t.label), datasets: [{ label: "Expense", data: expenseTrend.map(t => t.amount), backgroundColor: "rgba(37,99,235,0.75)", borderRadius: 4, barThickness: 40 }] },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 9 } } }, y: { grid: { color: "#f1f5f9" } } }
      }
    });
  } else {
    adChartTrend = new Chart(ctx1, {
      type: "line",
      data: {
        labels: expenseTrend.map(t => t.label),
        datasets: [{
          label: "Expense", data: expenseTrend.map(t => t.amount),
          borderColor: "rgba(37,99,235,0.9)", backgroundColor: "rgba(37,99,235,0.12)",
          tension: 0.25, fill: true, pointRadius: 3, pointBackgroundColor: "rgba(37,99,235,0.9)",
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 9 } } }, y: { grid: { color: "#f1f5f9" } } }
      }
    });
  }

  // Chart (left) — Tour Expense by Type, top 5 (horizontal bar)
  if (adChartTourType) adChartTourType.destroy();
  const ctx2 = document.getElementById("ad-chart-tour-type").getContext("2d");
  if (tourSpendByType.length === 0) {
    adChartTourType = new Chart(ctx2, { type: "bar", data: { labels: ["No data"], datasets: [{ data: [0], backgroundColor: "#f1f5f9" }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } else {
    adChartTourType = new Chart(ctx2, {
      type: "bar",
      data: { labels: tourSpendByType.map(r => r.label), datasets: [{ label: "Amount", data: tourSpendByType.map(r => r.amount), backgroundColor: "rgba(124,58,237,0.7)", borderRadius: 3 }] },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { color: "#f1f5f9" } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } }
      }
    });
  }

  // Chart (right) — Daily Expense by Type, top 5 (horizontal bar)
  if (adChartDailyType) adChartDailyType.destroy();
  const ctx3 = document.getElementById("ad-chart-daily-type").getContext("2d");
  if (dailySpendByType.length === 0) {
    adChartDailyType = new Chart(ctx3, { type: "bar", data: { labels: ["No data"], datasets: [{ data: [0], backgroundColor: "#f1f5f9" }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } else {
    adChartDailyType = new Chart(ctx3, {
      type: "bar",
      data: { labels: dailySpendByType.map(r => r.label), datasets: [{ label: "Amount", data: dailySpendByType.map(r => r.amount), backgroundColor: "rgba(15,118,110,0.7)", borderRadius: 3 }] },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { color: "#f1f5f9" } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } }
      }
    });
  }
}
