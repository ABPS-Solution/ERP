// Proforma Invoice for Customer Payment: create (Accounts) and status/close.
const pfMoney = n => n == null ? "-" : "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

function exitProformaPanelBackToMenu() {
  ["canvas-module-proforma-create", "canvas-module-proforma-status"].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = "none";
  });
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

// ── Create ──────────────────────────────────────────────
window.pfcProjects = [];
window.pfcSelected = null;

async function initializeProformaCreatePanel() {
  const body = document.getElementById("pfc-body");
  body.innerHTML = `<div style="color:var(--muted);">Loading...</div>`;
  const data = await apFetch({ action: "fetchProformaProjects" });
  if (!data.success) { body.innerHTML = ""; return abpsAlert(friendlyErr(data.error)); }
  window.pfcProjects = data.projects || [];
  window.pfcSelected = null;
  body.innerHTML = `
    <input type="text" id="pfc-search" placeholder="Search Company Name or Project ID..." autocomplete="off" oninput="pfcRenderOptions()"
      style="width:100%; max-width:420px; padding:8px 10px; border:1px solid var(--border); border-radius:6px; margin-bottom:8px;">
    <div><select id="pfc-project" onchange="pfcPick()" size="6" style="width:100%; max-width:620px; padding:6px; border:1px solid var(--border); border-radius:6px;"></select></div>
    <div id="pfc-detail" style="margin-top:16px;"></div>`;
  pfcRenderOptions();
}

function pfcRenderOptions() {
  const q = (document.getElementById("pfc-search").value || "").toLowerCase();
  const sel = document.getElementById("pfc-project");
  const list = window.pfcProjects.filter(p => !q || (p.companyName || "").toLowerCase().includes(q) || (p.projectId || "").toLowerCase().includes(q));
  sel.innerHTML = list.length
    ? list.map(p => `<option value="${escapeHtml(p.projectId)}">${escapeHtml(p.companyName || "")} (${escapeHtml(p.projectId)})</option>`).join("")
    : `<option disabled>No project with a balance left to bill</option>`;
}

function pfcPick() {
  const id = document.getElementById("pfc-project").value;
  const p = window.pfcProjects.find(x => x.projectId === id);
  window.pfcSelected = p || null;
  const box = document.getElementById("pfc-detail");
  if (!p) { box.innerHTML = ""; return; }
  box.innerHTML = `
    <div style="display:flex; gap:24px; flex-wrap:wrap; margin-bottom:14px; font-size:0.9rem;">
      <div><div style="color:var(--muted); font-size:0.75rem;">PO Value</div><b>${pfMoney(p.poTotal)}</b></div>
      <div><div style="color:var(--muted); font-size:0.75rem;">Received</div><b>${pfMoney(p.received)}</b></div>
      <div><div style="color:var(--muted); font-size:0.75rem;">Balance</div><b>${pfMoney(p.balance)}</b></div>
      <div><div style="color:var(--muted); font-size:0.75rem;">In Open PIs</div><b>${pfMoney(p.openAmount)}</b></div>
      <div><div style="color:var(--muted); font-size:0.75rem;">Left to Bill</div><b>${pfMoney(p.availableToBill)}</b></div>
    </div>
    <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
      <label><input type="radio" name="pfc-mode" value="amount" checked onchange="pfcModeChange()"> Amount</label>
      <label><input type="radio" name="pfc-mode" value="percent" onchange="pfcModeChange()"> % of PO</label>
      <input type="number" id="pfc-value" min="0" step="any" oninput="pfcModeChange()" style="width:160px; padding:7px; border:1px solid var(--border); border-radius:6px;">
      <span id="pfc-calc" style="color:var(--muted); font-size:0.85rem;"></span>
    </div>
    <div style="margin-bottom:14px;"><input type="text" id="pfc-desc" maxlength="300" placeholder="Description (optional)" style="width:100%; max-width:620px; padding:7px; border:1px solid var(--border); border-radius:6px;"></div>
    <button class="nav-btn-styled" id="pfc-submit" onclick="pfcCreate()">Create Proforma Invoice</button>`;
}

function pfcMode() { const r = document.querySelector('input[name="pfc-mode"]:checked'); return r ? r.value : "amount"; }

