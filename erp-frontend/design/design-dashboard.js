// navigateToDesignWorkspacePanel — in Portal this lives in
// design/item-codes.js (it's Design's real per-department router, same
// shape as Purchase's own navigateToPurchaseWorkspacePanel in
// purchase/revise-po.js — shared/navigation.js's switchActiveDashboardModule
// just forwards every design-* target to this function rather than
// branching itself). ERP already had a WORKING, differently-shaped Item
// Code screen (design/item-codes.js's own initializeItemCodePanel(),
// canvas-module-itemcode, mod-itemcode — wired directly through the shared
// switchActiveDashboardModule, no enclosure panel) before this port, so
// rather than overwrite that file and risk breaking it, this router is
// placed here and trimmed to the 5 NEWLY-PORTED panels only — it does not
// handle 'design-itemcode' at all, since that screen never routes through
// here (see shared/navigation.js's DESIGN_WORKSPACE_TARGET_IDS, which
// deliberately excludes it).
function navigateToDesignWorkspacePanel(targetModuleId) {
  window.scrollTo(0, 0);
  setTimeout(() => window.scrollTo(0, 0), 50);
  document.getElementById("dashboard-view").style.display = "none";
  if (document.getElementById("module-workspace-container")) {
    document.getElementById("module-workspace-container").style.display = "none";
  }

  const masterParentEnclosure = document.getElementById("module-design-workspace-enclosure-panel");
  if (masterParentEnclosure) {
    masterParentEnclosure.style.display = "block";
  } else {
    console.error("Layout Render Error: module-design-workspace-enclosure-panel container not found in DOM.");
    return;
  }

  const allDesignCanvases = [
    "canvas-module-design-create-boq",
    "canvas-module-design-auth-boq",
    "canvas-module-design-update-boq",
    "canvas-module-design-auth-boq-upd",
    "canvas-module-design-upload-drawings"
  ];
  allDesignCanvases.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // Wipe operational dropzone feedback notes caches — same reset Portal's
  // version performs on every design nav call, ported verbatim.
  const dropzoneUpload = document.getElementById("boq-upload-file-dropzone");
  const dropzoneRevision = document.getElementById("boq-revision-file-dropzone");
  const resultsViewport = document.getElementById("boq-update-search-results-viewport");
  if (dropzoneUpload) {
    dropzoneUpload.textContent = "📷 Select or Capture Bill of Quantity Document Page Image";
    dropzoneUpload.classList.remove("done");
  }
  if (dropzoneRevision) {
    dropzoneRevision.textContent = "📷 Select Revised BOQ Document Page Image";
    dropzoneRevision.classList.remove("done");
  }
  if (resultsViewport) resultsViewport.style.display = "none";
  if (typeof targetBOQUploadFileRawObject !== "undefined") targetBOQUploadFileRawObject = null;

  if (targetModuleId === 'design-create-boq') {
    const el = document.getElementById("canvas-module-design-create-boq");
    if (el) { el.style.display = "block"; initializeCreateBOQPanel().catch(e => { if (e.message !== "SESSION_EXPIRED") console.error("BOQ init error:", e); }); }
  } else if (targetModuleId === 'design-auth-boq') {
    const el = document.getElementById("canvas-module-design-auth-boq");
    if (el) { el.style.display = "block"; initializeAuthorizeBOQPanel('authorize').catch(e => { if (e?.message !== "SESSION_EXPIRED") console.error("Auth BOQ init error:", e); }); }
  } else if (targetModuleId === 'design-update-boq') {
    const el = document.getElementById("canvas-module-design-update-boq");
    if (el) { el.style.display = "block"; initializeUpdateBOQPanel().catch(e => { if (e.message !== "SESSION_EXPIRED") console.error("Update BOQ init error:", e); }); }
  } else if (targetModuleId === 'design-auth-boq-upd') {
    const el = document.getElementById("canvas-module-design-auth-boq-upd");
    if (el) { el.style.display = "block"; initializeAuthorizeBOQPanel('authorize-update').catch(e => { if (e?.message !== "SESSION_EXPIRED") console.error("Auth BOQ upd init error:", e); }); }
  } else if (targetModuleId === 'design-upload-drawings') {
    const el = document.getElementById("canvas-module-design-upload-drawings");
    if (el) { el.style.display = "block"; initializeUploadDrawingsPanel(); }
  } else {
    console.warn("Design routing gateway parameter fallback unmapped: ", targetModuleId);
  }
}

