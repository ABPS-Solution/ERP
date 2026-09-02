// ═══════════════════════════════════════════════════════════════════════
// design/item-codes.js — Add / Check Item Code, ported from ABPS Portal's
// abps-frontend/design/item-codes.js. Trimmed to just the item-code
// search + create + admin-format-editor logic — every BOQ/Store-Entry/
// Gate-Entry consumer of the catalog in Portal's file (navigateToDesign
// WorkspacePanel's BOQ routing, the se-* Store Entry search helpers) has
// no equivalent screen in ERP yet and was left out on purpose, not lost.
//
// initializeItemCodePanel() is ERP's own entry point (called from
// switchActiveDashboardModule via shared/navigation.js), replacing
// Portal's navigateToDesignWorkspacePanel('design-itemcode') branch —
// same reset-zones-then-load-cache shape, just scoped to this one screen.
//
// Deliberately left out vs. Portal (see routes/itemCodes.js's own header
// for the backend-side list): Gemini semantic re-ranking
// (searchItemCodeSemantic) — the strict client-side text pre-filter below
// still narrows results to a good shortlist on its own; add Gemini back
// here once lib/gemini.js exists on erp-backend.
// ═══════════════════════════════════════════════════════════════════════

function initializeItemCodePanel() {
  document.getElementById("itemcode-search-input").value = "";
  document.getElementById("itemcode-search-results-zone").style.display = "none";
  document.getElementById("itemcode-no-results-zone").style.display = "none";
  document.getElementById("itemcode-create-form-zone").style.display = "none";
  document.getElementById("itemcode-feedback-banner").style.display = "none";
  window.icfSearchSelectedType = "";
  const searchTypeInput = document.getElementById("icf-search-type-ta-input");
  if (searchTypeInput) searchTypeInput.value = "";
  const fmtBtn = document.getElementById("icf-mode-btn-format");
  if (fmtBtn) fmtBtn.style.display = localStorage.getItem("erpIsUserAdminGlobal") === "true" ? "inline-block" : "none";
  switchItemCodeMode('search');
  loadItemCodeTypeConfigIntoCache();
  loadItemCodeCatalogIntoCache();
}

async function loadItemCodeCatalogIntoCache(forceRefresh = false) {
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  if (
    !forceRefresh &&
    window.itemCodeCatalogCache &&
    window.itemCodeCatalogCache.length > 0 &&
    window._itemCodeCacheLoadedAt &&
    (now - window._itemCodeCacheLoadedAt) < CACHE_TTL_MS
  ) {
    return;
  }
  try {
    const data = await apFetch({ action: "fetchItemCodeCatalog" });
    if (data.success) {
      window.itemCodeCatalogCache = data.catalog;
      window._itemCodeCacheLoadedAt = Date.now();
    } else {
      console.error("ItemCode catalog failed:", data.error);
      window.itemCodeCatalogCache = [];
    }
  } catch (e) {
    console.error("ItemCode catalog load failed:", e);
    window.itemCodeCatalogCache = [];
  }
}

// Every query word must have a real match (exact word, or a word-start
// match at least 3 characters long) — same strict scorer as Portal's,
// kept identical since ERP has no Gemini re-rank to fall back on for
// larger catalogs, so precision here matters more, not less.
function filterItemCodeCatalogStrict(query, catalog, topN) {
  const queryWords = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);
  if (queryWords.length === 0) return [];
  const codeQuery = query.toLowerCase().replace(/\s+/g, '');

  const scored = catalog.map(item => {
    const nameNorm = (item.combinedName || item.productName || "").toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const nameWords = nameNorm.split(/\s+/).filter(Boolean);
    const codeNorm = (item.itemCode || "").toLowerCase();
    const codeMatch = codeQuery.length >= 3 && codeNorm.includes(codeQuery);

    let score = 0;
    for (const qw of queryWords) {
      let tokenScore = 0;
      for (const nw of nameWords) {
        if (nw === qw) tokenScore = Math.max(tokenScore, 10);
        else if (qw.length >= 3 && (nw.startsWith(qw) || qw.startsWith(nw))) tokenScore = Math.max(tokenScore, 6);
      }
      if (tokenScore === 0) return { item, score: 0, allMatched: false };
      score += tokenScore;
    }
    if (codeMatch) score += 20;
    return { item, score, allMatched: true };
  });

  return scored
    .filter(s => s.allMatched || s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(s => s.item);
}

