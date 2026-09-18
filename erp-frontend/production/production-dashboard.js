// ═══════════════════════════════════════════════════════════════════════
// production/production-dashboard.js — Production Dashboard (Batch 7,
// 16 Sep 2026).
//
// ASSEMBLED, not a straight copy. Portal's 4 Sep 2026 automated file
// split left this feature in three wrong places:
//   * navigateToProductionDashboard + every pd2* module global sit at the
//     END of Portal's store/store-dashboard.js (Batch 6 dropped them and
//     flagged them for this batch — see its ledger entry, item 15);
//   * pd2ReturnToMain sits in Portal's marketing/marketing-dashboard.js;
//   * Portal's own production/production-dashboard.js starts mid-engine
//     and ENDS with navigateToMarketingDashboard,
//     exitPurchaseWorkspacePanelBackToMenu and the PRN/stock-sweep module
//     globals (prnCurrentData, prnStoreQtyLocked, sweepBasket) — all of
//     which already exist in ERP in their real owners. Copying that tail
//     across would have been a FATAL duplicate top-level let.
// So this file is: the globals + both navigation functions, then Portal's
// production-dashboard.js lines 1-227 (the real engine), and nothing else.
//
// Two ERP adaptations, same as every other ported dashboard here:
//   * the custom-period block uses ERP's per-dashboard hidden-attribute
//     toggle convention instead of Portal's shared dashCustomTypeChange /
//     dashReadCustomVal, which do not exist in ERP;
//   * the admin today-override localStorage key is erpPtlTodayOverride.
// ERP has no ddShowAllWorkspaceEnclosures, so navigateToProductionDashboard
// mirrors navigateToStoreDashboard / navigateToPurchaseDashboard instead.
// ═══════════════════════════════════════════════════════════════════════
let pd2CurrentPeriod     = "today";
let pd2CurrentCustomType = "customday";
let pd2JCNData = [], pd2JCNFiltered = [], pd2JCNCurrentPage = 1;
// Real bug found by live click-test, 16 Sep 2026: this declaration lives
// in Portal's marketing/marketing-dashboard.js, not store-dashboard.js —
// a THIRD file the automated split scattered pd2* globals into that this
// port's own header comment above didn't account for. Without it, the
// dashboard's own chart-drawing code threw "pd2ChartDept is not defined"
// the moment any chart tried to render (a bare identifier assignment with
// no prior declaration throws in an ES module / strict-adjacent context;
// this codebase's classic-script global scope let it silently create an
// implicit global on first assignment in some paths, but the `if
// (pd2ChartDept)` read immediately before that assignment still threw
// ReferenceError, since a read of an undeclared identifier always throws,
// unlike a write).
let pd2ChartDept = null, pd2ChartTrend = null, pd2ChartCompletion = null;
const PD2_JCN_PAGE_SIZE = 8;

const PD2_CUSTOM_TYPE_SUFFIX = {
  customday: "day", customrange: "range", custommonth: "month",
  customquarter: "quarter", customyear: "year",
};

function navigateToProductionDashboard() {
  document.getElementById("dashboard-view").style.display = "none";
  const wc = document.getElementById("module-workspace-container");
  if (wc) wc.style.display = "none";
  document.querySelectorAll(".workspace-panel").forEach(p => p.style.display = "none");
  const c = document.getElementById("canvas-module-production-dashboard");
  if (c) c.style.display = "block";
  showDashboardGlobalToolbar("Production Dashboard", "pd2-period-btns", pd2ReturnToMain);
  if (typeof pd2LoadDashboard === "function") pd2LoadDashboard();
}

