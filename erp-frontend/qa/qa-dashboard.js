// ═══════════════════════════════════════════════════════════════════════
// qa/qa-dashboard.js — QA Dashboard (Batch 8, 16 Sep 2026). Same shape as
// every other department dashboard (store/store-dashboard.js is the
// closest twin — Average GRN Turnaround there and Average QA Turnaround
// Time here are the two halves of the same inbound pipeline, split by
// department).
//
// Ported from Portal's qa/qa-dashboard.js verbatim except for two
// deliberate ERP adaptations (same as every other ported dashboard here,
// e.g. production/production-dashboard.js):
//   * navigateToQaDashboard mirrors ERP's navigateToStoreDashboard /
//     navigateToProductionDashboard shape — ERP has no
//     ddShowAllWorkspaceEnclosures, so the plain ".workspace-panel" sweep
//     is used instead;
//   * the custom-period block uses ERP's per-dashboard hidden-attribute
//     toggle convention (five dedicated inputs, `hidden` attribute) instead
//     of Portal's shared dashCustomTypeChange / dashReadCustomVal, which do
//     not exist in ERP — matching the qad-prefixed convention already used
//     by md/dd/pd/pd2/sd/adm/ad.
// ═══════════════════════════════════════════════════════════════════════
let qadCurrentPeriod     = "today";
let qadCurrentCustomType = "customday";
let qadChartRejTrend = null, qadChartVolume = null;

const QAD_CUSTOM_TYPE_SUFFIX = {
  customday: "day", customrange: "range", custommonth: "month",
  customquarter: "quarter", customyear: "year",
};

function navigateToQaDashboard() {
  document.getElementById("dashboard-view").style.display = "none";
  const wc = document.getElementById("module-workspace-container");
  if (wc) wc.style.display = "none";
  document.querySelectorAll(".workspace-panel").forEach(p => p.style.display = "none");
  const c = document.getElementById("canvas-module-qa-dashboard");
  if (c) c.style.display = "block";
  showDashboardGlobalToolbar("QA Dashboard", "qad-period-btns", qadReturnToMain);
  if (typeof qadLoadDashboard === "function") qadLoadDashboard();
}

function qadReturnToMain() {
  const c = document.getElementById("canvas-module-qa-dashboard");
  if (c) c.style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

function qadSetPeriod(btn) {
  document.querySelectorAll("#qad-period-btns .dd-period-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  qadCurrentPeriod = btn.dataset.period;
  const customZone = document.getElementById("qad-custom-zone");
  if (qadCurrentPeriod === "custom") { customZone.style.display = "flex"; requestAnimationFrame(syncDashboardCanvasTopPadding); return; }
  customZone.style.display = "none";
  requestAnimationFrame(syncDashboardCanvasTopPadding);
  qadLoadDashboard();
}

// ERP convention: five dedicated inputs toggled with the `hidden`
// attribute, never an <input> whose `type` is mutated at runtime — that
// pattern leaves a ghosted native date-picker behind (Portal's 8-9 Sep
// 2026 landmine). Portal's own shared dashCustomTypeChange("qad") /
// dashReadCustomVal("qad") live in its marketing/marketing-dashboard.js
// and do not exist here; this is the same qad-prefixed version every
// other ERP dashboard already uses.
function qadCustomTypeChange() {
  const type = document.getElementById("qad-custom-type").value;
  qadCurrentCustomType = type;
  const activeSuffix = QAD_CUSTOM_TYPE_SUFFIX[type];
  Object.values(QAD_CUSTOM_TYPE_SUFFIX).forEach(suf => {
    const el = document.getElementById(`qad-custom-val-${suf}`);
    if (el) el.hidden = (suf !== activeSuffix);
  });
}

function qadReadCustomVal() {
  const type = document.getElementById("qad-custom-type").value;
  if (type === "customday") {
    return document.getElementById("qad-custom-val-day-input").value.trim();
  }
  if (type === "customrange") {
    const s = document.getElementById("qad-custom-val-range-start").value.trim();
    const e = document.getElementById("qad-custom-val-range-end").value.trim();
    return (s && e) ? `${s}_${e}` : "";
  }
  if (type === "custommonth") {
    const y = document.getElementById("qad-custom-val-month-year").value;
    const m = document.getElementById("qad-custom-val-month-month").value;
    return (y && m) ? `${y}-${String(m).padStart(2, "0")}` : "";
  }
  if (type === "customquarter") {
    const y = document.getElementById("qad-custom-val-quarter-year").value;
    const q = document.getElementById("qad-custom-val-quarter-q").value;
    return (y && q) ? `${y}-Q${q}` : "";
  }
  const el = document.getElementById(`qad-custom-val-${QAD_CUSTOM_TYPE_SUFFIX[type]}`);
  return el ? el.value.trim() : "";
}

function qadLoadCustom() {
  const val = qadReadCustomVal();
  if (!val) return alert("Please enter a value for the custom period.");
  qadCurrentPeriod = qadCurrentCustomType;
  qadLoadDashboard(val);
}

async function qadLoadDashboard(customVal) {
  ["qad-s-pendingqa","qad-s-fgpending","qad-s-dueoverdue","qad-s-repairing","qad-s-docgap",
   "qad-s-checked","qad-s-rejrate","qad-s-fgapproved","qad-s-repairresolved","qad-s-turnaround"].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = "…";
  });
  try {
    const data = await apFetch({
      action:      "fetchQaDashboardData",
      periodType:  qadCurrentPeriod,
      periodValue: customVal || ""
    });
    if (!data.success) { alert("QA Dashboard load failed: " + data.error); return; }
    qadRenderDashboard(data);
  } catch (e) {
    alert("QA Dashboard error: " + e.message);
  }
}

