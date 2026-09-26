// ═══════════════════════════════════════════════════════════════════════
// store/store-dashboard.js — Store Dashboard (Batch 6, 16 Sep 2026).
//
// Portal's copy of this file relies on three helpers that live in its
// marketing/marketing-dashboard.js and do not exist in ERP:
// dashCustomTypeChange / dashReadCustomVal (its shared 5-dashboard
// custom-period helpers) and ddShowAllWorkspaceEnclosures. ERP instead
// uses a per-dashboard prefixed convention — see md/dd/pd/adm/ad — so
// the custom-period block below is ERP's own `sd`-prefixed version,
// matching purchase-dashboard.js exactly. Everything else is Portal's
// code unchanged.
//
// Portal also declares the sd* module globals, navigateToStoreDashboard
// and sdReturnToMain in marketing/marketing-dashboard.js (an artifact of
// its 4 Sep 2026 automated split). In ERP they live here, in their real
// owner — the same choice Batch 5 made for navigateToPurchaseDashboard.
// ═══════════════════════════════════════════════════════════════════════
let sdCurrentPeriod     = "today";
let sdCurrentCustomType = "customday";
let sdChartDept = null, sdChartTrend = null, sdChartGrnType = null;
let sdHealthData = [], sdHealthFiltered = [], sdHealthCurrentPage = 1;
const SD_HEALTH_PAGE_SIZE = 5;

const SD_CUSTOM_TYPE_SUFFIX = {
  customday: "day", customrange: "range", custommonth: "month",
  customquarter: "quarter", customyear: "year",
};

function navigateToStoreDashboard() {
  document.getElementById("dashboard-view").style.display = "none";
  const wc = document.getElementById("module-workspace-container");
  if (wc) wc.style.display = "none";
  document.querySelectorAll(".workspace-panel").forEach(p => p.style.display = "none");
  // Mirrors Portal's 16 Sep 2026 fix for the analogous Purchase banner —
  // reset the leftover "BOQ revised" banner state before showing Dashboard.
  document.querySelectorAll(".store-prn-revision-reminder-banner-el")
    .forEach(b => b.style.display = "none");
  const c = document.getElementById("canvas-module-store-dashboard");
  if (c) c.style.display = "block";
  showDashboardGlobalToolbar("Store Dashboard", "sd-period-btns", sdReturnToMain);
  if (typeof sdLoadDashboard === "function") sdLoadDashboard();
}

function sdReturnToMain() {
  const c = document.getElementById("canvas-module-store-dashboard");
  if (c) c.style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

function sdSetPeriod(btn) {
  document.querySelectorAll("#sd-period-btns .dd-period-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  sdCurrentPeriod = btn.dataset.period;
  const customZone = document.getElementById("sd-custom-zone");
  if (sdCurrentPeriod === "custom") { customZone.style.display = "flex"; requestAnimationFrame(syncDashboardCanvasTopPadding); return; }
  customZone.style.display = "none";
  requestAnimationFrame(syncDashboardCanvasTopPadding);
  sdLoadDashboard();
}

// ERP convention (see the file header): five dedicated inputs toggled
// with the `hidden` attribute, never an <input> whose `type` is mutated
// at runtime — that pattern leaves a ghosted native date-picker behind
// (Portal's 8-9 Sep 2026 landmine).
function sdCustomTypeChange() {
  const type = document.getElementById("sd-custom-type").value;
  sdCurrentCustomType = type;
  const activeSuffix = SD_CUSTOM_TYPE_SUFFIX[type];
  Object.values(SD_CUSTOM_TYPE_SUFFIX).forEach(suf => {
    const el = document.getElementById(`sd-custom-val-${suf}`);
    if (el) el.hidden = (suf !== activeSuffix);
  });
}

function sdReadCustomVal() {
  const type = document.getElementById("sd-custom-type").value;
  if (type === "customday") {
    return document.getElementById("sd-custom-val-day-input").value.trim();
  }
  if (type === "customrange") {
    const s = document.getElementById("sd-custom-val-range-start").value.trim();
    const e = document.getElementById("sd-custom-val-range-end").value.trim();
    return (s && e) ? `${s}_${e}` : "";
  }
  if (type === "custommonth") {
    const y = document.getElementById("sd-custom-val-month-year").value;
    const m = document.getElementById("sd-custom-val-month-month").value;
    return (y && m) ? `${y}-${String(m).padStart(2, "0")}` : "";
  }
  if (type === "customquarter") {
    const y = document.getElementById("sd-custom-val-quarter-year").value;
    const q = document.getElementById("sd-custom-val-quarter-q").value;
    return (y && q) ? `${y}-Q${q}` : "";
  }
  const el = document.getElementById(`sd-custom-val-${SD_CUSTOM_TYPE_SUFFIX[type]}`);
  return el ? el.value.trim() : "";
}

function sdLoadCustom() {
  const val = sdReadCustomVal();
  if (!val) return alert("Please enter a value for the custom period.");
  sdCurrentPeriod = sdCurrentCustomType;
  sdLoadDashboard(val);
}

async function sdLoadDashboard(customVal) {
  ["sd-s-tickets","sd-s-pending","sd-s-boqneedprn","sd-s-grns",
   "sd-s-boqinc","sd-s-gateawaiting","sd-s-qaawaiting","sd-s-rejrate","sd-s-sweeps","sd-s-challans","sd-s-outward"].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = "…";
  });
  try {
    const data = await apFetch({
      action:      "fetchStoreDashboardData",
      periodType:  sdCurrentPeriod,
      periodValue: customVal || ""
    });
    if (!data.success) { alert("Store Dashboard load failed: " + data.error); return; }
    sdRenderDashboard(data);
  } catch(e) {
    alert("Store Dashboard error: " + e.message);
  }
}

