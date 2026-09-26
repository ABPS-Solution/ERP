// ═══════════════════════════════════════════════════════
// MARKETING DASHBOARD ENGINE — ported from ABPS Portal's
// marketing/marketing-dashboard.js (15 Sep 2026). Portal's copy of this
// file is actually shared infrastructure for 5+ department dashboards
// (Design/Purchase/Store/Accounts/Production all route through it, an
// artifact of Portal's automated department split putting shared code in
// whichever file loaded first) — only the "md"-prefixed functions below
// are genuinely Marketing's own. The shared toolbar mechanism
// (activeDashboardReturnFn / dashboardGlobalReturnClick /
// syncDashboardCanvasTopPadding / showDashboardGlobalToolbar) already
// exists in ERP's accounts/accounts-dashboard.js (ERP's first dashboard)
// and was generalized there (3-arg signature, periodBtnsId) rather than
// duplicated here — a second top-level `let activeDashboardReturnFn`
// declaration in this file would be a fatal SyntaxError (both files share
// one global scope). Do NOT redeclare any of those four here.
//
// mdCurrentPeriod/mdCurrentCustomType/mdChartFunnel/mdChartPotential/
// mdChartVertical were themselves misplaced in Portal — they actually live
// in store/revise-prn.js there, not marketing-dashboard.js (found by
// grepping for their real declaration site). ERP already has its own
// store/revise-prn.js carrying that exact same artifact forward from an
// earlier port, so this file does NOT redeclare them — see the comment
// just above their first use below.
//
// Following ERP's own established precedent (accounts-dashboard.js's own
// comment: "if a second ERP dashboard is ever added, generalize this the
// same way Portal's own history did, not before") the Custom-period type
// helpers (dashCustomTypeChange/dashReadCustomVal/dashPopulateYearSelects
// in Portal) are kept LOCAL here with an "md" prefix, exactly mirroring
// accounts-dashboard.js's own local AD_CUSTOM_TYPE_SUFFIX/adCustomTypeChange/
// adReadCustomVal/adPopulateYearSelects — not shared, to avoid touching
// Accounts' already-working code for this port. A future third dashboard
// is the right time to generalize both into one shared file.
// ═══════════════════════════════════════════════════════
// mdCurrentPeriod/mdCurrentCustomType/mdChartFunnel/mdChartPotential/
// mdChartVertical are declared HERE, in their real owner file — NOT in
// store/revise-prn.js the way Portal's own (misplaced) copy has them.
// 15 Sep 2026: an earlier session in THIS repo, working from Portal's
// history, mistook Portal's misplaced declaration in store/revise-prn.js
// for genuinely dead code and deleted it outright (no equivalent existed
// here to replace it) — that broke this dashboard with a live
// "mdCurrentPeriod is not defined" error the moment it was opened, since
// nothing anywhere declared these names. Fixed by declaring them properly
// in the file that actually reads/writes them, rather than reintroducing
// Portal's own misplacement. Do NOT add a second declaration to
// store/revise-prn.js — that file's own comment (~line 500) documents
// this history.
let mdChartFunnel = null, mdChartPotential = null, mdChartVertical = null;
let mdCurrentPeriod = "today", mdCurrentCustomType = "customday";

const MD_CUSTOM_TYPE_SUFFIX = {
  customday: "day", customrange: "range", custommonth: "month",
  customquarter: "quarter", customyear: "year",
};
let mdYearSelectsPopulated = false;
function mdPopulateYearSelects() {
  if (mdYearSelectsPopulated) return;
  mdYearSelectsPopulated = true;
  const now = new Date();
  const curCalYear = now.getFullYear();
  const curFY = now.getMonth() >= 3 ? curCalYear : curCalYear - 1; // FY starts April (month index 3)
  // 2026 is when this system went live — no real data exists before it,
  // so the floor is fixed rather than a rolling "N years back" window.
  const EARLIEST_YEAR = 2026;
  const calYears = []; for (let y = curCalYear; y >= EARLIEST_YEAR; y--) calYears.push(y);
  const fyYears = []; for (let y = curFY; y >= EARLIEST_YEAR; y--) fyYears.push(y);
  document.querySelectorAll(".dash-cal-year-select").forEach(sel => {
    sel.innerHTML = calYears.map(y => `<option value="${y}">${y}</option>`).join("");
  });
  document.querySelectorAll(".dash-fy-year-select").forEach(sel => {
    sel.innerHTML = fyYears.map(y => `<option value="${y}">${y}-${String((y + 1) % 100).padStart(2, "0")}</option>`).join("");
  });
}
mdPopulateYearSelects();

