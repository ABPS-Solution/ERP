// ===========================================================================
// approvals/approvals-dashboard.js -- Approvals Dashboard (26 Oct 2026).
// Row 1 what is waiting now per approval kind, Row 2 how many were approved
// or rejected in the selected period, Row 3 the waiting list (oldest first)
// next to approvals done per day. Data: fetchApprovalsDashboardData.
// ===========================================================================
let apdCurrentPeriod     = "today";
let apdCurrentCustomType = "customday";
let apdChartDaily        = null;
const APD_CUSTOM_TYPE_SUFFIX = {
  customday: "day", customrange: "range", custommonth: "month",
  customquarter: "quarter", customyear: "year",
};
const APD_COLORS = ["#2563eb", "#7c3aed", "#b45309", "#0f766e", "#be185d", "#0369a1", "#15803d", "#dc2626"];

function navigateToApprovalsDashboard() {
  document.getElementById("dashboard-view").style.display = "none";
  const wc = document.getElementById("module-workspace-container");
  if (wc) wc.style.display = "none";
  document.querySelectorAll(".workspace-panel").forEach(p => p.style.display = "none");
  const c = document.getElementById("canvas-module-approvals-dashboard");
  if (c) c.style.display = "block";
  showDashboardGlobalToolbar("Approvals Dashboard", "apd-period-btns", apdReturnToMain);
  apdLoadDashboard();
}

function apdReturnToMain() {
  const c = document.getElementById("canvas-module-approvals-dashboard");
  if (c) c.style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

function apdSetPeriod(btn) {
  document.querySelectorAll("#apd-period-btns .dd-period-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  apdCurrentPeriod = btn.dataset.period;
  const customZone = document.getElementById("apd-custom-zone");
  if (apdCurrentPeriod === "custom") { customZone.style.display = "flex"; requestAnimationFrame(syncDashboardCanvasTopPadding); return; }
  customZone.style.display = "none";
  requestAnimationFrame(syncDashboardCanvasTopPadding);
  apdLoadDashboard();
}

function apdCustomTypeChange() {
  const type = document.getElementById("apd-custom-type").value;
  apdCurrentCustomType = type;
  const activeSuffix = APD_CUSTOM_TYPE_SUFFIX[type];
  Object.values(APD_CUSTOM_TYPE_SUFFIX).forEach(suf => {
    const el = document.getElementById(`apd-custom-val-${suf}`);
    if (el) el.hidden = (suf !== activeSuffix);
  });
}

function apdReadCustomVal() {
  const type = document.getElementById("apd-custom-type").value;
  if (type === "customday") return document.getElementById("apd-custom-val-day-input").value.trim();
  if (type === "customrange") {
    const s = document.getElementById("apd-custom-val-range-start").value.trim();
    const e = document.getElementById("apd-custom-val-range-end").value.trim();
    return (s && e) ? `${s}_${e}` : "";
  }
  if (type === "custommonth") {
    const y = document.getElementById("apd-custom-val-month-year").value;
    const m = document.getElementById("apd-custom-val-month-month").value;
    return (y && m) ? `${y}-${String(m).padStart(2, "0")}` : "";
  }
  if (type === "customquarter") {
    const y = document.getElementById("apd-custom-val-quarter-year").value;
    const q = document.getElementById("apd-custom-val-quarter-q").value;
    return (y && q) ? `${y}-Q${q}` : "";
  }
  const el = document.getElementById(`apd-custom-val-${APD_CUSTOM_TYPE_SUFFIX[type]}`);
  return el ? el.value.trim() : "";
}

function apdLoadCustom() {
  const val = apdReadCustomVal();
  if (!val) return abpsAlert("Please enter a value for the custom period.");
  apdCurrentPeriod = apdCurrentCustomType;
  apdLoadDashboard(val);
}

// Leaves the dashboard and opens that kind's approval screen.
function apdOpenApproval(cardId) {
  dashboardGlobalReturnClick();
  const card = document.getElementById(cardId);
  if (card) card.click();
}

async function apdLoadDashboard(customVal) {
  try {
    const data = await apFetch({ action: "fetchApprovalsDashboardData", periodType: apdCurrentPeriod, periodValue: customVal || "" });
    if (!data.success) { abpsAlert("Approvals Dashboard load failed: " + data.error); return; }
    apdRender(data);
  } catch (e) {
    if (e.message !== "SESSION_EXPIRED") abpsAlert("Approvals Dashboard error: " + e.message);
  }
}

function apdRender(data) {
  const kinds = data.kinds || [];
  const tile = (cls, label, val, color) => `<div class="dd-stat-card ${cls}"><div class="dd-stat-label">${escapeHtml(label)}</div><div class="dd-stat-val" style="color:${color};">${val}</div></div>`;
  document.getElementById("apd-row1").innerHTML = kinds.map(k => tile("stat-live", `${k.label} Pending`, k.pending, k.pending ? "#b45309" : "var(--muted)")).join("");
  document.getElementById("apd-row2").innerHTML = kinds.map(k => tile("stat-period", `${k.label} Done`, k.done, "#15803d")).join("");

  const tbody = document.getElementById("apd-waiting-tbody");
  const rows = data.waiting || [];
  tbody.innerHTML = rows.length ? rows.map((r, i) => {
    const bg = i % 2 === 0 ? "var(--card)" : "#f8fafc";
    const dc = r.days >= 3 ? "#b91c1c" : (r.days >= 1 ? "#b45309" : "var(--muted)");
    return `<tr style="background:${bg}; border-bottom:1px solid var(--border);">
      <td style="padding:4px 6px; font-weight:700;">${escapeHtml(r.kind)}</td>
      <td style="padding:4px 6px;"><div style="font-weight:600; word-break:break-word;">${escapeHtml(r.doc || "")}</div>${r.detail ? `<div style="color:var(--muted); font-size:0.68rem; word-break:break-word;">${escapeHtml(r.detail)}</div>` : ""}</td>
      <td style="padding:4px 6px;">${escapeHtml(r.who || "-")}</td>
      <td style="padding:4px 6px; white-space:nowrap;">${r.at ? formatOrdinalDate(r.at) : "-"}</td>
      <td style="padding:4px 6px; text-align:center; font-weight:700; color:${dc};">${r.days == null ? "-" : r.days}</td>
      <td style="padding:4px 6px; text-align:right;"><a href="javascript:void(0)" onclick="apdOpenApproval(${jsArg(r.card)})" style="font-weight:700; color:var(--brand); white-space:nowrap;">Open ↗</a></td>
    </tr>`;
  }).join("") : `<tr><td colspan="6" style="color:var(--muted); font-size:0.72rem; padding:8px; text-align:center;">Nothing is waiting for approval.</td></tr>`;

  if (apdChartDaily) apdChartDaily.destroy();
  const ctx = document.getElementById("apd-chart-daily").getContext("2d");
  const chart = data.chart || { labels: [], series: {} };
  apdChartDaily = new Chart(ctx, {
    type: "bar",
    data: {
      labels: chart.labels,
      datasets: kinds.map((k, i) => ({ label: k.label, data: chart.series[k.key] || [], backgroundColor: APD_COLORS[i % APD_COLORS.length], borderRadius: 2 })),
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { font: { size: 9 }, boxWidth: 10 } } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 } } },
                y: { stacked: true, beginAtZero: true, grid: { color: "#f1f5f9" }, ticks: { precision: 0 } } } },
  });
}