function sdRenderDashboard(data) {
  const { stats, byDept, inboundOutboundTrend, expectedDeliveryTimeline, projectHealth, inboundPipelineAging } = data;

  // Row 1 stat cards — live queues
  document.getElementById("sd-s-pending").textContent   = stats.pendingApprovals;
  document.getElementById("sd-s-boqneedprn").textContent = stats.boqsNeedingPRN ?? "—";
  document.getElementById("sd-s-gateawaiting").textContent = stats.gateAwaitingGRN.count;
  const outwardEl = document.getElementById("sd-s-outward");
  if (outwardEl) outwardEl.textContent = stats.unactionedMaterialOutward ?? 0;
  document.getElementById("sd-s-gateawaiting-sub").textContent = stats.gateAwaitingGRN.count > 0
    ? `oldest ${stats.gateAwaitingGRN.oldestDays}d` : "";
  document.getElementById("sd-s-qaawaiting").textContent = stats.grnAwaitingQA.count;
  document.getElementById("sd-s-qaawaiting-sub").textContent = stats.grnAwaitingQA.count > 0
    ? `oldest ${stats.grnAwaitingQA.oldestDays}d` : "";
  document.getElementById("sd-s-boqinc").textContent    = stats.pendingBOQIncrease;

  // Row 2 stat cards — period throughput / rates
  document.getElementById("sd-s-tickets").textContent   = stats.totalTickets;
  document.getElementById("sd-s-grns").textContent      = stats.totalGRNs;
  document.getElementById("sd-s-rejrate").textContent   = stats.avgGrnTurnaroundHours === null ? "—" : `${trimNum(stats.avgGrnTurnaroundHours / 24)}d`;
  document.getElementById("sd-s-sweeps").textContent    = stats.stockSweeps;
  document.getElementById("sd-s-challans").textContent  = stats.challansIssued;

  // Chart 1 — Tickets by Department (horizontal bar)
  if (sdChartDept) sdChartDept.destroy();
  const deptLabels = Object.keys(byDept);
  const ctx1 = document.getElementById("sd-chart-dept").getContext("2d");
  sdChartDept = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: deptLabels,
      datasets: [{ label:"Tickets", data: deptLabels.map(d => byDept[d]),
        backgroundColor: ["rgba(37,99,235,0.7)","rgba(16,185,129,0.7)","rgba(245,158,11,0.7)","rgba(239,68,68,0.7)","rgba(139,92,246,0.7)","rgba(236,72,153,0.7)"],
        borderRadius: 4 }]
    },
    options: { indexAxis:"y", responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ x:{ grid:{ color:"#f1f5f9" }, ticks:{ stepSize:1 } }, y:{ grid:{ display:false } } } }
  });

  // Chart 2 — Material Received vs Issued Trend (dual line: GRNs
  // completed vs tickets approved). Both series share
  // inboundOutboundTrend.labels — the backend field name is unchanged,
  // only the on-screen title/legend wording moved off "Inbound/Outbound".
  if (sdChartTrend) sdChartTrend.destroy();
  const ctx2 = document.getElementById("sd-chart-trend").getContext("2d");
  sdChartTrend = new Chart(ctx2, {
    type: "line",
    data: {
      labels: inboundOutboundTrend.labels,
      datasets: [
        { label:"Material Received (GRNs)", data: inboundOutboundTrend.inbound,
          borderColor: "rgba(16,185,129,0.8)", backgroundColor: "rgba(16,185,129,0.08)",
          pointRadius: 3, fill: true, tension: 0.3 },
        { label:"Material Issued (Tickets Approved)", data: inboundOutboundTrend.outbound,
          borderColor: "rgba(37,99,235,0.8)", backgroundColor: "rgba(37,99,235,0.08)",
          pointRadius: 3, fill: true, tension: 0.3 },
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:true, labels:{ font:{ size:9 }, boxWidth:10 } } },
      scales:{ y:{ ticks:{ stepSize:1 }, grid:{ color:"#f1f5f9" } }, x:{ grid:{ display:false }, ticks:{ font:{ size:9 } } } } }
  });

  // Chart 3 — Expected Deliveries (bar) — replaces GRN Volume by Material
  // Type, which was unreadable with 30+ distinct material types. Same
  // 4-bucket breakdown + color convention as the Purchase Dashboard's own
  // Purchase Order Delivery Timeline chart, since both read the same
  // computeExpectedDeliveryTimeline data (backend, routes/dashboards.js).
  if (sdChartGrnType) sdChartGrnType.destroy();
  const dl = expectedDeliveryTimeline;
  const ctx3 = document.getElementById("sd-chart-expected-deliveries").getContext("2d");
  sdChartGrnType = new Chart(ctx3, {
    type: "bar",
    data: {
      labels: ["Overdue", "Due This Week", "Due This Month", "Due Later"],
      datasets: [{
        data: [dl.overdue, dl.thisWeek, dl.thisMonth, dl.later],
        backgroundColor: [
          "rgba(239,68,68,0.75)",
          "rgba(245,158,11,0.75)",
          "rgba(37,99,235,0.7)",
          "rgba(16,185,129,0.7)"
        ],
        borderRadius: 4
      }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ y:{ grid:{ color:"#f1f5f9" }, ticks:{ stepSize:1 } }, x:{ grid:{ display:false }, ticks:{ font:{ size:9 } } } } }
  });

  // Row 4 left — Inbound Pipeline Aging (Gate Entered / GRN Done, oldest first)
  const pipelineTbody = document.getElementById("sd-pipeline-tbody");
  if (pipelineTbody) {
    if (!inboundPipelineAging || inboundPipelineAging.length === 0) {
      pipelineTbody.innerHTML = `<tr><td colspan="5" style="color:var(--muted); font-size:0.72rem; padding:8px; text-align:center;">Nothing stuck before QA — pipeline is clear.</td></tr>`;
    } else {
      pipelineTbody.innerHTML = inboundPipelineAging.map((r, i) => {
        const rowBg = i % 2 === 0 ? "var(--card)" : "#f8fafc";
        const stageBg = r.stage === "Awaiting GRN" ? "#fef9c3" : "#ede9fe";
        const stageColor = r.stage === "Awaiting GRN" ? "#854d0e" : "#6d28d9";
        const daysColor = r.daysWaiting >= 3 ? "#b91c1c" : (r.daysWaiting >= 1 ? "#b45309" : "var(--muted)");
        return `<tr style="background:${rowBg}; border-bottom:1px solid #f1f5f9;">
          <td style="padding:6px; font-size:0.68rem;"><span style="font-weight:700; padding:1px 6px; border-radius:6px; background:${stageBg}; color:${stageColor};">${r.stage}</span></td>
          <td style="padding:6px; font-size:0.72rem;">${escapeHtml(r.vendorName || "—")}</td>
          <td style="padding:6px; font-size:0.72rem; font-family:monospace;">${r.invoiceNumber || "—"}</td>
          <td style="padding:6px; font-size:0.72rem;">${escapeHtml(r.materialName || r.itemCode || "—")}</td>
          <td style="padding:6px; text-align:center; font-weight:700; color:${daysColor}; font-size:0.72rem;">${r.daysWaiting}d</td>
        </tr>`;
      }).join("");
    }
  }

  // Row 4 right — Project Health
  sdHealthData        = projectHealth;
  sdHealthFiltered    = [...projectHealth];
  sdHealthCurrentPage = 1;
  const searchEl = document.getElementById("sd-health-search");
  if (searchEl) searchEl.value = "";
  sdRenderHealthTable();
}