function pd2ReturnToMain() {
  const c = document.getElementById("canvas-module-production-dashboard");
  if (c) c.style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

function pd2SetPeriod(btn) {
  document.querySelectorAll("#pd2-period-btns .dd-period-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  pd2CurrentPeriod = btn.dataset.period;
  const customZone = document.getElementById("pd2-custom-zone");
  if (pd2CurrentPeriod === "custom") { customZone.style.display = "flex"; requestAnimationFrame(syncDashboardCanvasTopPadding); return; }
  customZone.style.display = "none";
  requestAnimationFrame(syncDashboardCanvasTopPadding);
  pd2LoadDashboard();
}

// ERP convention: five dedicated inputs toggled with the `hidden`
// attribute, never an <input> whose `type` is mutated at runtime — that
// pattern leaves a ghosted native date-picker behind (Portal's 8-9 Sep
// 2026 landmine). Portal's own shared dashCustomTypeChange("pd2") /
// dashReadCustomVal("pd2") live in its marketing/marketing-dashboard.js
// and do not exist here; this is the same `pd2`-prefixed version every
// other ERP dashboard (md/dd/pd/sd/adm/ad) already uses.
function pd2CustomTypeChange() {
  const type = document.getElementById("pd2-custom-type").value;
  pd2CurrentCustomType = type;
  const activeSuffix = PD2_CUSTOM_TYPE_SUFFIX[type];
  Object.values(PD2_CUSTOM_TYPE_SUFFIX).forEach(suf => {
    const el = document.getElementById(`pd2-custom-val-${suf}`);
    if (el) el.hidden = (suf !== activeSuffix);
  });
}

function pd2ReadCustomVal() {
  const type = document.getElementById("pd2-custom-type").value;
  if (type === "customday") {
    return document.getElementById("pd2-custom-val-day-input").value.trim();
  }
  if (type === "customrange") {
    const s = document.getElementById("pd2-custom-val-range-start").value.trim();
    const e = document.getElementById("pd2-custom-val-range-end").value.trim();
    return (s && e) ? `${s}_${e}` : "";
  }
  if (type === "custommonth") {
    const y = document.getElementById("pd2-custom-val-month-year").value;
    const m = document.getElementById("pd2-custom-val-month-month").value;
    return (y && m) ? `${y}-${String(m).padStart(2, "0")}` : "";
  }
  if (type === "customquarter") {
    const y = document.getElementById("pd2-custom-val-quarter-year").value;
    const q = document.getElementById("pd2-custom-val-quarter-q").value;
    return (y && q) ? `${y}-Q${q}` : "";
  }
  const el = document.getElementById(`pd2-custom-val-${PD2_CUSTOM_TYPE_SUFFIX[type]}`);
  return el ? el.value.trim() : "";
}

function pd2LoadCustom() {
  const val = pd2ReadCustomVal();
  if (!val) return alert("Please enter a value for the custom period.");
  pd2CurrentPeriod = pd2CurrentCustomType;
  pd2LoadDashboard(val);
}

async function pd2LoadDashboard(customVal) {
  ["pd2-s-activejcn","pd2-s-finished","pd2-s-inprogress","pd2-s-mrd-awaiting","pd2-s-mrd-revision",
   "pd2-s-tickets","pd2-s-repair-qty","pd2-s-overdue-deliveries","pd2-s-boq-awaiting-plan","pd2-s-fg-pending"].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = "…";
  });
  try {
    const data = await apFetch({
      action:      "fetchProductionDashboardData",
      periodType:  pd2CurrentPeriod,
      periodValue: customVal || "",
      todayOverride: localStorage.getItem("erpPtlTodayOverride") || "",
    });
    if (!data.success) { alert("Production Dashboard load failed: " + data.error); return; }
    pd2RenderDashboard(data);
  } catch(e) {
    alert("Production Dashboard error: " + e.message);
  }
}

