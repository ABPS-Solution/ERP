// ===========================================================================
// production/memo-tracking.js -- Memo Purchase Requests Tracking (18 Nov 2026).
// Every memo raised from Create Material Issue Ticket and where it stands (approval, RM PO,
// expected delivery, ordered / received). Data: fetchMemoTracking (routes/consumables.js).
// ===========================================================================
function initializeMemoTrackingPanel() {
  window.scrollTo(0, 0);
  mtLoad();
}

function exitMemoTrackingBackToMenu() {
  const c = document.getElementById("canvas-module-memo-tracking");
  if (c) c.style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

async function mtLoad() {
  const body = document.getElementById("mt-body");
  if (!body) return;
  body.innerHTML = '<div style="padding:12px; color:#64748b;">Loading...</div>';
  try {
    const d = await apFetch({ action: "fetchMemoTracking" });
    if (!d.success) { body.innerHTML = '<div style="padding:12px; color:#b91c1c;">' + escapeHtml(d.error || "Could not load the memo requests.") + "</div>"; return; }
    mtRender(d.rows || []);
  } catch (e) {
    body.innerHTML = '<div style="padding:12px; color:#b91c1c;">' + escapeHtml(friendlyErr(e)) + "</div>";
  }
}

const MT_STATE_COLOURS = {
  "Waiting for approval": ["#fffbeb", "#b45309"], "Rejected": ["#fef2f2", "#b91c1c"],
  "Approved, not ordered yet": ["#eff6ff", "#1d4ed8"], "Partly ordered": ["#eff6ff", "#1d4ed8"], "Ordered": ["#ede9fe", "#5b21b6"],
  "Partly delivered": ["#fff7ed", "#c2410c"], "Delivered": ["#f0fdf4", "#15803d"],
};

function mtRender(rows) {
  const body = document.getElementById("mt-body");
  if (!rows.length) { body.innerHTML = '<div style="padding:12px; color:#64748b;">No memo requests yet.</div>'; return; }
  const th = (t, w) => '<th style="padding:10px 12px; text-align:center; font-size:0.78rem;' + (w ? " width:" + w + ";" : "") + '">' + t + "</th>";
  const td = (t, extra, span) => '<td' + (span > 1 ? ' rowspan="' + span + '"' : "") + ' style="padding:10px 12px; font-size:0.88rem; text-align:center;' + (extra || "") + '">' + t + "</td>";
  const dash = '<span style="color:#94a3b8;">-</span>';
  const when = (v) => v ? escapeHtml(formatOrdinalDateTime(v)) : dash;
  const groups = [];
  rows.forEach(r => {
    const g = groups.length && groups[groups.length - 1].ticketId === r.ticketId ? groups[groups.length - 1] : null;
    if (g) g.rows.push(r); else groups.push({ ticketId: r.ticketId, rows: [r] });
  });
  let html = "";
  groups.forEach(g => {
    const n = g.rows.length, first = g.rows[0];
    const same = (f) => g.rows.every(x => String(x[f] || "") === String(first[f] || ""));
    const mergeApproval = same("actionedAt"), mergeState = same("state");
    g.rows.forEach((r, i) => {
      const lead = i === 0;
      const poLinks = r.pos.length ? r.pos.map(p => p.pdfUrl
        ? '<a href="' + driveLink(p.pdfUrl) + '" target="_blank" rel="noopener" style="font-weight:700; color:#1d4ed8;" title="' + (p.pdfIsDraft ? "Open draft" : "Open PO document") + '">' + escapeHtml(p.poNo) + "</a>"
        : '<span style="font-weight:700;">' + escapeHtml(p.poNo) + "</span>").join("<br>") : dash;
      const expected = r.pos.length ? r.pos.map(p => p.expected ? escapeHtml(formatOrdinalDate(p.expected)) : dash).join("<br>") : dash;
      const approved = r.status === "Pending" || r.status === "Rejected" ? dash : fmtQty(r.approvedQty);
      const orderedRec = r.status === "Pending" || r.status === "Rejected" ? dash : fmtQty(r.ordered) + " / " + fmtQty(r.received);
      const c = MT_STATE_COLOURS[r.state] || ["#f1f5f9", "#475569"];
      const chip = '<span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:0.78rem; font-weight:800; background:' + c[0] + "; color:" + c[1] + '; border:1px solid ' + c[1] + ';">' + escapeHtml(r.state) + "</span>";
      html += "<tr>" +
        (lead ? td(when(first.requestedAt), "", n) : "") +
        (mergeApproval ? (lead ? td(when(first.actionedAt), "", n) : "") : td(when(r.actionedAt))) +
        (lead ? td('<span style="font-family:monospace; font-weight:700;">' + escapeHtml(first.ticketId || "") + "</span>", "", n) : "") +
        td(escapeHtml(r.materialName || ""), "text-align:left;") +
        (lead ? td(escapeHtml(first.projectId || "") || dash, "", n) : "") +
        (lead ? td(escapeHtml(first.department || ""), "", n) : "") +
        (lead ? td(escapeHtml(first.requestedBy || ""), "", n) : "") +
        (mergeState ? (lead ? td(chip, "", n) : "") : td(chip)) +
        td(poLinks) + td(expected) +
        td(fmtQty(r.requestedQty) + " / " + approved, "font-weight:700;") +
        td(orderedRec, "font-weight:700;") +
        td(escapeHtml(r.unit || "")) +
        "</tr>";
    });
  });
  body.innerHTML = '<div style="overflow-x:auto;"><table style="width:100%; min-width:1300px;"><thead><tr>' +
    th("Memo Date and Time of Request", "9%") + th("Memo Date and Time of Approval", "9%") + th("Ticket No", "8%") + th("Material Name", "16%") +
    th("Project ID", "8%") + th("Department", "7%") + th("Who Requested", "9%") + th("Status", "10%") + th("PO No", "8%") +
    th("Expected Delivery Date", "8%") + th("Asked / Approved Qty", "7%") + th("Ordered / Received Qty", "7%") + th("Unit", "4%") +
    "</tr></thead><tbody>" + html + "</tbody></table></div>";
}
