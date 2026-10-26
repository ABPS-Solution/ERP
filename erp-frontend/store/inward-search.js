// store/inward-search.js — Store → Search Inward Material (22 Oct 2026,
// routes/inwardSearch.js). View only: every Gate Entry line, filtered by
// date / vendor / material / document numbers / status / project; clicking a
// row shows its timeline, where the stock went and any rejection.
let iwsRows = [];
let iwsVendors = [];
let iwsItemCode = "";
let iwsGroups = [];
let iwsRangeKind = "";

async function initializeSearchInwardMaterialWorkspace() {
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const from = new Date(Date.now() + 5.5 * 3600 * 1000 - 30 * 86400000).toISOString().slice(0, 10);
  const df = document.getElementById("iws-date-from"), dt = document.getElementById("iws-date-to");
  if (df && !df.value) df.value = from;
  if (dt && !dt.value) dt.value = today;
  iwsPaintRangeButtons();
  if (typeof loadItemCodeCatalogIntoCache === "function") loadItemCodeCatalogIntoCache().catch(() => {});
  try {
    const o = await apFetch({ action: "fetchInwardSearchOptions" });
    if (o.success) iwsVendors = o.vendors || [];
  } catch (e) { /* vendor box still takes typed text */ }
  runInwardMaterialSearch();
}

function iwsSetRange(kind) {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const iso = d => d.toISOString().slice(0, 10);
  const to = iso(ist);
  let from = to;
  if (kind === "week") { const d = new Date(ist); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); from = iso(d); }
  if (kind === "month") from = to.slice(0, 8) + "01";
  document.getElementById("iws-date-from").value = from;
  document.getElementById("iws-date-to").value = to;
  iwsRangeKind = kind;
  iwsPaintRangeButtons();
  runInwardMaterialSearch();
}
// Highlight the picked quick range (cleared when a date is typed by hand).
function iwsPaintRangeButtons() {
  ["today", "week", "month"].forEach(k => {
    const b = document.getElementById("iws-range-" + k);
    if (!b) return;
    const on = iwsRangeKind === k;
    b.style.background = on ? "var(--brand)" : "#fff";
    b.style.color = on ? "#fff" : "#334155";
    b.style.borderColor = on ? "var(--brand)" : "#cbd5e1";
  });
}
document.addEventListener("change", e => {
  if (e.target && (e.target.id === "iws-date-from" || e.target.id === "iws-date-to")) { iwsRangeKind = ""; iwsPaintRangeButtons(); }
});
// "Filtering for → ..." line under the search box (same as Search Leads).
function iwsShowActiveFilters(f) {
  const el = document.getElementById("iws-active-filters");
  if (!el) return;
  const rangeName = { today: "Today", week: "This Week", month: "This Month" }[iwsRangeKind];
  const parts = [];
  if (rangeName) parts.push("Date: " + rangeName);
  else if (f.dateFrom || f.dateTo) parts.push("Date: " + (f.dateFrom ? formatOrdinalDate(f.dateFrom) : "start") + " to " + (f.dateTo ? formatOrdinalDate(f.dateTo) : "today"));
  if (f.vendor) parts.push("Vendor: " + f.vendor);
  if (f.itemCode) parts.push("Material: " + (document.getElementById("iws-material")?.value || f.itemCode));
  if (f.poNo) parts.push("PO No: " + f.poNo);
  if (f.invoiceNo) parts.push("Invoice / Challan: " + f.invoiceNo);
  if (f.gateNo) parts.push("Gate Entry: " + f.gateNo);
  if (f.grnNo) parts.push("GRN: " + f.grnNo);
  if (f.status) parts.push("Status: " + f.status);
  if (f.projectId) parts.push("Project: " + f.projectId);
  el.textContent = "Filtering for → " + (parts.length ? parts.join(" | ") : "Everything");
  el.style.display = "block";
}