function pfcModeChange() {
  const p = window.pfcSelected; if (!p) return;
  const v = parseFloat(document.getElementById("pfc-value").value) || 0;
  const amt = pfcMode() === "percent" ? Math.round(p.poTotal * v) / 100 : v;
  const el = document.getElementById("pfc-calc");
  el.textContent = v > 0 ? "PI amount: " + pfMoney(amt) : "";
  el.style.color = amt > p.availableToBill + 0.005 ? "#b91c1c" : "var(--muted)";
}

async function pfcCreate() {
  const p = window.pfcSelected; if (!p) return;
  const value = parseFloat(document.getElementById("pfc-value").value);
  if (!(value > 0)) return abpsAlert("Enter an amount or percentage above zero.");
  const btn = document.getElementById("pfc-submit");
  btn.disabled = true; btn.textContent = "Creating...";
  try {
    const data = await apFetch({ action: "createProformaInvoice", projectId: p.projectId, mode: pfcMode(), value, description: document.getElementById("pfc-desc").value });
    if (!data.success) return abpsAlert(friendlyErr(data.error));
    await abpsAlert(data.pdfUrl ? `Proforma Invoice ${data.piNo} created.` : `Proforma Invoice ${data.piNo} created. The PDF is not ready yet; open it from Customer Proforma Invoice Status.`);
    initializeProformaCreatePanel();
  } catch (e) {
    abpsAlert(friendlyErr(e));
  } finally {
    btn.disabled = false; btn.textContent = "Create Proforma Invoice";
  }
}

// ── Status ──────────────────────────────────────────────
window.pfsRows = null;
window.pfsOpenForm = null;
window.pfsExpanded = new Set();

async function initializeProformaStatusPanel() {
  window.pfsOpenForm = null; window.pfsExpanded = new Set();
  document.getElementById("pfs-search").value = "";
  await pfsLoad();
}

async function pfsLoad(opts) {
  const list = document.getElementById("pfs-list");
  if (!(opts && opts.silent)) list.innerHTML = `<div style="color:var(--muted);">Loading...</div>`;
  const data = await apFetch({ action: "fetchProformaInvoiceStatus" });
  if (!data.success) { if (!(opts && opts.silent)) list.innerHTML = ""; return abpsAlert(friendlyErr(data.error)); }
  window.pfsRows = data.rows || [];
  const banner = document.getElementById("pfs-banner");
  if (data.overdueCount > 0) {
    banner.style.display = "block";
    banner.textContent = `${data.overdueCount} Proforma Invoice${data.overdueCount === 1 ? " is" : "s are"} still open after ${data.reminderDays} working days. Please follow up with the customer.`;
  } else banner.style.display = "none";
  pfsRender();
}

function pfsRender() {
  const list = document.getElementById("pfs-list");
  if (!Array.isArray(window.pfsRows)) return;
  const q = (document.getElementById("pfs-search").value || "").toLowerCase();
  const rows = window.pfsRows.filter(r => !q || (r.companyName || "").toLowerCase().includes(q) || (r.projectId || "").toLowerCase().includes(q));
  if (!rows.length) { list.innerHTML = `<div style="color:var(--muted);">Nothing to show.</div>`; return; }
  list.innerHTML = `<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
    <thead><tr style="text-align:left; border-bottom:2px solid var(--border);">
      <th style="padding:6px;">Company / Project</th><th style="padding:6px; text-align:right;">PO Value</th>
      <th style="padding:6px; text-align:right;">Received</th><th style="padding:6px; text-align:right;">Balance</th><th style="padding:6px;">Proforma Invoice</th>
    </tr></thead><tbody>${rows.map(pfsRowHtml).join("")}</tbody></table>`;
}

function pfsRowHtml(r) {
  const open = r.invoices.find(x => x.status === "Open");
  const overdue = open && open.overdue;
  let state;
  if (open) state = `<span style="color:${overdue ? "#b91c1c" : "#b45309"}; font-weight:700;">Open (${escapeHtml(open.piNo)}, ${open.workingDays} working days)</span>`;
  else if (r.invoices.length) state = `<span style="color:#15803d; font-weight:700;">Closed</span>`;
  else state = `<span style="color:var(--muted);">No PI yet</span>`;
  const expanded = window.pfsExpanded.has(r.projectId);
  return `<tr style="border-bottom:1px solid var(--border); cursor:pointer;" onclick="pfsToggle(${jsArg(r.projectId)})">
      <td style="padding:6px;"><div>${escapeHtml(r.companyName || r.projectId)}</div><div style="font-size:0.7rem; color:var(--muted);">${escapeHtml(r.projectId)}</div></td>
      <td style="padding:6px; text-align:right;">${pfMoney(r.poTotal)}</td>
      <td style="padding:6px; text-align:right;">${pfMoney(r.received)}</td>
      <td style="padding:6px; text-align:right; font-weight:700;">${pfMoney(r.balance)}</td>
      <td style="padding:6px;">${state}</td></tr>
    ${expanded ? `<tr><td colspan="5" style="padding:8px 6px 14px 24px; background:var(--bg);">${r.invoices.length ? r.invoices.map(pfsInvoiceHtml).join("") : `<span style="color:var(--muted);">No Proforma Invoice for this order yet.</span>`}</td></tr>` : ""}`;
}