function mdSetPeriod(btn) {
  document.querySelectorAll("#md-period-btns .dd-period-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const p = btn.dataset.period;
  mdCurrentPeriod = p;
  const customZone = document.getElementById("md-custom-zone");
  if (p === "custom") { customZone.style.display = "flex"; requestAnimationFrame(syncDashboardCanvasTopPadding); return; }
  customZone.style.display = "none";
  requestAnimationFrame(syncDashboardCanvasTopPadding);
  mdLoadDashboard();
}

function mdCustomTypeChange() {
  const type = document.getElementById("md-custom-type").value;
  mdCurrentCustomType = type;
  const activeSuffix = MD_CUSTOM_TYPE_SUFFIX[type];
  Object.values(MD_CUSTOM_TYPE_SUFFIX).forEach(suf => {
    const el = document.getElementById(`md-custom-val-${suf}`);
    if (el) el.hidden = (suf !== activeSuffix);
  });
}

function mdReadCustomVal() {
  const type = document.getElementById("md-custom-type").value;
  if (type === "customday") {
    return document.getElementById("md-custom-val-day-input").value.trim();
  }
  if (type === "customrange") {
    const s = document.getElementById("md-custom-val-range-start").value.trim();
    const e = document.getElementById("md-custom-val-range-end").value.trim();
    return (s && e) ? `${s}_${e}` : "";
  }
  if (type === "custommonth") {
    const y = document.getElementById("md-custom-val-month-year").value;
    const m = document.getElementById("md-custom-val-month-month").value;
    return (y && m) ? `${y}-${String(m).padStart(2, "0")}` : "";
  }
  if (type === "customquarter") {
    const y = document.getElementById("md-custom-val-quarter-year").value;
    const q = document.getElementById("md-custom-val-quarter-q").value;
    return (y && q) ? `${y}-Q${q}` : "";
  }
  const el = document.getElementById(`md-custom-val-${MD_CUSTOM_TYPE_SUFFIX[type]}`);
  return el ? el.value.trim() : "";
}

function mdLoadCustom() {
  const val = mdReadCustomVal();
  if (!val) return alert("Please enter a value for the custom period.");
  mdCurrentPeriod = mdCurrentCustomType;
  mdLoadDashboard(val);
}

async function mdLoadDashboard(customVal) {
  const body = document.getElementById("md-body");
  if (!body) return;
  ["md-s-newleads","md-s-inprogress","md-s-winrate","md-s-avgdays",
   "md-s-emailleads","md-s-opentasks","md-s-zerofollowup","md-s-pouploads","md-s-offerssent","md-s-coldemails"].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = "…";
  });

  try {
    const data = await apFetch({
      action:      "fetchMarketingDashboardData",
      periodType:  mdCurrentPeriod,
      periodValue: customVal || ""
    });
    if (!data.success) { alert("Dashboard load failed: " + data.error); return; }
    mdRenderDashboard(data);
  } catch(e) {
    alert("Dashboard error: " + e.message);
  }
}