function qadRenderDashboard(data) {
  const { stats, rejectionRateTrend, checkedVolumeTrend, agingRejectionQueue, dueToday, overdue } = data;

  // Row 1 -- live queues
  document.getElementById("qad-s-pendingqa").textContent = stats.pendingQaCheck.count;
  document.getElementById("qad-s-pendingqa-sub").textContent = stats.pendingQaCheck.count > 0
    ? `oldest ${stats.pendingQaCheck.oldestDays}d` : "";
  document.getElementById("qad-s-fgpending").textContent = stats.pendingFgApprovals;
  document.getElementById("qad-s-dueoverdue").textContent = stats.qaDueOverdueCount;
  document.getElementById("qad-s-repairing").textContent = stats.currentlyRepairing.count;
  document.getElementById("qad-s-repairing-sub").textContent = stats.currentlyRepairing.count > 0
    ? `oldest ${stats.currentlyRepairing.oldestDays}d` : "";
  document.getElementById("qad-s-docgap").textContent = stats.docsPendingUploadProjects;

  // Row 2 -- period throughput / rates
  document.getElementById("qad-s-checked").textContent = stats.materialsQaChecked;
  document.getElementById("qad-s-rejrate").textContent = stats.qaRejectionRate === null ? "—" : `${stats.qaRejectionRate.toFixed(1)}%`;
  document.getElementById("qad-s-fgapproved").textContent = stats.fgUnitsApproved;
  document.getElementById("qad-s-repairresolved").textContent = stats.repairQaResolved;
  document.getElementById("qad-s-turnaround").textContent = stats.avgQaTurnaroundHours === null ? "—" : `${trimNum(stats.avgQaTurnaroundHours / 24)}d`;

  // Chart 1 -- QA Rejection Rate Trend (line)
  if (qadChartRejTrend) qadChartRejTrend.destroy();
  const ctx1 = document.getElementById("qad-chart-rejtrend").getContext("2d");
  qadChartRejTrend = new Chart(ctx1, {
    type: "line",
    data: {
      labels: rejectionRateTrend.map(p => p.label),
      datasets: [{ label: "Rejection Rate %", data: rejectionRateTrend.map(p => p.value),
        borderColor: "rgba(239,68,68,0.8)", backgroundColor: "rgba(239,68,68,0.08)",
        pointRadius: 3, fill: true, tension: 0.3 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { y: { grid: { color: "#f1f5f9" } }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } } }
  });

  // Chart 2 -- Materials QA-Checked Volume Over Time (dual line: OK vs Not-OK/Missing)
  if (qadChartVolume) qadChartVolume.destroy();
  const ctx2 = document.getElementById("qad-chart-volume").getContext("2d");
  qadChartVolume = new Chart(ctx2, {
    type: "line",
    data: {
      labels: checkedVolumeTrend.labels,
      datasets: [
        { label: "OK Qty", data: checkedVolumeTrend.ok,
          borderColor: "rgba(16,185,129,0.8)", backgroundColor: "rgba(16,185,129,0.08)",
          pointRadius: 3, fill: true, tension: 0.3 },
        { label: "Not-OK/Missing Qty", data: checkedVolumeTrend.rejected,
          borderColor: "rgba(239,68,68,0.8)", backgroundColor: "rgba(239,68,68,0.08)",
          pointRadius: 3, fill: true, tension: 0.3 },
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { font: { size: 9 }, boxWidth: 10 } } },
      scales: { y: { grid: { color: "#f1f5f9" } }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } } }
  });

  // Row 4 left -- Aging Rejection Queue
  const agingTbody = document.getElementById("qad-aging-tbody");
  if (agingTbody) {
    if (!agingRejectionQueue || agingRejectionQueue.length === 0) {
      agingTbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted); font-size:0.72rem; padding:8px; text-align:center;">No open rejections.</td></tr>`;
    } else {
      agingTbody.innerHTML = agingRejectionQueue.map((r, i) => {
        const rowBg = i % 2 === 0 ? "var(--card)" : "#f8fafc";
        const daysColor = r.daysWaiting >= 7 ? "#b91c1c" : (r.daysWaiting >= 3 ? "#b45309" : "var(--muted)");
        return `<tr style="background:${rowBg}; border-bottom:1px solid #f1f5f9;">
          <td style="padding:6px; font-size:0.72rem; font-family:monospace;">${escapeHtml(r.grnNumber || "—")}</td>
          <td style="padding:6px; font-size:0.72rem;">${escapeHtml(r.materialName || r.itemCode || "—")}</td>
          <td style="padding:6px; font-size:0.72rem;">${escapeHtml(r.vendorName || "—")}</td>
          <td style="padding:6px; text-align:center; font-weight:700; color:${daysColor}; font-size:0.72rem;">${r.daysWaiting}d</td>
        </tr>`;
      }).join("");
    }
  }

  // Row 4 middle -- Due Today
  const dueTbody = document.getElementById("qad-duetoday-tbody");
  if (dueTbody) {
    if (!dueToday || dueToday.length === 0) {
      dueTbody.innerHTML = `<tr><td colspan="2" style="color:var(--muted); font-size:0.72rem; padding:8px; text-align:center;">Nothing due today.</td></tr>`;
    } else {
      dueTbody.innerHTML = dueToday.map((r, i) => {
        const rowBg = i % 2 === 0 ? "var(--card)" : "#f8fafc";
        return `<tr style="background:${rowBg}; border-bottom:1px solid #f1f5f9;">
          <td style="padding:6px; font-size:0.72rem;"><div style="font-weight:700; font-family:monospace;">${escapeHtml(r.projectId)}</div><div style="font-size:0.65rem; color:var(--muted);">${escapeHtml(r.companyName || "")}</div></td>
          <td style="padding:6px; font-size:0.72rem; text-transform:capitalize;">${escapeHtml(r.label || "")}</td>
        </tr>`;
      }).join("");
    }
  }

  // Row 4 right -- Overdue
  const overdueTbody = document.getElementById("qad-overdue-tbody");
  if (overdueTbody) {
    if (!overdue || overdue.length === 0) {
      overdueTbody.innerHTML = `<tr><td colspan="3" style="color:var(--muted); font-size:0.72rem; padding:8px; text-align:center;">Nothing overdue.</td></tr>`;
    } else {
      overdueTbody.innerHTML = overdue.map((r, i) => {
        const rowBg = i % 2 === 0 ? "var(--card)" : "#f8fafc";
        return `<tr style="background:${rowBg}; border-bottom:1px solid #f1f5f9;">
          <td style="padding:6px; font-size:0.72rem;"><div style="font-weight:700; font-family:monospace;">${escapeHtml(r.projectId)}</div><div style="font-size:0.65rem; color:var(--muted);">${escapeHtml(r.companyName || "")}</div></td>
          <td style="padding:6px; font-size:0.72rem; text-transform:capitalize;">${escapeHtml(r.label || "")}</td>
          <td style="padding:6px; text-align:center; font-weight:700; color:#b91c1c; font-size:0.72rem;">${r.daysOverdue}d</td>
        </tr>`;
      }).join("");
    }
  }
}