// Vendor and material pickers (type to filter, click to pick).
function iwsVendorSearch(q) {
  const dd = document.getElementById("iws-vendor-dd");
  const s = (q || "").trim().toLowerCase();
  if (!s) { dd.style.display = "none"; return; }
  const m = iwsVendors.filter(v => v.toLowerCase().includes(s)).slice(0, 12);
  dd.innerHTML = m.map(v => `<div onmousedown="event.preventDefault()" onclick="iwsPickVendor(${jsArg(v)})" style="padding:7px 10px; cursor:pointer; font-size:0.85rem; border-bottom:1px solid #f1f5f9;">${escapeHtml(v)}</div>`).join("");
  dd.style.display = m.length ? "block" : "none";
}
function iwsPickVendor(v) {
  document.getElementById("iws-vendor").value = v;
  document.getElementById("iws-vendor-dd").style.display = "none";
}
function iwsMaterialSearch(q) {
  const dd = document.getElementById("iws-material-dd");
  iwsItemCode = "";
  if (!(q || "").trim()) { dd.style.display = "none"; return; }
  const m = materialSearch(window.itemCodeCatalogCache || [], q, 12);
  dd.innerHTML = m.map(c => `<div onmousedown="event.preventDefault()" onclick="iwsPickMaterial(${jsArg(c.itemCode)}, ${jsArg(c.combinedName || c.productName || "")})" style="padding:7px 10px; cursor:pointer; font-size:0.85rem; border-bottom:1px solid #f1f5f9;"><b>${escapeHtml(c.itemCode)}</b> ${escapeHtml(c.combinedName || c.productName || "")}</div>`).join("");
  dd.style.display = m.length ? "block" : "none";
}
function iwsPickMaterial(code, name) {
  iwsItemCode = code;
  document.getElementById("iws-material").value = `${code} - ${name}`;
  document.getElementById("iws-material-dd").style.display = "none";
}

function iwsFilters() {
  const v = id => (document.getElementById(id)?.value || "").trim();
  return {
    dateFrom: v("iws-date-from"), dateTo: v("iws-date-to"),
    vendor: v("iws-vendor"), itemCode: v("iws-material") ? iwsItemCode : "",
    poNo: v("iws-po"), invoiceNo: v("iws-invoice"), gateNo: v("iws-gate"), grnNo: v("iws-grn"),
    status: v("iws-status"), projectId: v("iws-project-ta-input"),
  };
}