async function executeItemCodeSearch() {
  const query = document.getElementById("itemcode-search-input").value.trim();
  const btn = document.getElementById("itemcode-search-btn");
  const resultsZone = document.getElementById("itemcode-search-results-zone");
  const noResultsZone = document.getElementById("itemcode-no-results-zone");
  const suggestMount = document.getElementById("itemcode-suggestions-mount");
  const createZone = document.getElementById("itemcode-create-form-zone");
  const banner = document.getElementById("itemcode-feedback-banner");

  if (!query) { alert("Please enter a material name to search."); return; }

  resultsZone.style.display = "none";
  noResultsZone.style.display = "none";
  createZone.style.display = "none";
  banner.style.display = "none";
  suggestMount.innerHTML = "";

  const nmBanner = document.getElementById("itemcode-none-match-banner");
  const nrBtn = document.getElementById("itemcode-no-results-create-btn");
  if (nmBanner) nmBanner.style.display = "block";
  if (nrBtn) nrBtn.style.display = "inline";

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;margin-right:6px;vertical-align:middle;"></div> Searching...';

  try {
    await loadItemCodeCatalogIntoCache();

    const allCatalog = window.itemCodeCatalogCache || [];
    const catalogToSearch = window.icfSearchSelectedType
      ? allCatalog.filter(item => item.typeOfMaterial === window.icfSearchSelectedType)
      : allCatalog;

    const exactMatch = catalogToSearch.filter(item =>
      (item.combinedName || item.productName || "").toLowerCase().includes(query.toLowerCase())
    );
    const top15 = filterItemCodeCatalogStrict(query, catalogToSearch, 15);
    const candidatesToUse = top15.length > 0 ? top15 : exactMatch;

    if (candidatesToUse.length === 0) {
      noResultsZone.style.display = "block";
      return;
    }

    // No Gemini re-rank in ERP yet (see file header) — show up to 10
    // strict-matched candidates directly.
    const finalMatches = candidatesToUse.slice(0, 10).map(c => ({
      itemCode: c.itemCode,
      productName: c.combinedName || c.productName,
      typeOfMaterial: c.typeOfMaterial,
    }));

    const _unitLookup = {};
    (window.itemCodeCatalogCache || []).forEach(c => {
      if (c.itemCode) _unitLookup[c.itemCode.toString().trim().toUpperCase()] = (c.unit || "").toString().trim();
    });

    finalMatches.forEach((match) => {
      const unit = _unitLookup[(match.itemCode || "").toString().trim().toUpperCase()] || "";
      const card = document.createElement("div");
      card.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#fff; border:1.5px solid var(--border); border-radius:var(--radius); padding:12px 16px; cursor:pointer; transition:all 0.15s ease;";
      card.title = "Click to clone this item code into the Create form — change what's different, then Create to save it as a new item code.";
      card.onmouseover = () => { card.style.borderColor = "var(--brand)"; card.style.background = "var(--highlight-bg)"; };
      card.onmouseout = () => { card.style.borderColor = "var(--border)"; card.style.background = "#fff"; };
      card.onclick = () => cloneItemCodeIntoCreateForm(match.itemCode);
      card.innerHTML = `
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span style="font-family:monospace; font-weight:800; color:var(--brand); font-size:0.9rem;">${match.itemCode}</span>
          </div>
          <div style="font-size:0.88rem; font-weight:600; color:var(--text); line-height:1.4;">${match.productName}</div>
          <div style="font-size:0.75rem; color:var(--muted); margin-top:2px;">${match.typeOfMaterial}${unit ? ` &nbsp;·&nbsp; <strong style="color:var(--text);">Unit: ${unit}</strong>` : ""}</div>
        </div>
        <span style="color:var(--brand); font-size:0.78rem; font-weight:700; flex-shrink:0; margin-left:10px;">Clone →</span>
      `;
      suggestMount.appendChild(card);
    });

    resultsZone.style.display = "block";
  } catch (e) {
    banner.style.cssText = "display:block; background:#fee2e2; border-color:#b91c1c; color:#b91c1c; padding:10px; border-left:4px solid #b91c1c;";
    banner.textContent = "Search failed: " + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Search";
  }
}

