// accounts/company-list.js — Tour Expense Tracker's "Company of Visit List" toggle.
// Shows every company offered in the Company of Visit box and lets a person remove one that should not be there
// (a spelling mistake, a duplicate). Removing only takes it off the list; vouchers that already used the name keep it.
let tclCompanies = [];

async function initializeCompanyListPanel() {
  const panel = document.getElementById("te-panel-companies");
  if (!panel) return;
  panel.innerHTML = `
    <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px; flex-wrap:wrap;">
      <input type="text" id="tcl-search" placeholder="Search companies..." autocomplete="off" oninput="tclRender()"
        style="flex:1; min-width:220px; padding:9px 10px; border:1px solid var(--border); border-radius:6px;">
      <div id="tcl-count" style="color:var(--muted); font-size:0.85rem; font-weight:600;"></div>
    </div>
    <div id="tcl-list"><div style="color:var(--muted); padding:12px;">Loading companies...</div></div>`;
  try {
    const data = await apFetch({ action: "listTourCompaniesDetailed" });
    if (!data.success) throw new Error(data.error || "Could not load the list.");
    tclCompanies = data.companies || [];
    tclRender();
  } catch (e) {
    if (e.message === "SESSION_EXPIRED") return;
    document.getElementById("tcl-list").innerHTML = `<div style="color:#b91c1c; padding:12px;">${escapeHtml(friendlyErr(e))}</div>`;
  }
}

function tclRender() {
  const q = (document.getElementById("tcl-search")?.value || "").trim().toLowerCase();
  const rows = tclCompanies.filter(c => !q || c.companyName.toLowerCase().includes(q));
  const cnt = document.getElementById("tcl-count");
  if (cnt) cnt.textContent = rows.length === tclCompanies.length ? `${tclCompanies.length} companies` : `${rows.length} of ${tclCompanies.length} companies`;
  const el = document.getElementById("tcl-list");
  if (!el) return;
  if (!rows.length) { el.innerHTML = `<div style="color:var(--muted); padding:12px;">No companies found.</div>`; return; }
  const cell = "padding:9px 12px; border:2px solid #94a3b8; vertical-align:middle;";
  el.innerHTML = `<div style="overflow-x:auto; border-radius:var(--radius);"><table style="width:100%; border-collapse:collapse; font-size:0.88rem; border:2px solid #94a3b8;">
    <thead><tr style="background:var(--highlight-bg); text-align:left; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.03em; color:var(--muted);">
      <th style="${cell} text-align:center; width:56px;">Sr No</th><th style="${cell}">Company of Visit</th><th style="${cell} text-align:center; width:110px;">Used in Vouchers</th><th style="${cell} width:170px;">Added By</th><th style="${cell} text-align:center; width:90px;"></th>
    </tr></thead><tbody>${rows.map((c, i) => `<tr>
      <td style="${cell} text-align:center;">${i + 1}</td>
      <td style="${cell} font-weight:600; word-break:break-word;">${escapeHtml(c.companyName)}</td>
      <td style="${cell} text-align:center;">${c.usedCount}</td>
      <td style="${cell}">${escapeHtml(c.createdBy || "")}</td>
      <td style="${cell} text-align:center;"><button class="po-li-del-btn" title="Remove from the list" onclick="tclDelete(${c.companyId})">✕</button></td>
    </tr>`).join("")}</tbody></table></div>`;
}

async function tclDelete(companyId) {
  const c = tclCompanies.find(x => x.companyId === companyId);
  if (!c) return;
  const used = c.usedCount ? `\n\nIt is used in ${c.usedCount} voucher(s). Those vouchers keep the name.` : "";
  if (!await abpsConfirm(`Remove "${c.companyName}" from the Company of Visit list?${used}`)) return;
  try {
    const data = await apFetch({ action: "deleteTourCompany", companyId });
    if (!data.success) { abpsAlert(data.error || "Could not remove the company."); return; }
    tclCompanies = tclCompanies.filter(x => x.companyId !== companyId);
    tclRender();
  } catch (e) {
    if (e.message !== "SESSION_EXPIRED") abpsAlert(friendlyErr(e));
  }
}
