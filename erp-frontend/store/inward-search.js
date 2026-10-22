// store/inward-search.js — Store → Search Inward Material (22 Oct 2026,
// routes/inwardSearch.js). View only: every Gate Entry line, filtered by
// date / vendor / material / document numbers / status / project; clicking a
// row shows its timeline, where the stock went and any rejection.
let iwsRows = [];
let iwsVendors = [];
let iwsItemCode = "";

async function initializeSearchInwardMaterialWorkspace() {
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const from = new Date(Date.now() + 5.5 * 3600 * 1000 - 30 * 86400000).toISOString().slice(0, 10);
  const df = document.getElementById("iws-date-from"), dt = document.getElementById("iws-date-to");
  if (df && !df.value) df.value = from;
  if (dt && !dt.value) dt.value = today;
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
  runInwardMaterialSearch();
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
  return `<span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:0.72rem; font-weight:700; color:#fff; background:${color};">${escapeHtml(r.status)}${bad ? " · Not OK / Missing" : ""}</span>`;
}

function iwsRender(d) {
  const feed = document.getElementById("iws-results");
  if (!iwsRows.length) { feed.innerHTML = `<div style="padding:20px; text-align:center; color:var(--muted); border:1px dashed var(--border); border-radius:var(--radius);">No inward material matches these filters.</div>`; return; }
  const head = `<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
      <div style="font-size:0.85rem; color:#334155;"><b>${d.capped ? `Showing ${iwsRows.length} of ${d.matchedCount}` : `${d.matchedCount}`}</b> line(s) · Basic ${iwsMoney(d.totals.basicAmount)} · With GST ${iwsMoney(d.totals.totalAmount)}${d.capped ? ` <span style="color:#b45309;">(narrow the filters to see the rest)</span>` : ""}</div>
      <button class="nav-btn-styled" style="width:auto; padding:7px 14px; background:#15803d;" onclick="iwsDownload()">Download to Excel</button>
    </div>`;
  const rows = iwsRows.map((r, i) => `
    <tr onclick="iwsToggleDetail(${i})" style="cursor:pointer; border-bottom:1px solid #e2e8f0;">
      <td>${escapeHtml(formatOrdinalDate(r.ts))}</td>
      <td>${escapeHtml(r.gateNumber || "")}<div style="color:var(--muted);">${escapeHtml(r.grnNumber || "")}</div></td>
      <td>${escapeHtml(r.vendorName || "")}</td>
      <td>${escapeHtml(r.invoiceNumber || r.challanNumber || "")}${r.docUrls ? `<div>${gateDocLinksHtml(r.docUrls, r.invoiceNumber, r.challanNumber)}</div>` : ""}</td>
      <td>${escapeHtml(r.poNo || r.legacyPoNo || (r.processingTicketId ? "Return: " + r.processingTicketId : "-"))}</td>
      <td><b>${escapeHtml(r.itemCode || "")}</b> ${escapeHtml(r.materialName || "")}</td>
      <td style="text-align:right;">${fmtQty(r.received)}</td>
      <td style="text-align:right;">${r.ok == null ? "-" : fmtQty(r.ok)}</td>
      <td style="text-align:right;">${(Number(r.notOk) || 0) + (Number(r.missing) || 0) ? fmtQty((Number(r.notOk) || 0) + (Number(r.missing) || 0)) : "-"}</td>
      <td>${escapeHtml(r.unit || "")}</td>
      <td style="text-align:right;">${iwsMoney(r.rate)}</td>
      <td style="text-align:right;">${iwsMoney(r.basicAmount)}</td>
      <td>${iwsStatusBadge(r)}</td>
    </tr>
    <tr id="iws-detail-${i}" style="display:none;"><td colspan="13" style="background:#f8fafc; padding:12px 14px;"></td></tr>`).join("");
  feed.innerHTML = head + `<div style="overflow-x:auto;"><table class="iws-table" style="width:100%; border-collapse:collapse; font-size:0.82rem;">
    <thead><tr style="background:#f1f5f9; text-align:left;">
      <th>Gate date</th><th>Gate / GRN No</th><th>Vendor</th><th>Invoice / Challan</th><th>PO No</th><th>Material</th>
      <th style="text-align:right;">Received</th><th style="text-align:right;">OK</th><th style="text-align:right;">Not OK / Missing</th>
      <th>Unit</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th><th>Status</th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function iwsToggleDetail(i) {
  const tr = document.getElementById(`iws-detail-${i}`);
  if (!tr) return;
  if (tr.style.display !== "none") { tr.style.display = "none"; return; }
  tr.style.display = "";
  const cell = tr.firstElementChild;
  cell.innerHTML = "Loading...";
  try {
    const d = await apFetch({ action: "fetchInwardMaterialDetail", ledgerId: iwsRows[i].ledgerId });
    if (!d.success) { cell.textContent = d.error || "Could not load."; return; }
    const l = d.line, r = iwsRows[i];
    const step = (label, at, by) => `<li><b>${label}</b>: ${at ? escapeHtml(formatOrdinalDateTime(at)) : "<span style='color:var(--muted);'>not yet</span>"}${by ? " by " + escapeHtml(by) : ""}</li>`;
    const went = (d.went || []).map(w => `<li>${w.reversed ? "<s>" : ""}${fmtQty(w.quantity)} ${escapeHtml(r.unit || "")}: ${
      w.prnId ? `reserved for <b>${escapeHtml(w.projectId || "")}</b> (${escapeHtml(w.prnId)})` : (w.kind === "po_credit" ? `counted on PO ${escapeHtml(w.poNo || "")}` : "free stock")
    }${w.reversed ? "</s> (undone)" : ""}</li>`).join("") || "<li>Not received into stock yet.</li>";
    const rej = (d.rejections || []).map(x => `<li>Not OK ${fmtQty(x.notOk)}, Missing ${fmtQty(x.missing)}${x.reason ? " (" + escapeHtml(x.reason) + ")" : ""}: ${escapeHtml(x.action || "no action yet")}, <b>${escapeHtml(x.status || "")}</b>${(Number(x.notOkPending) || 0) + (Number(x.missingPending) || 0) > 0 ? `, ${fmtQty((Number(x.notOkPending) || 0) + (Number(x.missingPending) || 0))} still pending` : ""}</li>`).join("");
    const chg = (d.changes || []).map(c => `<li>${escapeHtml(formatOrdinalDateTime(c.at))}: ${escapeHtml(c.by || "")}, ${escapeHtml(c.summary || c.action || "")}</li>`).join("");
    cell.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:14px;">
        <div><div style="font-weight:800; margin-bottom:4px;">Timeline</div><ul style="margin:0; padding-left:18px;">
          ${step("Gate Entry", l.ts, l.gatePerson)}${step("GRN", l.grnAt, l.grnPerson)}${step("Q/A", l.qaAt, l.qaPerson)}</ul>
          ${r.invoiceDescription ? `<div style="margin-top:6px; color:#475569;">On invoice: ${escapeHtml(r.invoiceDescription)}${r.invoiceUnit && r.invoiceUnit !== r.unit ? " (" + escapeHtml(r.invoiceUnit) + ")" : ""}</div>` : ""}</div>
        <div><div style="font-weight:800; margin-bottom:4px;">Where the stock went</div><ul style="margin:0; padding-left:18px;">${went}</ul></div>
        ${rej ? `<div><div style="font-weight:800; margin-bottom:4px;">Not OK / Missing</div><ul style="margin:0; padding-left:18px;">${rej}</ul></div>` : ""}
        ${chg ? `<div><div style="font-weight:800; margin-bottom:4px;">Gate / GRN history</div><ul style="margin:0; padding-left:18px;">${chg}</ul></div>` : ""}
      </div>`;
  } catch (e) { cell.textContent = e.message; }
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