function sdFilterHealth() {
  const q = (document.getElementById("sd-health-search")?.value || "").toLowerCase();
  sdHealthFiltered = q
    ? sdHealthData.filter(p => p.projId.toLowerCase().includes(q) || p.customer.toLowerCase().includes(q))
    : [...sdHealthData];
  sdHealthCurrentPage = 1;
  sdRenderHealthTable();
}

function sdHealthPage(dir) {
  const total = sdHealthFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / SD_HEALTH_PAGE_SIZE));
  sdHealthCurrentPage = Math.min(Math.max(1, sdHealthCurrentPage + dir), totalPages);
  sdRenderHealthTable();
}

function sdRenderHealthTable() {
  const tbody = document.getElementById("sd-health-tbody");
  const total = sdHealthFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / SD_HEALTH_PAGE_SIZE));
  const start = (sdHealthCurrentPage - 1) * SD_HEALTH_PAGE_SIZE;
  const page  = sdHealthFiltered.slice(start, start + SD_HEALTH_PAGE_SIZE);

  const pageInfo = document.getElementById("sd-health-page-info");
  if (pageInfo) pageInfo.textContent = total > SD_HEALTH_PAGE_SIZE
    ? `${start+1}–${Math.min(start+SD_HEALTH_PAGE_SIZE, total)} of ${total}`
    : `${total} project${total !== 1 ? "s" : ""}`;

  const prevBtn = document.querySelector("[onclick=\"sdHealthPage(-1)\"]");
  const nextBtn = document.querySelector("[onclick=\"sdHealthPage(1)\"]");
  if (prevBtn) prevBtn.disabled = sdHealthCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = sdHealthCurrentPage >= totalPages;

  if (!tbody) return;
  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--muted); font-size:0.72rem; padding:6px;">No projects found</td></tr>`;
    return;
  }
  tbody.innerHTML = page.map((p, i) => {
    const rowBg = i % 2 === 0 ? "var(--card)" : "#f8fafc";
    return `<tr style="background:${rowBg}; border-bottom:1px solid #f1f5f9;">
      <td style="padding:8px 6px; font-size:0.75rem;">
        <div style="font-weight:700; font-family:monospace;">${p.projId}</div>
        <div style="font-size:0.65rem; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.customer)}</div>
      </td>
      <td style="padding:8px 6px; text-align:center; font-size:0.75rem;">${p.totalTickets}</td>
      <td style="padding:8px 6px; text-align:center; color:#15803d; font-weight:700; font-size:0.75rem;">${p.approved}</td>
      <td style="padding:8px 6px; text-align:center; color:${p.pending > 0 ? "#b45309" : "var(--muted)"}; font-weight:${p.pending > 0 ? "700" : "400"}; font-size:0.75rem;">${p.pending}</td>
      <td style="padding:8px 6px; text-align:center; font-family:monospace; font-size:0.75rem;">${escapeHtml(p.itemsIssued)}</td>
    </tr>`;
  }).join("");
}

// ── Production Dashboard block removed (Batch 6, 16 Sep 2026) ────────
// Portal's store-dashboard.js ends with navigateToProductionDashboard()
// plus the start of its pd2* Production Dashboard engine globals — a
// misplacement from its own 4 Sep 2026 automated file split, not Store
// code. Dropped here rather than carried across as permanently-broken
// dead code (it calls ddShowAllWorkspaceEnclosures / pd2ReturnToMain,
// neither of which exists in ERP). Batch 7 (Production) owns it and
// should put it in production/production-dashboard.js, its real home.