async function revealItemCodeCreateForm() {
  const createZone = document.getElementById("itemcode-create-form-zone");
  const codeInput = document.getElementById("itemcode-new-code");
  const nameInput = document.getElementById("itemcode-new-name");
  const typeInput = document.getElementById("icf-new-type-ta-input");
  const banner = document.getElementById("itemcode-feedback-banner");

  const noneMatchBanner = document.getElementById("itemcode-none-match-banner");
  const noResultsBtn = document.getElementById("itemcode-no-results-create-btn");
  if (noneMatchBanner) noneMatchBanner.style.display = "none";
  if (noResultsBtn) noResultsBtn.style.display = "none";

  const query = document.getElementById("itemcode-search-input").value.trim();
  nameInput.value = query;
  typeInput.value = "";
  typeInput.disabled = false;
  const subSelectReset = document.getElementById("icf-new-suboption-select");
  if (subSelectReset) subSelectReset.disabled = false;
  codeInput.value = "Loading...";
  banner.style.display = "none";
  const searchZoneWrapper = document.getElementById("itemcode-search-zone-wrapper");
  if (searchZoneWrapper) searchZoneWrapper.style.display = "block";
  document.getElementById("icf-new-fixed-zone").style.display = "none";
  document.getElementById("icf-new-freeform-zone").style.display = "none";
  if (document.getElementById("icf-new-fixed-make")) document.getElementById("icf-new-fixed-make").value = "";
  if (document.getElementById("itemcode-new-make")) document.getElementById("itemcode-new-make").value = "";
  await loadItemCodeTypeConfigIntoCache();

  createZone.style.display = "block";
  createZone.scrollIntoView({ behavior: "smooth", block: "nearest" });

  try {
    const data = await apFetch({ action: "getNextItemCode" });
    codeInput.value = data.success ? data.nextCode : "Error — refresh";
  } catch (e) {
    codeInput.value = "Error — refresh";
  }
}

// typeLabelDisplay_ — Portal has a shared version elsewhere for display
// tweaks on a handful of Type-of-Material names; ERP has no equivalent
// yet, so this is a plain passthrough. Kept as a named function (not
// inlined) so a future per-type label override can be added here without
// touching the success-banner code that calls it.
function typeLabelDisplay_(typeOfMaterial) {
  return typeOfMaterial;
}