function iwsClearFilters() {
  ["iws-vendor", "iws-material", "iws-po", "iws-invoice", "iws-gate", "iws-grn", "iws-status", "iws-project-ta-input"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  iwsItemCode = "";
  runInwardMaterialSearch();
}

async function runInwardMaterialSearch() {
  const feed = document.getElementById("iws-results");
  if (!feed) return;
  const f = iwsFilters();
  if (f.dateFrom && f.dateTo && f.dateFrom > f.dateTo) { feed.innerHTML = `<p style="color:#b91c1c;">Date From is after Date To.</p>`; return; }
  iwsShowActiveFilters(f);
  feed.innerHTML = `<div style="padding:20px; text-align:center; color:var(--muted);">Searching...</div>`;
  try {
    const d = await apFetch({ action: "searchInwardMaterial", ...f });
    if (!d.success) { feed.innerHTML = `<p style="color:#b91c1c;">${escapeHtml(d.error || "Search failed.")}</p>`; return; }
    iwsRows = d.rows || [];
    iwsRender(d);
  } catch (e) {
    if (e.message !== "SESSION_EXPIRED") feed.innerHTML = `<p style="color:#b91c1c;">${escapeHtml(e.message)}</p>`;
  }
}

function iwsMoney(n) { return "₹" + formatINRComma(n || 0); }
function iwsStatusBadge(r) {
  const bad = Number(r.notOk) > 0 || Number(r.missing) > 0;
  const color = r.status === "QA Passed" ? (bad ? "#b45309" : "#15803d") : "#1d4ed8";
  return `<span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:0.72rem; white-space:normal; line-height:1.3; font-weight:700; color:#fff; background:${color};">${escapeHtml(r.status)}${bad ? " · Not OK / Missing" : ""}</span>`;
}

function iwsRender(d) {
  const feed = document.getElementById("iws-results");
  if (!iwsRows.length) { feed.innerHTML = `<div style="padding:24px; text-align:center; color:var(--muted); border:2px dashed #cbd5e1; border-radius:var(--radius);">No inward material matches these filters.</div>`; return; }
  const chip = (label, value, color) => `<div style="background:#fff; border:1.5px solid #cbd5e1; border-radius:var(--radius); padding:8px 14px; min-width:140px;">
      <div style="font-size:0.66rem; font-weight:800; text-transform:uppercase; color:#64748b; letter-spacing:0.03em;">${label}</div>
      <div style="font-size:1.1rem; font-weight:800; color:${color || "#0f172a"}; font-family:monospace;">${value}</div></div>`;
  // One row per Gate Entry / GRN; its materials are sub-rows inside the cells.
  const groups = [];
  const byKey = new Map();
  iwsRows.forEach((r, i) => {
    const key = (r.gateNumber || "") + "|" + (r.grnNumber || "");
    if (!byKey.has(key)) { const g = { key, first: r, lines: [] }; byKey.set(key, g); groups.push(g); }
    byKey.get(key).lines.push({ r, i });
  });
  iwsGroups = groups;
  const head = `<div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        ${chip("Gate Entries", groups.length)}
        ${chip("Materials", d.capped ? `${iwsRows.length} of ${d.matchedCount}` : d.matchedCount)}
        ${chip("Basic amount", iwsMoney(d.totals.basicAmount), "var(--brand)")}
        ${chip("Amount with GST", iwsMoney(d.totals.totalAmount))}
      </div>
      <button class="nav-btn-styled" style="width:auto; padding:8px 16px; background:#15803d;" onclick="iwsDownload()">Download to Excel</button>
    </div>
    ${d.capped ? `<div style="background:#fffbeb; border:1px solid #fcd34d; color:#92400e; padding:7px 12px; border-radius:6px; font-size:0.82rem; font-weight:600; margin-bottom:10px;">Showing the newest ${iwsRows.length} materials. Narrow the filters to see the rest.</div>` : ""}`;
  // PPS Tracking borders: on every cell, since row lines on a <tr> don't
  // paint under border-collapse:collapse.
  const cb = "border-left:1.5px solid var(--border); border-bottom:2px solid #94a3b8;";
  const fb = "border-bottom:2px solid #94a3b8;";
  const th = (t, extra) => `<th style="padding:8px; font-size:0.7rem; ${extra || "text-align:center;"}">${t}</th>`;
  const sub = "border-top:1px solid var(--border);";
  // Sub-rows: one block per material, same height in every material column.
  const subCells = (lines, fn, style) => lines.map(({ r }, k) =>
    `<div style="padding:8px; min-height:44px; box-sizing:border-box; display:flex; align-items:center; ${style || "justify-content:center;"} ${k ? sub : ""}">${fn(r)}</div>`).join("");
  const stageOrder = ["Gate Entered", "GRN Done", "QA Passed"];
  const docLink = (r) => {
    const urls = String(r.docUrls || "").split(",").map(s => s.trim());
    const a = (no, url) => no ? (url ? `<a href="${escapeHtml(driveLink(url))}" target="_blank" onclick="event.stopPropagation()" style="color:var(--brand); font-weight:700;">${escapeHtml(no)}</a>` : escapeHtml(no)) : "";
    const inv = a(r.invoiceNumber, urls[0]), ch = a(r.challanNumber, urls[1] || (!r.invoiceNumber ? urls[0] : ""));
    return [inv, ch].filter(Boolean).join("<br>") || "-";
  };
  const rows = groups.map((g, gi) => {
    const f = g.first;
    const statusRow = g.lines.map(l => l.r).sort((a, b) => stageOrder.indexOf(a.status) - stageOrder.indexOf(b.status))[0];
    const anyBad = g.lines.some(({ r }) => (Number(r.notOk) || 0) + (Number(r.missing) || 0) > 0);
    return `
    <tr>
      <td style="padding:8px; white-space:nowrap; vertical-align:middle; ${fb}">${escapeHtml(formatOrdinalDate(f.ts))}</td>
      <td style="padding:6px 4px; text-align:center; vertical-align:middle; width:110px; ${cb}">${iwsStatusBadge({ ...statusRow, notOk: anyBad ? 1 : 0, missing: 0 })}</td>
      <td style="padding:0; vertical-align:middle; min-width:170px; ${cb}">
        <div style="padding:8px; font-family:monospace; font-weight:700;">${escapeHtml(f.gateNumber || "")}</div>
        <div style="padding:8px; font-family:monospace; color:#64748b; font-size:0.82rem; ${sub}">${escapeHtml(f.grnNumber || "No GRN yet")}</div></td>
      <td style="padding:8px; font-weight:600; vertical-align:middle; ${cb}">${escapeHtml(f.vendorName || "")}</td>
      <td style="padding:8px; vertical-align:middle; ${cb}">${docLink(f)}</td>
      <td style="padding:8px; font-family:monospace; font-size:0.82rem; vertical-align:middle; ${cb}">${escapeHtml([...new Set(g.lines.map(({ r }) => r.poNo || (r.legacyPoNo ? r.legacyPoNo + " (old)" : "") || (r.processingTicketId ? "Return: " + r.processingTicketId : "-")))].join(", "))}</td>
      <td style="padding:0; ${cb}">${subCells(g.lines, r => `<div><div style="font-weight:600;">${escapeHtml(r.materialName || "")}</div><div style="font-family:monospace; color:#64748b; font-size:0.78rem;">${escapeHtml(r.itemCode || "")}</div></div>`, "justify-content:flex-start;")}</td>
      <td style="padding:0; ${cb}">${subCells(g.lines, r => escapeHtml(r.unit || ""))}</td>
      <td style="padding:0; font-family:monospace; font-weight:700; ${cb}">${subCells(g.lines, r => fmtQty(r.received))}</td>
      <td style="padding:0; font-family:monospace; ${cb}">${subCells(g.lines, r => { const b = (Number(r.notOk) || 0) + (Number(r.missing) || 0); return b ? `<span style="color:#b91c1c; font-weight:800;">${fmtQty(b)}</span>` : `<span style="color:#94a3b8;">-</span>`; })}</td>
      <td style="padding:0; font-family:monospace; color:#15803d; font-weight:700; ${cb}">${subCells(g.lines, r => r.ok == null ? "-" : fmtQty(r.ok))}</td>
    </tr>`;
  }).join("");
  feed.innerHTML = head + `<div style="overflow-x:auto; border:2px solid #94a3b8; border-radius:var(--radius);">
    <table class="store-basket-data-table prn-view-table" style="width:100%; border-collapse:collapse; min-width:1150px; margin-top:0;">
    <thead><tr style="background:#f8fafc;">
      ${th("Gate Entry Date", "text-align:left;" + fb)}${th("Status", "text-align:center; width:110px;" + cb)}${th("Gate / GRN No", "text-align:left; min-width:170px;" + cb)}${th("Vendor Name", "text-align:left;" + cb)}${th("Invoice / Challan", "text-align:left;" + cb)}
      ${th("PO No", "text-align:left;" + cb)}${th("Material Name", "text-align:left; min-width:240px;" + cb)}
      ${th("Unit", "text-align:center;" + cb)}${th("Received Qty", "text-align:center;" + cb)}${th("Not OK / Missing", "text-align:center;" + cb)}${th("OK Qty", "text-align:center;" + cb)}
    </tr></thead><tbody>${rows}</tbody></table></div>`;
}

// Unused since 23 Oct 2026 (rows no longer expand); kept, flagged.
async function iwsToggleDetail(gi) {
  const tr = document.getElementById(`iws-detail-${gi}`);
  if (!tr) return;
  if (tr.style.display !== "none") { tr.style.display = "none"; return; }
  tr.style.display = "";
  const cell = tr.firstElementChild;
  const lines = (iwsGroups[gi] || { lines: [] }).lines;
  cell.innerHTML = lines.map(({ i }) => `<div id="iws-line-detail-${i}" style="margin-bottom:12px;">Loading...</div>`).join("");
  for (const { i } of lines) await iwsLoadLineDetail(i, document.getElementById(`iws-line-detail-${i}`), lines.length > 1);
}

async function iwsLoadLineDetail(i, cell, showName) {
  if (!cell) return;
  try {
    const d = await apFetch({ action: "fetchInwardMaterialDetail", ledgerId: iwsRows[i].ledgerId });
    if (!d.success) { cell.textContent = d.error || "Could not load."; return; }
    const l = d.line, r = iwsRows[i];
    const nameHead = showName ? `<div style="font-weight:800; color:var(--brand); margin-bottom:6px;">${escapeHtml(r.materialName || r.itemCode || "")}</div>` : "";
    const step = (label, at, by) => `<li><b>${label}</b>: ${at ? escapeHtml(formatOrdinalDateTime(at)) : "<span style='color:var(--muted);'>not yet</span>"}${by ? " by " + escapeHtml(by) : ""}</li>`;
    const went = (d.went || []).map(w => `<li>${w.reversed ? "<s>" : ""}${fmtQty(w.quantity)} ${escapeHtml(r.unit || "")}: ${
      w.prnId ? `reserved for <b>${escapeHtml(w.projectId || "")}</b> (${escapeHtml(w.prnId)})` : (w.kind === "po_credit" ? `counted on PO ${escapeHtml(w.poNo || "")}` : "free stock")
    }${w.reversed ? "</s> (undone)" : ""}</li>`).join("") || "<li>Not received into stock yet.</li>";
    const rej = (d.rejections || []).map(x => `<li>Not OK ${fmtQty(x.notOk)}, Missing ${fmtQty(x.missing)}${x.reason ? " (" + escapeHtml(x.reason) + ")" : ""}: ${escapeHtml(x.action || "no action yet")}, <b>${escapeHtml(x.status || "")}</b>${(Number(x.notOkPending) || 0) + (Number(x.missingPending) || 0) > 0 ? `, ${fmtQty((Number(x.notOkPending) || 0) + (Number(x.missingPending) || 0))} still pending` : ""}</li>`).join("");
    const chg = (d.changes || []).map(c => `<li>${escapeHtml(formatOrdinalDateTime(c.at))}: ${escapeHtml(c.by || "")}, ${escapeHtml(c.summary || c.action || "")}</li>`).join("");
    cell.innerHTML = nameHead + `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px;">
        <div style="background:#fff; border:1.5px solid #cbd5e1; border-radius:var(--radius); padding:10px 12px;"><div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--brand); margin-bottom:6px;">Timeline</div><ul style="margin:0; padding-left:18px;">
          ${step("Gate Entry", l.ts, l.gatePerson)}${step("GRN", l.grnAt, l.grnPerson)}${step("Q/A", l.qaAt, l.qaPerson)}</ul>
          ${r.invoiceDescription ? `<div style="margin-top:6px; color:#475569;">On invoice: ${escapeHtml(r.invoiceDescription)}${r.invoiceUnit && r.invoiceUnit !== r.unit ? " (" + escapeHtml(r.invoiceUnit) + ")" : ""}</div>` : ""}</div>
        <div style="background:#fff; border:1.5px solid #cbd5e1; border-radius:var(--radius); padding:10px 12px;"><div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--brand); margin-bottom:6px;">Where the stock went</div><ul style="margin:0; padding-left:18px;">${went}</ul></div>
        ${rej ? `<div style="background:#fff; border:1.5px solid #cbd5e1; border-radius:var(--radius); padding:10px 12px;"><div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--brand); margin-bottom:6px;">Not OK / Missing</div><ul style="margin:0; padding-left:18px;">${rej}</ul></div>` : ""}
        ${chg ? `<div style="background:#fff; border:1.5px solid #cbd5e1; border-radius:var(--radius); padding:10px 12px;"><div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--brand); margin-bottom:6px;">Gate / GRN history</div><ul style="margin:0; padding-left:18px;">${chg}</ul></div>` : ""}
      </div>`;
  } catch (e) { cell.textContent = friendlyErr(e); }
}

// CSV opens straight in Excel.
function iwsDownload() {
  const cols = ["Gate date", "Gate No", "GRN No", "Vendor", "Invoice No", "Challan No", "PO No", "Item Code", "Material",
    "Received", "OK", "Not OK", "Missing", "Unit", "Rate", "Basic Amount", "GST %", "Amount with GST", "Status"];
  const q = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.join(",")].concat(iwsRows.map(r => [
    formatOrdinalDate(r.ts), r.gateNumber, r.grnNumber, r.vendorName, r.invoiceNumber, r.challanNumber,
    r.poNo || r.legacyPoNo || "", r.itemCode, r.materialName, trimNum(r.received), r.ok == null ? "" : trimNum(r.ok),
    trimNum(r.notOk), trimNum(r.missing), r.unit, trimNum(r.rate), trimNum(r.basicAmount), trimNum(r.gstPercent),
    trimNum(r.totalAmount), r.status].map(q).join(",")));
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Inward Material ${iwsFilters().dateFrom || ""} to ${iwsFilters().dateTo || ""}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}