// exitDesignWorkspacePanelBackToMenu — in Portal this lives in
// project/project-status.js (a cross-department placement; Project
// department doesn't exist in ERP at all). Placed here since it's the
// Design-workspace return path and this is the Design-owned file closest
// to it. The triggerCompanyDropdownArrayFetch() call (Marketing's shared
// company typeahead cache) is dropped — no Marketing department, no such
// cache, in ERP.
function exitDesignWorkspacePanelBackToMenu() {
  const enc = document.getElementById("module-design-workspace-enclosure-panel");
  if (enc) enc.style.display = "none";
  const dd = document.getElementById("canvas-module-design-dashboard");
  if (dd) dd.style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

// navigateToDesignDashboard — in Portal this lives in
// marketing/marketing-dashboard.js (cross-department, same as
// navigateToPurchaseDashboard — see purchase/purchase-dashboard.js's own
// comment on this pattern). Adapted to ERP's simpler dashboard-toolbar
// convention (2-arg showDashboardGlobalToolbar, no
// ddShowAllWorkspaceEnclosures/module-workspace-enclosure-panel juggling —
// canvas-module-design-dashboard sits as its own top-level workspace-panel
// in ERP's index.html, not nested inside another department's enclosure
// the way Portal's copy ended up, so that whole workaround is unnecessary
// here).
function navigateToDesignDashboard() {
  document.getElementById("dashboard-view").style.display = "none";
  document.querySelectorAll(".workspace-panel").forEach(p => p.style.display = "none");
  const c = document.getElementById("canvas-module-design-dashboard");
  if (c) c.style.display = "block";
  showDashboardGlobalToolbar("Design Dashboard", exitDesignWorkspacePanelBackToMenu);
  if (typeof ddLoadDashboard === "function") ddLoadDashboard();
}

function ddSetPeriod(btn) {
  document.querySelectorAll(".dd-period-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const p = btn.dataset.period;
  ddCurrentPeriod = p;
  const customZone = document.getElementById("dd-custom-zone");
  if (p === "custom") { customZone.style.display = "flex"; requestAnimationFrame(syncDashboardCanvasTopPadding); return; }
  customZone.style.display = "none";
  requestAnimationFrame(syncDashboardCanvasTopPadding);
  ddLoadDashboard();
}

function ddCustomTypeChange() {
  const type = document.getElementById("dd-custom-type").value;
  ddCurrentCustomType = type;
  const valInput = document.getElementById("dd-custom-val");
  if (type === "customday")     { valInput.type = "date";  valInput.placeholder = ""; }
  else if (type === "customweek")  { valInput.type = "date";  valInput.placeholder = "Pick any day in the week"; }
  else if (type === "custommonth") { valInput.type = "month"; }
  else if (type === "customquarter") { valInput.type = "text"; valInput.placeholder = "e.g. 2025-Q2"; }
  else if (type === "customyear")  { valInput.type = "number"; valInput.placeholder = "e.g. 2025"; }
}

function ddLoadCustom() {
  const val = document.getElementById("dd-custom-val").value.trim();
  if (!val) return alert("Please enter a value for the custom period.");
  ddCurrentPeriod = ddCurrentCustomType;
  ddLoadDashboard(val);
}

// PTL_TODAY_OVERRIDE_KEY ("ptlTodayOverride") is Project Timeline's own
// admin-only, client-side-only "today" override (project-timeline.js) —
// this dashboard's Due Today/Overdue panels read the SAME key so an
// admin building a test scenario on the Timeline screen sees a
// consistent picture here too, without that override ever needing to
// exist as a real server-side setting. A non-admin's request is ignored
// server-side regardless of what's in their own localStorage.
async function ddLoadDashboard(customVal) {
  const body = document.getElementById("dd-body");
  if (!body) return;
  // Show loading state on stat cards
  ["dd-s-overdue","dd-s-pending","dd-s-pendingrevisions","dd-s-itemcodes","dd-s-drawingsuploaded",
   "dd-s-authorized","dd-s-revised","dd-s-drawingturnaround","dd-s-avgboqs","dd-s-revrate"].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = "…";
  });

  try {
    const data = await apFetch({
      action:      "fetchDesignDashboardData",
      periodType:  ddCurrentPeriod,
      periodValue: customVal || "",
      todayOverride: localStorage.getItem("erpPtlTodayOverride") || "",
    });
    if (!data.success) { alert("Dashboard load failed: " + data.error); return; }
    ddRenderDashboard(data);
  } catch(e) {
    alert("Dashboard error: " + e.message);
  }
}

