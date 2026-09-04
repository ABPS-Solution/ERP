// shared/typeahead.js — ported from ABPS Portal. Trimmed to what Design
// (and future Purchase/Store screens) actually need: the shared Project ID
// typeahead trio, and initializeCreateBOQPanel (which in Portal has always
// lived in this file, not design/create-boq.js, despite being Design-only
// logic — kept here rather than moved, to match Portal's file layout for
// anyone diffing the two codebases later).
//
// NOT ported: initializeProjectStatusPanel, initializeFinishedGoodsAddWorkspace,
// initializeJCLHWorkspace — these belong to Project Status / Production
// screens, which don't exist in ERP yet.

async function ensureSharedProjectTypeaheadData(forceRefresh = false) {
  if (window._sharedProjectTypeaheadLoaded && !forceRefresh) return;
  try {
    const data = await apFetch({ action: "pullLiveActiveProjectCodes" });
    window.sharedActiveProjectCodes = data.projects || [];
    window.sharedProjectMeta = data.projectMeta || {};
    window._sharedProjectTypeaheadLoaded = true;
  } catch(e) {
    window.sharedActiveProjectCodes = [];
    window.sharedProjectMeta = {};
  }
}

function handleSharedProjectTypeaheadInput(query, inputId, dropdownId) {
  const dd = document.getElementById(dropdownId);
  if (!dd) return;
  if (!query || query.trim().length < 1) { dd.style.display = "none"; return; }
  const q = query.trim().toLowerCase();
  const meta = window.sharedProjectMeta || {};
  const matches = (window.sharedActiveProjectCodes || []).filter(p => {
    const companyName = (meta[p] && meta[p].companyName) || "";
    return p.toLowerCase().includes(q) || companyName.toLowerCase().includes(q);
  }).slice(0, 10);
  if (matches.length === 0) { dd.style.display = "none"; return; }
  dd.innerHTML = matches.map(p => {
    const companyName = (meta[p] && meta[p].companyName) || "";
    return `<div onmousedown="event.preventDefault();" onclick="selectSharedProjectTypeahead('${p.replace(/'/g,"\\'")}', '${inputId}', '${dropdownId}')"
      style="padding:8px 10px; cursor:pointer; border-bottom:1px solid #f1f5f9; font-size:0.82rem;"
      onmouseover="this.style.background='var(--highlight-bg)'" onmouseout="this.style.background='#fff'">
      <span style="font-weight:700;">${p}</span>${companyName ? ` <span style="color:var(--muted);">— ${companyName}</span>` : ''}
    </div>`;
  }).join("");
  dd.style.display = "block";
}

function selectSharedProjectTypeahead(projectId, inputId, dropdownId) {
  const input = document.getElementById(inputId);
  input.value = projectId;
  document.getElementById(dropdownId).style.display = "none";
  input.dispatchEvent(new Event('change'));
}

document.addEventListener("click", (e) => {
  document.querySelectorAll("[id$='-ta-dropdown']").forEach(dd => {
    const inputId = dd.id.replace('-ta-dropdown', '-ta-input');
    if (!e.target.closest(`#${inputId}`) && !e.target.closest(`#${dd.id}`)) dd.style.display = "none";
  });
});

async function initializeCreateBOQPanel() {
  const isFirstVisit = !window._cboqInitializedOnce;
  window._cboqInitializedOnce = true;

  const _g = id => document.getElementById(id);

  if (isFirstVisit) {
    const dateEl = _g("cboq-date"); if (dateEl) dateEl.value = formatOrdinalDate(new Date());

    cboqMaterialRows = [];
    cboqSpecFiles    = [];
    if (_g("cboq-customer-name"))  _g("cboq-customer-name").value  = "";
    if (_g("cboq-product-search")) { _g("cboq-product-search").value = ""; _g("cboq-product-search").placeholder = "— Select Project First —"; }
    if (_g("cboq-product-itemcode")) _g("cboq-product-itemcode").value = "";
    if (_g("cboq-product-dropdown")) _g("cboq-product-dropdown").style.display = "none";
    if (_g("cboq-product-name"))   _g("cboq-product-name").value   = "";
    if (_g("cboq-source-po-line-id")) _g("cboq-source-po-line-id").value = "";
    if (_g("cboq-product-rating")) { _g("cboq-product-rating").value = ""; _g("cboq-product-rating").style.height = "auto"; }
    if (_g("cboq-department"))     _g("cboq-department").value     = "";
    if (_g("cboq-order-qty"))      _g("cboq-order-qty").value      = "";
    if (_g("cboq-spec-doc-list"))  _g("cboq-spec-doc-list").innerHTML = "";
    if (_g("cboq-import-banner"))  { _g("cboq-import-banner").style.display = "none"; _g("cboq-import-banner").innerHTML = ""; }
    window.cboqImportSourceInfo = null;
    resetCBOQImportSearch();
  }

  const formBody = _g("cboq-form-body");
  if (formBody) formBody.style.display = "";
  renderCBOQMaterialRows();
  if (_g("create-boq-feedback")) _g("create-boq-feedback").style.display = "none";

  const projDrop = _g("cboq-project-id-ta-input");
  if (!projDrop) return;
  const previouslySelectedProject = isFirstVisit ? "" : projDrop.value;
  if (isFirstVisit) projDrop.innerHTML = '<option value="">Loading projects...</option>';

  const [projResult, , personnelResult, importListResult] = await Promise.allSettled([
    apFetch({ action: "pullLiveActiveProjectCodes" }),
    loadItemCodeCatalogIntoCache(),
    apFetch({ action: "getStoreOperatorsList" }),
    apFetch({ action: "fetchBOQsForImport" })
  ]);

  window.cboqImportBOQList = (importListResult.status === "fulfilled" && importListResult.value.success)
    ? (importListResult.value.boqs || []) : [];

  if (personnelResult.status === "fulfilled" && personnelResult.value.fullPersonnelDataRecordsTree) {
    window.cboqAllPersonnel = personnelResult.value.fullPersonnelDataRecordsTree;
  }

  if (projResult.status === "fulfilled" && projResult.value && projResult.value.projects) {
    window.sharedActiveProjectCodes = projResult.value.projects;
    window.sharedProjectMeta = projResult.value.projectMeta || {};
    window.cboqProjectMeta = projResult.value.projectMeta || {};
    if (previouslySelectedProject && projResult.value.projects.includes(previouslySelectedProject)) {
      projDrop.value = previouslySelectedProject;
    }
  } else {
    projDrop.placeholder = "Error loading projects";
  }
}