function mdRenderDashboard(data) {
  const { stats, statusCounts, verticalCounts, taskPriorityOpenCounts, taskPriorityOverdueCounts, staleLeads, recentWins, overdueOrderPayments } = data;

  document.getElementById("md-s-newleads").textContent       = stats.newLeads;
  document.getElementById("md-s-inprogress").textContent     = stats.inProgress;
  document.getElementById("md-s-winrate").textContent        = stats.winRatePct !== null ? stats.winRatePct + "%" : "—";
  document.getElementById("md-s-avgdays").textContent        = stats.avgConversionDays !== null ? stats.avgConversionDays : "—";
  document.getElementById("md-s-emailleads").textContent     = stats.emailLeadsAwaitingAction;
  document.getElementById("md-s-opentasks").textContent      = stats.openTasks;
  document.getElementById("md-s-zerofollowup").textContent   = stats.zeroFollowUpLeads;
  document.getElementById("md-s-pouploads").textContent      = stats.poUploads;
  document.getElementById("md-s-offerssent").textContent     = stats.distinctOffersSent;
  document.getElementById("md-s-coldemails").textContent     = stats.coldEmailsSent;

  // Chart 1 — Lead Status Funnel (horizontal bar). Live pipeline snapshot
  // (period-independent — see routes/dashboards.js), always all 9
  // statuses in pipeline order, zero-filled — never GROUP BY's "whatever
  // happened to have a row" order/set.
  if (mdChartFunnel) mdChartFunnel.destroy();
  const funnelLabels = Object.keys(statusCounts);
  const ctxFunnel = document.getElementById("md-chart-funnel").getContext("2d");
  mdChartFunnel = new Chart(ctxFunnel, {
    type: "bar",
    data: {
      labels: funnelLabels,
      datasets: [{ label:"Leads", data: funnelLabels.map(k => statusCounts[k]),
        backgroundColor: "rgba(37,99,235,0.7)", borderRadius: 4 }]
    },
    options: { indexAxis:"y", responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ x:{ grid:{ color:"#f1f5f9" }, ticks:{ stepSize:1 } }, y:{ grid:{ display:false }, ticks:{ font:{ size:9 }, autoSkip:false } } } }
  });

  // Chart 2 — Open Tasks by Priority, Open vs Overdue (grouped vertical
  // bar). Live snapshot, same "not Resolved" open-tasks filter as the
  // stat tile above, split by whether target_date has already passed.
  if (mdChartPotential) mdChartPotential.destroy();
  // "Unspecified" (a task with no priority set) is excluded from the axis
  // by explicit request — the backend still counts it internally, this
  // chart just doesn't plot that bucket.
  const priorityLabels = Object.keys(taskPriorityOpenCounts).filter(k => k !== "Unspecified");
  const ctxPotential = document.getElementById("md-chart-potential").getContext("2d");
  mdChartPotential = new Chart(ctxPotential, {
    type: "bar",
    data: {
      labels: priorityLabels,
      datasets: [
        { label:"Open", data: priorityLabels.map(k => taskPriorityOpenCounts[k]),
          backgroundColor: "rgba(37,99,235,0.7)", borderRadius: 4 },
        { label:"Overdue", data: priorityLabels.map(k => taskPriorityOverdueCounts[k]),
          backgroundColor: "rgba(185,28,28,0.7)", borderRadius: 4 }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:true, position:"top", labels:{ boxWidth:10, font:{ size:10 } } } },
      scales:{ y:{ grid:{ color:"#f1f5f9" }, ticks:{ stepSize:1 } }, x:{ grid:{ display:false }, ticks:{ font:{ size:11 } } } } }
  });

  // Chart 3 — Business Vertical (horizontal bar, not a donut — angle/area
  // comparisons in a 6-category donut are hard to read at this tile size;
  // a bar keeps the same legible shape as the other two charts here).
  // Same OPEN-pipeline scope as the potential chart above.
  if (mdChartVertical) mdChartVertical.destroy();
  const verticalLabels = Object.keys(verticalCounts);
  const ctxVertical = document.getElementById("md-chart-vertical").getContext("2d");
  mdChartVertical = new Chart(ctxVertical, {
    type: "bar",
    data: {
      labels: verticalLabels,
      datasets: [{ label:"Open Leads", data: verticalLabels.map(k => verticalCounts[k]),
        backgroundColor: "rgba(21,128,61,0.7)", borderRadius: 4 }]
    },
    options: { indexAxis:"y", responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ x:{ grid:{ color:"#f1f5f9" }, ticks:{ stepSize:1 } }, y:{ grid:{ display:false }, ticks:{ font:{ size:9 } } } } }
  });

  // Stale Leads table
  const staleTbody = document.getElementById("md-stale-tbody");
  staleTbody.innerHTML = staleLeads.length === 0
    ? `<tr><td colspan="4" style="color:var(--muted); padding:6px;">No stale leads — nice work.</td></tr>`
    : staleLeads.map(l => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:4px;">${escapeHtml(l.company)}</td>
          <td style="padding:4px;">${escapeHtml(l.engineer)}</td>
          <td style="padding:4px;">${l.status}</td>
          <td style="padding:4px; text-align:right; color:#b91c1c; font-weight:700;">${l.daysSince}d</td>
        </tr>`).join("");

  // Recent Wins table
  const winsTbody = document.getElementById("md-wins-tbody");
  winsTbody.innerHTML = recentWins.length === 0
    ? `<tr><td colspan="3" style="color:var(--muted); padding:6px;">No orders received in this period.</td></tr>`
    : recentWins.map(w => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:4px;">${escapeHtml(w.company)}</td>
          <td style="padding:4px;">${escapeHtml(w.engineer)}</td>
          <td style="padding:4px; text-align:right;">${formatOrdinalDate(w.date)}</td>
        </tr>`).join("");

  // Overdue Order Payments table — live, period-independent (see the
  // backend's own comment on why), so this never reads from `stats`.
  const overduePaymentsTbody = document.getElementById("md-overdue-payments-tbody");
  const opList = overdueOrderPayments || [];
  overduePaymentsTbody.innerHTML = opList.length === 0
    ? `<tr><td colspan="3" style="color:var(--muted); padding:6px;">No overdue payments.</td></tr>`
    : opList.map(p => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:4px;">
            <div>${escapeHtml(p.companyName || p.projectId)}</div>
            ${p.companyName ? `<div style="font-size:0.68rem; color:var(--muted);">${escapeHtml(p.projectId)}</div>` : ""}
          </td>
          <td style="padding:4px; color:#b91c1c; font-weight:700;">${escapeHtml(formatOrdinalDate(p.expectedDate))}</td>
          <td style="padding:4px; text-align:right; font-family:monospace;">₹${(parseFloat(p.expectedAmount) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
        </tr>`).join("");
}

// navigateToMarketingDashboard — ERP-style opener (no *-workspace-enclosure-panel
// wrapper concept — ERP's canvas panels are plain top-level .workspace-panel
// divs, see accounts-dashboard.js's own navigateToAccountsDashboard for the
// same pattern). Portal's equivalent opener lives, oddly, in
// production/production-dashboard.js (another misplaced-file artifact) and
// calls the now-ERP-inapplicable ddShowAllWorkspaceEnclosures() — omitted here.
function navigateToMarketingDashboard() {
  document.getElementById("dashboard-view").style.display = "none";
  document.querySelectorAll(".workspace-panel").forEach(p => p.style.display = "none");
  const c = document.getElementById("canvas-module-marketing-dashboard");
  if (c) c.style.display = "block";
  showDashboardGlobalToolbar("Marketing Dashboard", "md-period-btns", exitMarketingDashboardBackToMenu);
  mdLoadDashboard();
}

function exitMarketingDashboardBackToMenu() {
  document.getElementById("canvas-module-marketing-dashboard").style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";

  // Reset period selector back to "Today" so the next visit starts fresh instead of
  // silently resuming whatever period was last viewed.
  mdCurrentPeriod = "today";
  document.querySelectorAll("#md-period-btns .dd-period-btn").forEach(b => b.classList.remove("active"));
  const todayBtn = document.querySelector('#md-period-btns .dd-period-btn[data-period="today"]');
  if (todayBtn) todayBtn.classList.add("active");
  const customZoneReset = document.getElementById("md-custom-zone");
  if (customZoneReset) customZoneReset.style.display = "none";
}