function pd2RenderDashboard(data) {
  const { stats, byDept, dailyTrend, inProgressJCNs, stepSlipByFlow, dueToday, overdue } = data;

  // Sub-department scoping (explicit request, 6 Sep 2026) — a Reactor/
  // Capacitor/Panel person's session is scoped server-side (routes/
  // dashboards.js's resolveProductionSubDeptScope); this just reflects
  // that back in the title so it's never silently unclear why the
  // numbers only cover one department. Unscoped for everyone else.
  const titleEl = document.getElementById("dash-global-title");
  const subDeptLabel = Array.isArray(stats.subDept) ? stats.subDept.join(" & ") : stats.subDept;
  if (titleEl) titleEl.textContent = subDeptLabel ? `Production Dashboard — ${subDeptLabel}` : "Production Dashboard";

  // Row 1
  document.getElementById("pd2-s-activejcn").textContent   = stats.activeJCNs;
  document.getElementById("pd2-s-finished").textContent    = stats.finishedThisPeriod;
  document.getElementById("pd2-s-inprogress").textContent  = stats.inProgress;
  document.getElementById("pd2-s-mrd-awaiting").textContent= stats.prnsAwaitingMrd ?? "—";
  document.getElementById("pd2-s-mrd-revision").textContent= stats.prnsNeedingMrdRevision ?? "—";

  // Row 2
  document.getElementById("pd2-s-tickets").textContent          = stats.storeTickets;
  document.getElementById("pd2-s-repair-qty").textContent       = stats.materialsBeingRepaired ?? "—";
  document.getElementById("pd2-s-overdue-deliveries").textContent = stats.overdueExpectedDeliveries ?? "—";
  document.getElementById("pd2-s-boq-awaiting-plan").textContent= stats.boqsAwaitingProductionPlan ?? "—";
  document.getElementById("pd2-s-fg-pending").textContent       = stats.fgAwaitingQaApproval ?? "—";

  // Chart 1 — FG by Department (bar)
  if (pd2ChartDept) pd2ChartDept.destroy();
  const deptLabels = Object.keys(byDept);
  const ctx1 = document.getElementById("pd2-chart-dept").getContext("2d");
  pd2ChartDept = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: deptLabels,
      datasets: [{ label:"FG Items", data: deptLabels.map(d => byDept[d]),
        backgroundColor: ["rgba(37,99,235,0.7)","rgba(16,185,129,0.7)","rgba(245,158,11,0.7)","rgba(139,92,246,0.7)","rgba(239,68,68,0.7)"],
        borderRadius: 4 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ y:{ ticks:{ stepSize:1 }, grid:{ color:"#f1f5f9" } }, x:{ grid:{ display:false } } } }
  });

  // Chart 2 — Job Card Completion Trend (line)
  if (pd2ChartTrend) pd2ChartTrend.destroy();
  const ctx2 = document.getElementById("pd2-chart-trend").getContext("2d");
  pd2ChartTrend = new Chart(ctx2, {
    type: "line",
    data: {
      labels: dailyTrend.map(d => d.label),
      datasets: [{ label:"Completed", data: dailyTrend.map(d => d.count),
        borderColor: "rgba(16,185,129,0.85)", backgroundColor: "rgba(16,185,129,0.08)",
        pointRadius: 3, fill: true, tension: 0.3 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ y:{ ticks:{ stepSize:1 }, grid:{ color:"#f1f5f9" } }, x:{ grid:{ display:false }, ticks:{ font:{ size:9 } } } } }
  });

  // Chart 3 — Average Step Slip by Flow (horizontal bar). Positive days =
  // finished later than its own target date; negative = early. Replaces
  // Project Completion Progress (thin/redundant once Due Today/Overdue
  // below covers the same lateness question with real dates).
  if (pd2ChartCompletion) pd2ChartCompletion.destroy();
  const ctx3el = document.getElementById("pd2-chart-completion");
  if (ctx3el && stepSlipByFlow && stepSlipByFlow.length > 0) {
    const slipLabels = stepSlipByFlow.map(f => f.flowName);
    const slipData    = stepSlipByFlow.map(f => f.avgSlipDays);
    pd2ChartCompletion = new Chart(ctx3el.getContext("2d"), {
      type: "bar",
      data: {
        labels: slipLabels,
        datasets: [{ label: "Avg Slip (days)", data: slipData,
          backgroundColor: slipData.map(v => v > 0 ? "rgba(239,68,68,0.75)" : "rgba(16,185,129,0.75)"),
          borderRadius: 3 }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "#f1f5f9" } },
          y: { grid: { display: false }, ticks: { font: { size: 9 } } }
        }
      }
    });
  } else if (ctx3el) {
    // No data state
    const c = ctx3el.getContext("2d");
    c.fillStyle = "#94a3b8";
    c.font = "11px sans-serif";
    c.textAlign = "center";
    c.fillText("No completed steps with target dates yet", ctx3el.width / 2, ctx3el.height / 2);
  }

  // Row 4 left — In Progress JCN table
  // Populate department filter dropdown
  const deptFilter = document.getElementById("pd2-jcn-dept-filter");
  const existingDepts = new Set([...deptFilter.options].map(o => o.value).filter(Boolean));
  const newDepts = [...new Set(inProgressJCNs.map(j => j.department).filter(Boolean))];
  newDepts.forEach(d => {
    if (!existingDepts.has(d)) {
      const opt = document.createElement("option");
      opt.value = d; opt.textContent = d;
      deptFilter.appendChild(opt);
    }
  });

  pd2JCNData        = inProgressJCNs;
  pd2JCNFiltered    = [...inProgressJCNs];
  pd2JCNCurrentPage = 1;
  pd2RenderJCNTable();

  // Row 4 right two panels — Due Today / Overdue, Production's own
  // Project Timeline trunk item (Production Planning), across every
  // Active project (routes/dashboards.js's fetchProductionTimelineDueOverdue)
  // — same shape/convention as Design's and Purchase's own Due Today/
  // Overdue panels (dd-duetoday-tbody/dd-overdue-tbody,
  // pd-duetoday-tbody/pd-overdue-tbody).
  const dueTbody = document.getElementById("pd2-duetoday-tbody");
  if (dueTbody) {
    dueTbody.innerHTML = (dueToday || []).length === 0
      ? `<tr><td colspan="2" style="color:var(--muted); padding:6px;">Nothing due today.</td></tr>`
      : dueToday.map(r => `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:4px;"><span style="font-family:monospace; font-weight:700; font-size:0.72rem;">${r.projectId}</span><br/><span style="color:var(--muted); font-size:0.72rem;">${r.companyName}</span></td>
            <td style="padding:4px;">${r.label}</td>
          </tr>`).join("");
  }

  const overdueTbody = document.getElementById("pd2-overdue-tbody");
  if (overdueTbody) {
    overdueTbody.innerHTML = (overdue || []).length === 0
      ? `<tr><td colspan="3" style="color:var(--muted); padding:6px;">Nothing overdue — nice work.</td></tr>`
      : overdue.map(r => `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:4px;"><span style="font-family:monospace; font-weight:700; font-size:0.72rem;">${r.projectId}</span><br/><span style="color:var(--muted); font-size:0.72rem;">${r.companyName}</span></td>
            <td style="padding:4px;">${r.label}</td>
            <td style="padding:4px; text-align:right; color:#b91c1c; font-weight:700;">${r.daysOverdue}d</td>
          </tr>`).join("");
  }
}