function ddRenderDashboard(data) {
  const { stats, byDept, versionDist, dueToday, overdue, mfcAwaitingBoq } = data;
  const fmt = n => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits:0 });

  // Row 1
  document.getElementById("dd-s-overdue").textContent          = stats.designWorkOverdue;
  document.getElementById("dd-s-pending").textContent           = stats.totalPending;
  document.getElementById("dd-s-pendingrevisions").textContent = stats.pendingBoqRevisions;
  document.getElementById("dd-s-itemcodes").textContent         = stats.newItemCodes;
  document.getElementById("dd-s-drawingsuploaded").textContent = stats.drawingsUploaded;

  // Row 2
  document.getElementById("dd-s-authorized").textContent = stats.totalAuthorized;
  document.getElementById("dd-s-revised").textContent    = stats.totalRevised;
  document.getElementById("dd-s-drawingturnaround").textContent =
    stats.avgDrawingTurnaroundDays !== null ? stats.avgDrawingTurnaroundDays + " days" : "—";
  document.getElementById("dd-s-avgboqs").textContent = stats.avgBoqsPerActiveProject !== null ? stats.avgBoqsPerActiveProject : "—";
  document.getElementById("dd-s-revrate").textContent = stats.boqRevisionRate !== null ? stats.boqRevisionRate + "%" : "—";

  // Products Cleared at MFC, Still Awaiting a BOQ — Tier-1 only (the
  // product's own first BOQ), not the Tier-2/Finished Goods material
  // requirement computeDesignMilestonesForProjects also tracks — this
  // table is specifically "what hasn't been started yet", not the fuller
  // "All BOQs Released" picture Project Timeline shows.
  const mfcTbody = document.getElementById("dd-mfcawaiting-tbody");
  const mfcCountEl = document.getElementById("dd-mfcawaiting-count");
  const mfcList = mfcAwaitingBoq || [];
  if (mfcCountEl) mfcCountEl.textContent = mfcList.length;
  mfcTbody.innerHTML = mfcList.length === 0
    ? `<tr><td colspan="3" style="padding:8px 4px; color:var(--muted); font-size:0.72rem;">✅ Nothing waiting on a first BOQ.</td></tr>`
    : mfcList.map(r => `
        <tr style="border-top:1px solid #f1f5f9;">
          <td style="padding:2px 4px;"><span style="font-family:monospace; font-weight:700; font-size:0.7rem; color:var(--brand);">${r.projectId}</span><br/><span style="color:var(--muted); font-size:0.68rem;">${r.companyName || ""}</span></td>
          <td style="padding:2px 4px;">${r.productName || ""}${r.productRating ? " " + r.productRating : ""}</td>
          <td style="padding:2px 4px; text-align:center; font-size:0.68rem;">${r.mfcDate ? formatDMYFromISO(r.mfcDate) : "—"}</td>
        </tr>`).join("");

  // Chart 2 — BOQs by dept
  if (ddChartDept) ddChartDept.destroy();
  const deptLabels = Object.keys(byDept);
  const ctx2 = document.getElementById("dd-chart-dept").getContext("2d");
  ddChartDept = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: deptLabels,
      datasets: [{ label:"BOQs", data: deptLabels.map(d => byDept[d].count),
        backgroundColor: ["rgba(37,99,235,0.7)","rgba(16,185,129,0.7)","rgba(245,158,11,0.7)","rgba(239,68,68,0.7)","rgba(139,92,246,0.7)"],
        borderRadius: 4 }]
    },
    options: { indexAxis:"y", responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ x:{ grid:{ color:"#f1f5f9" }, ticks:{ stepSize:1 } }, y:{ grid:{ display:false }, ticks:{ font:{ size:10 } } } } }
  });

  // Chart 3 — Version distribution
  if (ddChartVersion) ddChartVersion.destroy();
  const ctx3 = document.getElementById("dd-chart-version").getContext("2d");
  ddChartVersion = new Chart(ctx3, {
    type: "bar",
    data: {
      labels: ["v1","v2","v3+"],
      datasets: [{ label:"BOQs", data: [versionDist["v1"], versionDist["v2"], versionDist["v3+"]],
        backgroundColor: ["rgba(16,185,129,0.7)","rgba(245,158,11,0.7)","rgba(239,68,68,0.7)"],
        borderRadius: 4 }]
    },
    options: { responsive:true, plugins:{ legend:{ display:false } },
      scales:{ y:{ ticks:{ stepSize:1 }, grid:{ color:"#f1f5f9" } }, x:{ grid:{ display:false } } } }
  });

  // Due Today / Overdue — Design's 4 Project Timeline trunk items across
  // every Active project (routes/dashboards.js's fetchDesignTimelineDueOverdue),
  // already sorted server-side (priority order / days-overdue desc then priority).
  const dueTbody = document.getElementById("dd-duetoday-tbody");
  dueTbody.innerHTML = dueToday.length === 0
    ? `<tr><td colspan="2" style="color:var(--muted); padding:6px;">Nothing due today.</td></tr>`
    : dueToday.map(r => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:4px;"><span style="font-family:monospace; font-weight:700; font-size:0.72rem;">${r.projectId}</span><br/><span style="color:var(--muted); font-size:0.72rem;">${r.companyName}</span></td>
          <td style="padding:4px;">${r.label}</td>
        </tr>`).join("");

  const overdueTbody = document.getElementById("dd-overdue-tbody");
  overdueTbody.innerHTML = overdue.length === 0
    ? `<tr><td colspan="3" style="color:var(--muted); padding:6px;">Nothing overdue — nice work.</td></tr>`
    : overdue.map(r => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:4px;"><span style="font-family:monospace; font-weight:700; font-size:0.72rem;">${r.projectId}</span><br/><span style="color:var(--muted); font-size:0.72rem;">${r.companyName}</span></td>
          <td style="padding:4px;">${r.label}</td>
          <td style="padding:4px; text-align:right; color:#b91c1c; font-weight:700;">${r.daysOverdue}d</td>
        </tr>`).join("");
}