async function submitNewItemCode() {
  const btn = document.getElementById("itemcode-create-submit-btn");
  const banner = document.getElementById("itemcode-feedback-banner");
  const itemCode = document.getElementById("itemcode-new-code").value.trim();
  const typeOfMat = document.getElementById("icf-new-type-ta-input").value.trim();

  if (!typeOfMat) { alert("Type of Material is required."); return; }
  if (!itemCode || itemCode === "Loading..." || itemCode === "Error — refresh") {
    alert("Item Code not loaded yet. Please wait or refresh.");
    return;
  }

  const usingFormat = document.getElementById("icf-new-fixed-zone").style.display !== "none"
    && !document.getElementById("icf-new-admin-manual-checkbox").checked;

  let payload;
  let materialName, rating, unit;

  const makeInput = usingFormat ? document.getElementById("icf-new-fixed-make") : document.getElementById("itemcode-new-make");
  const make = (makeInput ? makeInput.value.trim().toUpperCase() : "");
  if (make && make.includes("ABPS")) {
    showBOQBanner("itemcode-feedback-banner", "⚠️ Make cannot be \"ABPS\" — leave Make blank for ABPS-made materials, and only enter another company's name.", "error");
    return;
  }

  if (usingFormat) {
    if (!icfSelectedFormat) { alert("Select a Sub-Option first."); return; }
    const nameValues = icfNameGetValues ? icfNameGetValues() : [];
    const ratingValues = icfRatingGetValues ? icfRatingGetValues() : [];
    const nameErr = icfValidateValues(icfSelectedFormat.materialNameTemplate, nameValues);
    if (nameErr) { showBOQBanner("itemcode-feedback-banner", "⚠️ Material Name: " + nameErr, "error"); return; }
    if (icfSelectedFormat.ratingTemplate) {
      const ratingErr = icfValidateValues(icfSelectedFormat.ratingTemplate, ratingValues);
      if (ratingErr) { showBOQBanner("itemcode-feedback-banner", "⚠️ Rating: " + ratingErr, "error"); return; }
    }
    payload = { formatId: icfSelectedFormat.formatId, materialNameValues: nameValues, ratingValues, make };
    materialName = document.getElementById("icf-new-preview-name").textContent;
    rating = document.getElementById("icf-new-preview-rating").textContent;
    unit = icfSelectedFormat.unit;
  } else {
    materialName = document.getElementById("itemcode-new-name").value.trim();
    rating = document.getElementById("itemcode-new-rating").value.trim();
    unit = document.getElementById("itemcode-new-unit").value.trim();
    if (!materialName) { alert("Material Name is required."); return; }
    if (!unit) { alert("Unit is required."); return; }
    payload = { materialName, rating, typeOfMaterial: typeOfMat, unit, make };
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;margin-right:6px;vertical-align:middle;"></div> Creating...';

  try {
    const data = await apFetch({
      action: "createItemCode",
      ...payload,
      createdBy: appActiveOperatorIdentityString,
      operatorName: appActiveOperatorIdentityString
    });

    if (data.success) {
      document.getElementById("itemcode-create-form-zone").style.display = "none";
      document.getElementById("itemcode-search-results-zone").style.display = "none";
      document.getElementById("itemcode-no-results-zone").style.display = "none";
      document.getElementById("itemcode-search-zone-wrapper").style.display = "none";
      const directCreateWrap = document.getElementById("itemcode-direct-create-btn-wrap");
      const orSearchDivider = document.getElementById("itemcode-or-search-divider");
      if (directCreateWrap) directCreateWrap.style.display = "none";
      if (orSearchDivider) orSearchDivider.style.display = "none";

      banner.style.cssText = "display:block; background:#dcfce7; border-color:#15803d; color:#15803d; padding:14px; border-left:4px solid #15803d; border-radius:var(--radius);";
      banner.innerHTML = `
        <strong style="font-size:0.95rem;">Item Code Created Successfully!</strong><br/>
        <div style="margin-top:8px; display:flex; gap:16px; flex-wrap:wrap;">
          <span>Code: <strong style="font-family:monospace; font-size:1rem; background:#fff; padding:2px 8px; border-radius:4px; border:1px solid #15803d;">${data.itemCode || itemCode}</strong></span>
          <span>Product: <strong>${materialName}${rating ? " - " + rating : ""}${make ? " - Make: " + make : ""}</strong></span>
          <span>Type: <strong>${typeLabelDisplay_(typeOfMat)}</strong></span>
          <span>Unit: <strong>${unit}</strong></span>
        </div>
        <button onclick="
          document.getElementById('itemcode-feedback-banner').style.display='none';
          document.getElementById('itemcode-search-input').value='';
          document.getElementById('itemcode-search-results-zone').style.display='none';
          document.getElementById('itemcode-no-results-zone').style.display='none';
          document.getElementById('itemcode-create-form-zone').style.display='none';
          document.getElementById('itemcode-search-zone-wrapper').style.display='block';
          const dc = document.getElementById('itemcode-direct-create-btn-wrap'); if(dc) dc.style.display='block';
          const osd = document.getElementById('itemcode-or-search-divider'); if(osd) osd.style.display='block';
          const nm = document.getElementById('itemcode-none-match-banner'); if(nm) nm.style.display='block';
          const nb = document.getElementById('itemcode-no-results-create-btn'); if(nb) nb.style.display='inline';
        " style="margin-top:10px; background:#15803d; color:#fff; border:none; padding:6px 14px; border-radius:4px; font-weight:700; cursor:pointer; font-size:0.8rem;">
          + Search / Add Another Item
        </button>
      `;

      await loadItemCodeCatalogIntoCache(true);
      banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      banner.style.cssText = "display:block; background:#fee2e2; border-color:#b91c1c; color:#b91c1c; padding:12px; border-left:4px solid #b91c1c; border-radius:var(--radius);";
      banner.textContent = "Failed: " + data.error;
    }
  } catch (e) {
    banner.style.cssText = "display:block; background:#fee2e2; border-color:#b91c1c; color:#b91c1c; padding:12px; border-left:4px solid #b91c1c; border-radius:var(--radius);";
    banner.textContent = "Network error: " + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Create Item Code";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Template-driven Item Code creation — see design/item-code-format.js
// (client port of erp-backend/lib/itemCodeFormat.js) for the template
// engine itself. The server is the ONLY authority on what a format
// actually renders to — everything below is convenience/preview.
// ═══════════════════════════════════════════════════════════════════════

async function loadItemCodeTypeConfigIntoCache(forceRefresh = false) {
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const now = Date.now();
  if (!forceRefresh && window.itemCodeTypeConfigCache && window.itemCodeTypeConfigCache.length > 0 &&
      window._itemCodeTypeConfigLoadedAt && (now - window._itemCodeTypeConfigLoadedAt) < CACHE_TTL_MS) {
    return;
  }
  try {
    const data = await apFetch({ action: "fetchItemCodeTypeConfig" });
    if (data.success) {
      window.itemCodeTypeConfigCache = data.types;
      window._itemCodeTypeConfigLoadedAt = Date.now();
    }
  } catch (e) {
    console.error("Item Code type config load failed:", e);
  }
}

function switchItemCodeMode(mode) {
  document.getElementById("icf-mode-search").style.display = mode === 'search' ? "block" : "none";
  document.getElementById("icf-mode-format").style.display = mode === 'format' ? "block" : "none";
  document.getElementById("icf-mode-btn-search").style.background = mode === 'search' ? "var(--brand)" : "#e2e8f0";
  document.getElementById("icf-mode-btn-search").style.color = mode === 'search' ? "#fff" : "#334155";
  document.getElementById("icf-mode-btn-format").style.background = mode === 'format' ? "var(--brand)" : "#e2e8f0";
  document.getElementById("icf-mode-btn-format").style.color = mode === 'format' ? "#fff" : "#334155";
  document.getElementById("itemcode-feedback-banner").style.display = "none";
}

// Generic Type of Material typeahead — used by three inputs: the
// search-zone filter, the create form's Type of Material, and the
// format editor's Type of Material.
function handleIcfTypeTypeaheadInput(query, inputId, dropdownId) {
  const dd = document.getElementById(dropdownId);
  if (!dd) return;
  if (!query || query.trim().length < 1) { dd.style.display = "none"; return; }
  const q = query.trim().toLowerCase();
  const matches = (window.itemCodeTypeConfigCache || [])
    .filter(t => t.typeOfMaterial.toLowerCase().includes(q)).slice(0, 15);
  if (matches.length === 0) { dd.style.display = "none"; return; }
  dd.innerHTML = matches.map(t => `
    <div onmousedown="event.preventDefault();" onclick="selectIcfTypeTypeahead('${t.typeOfMaterial.replace(/'/g,"\\'")}', '${inputId}', '${dropdownId}')"
      style="padding:8px 10px; cursor:pointer; border-bottom:1px solid #f1f5f9; font-size:0.82rem;"
      onmouseover="this.style.background='var(--highlight-bg)'" onmouseout="this.style.background='#fff'">
      <span style="font-weight:700;">${t.typeOfMaterial}</span>
      <span style="font-size:0.7rem; color:var(--muted); margin-left:6px;">${t.entryMode}</span>
    </div>`).join("");
  dd.style.display = "block";
}

function selectIcfTypeTypeahead(typeOfMaterial, inputId, dropdownId) {
  const input = document.getElementById(inputId);
  input.value = typeOfMaterial;
  document.getElementById(dropdownId).style.display = "none";
  input.dispatchEvent(new Event('change'));
}

function handleIcfSearchTypeChange(typeOfMaterial) {
  window.icfSearchSelectedType = (typeOfMaterial || "").trim();
}

// ── Create New Item Code: progressive flow ──────────────────────────────
let icfCurrentFormats = [];
let icfNameGetValues = null;
let icfRatingGetValues = null;
let icfSelectedFormat = null;

async function handleIcfNewTypeChange(typeOfMaterial) {
  const type = (typeOfMaterial || "").trim();
  const fixedZone = document.getElementById("icf-new-fixed-zone");
  const freeformZone = document.getElementById("icf-new-freeform-zone");
  const fixedForm = document.getElementById("icf-new-fixed-form");
  const subSelect = document.getElementById("icf-new-suboption-select");
  const adminToggleWrap = document.getElementById("icf-new-admin-manual-toggle");
  const adminCheckbox = document.getElementById("icf-new-admin-manual-checkbox");

  icfSelectedFormat = null;
  fixedForm.style.display = "none";
  subSelect.innerHTML = '<option value="">— Select Sub-Option —</option>';
  adminCheckbox.checked = false;

  const cfg = (window.itemCodeTypeConfigCache || []).find(t => t.typeOfMaterial === type);
  if (!type || !cfg) {
    fixedZone.style.display = "none";
    freeformZone.style.display = "none";
    return;
  }

  const isAdmin = localStorage.getItem("erpIsUserAdminGlobal") === "true";
  if (cfg.entryMode === 'Free Form') {
    fixedZone.style.display = "none";
    freeformZone.style.display = "block";
    return;
  }

  freeformZone.style.display = "none";
  fixedZone.style.display = "block";
  adminToggleWrap.style.display = isAdmin ? "block" : "none";

  try {
    const data = await apFetch({ action: "fetchItemCodeFormats", typeOfMaterial: type });
    icfCurrentFormats = data.success ? data.formats : [];
  } catch (e) { icfCurrentFormats = []; }

  subSelect.innerHTML = '<option value="">— Select Sub-Option —</option>' +
    icfCurrentFormats.map(f => `<option value="${f.formatId}">${f.subOption}</option>`).join("");
}

function handleIcfSubOptionChange(formatIdStr, initialValues) {
  const fixedForm = document.getElementById("icf-new-fixed-form");
  icfSelectedFormat = icfCurrentFormats.find(f => String(f.formatId) === String(formatIdStr)) || null;
  if (!icfSelectedFormat) { fixedForm.style.display = "none"; return; }

  fixedForm.style.display = "block";
  icfNameGetValues = icfRenderFormInputs(
    document.getElementById("icf-new-name-inputs"), icfSelectedFormat.materialNameTemplate, updateIcfNewPreview, "icf-new-name",
    initialValues ? initialValues.materialNameValues : undefined
  );
  const ratingContainer = document.getElementById("icf-new-rating-inputs");
  if (icfSelectedFormat.ratingTemplate && icfSelectedFormat.ratingTemplate.trim()) {
    icfRatingGetValues = icfRenderFormInputs(ratingContainer, icfSelectedFormat.ratingTemplate, updateIcfNewPreview, "icf-new-rating",
      initialValues ? initialValues.ratingValues : undefined);
  } else {
    ratingContainer.innerHTML = '<span style="color:var(--muted); font-size:0.82rem;">— No Rating for this Sub-Option —</span>';
    icfRatingGetValues = () => [];
  }
  document.getElementById("icf-new-preview-unit").textContent = icfSelectedFormat.unit;
  updateIcfNewPreview();
}

async function cloneItemCodeIntoCreateForm(itemCode) {
  const item = (window.itemCodeCatalogCache || []).find(c => c.itemCode === itemCode);
  if (!item) { alert("Could not find that item code's details — try refreshing the search."); return; }

  await revealItemCodeCreateForm();

  const typeInput = document.getElementById("icf-new-type-ta-input");
  const subSelect = document.getElementById("icf-new-suboption-select");
  typeInput.value = item.typeOfMaterial || "";
  await handleIcfNewTypeChange(item.typeOfMaterial || "");

  // A handful of item codes carry a stale format_id — pointing at a
  // format for a DIFFERENT Type of Material than the one stored on the
  // item code itself (found 2 Sep 2026: 158 rows, same set in both
  // Portal and ERP, most likely a leftover from the Aug 2026 item-code
  // renumbering — see Portal's CLAUDE.md §69). Locking the dropdown to a
  // format_id that isn't even in icfCurrentFormats for this Type left
  // the Sub-Option select empty and the whole fixed form blank with no
  // explanation. Detect that here and fall back to an unlocked, manually
  // pickable Sub-Option instead of silently rendering nothing.
  const formatStillValid = item.formatId && icfCurrentFormats.some(f => String(f.formatId) === String(item.formatId));

  if (formatStillValid) {
    const initialValues = item.formatValues || null;
    subSelect.value = item.formatId;
    handleIcfSubOptionChange(String(item.formatId), initialValues);
    if (document.getElementById("icf-new-fixed-make")) document.getElementById("icf-new-fixed-make").value = item.make || "";
    typeInput.disabled = true;
    subSelect.disabled = true;
  } else if (item.formatId) {
    // Stale format_id — Type of Material is still correct and locked,
    // but the Sub-Option is left for the operator to pick themselves.
    typeInput.disabled = true;
    subSelect.disabled = false;
    if (document.getElementById("icf-new-fixed-make")) document.getElementById("icf-new-fixed-make").value = item.make || "";
  } else {
    if (document.getElementById("itemcode-new-name")) document.getElementById("itemcode-new-name").value = item.productName || "";
    if (document.getElementById("itemcode-new-rating")) document.getElementById("itemcode-new-rating").value = item.rating || "";
    if (document.getElementById("itemcode-new-unit")) document.getElementById("itemcode-new-unit").value = item.unit || "";
    if (document.getElementById("itemcode-new-make")) document.getElementById("itemcode-new-make").value = item.make || "";
  }

  const banner = document.getElementById("itemcode-feedback-banner");
  if (item.formatId && !formatStillValid) {
    banner.style.cssText = "display:block; background:#fffbeb; border-color:#d97706; color:#92400e; padding:10px; border-left:4px solid #d97706; border-radius:var(--radius); font-size:0.85rem;";
    banner.textContent = `Cloned from ${itemCode} — its saved Sub-Option no longer matches a valid format for "${item.typeOfMaterial}" (likely stale data). Type of Material is locked; please pick the correct Sub-Option yourself, then fill in the values and Create.`;
  } else {
    banner.style.cssText = "display:block; background:#eff6ff; border-color:var(--brand); color:var(--brand); padding:10px; border-left:4px solid var(--brand); border-radius:var(--radius); font-size:0.85rem;";
    banner.textContent = `Cloned from ${itemCode}${item.formatId ? " — Type of Material and Sub-Option are locked to match its fixed format" : ""}. Change what's different, then Create to save as a new item code.`;
  }
}

function updateIcfNewPreview() {
  if (!icfSelectedFormat) return;
  const nameEl = document.getElementById("icf-new-preview-name");
  const ratingEl = document.getElementById("icf-new-preview-rating");
  try {
    nameEl.textContent = icfRenderTemplate(icfSelectedFormat.materialNameTemplate, icfNameGetValues ? icfNameGetValues() : []) || "—";
  } catch (e) { nameEl.textContent = "—"; }
  try {
    ratingEl.textContent = icfSelectedFormat.ratingTemplate
      ? (icfRenderTemplate(icfSelectedFormat.ratingTemplate, icfRatingGetValues ? icfRatingGetValues() : []) || "—")
      : "—";
  } catch (e) { ratingEl.textContent = "—"; }
}

function handleIcfAdminManualToggle(checked) {
  document.getElementById("icf-new-fixed-form").style.display = checked ? "none" : "block";
  document.getElementById("icf-new-suboption-select").disabled = checked;
  document.getElementById("icf-new-freeform-zone").style.display = checked ? "block" : "none";
}

// ── Admin: Add / Change Item Code Format ────────────────────────────────
let icfFmtCurrentType = "";

async function handleIcfFormatTypeChange(typeOfMaterial) {
  const type = (typeOfMaterial || "").trim();
  icfFmtCurrentType = type;
  const listZone = document.getElementById("icf-fmt-list-zone");
  const entryModeSelect = document.getElementById("icf-fmt-entry-mode");
  closeIcfFormatEditor();
  if (!type) { listZone.style.display = "none"; return; }

  const cfg = (window.itemCodeTypeConfigCache || []).find(t => t.typeOfMaterial === type);
  entryModeSelect.value = cfg ? cfg.entryMode : 'Fixed Format';

  listZone.style.display = "block";
  const listEl = document.getElementById("icf-fmt-formats-list");
  listEl.innerHTML = '<div style="color:var(--muted); font-size:0.85rem;">Loading...</div>';
  try {
    const data = await apFetch({ action: "fetchItemCodeFormats", typeOfMaterial: type });
    icfCurrentFormats = data.success ? data.formats : [];
  } catch (e) { icfCurrentFormats = []; }

  if (icfCurrentFormats.length === 0) {
    listEl.innerHTML = '<div style="color:var(--muted); font-size:0.85rem;">No formats yet for this Type of Material.</div>';
    return;
  }
  listEl.innerHTML = icfCurrentFormats.map(f => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid var(--border); border-radius:var(--radius); padding:12px 16px;">
      <div>
        <div style="font-weight:700; color:var(--brand);">${f.subOption}</div>
        <div style="font-size:0.78rem; color:var(--muted); font-family:monospace; margin-top:2px;">${f.materialNameTemplate}</div>
        ${f.ratingTemplate ? `<div style="font-size:0.78rem; color:var(--muted); font-family:monospace;">${f.ratingTemplate}</div>` : ''}
        <div style="font-size:0.72rem; color:var(--muted); margin-top:2px;">Unit: <strong>${f.unit}</strong></div>
      </div>
      <button onclick="editIcfFormat(${f.formatId})" style="background:var(--brand); color:#fff; border:none; padding:6px 14px; border-radius:4px; font-weight:700; cursor:pointer; font-size:0.8rem;">Edit</button>
    </div>`).join("");
}

async function handleIcfEntryModeChange(newMode) {
  if (!icfFmtCurrentType) return;
  try {
    await apFetch({ action: "saveItemCodeTypeConfig", typeOfMaterial: icfFmtCurrentType, entryMode: newMode, operatorName: appActiveOperatorIdentityString });
    await loadItemCodeTypeConfigIntoCache(true);
  } catch (e) {
    showBOQBanner("itemcode-feedback-banner", "⚠️ Failed to update entry mode: " + e.message, "error");
  }
}

function openIcfAddFormatEditor() {
  document.getElementById("icf-fmt-editor-formatid").value = "";
  document.getElementById("icf-fmt-editor-suboption").value = "";
  document.getElementById("icf-fmt-editor-name-template").value = "";
  document.getElementById("icf-fmt-editor-rating-template").value = "";
  document.getElementById("icf-fmt-editor-unit").value = "";
  document.getElementById("icf-fmt-editor-deactivate-btn").style.display = "none";
  document.getElementById("icf-fmt-editor-name-error").textContent = "";
  document.getElementById("icf-fmt-editor-rating-error").textContent = "";
  document.getElementById("icf-fmt-editor-zone").style.display = "block";
  renderIcfFormatEditorPreview();
  document.getElementById("icf-fmt-editor-zone").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function editIcfFormat(formatId) {
  const f = icfCurrentFormats.find(x => x.formatId === formatId);
  if (!f) return;
  document.getElementById("icf-fmt-editor-formatid").value = f.formatId;
  document.getElementById("icf-fmt-editor-suboption").value = f.subOption;
  document.getElementById("icf-fmt-editor-name-template").value = f.materialNameTemplate;
  document.getElementById("icf-fmt-editor-rating-template").value = f.ratingTemplate || "";
  document.getElementById("icf-fmt-editor-unit").value = f.unit;
  document.getElementById("icf-fmt-editor-deactivate-btn").style.display = "inline-block";
  document.getElementById("icf-fmt-editor-name-error").textContent = "";
  document.getElementById("icf-fmt-editor-rating-error").textContent = "";
  document.getElementById("icf-fmt-editor-zone").style.display = "block";
  renderIcfFormatEditorPreview();
  document.getElementById("icf-fmt-editor-zone").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeIcfFormatEditor() {
  document.getElementById("icf-fmt-editor-zone").style.display = "none";
}

function renderIcfFormatEditorPreview() {
  const nameTemplate = document.getElementById("icf-fmt-editor-name-template").value;
  const ratingTemplate = document.getElementById("icf-fmt-editor-rating-template").value;
  const nameErrEl = document.getElementById("icf-fmt-editor-name-error");
  const ratingErrEl = document.getElementById("icf-fmt-editor-rating-error");
  const namePreview = document.getElementById("icf-fmt-editor-name-preview");
  const ratingPreview = document.getElementById("icf-fmt-editor-rating-preview");

  const nameParsed = icfParseTemplate(nameTemplate);
  nameErrEl.textContent = nameParsed.error || "";
  icfRenderFormInputs(namePreview, nameTemplate, () => {}, "icf-fmt-editor-name-preview-ph");

  if (ratingTemplate.trim()) {
    const ratingParsed = icfParseTemplate(ratingTemplate);
    ratingErrEl.textContent = ratingParsed.error || "";
    icfRenderFormInputs(ratingPreview, ratingTemplate, () => {}, "icf-fmt-editor-rating-preview-ph");
  } else {
    ratingErrEl.textContent = "";
    ratingPreview.innerHTML = '<span style="color:var(--muted); font-size:0.82rem;">— No Rating —</span>';
  }
}

async function submitIcfSaveFormat() {
  const formatId = document.getElementById("icf-fmt-editor-formatid").value.trim();
  const subOption = document.getElementById("icf-fmt-editor-suboption").value.trim();
  const nameTemplate = document.getElementById("icf-fmt-editor-name-template").value.trim();
  const ratingTemplate = document.getElementById("icf-fmt-editor-rating-template").value.trim();
  const unit = document.getElementById("icf-fmt-editor-unit").value.trim();

  if (!subOption) return showBOQBanner("itemcode-feedback-banner", "⚠️ Sub-Option is required.", "error");
  if (!nameTemplate) return showBOQBanner("itemcode-feedback-banner", "⚠️ Material Name Template is required.", "error");
  if (!unit) return showBOQBanner("itemcode-feedback-banner", "⚠️ Unit is required.", "error");

  try {
    const data = await apFetch({
      action: "saveItemCodeFormat", formatId: formatId || null, typeOfMaterial: icfFmtCurrentType,
      subOption, materialNameTemplate: nameTemplate, ratingTemplate: ratingTemplate || null, unit,
      operatorName: appActiveOperatorIdentityString
    });
    if (!data.success) return showBOQBanner("itemcode-feedback-banner", "⚠️ " + data.error, "error");
    showBOQBanner("itemcode-feedback-banner", `✅ Format "${subOption}" saved.`, "success");
    closeIcfFormatEditor();
    handleIcfFormatTypeChange(icfFmtCurrentType);
  } catch (e) {
    showBOQBanner("itemcode-feedback-banner", "⚠️ Network error: " + e.message, "error");
  }
}

async function submitIcfDeactivateFormat() {
  const formatId = document.getElementById("icf-fmt-editor-formatid").value.trim();
  if (!formatId) return;
  if (!confirm("Deactivate this Item Code format? Existing item codes already created from it are unaffected.")) return;
  try {
    const data = await apFetch({ action: "deactivateItemCodeFormat", formatId, operatorName: appActiveOperatorIdentityString });
    if (!data.success) return showBOQBanner("itemcode-feedback-banner", "⚠️ " + data.error, "error");
    showBOQBanner("itemcode-feedback-banner", "✅ Format deactivated.", "success");
    closeIcfFormatEditor();
    handleIcfFormatTypeChange(icfFmtCurrentType);
  } catch (e) {
    showBOQBanner("itemcode-feedback-banner", "⚠️ Network error: " + e.message, "error");
  }
}
