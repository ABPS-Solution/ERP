// design/boq-progress.js — unsaved work per BOQ (22 Oct 2026).
// Create BOQ keeps one saved copy per product (project + product line), Revise
// BOQ one per BOQ. Work comes back automatically when that BOQ is opened again,
// with a note and a Discard link. Each screen also lists your unfinished BOQs.
// Saved per login for 15 days (shared/drafts.js), cleared on submit.

function boqProgList(prefix) {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(ABPS_DRAFT_PREFIX + prefix)) continue;
      const key = k.slice(ABPS_DRAFT_PREFIX.length);
      const d = abpsDraftRead(key);
      if (d) out.push({ key, ts: d.ts, payload: d.payload });
    }
  } catch (_) {}
  return out.sort((a, b) => b.ts - a.ts);
}

function boqProgWhen(ts) {
  return typeof formatOrdinalDateTime === "function" ? formatOrdinalDateTime(new Date(ts)) : new Date(ts).toLocaleString();
}

// Note at the top of a form: "Your unsaved work ... is back. Discard".
function boqProgNote(hostEl, html, discardJs) {
  if (!hostEl) return;
  const old = hostEl.querySelector(":scope > .boq-prog-note");
  if (old) old.remove();
  const n = document.createElement("div");
  n.className = "boq-prog-note";
  n.style.cssText = "background:#ecfdf5; border:1px solid #6ee7b7; color:#065f46; padding:8px 12px; border-radius:6px; font-size:0.84rem; font-weight:600; margin-bottom:12px; display:flex; gap:12px; align-items:center; flex-wrap:wrap;";
  n.innerHTML = html + (discardJs ? ` <a href="javascript:void(0)" onclick="${discardJs}" style="color:#b91c1c; font-weight:800;">Discard</a>` : "");
  hostEl.prepend(n);
}
function boqProgWarn(hostEl, text) {
  if (!hostEl) return;
  const n = document.createElement("div");
  n.className = "boq-prog-note";
  n.style.cssText = "background:#fffbeb; border:1px solid #fcd34d; color:#92400e; padding:8px 12px; border-radius:6px; font-size:0.84rem; font-weight:600; margin-bottom:12px;";
  n.textContent = text;
  hostEl.prepend(n);
}

function boqProgListHtml(items, openFn, discardFn) {
  if (!items.length) return "";
  return `<div style="background:#f8fafc; border:1px solid var(--border); border-radius:var(--radius); padding:10px 14px; margin-bottom:14px;">
    <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:var(--brand); margin-bottom:6px;">Your unfinished BOQs</div>
    ${items.map(it => {
      const l = it.payload.label || {};
      return `<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding:5px 0; border-top:1px solid #e2e8f0; font-size:0.84rem;">
        <span style="flex:1; min-width:200px;"><b>${escapeHtml(l.customer || "")}</b> · ${escapeHtml(l.product || "")}${l.rating ? " " + escapeHtml(l.rating) : ""}
          <span style="color:var(--muted);">· ${escapeHtml(l.projectId || "")} · last edited ${escapeHtml(boqProgWhen(it.ts))}</span></span>
        <button class="nav-btn-styled" style="width:auto; padding:5px 12px; font-size:0.78rem;" onclick="${openFn}(${jsArg(it.key)})">Continue</button>
        <a href="javascript:void(0)" onclick="${discardFn}(${jsArg(it.key)})" style="color:#b91c1c; font-size:0.8rem; font-weight:700;">Discard</a>
      </div>`;
    }).join("")}</div>`;
}