function pfsInvoiceHtml(pi) {
  const pdf = pi.pdfUrl
    ? `<a href="${driveLink(pi.pdfUrl)}" target="_blank" rel="noopener">PDF</a>`
    : `<a href="#" onclick="event.preventDefault(); pfsRetryPdf(${pi.piId});">Create PDF</a>`;
  let detail;
  if (pi.status === "Closed") {
    const short = Math.round(((Number(pi.piAmount) || 0) - (Number(pi.receivedAmount) || 0)) * 100) / 100;
    detail = `Received ${pfMoney(pi.receivedAmount)} on ${escapeHtml(formatOrdinalDate(pi.receivedDate))}${pi.paymentReference ? ", Ref " + escapeHtml(pi.paymentReference) : ""}` +
      (short > 0.005 ? ` <b style="color:#b91c1c;">(short by ${pfMoney(short)})</b>` : "");
  } else {
    detail = `<button class="nav-btn-styled" onclick="pfsShowClose(${pi.piId})">Close</button>
      <div id="pfs-close-${pi.piId}" style="display:none; margin-top:8px;"></div>`;
  }
  return `<div style="margin-bottom:8px;"><b>${escapeHtml(pi.piNo)}</b> ${pfMoney(pi.piAmount)}, ${escapeHtml(formatOrdinalDate(pi.createdDate))}, ${pdf}
    <span style="margin-left:8px;">${pi.status === "Open" ? "" : "Closed: "}${detail}</span></div>`;
}

function pfsToggle(projectId) {
  if (window.pfsExpanded.has(projectId)) window.pfsExpanded.delete(projectId); else window.pfsExpanded.add(projectId);
  window.pfsOpenForm = null;
  pfsRender();
}

function pfsShowClose(piId) {
  const row = window.pfsRows.flatMap(r => r.invoices).find(x => x.piId === piId);
  const box = document.getElementById("pfs-close-" + piId);
  if (!row || !box) return;
  window.pfsOpenForm = piId;
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  box.style.display = "block";
  box.innerHTML = `<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <input type="number" id="pfs-amt-${piId}" min="0" step="any" value="${row.piAmount}" title="Amount received" style="width:140px; padding:6px; border:1px solid var(--border); border-radius:6px;">
      <input type="date" id="pfs-date-${piId}" value="${today}" style="padding:6px; border:1px solid var(--border); border-radius:6px;">
      <input type="text" id="pfs-ref-${piId}" placeholder="Payment reference" maxlength="120" style="width:180px; padding:6px; border:1px solid var(--border); border-radius:6px;">
      <input type="text" id="pfs-note-${piId}" placeholder="Note (optional)" maxlength="300" style="width:200px; padding:6px; border:1px solid var(--border); border-radius:6px;">
      <button class="nav-btn-styled" onclick="pfsClose(${piId})">Save</button>
    </div>
    <div style="font-size:0.75rem; color:var(--muted); margin-top:4px;">Received less than the PI amount? Type what came in. The rest stays in the balance.</div>`;
}

async function pfsClose(piId) {
  const g = k => document.getElementById(`pfs-${k}-${piId}`).value;
  const data = await apFetch({ action: "closeProformaInvoice", piId, receivedAmount: g("amt"), receivedDate: g("date"), paymentReference: g("ref"), note: g("note") });
  if (!data.success) return abpsAlert(friendlyErr(data.error));
  window.pfsOpenForm = null;
  await pfsLoad({ silent: true });
}

async function pfsRetryPdf(piId) {
  const data = await apFetch({ action: "retryProformaInvoicePdf", piId });
  if (!data.success) return abpsAlert(friendlyErr(data.error));
  await pfsLoad({ silent: true });
}
