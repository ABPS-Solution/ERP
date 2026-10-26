// accounts/bank-documents.js — Accounts -> Bank Related Documents (23 Oct 2026).
// Pick a document type and download it as Excel; each type has its own fixed
// format built on the server (lib/bankDocuments.js).
let bankDocTypes = [];

async function initializeBankDocumentsPanel() {
  const sel = document.getElementById("bankdoc-type");
  const fb = document.getElementById("bankdoc-feedback");
  if (fb) { fb.style.display = "none"; fb.innerHTML = ""; }
  if (!sel) return;
  sel.innerHTML = `<option value="">Loading...</option>`;
  try {
    const d = await apFetch({ action: "fetchBankDocumentTypes" });
    bankDocTypes = d.success ? (d.types || []) : [];
  } catch (e) { bankDocTypes = []; }
  sel.innerHTML = `<option value="">— Select document type —</option>`
    + bankDocTypes.map(t => `<option value="${escapeHtml(t.key)}">${escapeHtml(t.label)}</option>`).join("");
  bankDocTypeChanged();
}

function bankDocTypeChanged() {
  const key = document.getElementById("bankdoc-type")?.value || "";
  const t = bankDocTypes.find(x => x.key === key);
  const desc = document.getElementById("bankdoc-desc");
  const btn = document.getElementById("bankdoc-download-btn");
  if (desc) desc.textContent = t ? t.description : "";
  if (btn) btn.disabled = !t;
}

async function downloadBankDocument() {
  const key = document.getElementById("bankdoc-type")?.value || "";
  const btn = document.getElementById("bankdoc-download-btn");
  const fb = document.getElementById("bankdoc-feedback");
  if (!key) return;
  if (btn) { btn.disabled = true; btn.textContent = "Preparing..."; }
  if (fb) fb.style.display = "none";
  try {
    const d = await apFetch({ action: "downloadBankDocument", docType: key });
    if (!d.success) throw new Error(d.error || "Could not build the Excel file.");
    const link = document.createElement("a");
    link.href = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + d.base64;
    link.download = d.fileName || "Bank_Document.xlsx";
    document.body.appendChild(link); link.click(); link.remove();
    if (fb) {
      fb.style.cssText = "display:block; margin-top:14px; padding:10px 14px; border-radius:var(--radius); background:#f0fdf4; border:1px solid #86efac; color:#14532d; font-weight:600; font-size:0.88rem;";
      fb.textContent = `Downloaded ${d.fileName} (${d.rowCount} row${d.rowCount === 1 ? "" : "s"}).`;
    }
  } catch (e) {
    if (e.message !== "SESSION_EXPIRED" && fb) {
      fb.style.cssText = "display:block; margin-top:14px; padding:10px 14px; border-radius:var(--radius); background:#fef2f2; border:1px solid #fca5a5; color:#991b1b; font-weight:600; font-size:0.88rem;";
      fb.textContent = friendlyErr(e);
    }
  } finally {
    if (btn) { btn.textContent = "Download Excel"; bankDocTypeChanged(); }
  }
}