// ── Create BOQ ───────────────────────────────────────────────────────────
function cboqProgKey() {
  const v = id => (document.getElementById(id)?.value || "").trim();
  const project = v("cboq-project-id-ta-input"), item = v("cboq-product-itemcode");
  if (!project || !item) return null;
  return `createBOQ:${project}|${item}|${v("cboq-description-id")}|${v("cboq-source-po-line-id")}`;
}
function cboqProgLabel() {
  const v = id => (document.getElementById(id)?.value || "").trim();
  return { projectId: v("cboq-project-id-ta-input"), customer: v("cboq-customer-name"), product: v("cboq-product-name"), rating: v("cboq-product-rating") };
}
let cboqProgTimer = null;
function cboqProgSaveSoon() {
  if (window._cboqProgRestoring) return;
  clearTimeout(cboqProgTimer);
  cboqProgTimer = setTimeout(() => {
    const key = cboqProgKey();
    if (!key || !(cboqMaterialRows || []).some(r => r && (r.itemCode || r.materialName))) return;
    abpsDraftSave(key, { state: cboqDraftState(), department: document.getElementById("cboq-department")?.value || "", label: cboqProgLabel() });
  }, 800);
}
function cboqProgAttach() {
  const root = document.getElementById("cboq-form-body");
  if (!root || root.dataset.boqProg === "1") return;
  root.dataset.boqProg = "1";
  ["input", "change", "click"].forEach(ev => root.addEventListener(ev, cboqProgSaveSoon));
  cboqProgRenderList();
}
// Called after a product is picked: bring back that product's saved work.
function cboqProgRestoreForCurrent() {
  if (window._cboqProgRestoring) return;
  const key = cboqProgKey();
  const d = key && abpsDraftRead(key);
  if (!d || !d.payload || !d.payload.state) return;
  window._cboqProgRestoring = true;
  try {
    cboqMaterialRows = Array.isArray(d.payload.state.rows) ? d.payload.state.rows : [];
    renderCBOQMaterialRows();
    updateCBOQTotals();
    const dept = document.getElementById("cboq-department");
    if (dept && d.payload.department && !dept.value) { dept.value = d.payload.department; dept.dispatchEvent(new Event("change", { bubbles: true })); }
  } finally { window._cboqProgRestoring = false; }
  boqProgNote(document.getElementById("cboq-form-body"),
    `Your unsaved work on this BOQ from ${escapeHtml(boqProgWhen(d.ts))} is back.`, `cboqProgDiscardCurrent()`);
}
async function cboqProgDiscardCurrent() {
  const key = cboqProgKey();
  if (!key || !await abpsConfirm("Discard your unsaved work on this BOQ? The material rows will be cleared.")) return;
  abpsDraftClear(key);
  cboqMaterialRows = [];
  renderCBOQMaterialRows(); updateCBOQTotals();
  const n = document.querySelector("#cboq-form-body > .boq-prog-note"); if (n) n.remove();
  cboqProgRenderList();
}
function cboqProgRenderList() {
  const host = document.getElementById("cboq-progress-list");
  if (host) host.innerHTML = boqProgListHtml(boqProgList("createBOQ:"), "cboqProgOpen", "cboqProgDiscardKey");
}
async function cboqProgDiscardKey(key) {
  if (!await abpsConfirm("Discard this unfinished BOQ?")) return;
  abpsDraftClear(key);
  cboqProgRenderList();
}
// Continue: pick its project and product; the restore runs on product pick.
async function cboqProgOpen(key) {
  const parts = key.slice("createBOQ:".length).split("|");
  const [projectId, itemCode, descriptionId, lineId] = parts;
  const projEl = document.getElementById("cboq-project-id-ta-input");
  if (projEl) projEl.value = projectId;
  handleCBOQProjectChange(projectId);
  try { await window.cboqAllowedProductsPromise; } catch (_) {}
  const opts = window.cboqAllowedOptionsByValue || {};
  const found = opts[itemCode + "|" + (descriptionId || "") + "|" + (lineId || "")]
    || Object.values(opts).find(o => o.itemCode === itemCode && String(o.descriptionId || "") === String(descriptionId || ""));
  if (!found) { abpsAlert("This product no longer needs a BOQ on this project (it may already have one). You can Discard this saved work."); return; }
  selectCBOQProductOption(found.itemCode, found.descriptionId || "", found.lineId || "");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Revise BOQ ───────────────────────────────────────────────────────────
function uboqProgBase(draft) {
  return String(draft.version ?? "") + "|" + authBoqBaseSig(draft.materialRows, String(draft.orderQuantity ?? ""));
}
let uboqProgTimer = null;
function uboqProgSaveSoon() {
  if (window._uboqProgRestoring || !uboqCurrentDraft) return;
  clearTimeout(uboqProgTimer);
  uboqProgTimer = setTimeout(() => {
    const dr = uboqCurrentDraft;
    if (!dr) return;
    abpsDraftSave("reviseBOQ:" + dr.boqId, {
      state: { base: uboqProgBase(dr), rows: uboqMaterialRows },
      label: { projectId: dr.projectId, customer: dr.customerName, product: dr.productName, rating: dr.productRating },
    });
  }, 800);
}
function uboqProgAttach() {
  const root = document.getElementById("update-boq-form");
  if (!root || root.dataset.boqProg === "1") return;
  root.dataset.boqProg = "1";
  ["input", "change", "click"].forEach(ev => root.addEventListener(ev, uboqProgSaveSoon));
}
// Called after a BOQ is loaded into Revise BOQ, before it is drawn.
function uboqProgRestoreFor(draft) {
  const key = "reviseBOQ:" + draft.boqId;
  const d = abpsDraftRead(key);
  if (!d || !d.payload || !d.payload.state) return null;
  if (d.payload.state.base !== uboqProgBase(draft)) {
    abpsDraftClear(key);
    return { dropped: true };
  }
  return { rows: d.payload.state.rows || [], ts: d.ts };
}
function uboqProgShowNote(result) {
  const form = document.getElementById("update-boq-form");
  if (!result || !form) return;
  if (result.dropped) boqProgWarn(form, "Your earlier unsaved changes to this BOQ were dropped because the BOQ was changed since (revised or updated by someone else).");
  else boqProgNote(form, `Your unsaved changes to this BOQ from ${escapeHtml(boqProgWhen(result.ts))} are back.`, `uboqProgDiscardCurrent()`);
}
async function uboqProgDiscardCurrent() {
  if (!uboqCurrentDraft || !await abpsConfirm("Discard your unsaved changes to this BOQ? It goes back to the current authorized version.")) return;
  const boqId = uboqCurrentDraft.boqId;
  abpsDraftClear("reviseBOQ:" + boqId);
  window._uboqProgSkipRestore = true;
  try { await loadBOQForUpdate(boqId); } finally { window._uboqProgSkipRestore = false; }
  uboqProgRenderList();
}
function uboqProgRenderList() {
  const host = document.getElementById("uboq-progress-list");
  if (host) host.innerHTML = boqProgListHtml(boqProgList("reviseBOQ:"), "uboqProgOpen", "uboqProgDiscardKey");
}
async function uboqProgDiscardKey(key) {
  if (!await abpsConfirm("Discard these unsaved changes?")) return;
  abpsDraftClear(key);
  uboqProgRenderList();
}
async function uboqProgOpen(key) {
  await loadBOQForUpdate(key.slice("reviseBOQ:".length));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