function pd2FilterJCN() {
  const dept = document.getElementById("pd2-jcn-dept-filter")?.value || "";
  pd2JCNFiltered = pd2JCNData.filter(j => !dept || j.department === dept);
  pd2JCNCurrentPage = 1;
  pd2RenderJCNTable();
}

function pd2JCNPage(dir) {
  const totalPages = Math.max(1, Math.ceil(pd2JCNFiltered.length / PD2_JCN_PAGE_SIZE));
  pd2JCNCurrentPage = Math.min(Math.max(1, pd2JCNCurrentPage + dir), totalPages);
  pd2RenderJCNTable();
}

function pd2RenderJCNTable() {
  const tbody = document.getElementById("pd2-jcn-tbody");
  const total = pd2JCNFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / PD2_JCN_PAGE_SIZE));
  const start = (pd2JCNCurrentPage - 1) * PD2_JCN_PAGE_SIZE;
  const page  = pd2JCNFiltered.slice(start, start + PD2_JCN_PAGE_SIZE);

  const pageInfo = document.getElementById("pd2-jcn-page-info");
  if (pageInfo) pageInfo.textContent = total > PD2_JCN_PAGE_SIZE
    ? `${start+1}–${Math.min(start+PD2_JCN_PAGE_SIZE, total)} of ${total}`
    : `${total} job card${total !== 1 ? "s" : ""}`;

  const prevBtn = document.querySelector("[onclick=\"pd2JCNPage(-1)\"]");
  const nextBtn = document.querySelector("[onclick=\"pd2JCNPage(1)\"]");
  if (prevBtn) prevBtn.disabled = pd2JCNCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = pd2JCNCurrentPage >= totalPages;

  if (!tbody) return;
  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:var(--muted); font-size:0.72rem; padding:10px;">No in-progress job cards found.</td></tr>`;
    return;
  }
  tbody.innerHTML = page.map((j, i) => {
    const rowBg = i % 2 === 0 ? "var(--card)" : "#f8fafc";
    return `<tr style="background:${rowBg}; border-bottom:1px solid #f1f5f9;">
      <td style="padding:7px 6px; font-family:monospace; font-size:0.72rem; font-weight:700; color:var(--brand);">${j.jcn}</td>
      <td style="padding:7px 6px; font-size:0.72rem;">${j.department}</td>
      <td style="padding:7px 6px; text-align:center; font-size:0.72rem; font-weight:700; color:var(--brand);">${j.ticketCount}</td>
    </tr>`;
  }).join("");
}
