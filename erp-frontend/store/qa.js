// ═══════════════════════════════════════════════════════════════════════
// store/qa.js — ★ PARTIAL FILE (Batch 5 — Purchase, 16 Sep 2026).
//
// Store is Batch 6 and is NOT built yet. Portal's own store/qa.js is a
// ~1700-line file covering Store Entry, GRN and Raw Materials Q/A Check.
// Only ONE screen out of it belongs to the PURCHASE department: "Store
// Inward Rejected & Missing Material" (`perm_store_inward_rejected`,
// canvas-module-purchase-rejected-material), which renders inside
// Purchase's own workspace enclosure. Those functions are extracted here
// VERBATIM, at Portal's own file path, so Batch 6 can copy Portal's full
// store/qa.js over this file wholesale without producing duplicate
// function declarations.
//
// ★ BATCH 6: do NOT treat this as "QA Check is already partly done."
// Replace this file with Portal's full store/qa.js and confirm this
// block comes across unchanged.
//
// ERP adaptation (the only one): the admin flag reads the erp-prefixed
// localStorage key (CLAUDE.md §3 — Portal and ERP share one origin).
// `rejVendorSearchDebounce` is deliberately NOT declared here: Portal
// declares it in purchase/po.js (an artifact of its own automated file
// split) and so does ERP — a second top-level `let` of the same name
// would be a fatal SyntaxError.
// ═══════════════════════════════════════════════════════════════════════

// exitCanvasToCardView — Portal defines it at the top of this same file.
// It was ALREADY referenced by ERP's index.html and marketing/companies.js
// and marketing/leads.js ("Back to Search") since Batch 2 but defined
// nowhere, so those buttons threw. Included here at its real Portal home
// rather than inventing a new one.
function exitCanvasToCardView() {
  collapseNewEntryDropdownFormExplicitly();
  document.getElementById("global-direct-inline-create-entry-btn").style.display = "none";
  document.getElementById("step2-inline-interaction-canvas").style.display = "none";
  document.getElementById("missing-trigger-notice-block").style.display = "none";
  if (currentActiveModuleContext === "CARD") {
    document.getElementById("step1-card-capture-block").style.display = "block";
  } else if (currentActiveModuleContext === "DROPDOWN") {
    document.getElementById("company-dropdown-selector-block").style.display = "block";
    triggerCompanyDropdownArrayFetch();
  } else {
    // FILTERS context — show the search form in whichever workspace last had results
    const filterInputMap = {
      "workspace-searchStatus":        "status-search-section",
      "workspace-searchEngineer":      "engineer-search-section",
      "workspace-searchQualification": "qualification-search-section",
      "workspace-searchCityState":     "city-state-search-section"
    };
    const sectionId = filterInputMap[canvasLastParentWorkspaceId];
    if (sectionId && document.getElementById(sectionId)) {
      document.getElementById(sectionId).style.display = "block";
    }
  }
}

function handleRejVendorSearch(query) {
  clearTimeout(rejVendorSearchDebounce);
  const dropdown = document.getElementById("rejected-material-vendor-dropdown");
  if (!query || query.trim().length < 1) { if (dropdown) dropdown.style.display = "none"; return; }
  rejVendorSearchDebounce = setTimeout(async () => {
    try {
      const data = await apFetch({ action: "searchVendorNamesForRejectedMaterial", query });
      if (!dropdown) return;
      if (!data.success || !data.vendors.length) { dropdown.style.display = "none"; return; }
      dropdown.innerHTML = data.vendors.map(v => `<div onclick="selectRejVendorSuggestion('${v.replace(/'/g,"\\'")}')" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='var(--highlight-bg)'" onmouseout="this.style.background='#fff'">${v}</div>`).join("");
      dropdown.style.display = "block";
    } catch(e) { if (dropdown) dropdown.style.display = "none"; }
  }, 250);
}

function selectRejVendorSuggestion(vendorName) {
  const input = document.getElementById("rejected-material-vendor-input");
  if (input) input.value = vendorName;
  const dropdown = document.getElementById("rejected-material-vendor-dropdown");
  if (dropdown) dropdown.style.display = "none";
  applyRejectedMaterialFilters();
}

function toggleRejActionAll(checked) {
  if (checked) {
    document.querySelectorAll(".rej-action-filter-cb").forEach(cb => cb.checked = false);
  }
  applyRejectedMaterialFilters();
}

function handleRejActionFilterChange() {
  const anyChecked = Array.from(document.querySelectorAll(".rej-action-filter-cb")).some(cb => cb.checked);
  const allCb = document.getElementById("rej-action-all");
  if (allCb) allCb.checked = !anyChecked;
  applyRejectedMaterialFilters();
}

function applyRejectedMaterialFilters() {
  const vendorInput = document.getElementById("rejected-material-vendor-input");
  window.rejMaterialVendorFilter = vendorInput ? vendorInput.value : "";
  const allCb = document.getElementById("rej-action-all");
  window.rejMaterialActionFilter = (allCb && allCb.checked)
    ? []
    : Array.from(document.querySelectorAll(".rej-action-filter-cb:checked")).map(cb => cb.value);
  initializeRejectedMaterialPanel('completed');
}

async function initializeRejectedMaterialPanel(toggle) {
  window.activeRejectedMaterialToggle = toggle || window.activeRejectedMaterialToggle || "pending";
  const feed = document.getElementById("rejected-material-cards-feed");
  const isCompleted = window.activeRejectedMaterialToggle === "completed";

  const cleanVendor = (window.rejMaterialVendorFilter || "").toString().trim();
  const selectedActions = window.rejMaterialActionFilter || [];
  const ALL_ACTIONS = ["Return to Vendor for Replacement", "Return to Vendor for Repair", "Ask Vendor to repair at ABPS", "Ask ABPS to Repair at ABPS", "Under Deviation"];

  const filterSummaryText = isCompleted
    ? `Filtering for ${selectedActions.length === 0 ? "All Action for Rejected" : selectedActions.join(", or ")}${cleanVendor ? ` • Vendor: "${cleanVendor}"` : ""}`
    : "";

  const toggleBar = `
    <div style="display:flex; gap:8px; margin-bottom:12px;">
      <button class="nav-btn-styled" onclick="initializeRejectedMaterialPanel('pending')" style="background:${!isCompleted ? 'var(--brand)' : '#e2e8f0'}; color:${!isCompleted ? '#fff' : '#334155'}; font-weight:700;">Pending Action</button>
      <button class="nav-btn-styled" onclick="initializeRejectedMaterialPanel('completed')" style="background:${isCompleted ? 'var(--brand)' : '#e2e8f0'}; color:${isCompleted ? '#fff' : '#334155'}; font-weight:700;">Action in Progress</button>
    </div>
    ${isCompleted ? `
    <div style="display:flex; gap:14px; margin-bottom:12px; flex-wrap:wrap; align-items:center; background:#f8fafc; border:1px solid var(--border); border-radius:var(--radius); padding:12px;">
      <div style="position:relative; flex:1; min-width:200px;">
        <input type="text" id="rejected-material-vendor-input" placeholder="Search by Vendor Name..." value="${cleanVendor.replace(/"/g,'&quot;')}" autocomplete="off"
          style="width:100%; padding:8px; border:1.5px solid var(--border); border-radius:var(--radius);"
          oninput="handleRejVendorSearch(this.value)"
          onkeydown="if(event.key==='Enter') applyRejectedMaterialFilters()" />
        <div id="rejected-material-vendor-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; background:#fff; border:1.5px solid var(--brand); border-top:none; border-radius:0 0 4px 4px; max-height:200px; overflow-y:auto; z-index:200; box-shadow:0 6px 16px rgba(0,0,0,0.15);"></div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <label style="display:flex; align-items:center; gap:6px; font-size:0.78rem; font-weight:700; padding:6px 12px; border:1.5px solid ${selectedActions.length === 0 ? 'var(--brand)' : 'var(--border)'}; border-radius:20px; background:${selectedActions.length === 0 ? '#eff6ff' : '#fff'}; cursor:pointer; white-space:nowrap;">
          <input type="checkbox" id="rej-action-all" onchange="toggleRejActionAll(this.checked)" ${selectedActions.length === 0 ? 'checked' : ''} style="margin:0; cursor:pointer;"> ALL
        </label>
        ${ALL_ACTIONS.map(a => `
          <label style="display:flex; align-items:center; gap:6px; font-size:0.78rem; font-weight:600; padding:6px 12px; border:1.5px solid ${selectedActions.includes(a) ? 'var(--brand)' : 'var(--border)'}; border-radius:20px; background:${selectedActions.includes(a) ? '#eff6ff' : '#fff'}; cursor:pointer; white-space:nowrap;">
            <input type="checkbox" class="rej-action-filter-cb" value="${a}" onchange="handleRejActionFilterChange()" ${selectedActions.includes(a) ? 'checked' : ''} style="margin:0; cursor:pointer;"> ${a}
          </label>`).join("")}
      </div>
    </div>
    <div style="margin-bottom:14px; font-size:0.82rem; font-weight:700; color:#475569;">${filterSummaryText}</div>
    ` : ''}`;

  feed.innerHTML = toggleBar + `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; background:#fff; border:1px solid var(--border); border-radius:var(--radius); gap:12px; color:var(--accent);">
      <div class="spinner" style="width:28px; height:28px; border:3px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
      <span style="font-size:0.9rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Loading...</span>
    </div>`;

  try {
    const data = await apFetch({ action: "fetchRejectedMaterialQueue", toggle: window.activeRejectedMaterialToggle, vendorName: cleanVendor, actions: selectedActions });
    if (!data.success || !data.queue || data.queue.length === 0) {
      feed.innerHTML = toggleBar + `<div style="text-align:center;padding:30px;color:var(--muted);background:#fff;border:1px solid var(--border);border-radius:6px;">No records found.</div>`;
      return;
    }

    feed.innerHTML = toggleBar;
    let anyCardRendered = false;

    data.queue.forEach(item => {
      // Once every line on a GRN is Resolved, there's nothing left to
      // track here — drop the card entirely instead of leaving a
      // fully-done GRN sitting in the queue forever.
      const totalLineCount = item.lineItems.length;
      const resolvedLineCount = item.lineItems.filter(l => l.status === 'Resolved').length;
      if (resolvedLineCount === totalLineCount) return;
      anyCardRendered = true;

      let cardHasEditableLine = false;
      let trs = "";
      item.lineItems.forEach((line, idx) => {
        const isMissingOnly = (Number(line.notOkQuantity) || 0) === 0 && (Number(line.missingQuantity) || 0) > 0;
        const isEditable = line.status !== 'Resolved' && !isMissingOnly;
        if (isEditable) cardHasEditableLine = true;
        trs += `<tr style="border-bottom:1px solid #f1f5f9; vertical-align:middle;">
          <td style="width:110px; padding:8px 6px; text-align:center; font-family:monospace; font-weight:700;">${line.itemCode}</td>
          <td style="min-width:260px; padding:8px 6px; font-size:0.85rem;">${(line.materialName || "").replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
          <td style="width:70px; padding:8px 6px; text-align:center; font-weight:700; font-size:1rem;">${Number(line.missingQuantity) || 0}</td>
          <td style="width:70px; padding:8px 6px; text-align:center; font-weight:700; font-size:1rem;">${line.notOkQuantity}</td>
          <td style="width:90px; padding:8px 6px; text-align:center; font-weight:700; font-size:1rem;">${line.outstandingQuantity}</td>
          <td style="width:130px; padding:8px 6px; font-size:0.8rem; color:#64748b;">${(line.reasonForNotOk || "").replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
          <td style="width:170px; padding:8px 6px;">
            ${isMissingOnly ? `<span style="font-size:0.8rem; font-weight:600; color:#64748b;">Awaiting vendor replacement</span> <span style="font-size:0.72rem; color:var(--muted);">(${line.status})</span>` :
              isEditable ? `
              <select class="rej-action-${item.grnNumber}" data-idx="${idx}" data-rejid="${line.rejectionId}" style="width:100%; font-size:0.76rem; padding:3px 2px;">
                <option value="Return to Vendor for Replacement" ${line.actionForRejectedMaterial==='Return to Vendor for Replacement'?'selected':''}>Return to Vendor for Replacement</option>
                <option value="Return to Vendor for Repair" ${line.actionForRejectedMaterial==='Return to Vendor for Repair'?'selected':''}>Return to Vendor for Repair</option>
                <option value="Ask Vendor to repair at ABPS" ${line.actionForRejectedMaterial==='Ask Vendor to repair at ABPS'?'selected':''}>Ask Vendor to repair at ABPS</option>
                <option value="Ask ABPS to Repair at ABPS" ${line.actionForRejectedMaterial==='Ask ABPS to Repair at ABPS'?'selected':''}>Ask ABPS to Repair at ABPS</option>
                <option value="Under Deviation" ${line.actionForRejectedMaterial==='Under Deviation'?'selected':''}>Under Deviation</option>
              </select>` : `<span style="font-size:0.8rem; font-weight:600;">${line.actionForRejectedMaterial}</span> <span style="font-size:0.72rem; color:var(--muted);">(${line.status})</span>`}
          </td>
        </tr>`;
      });

      // Date/time badge — same source and formatting as the GRN card in Store Entry.
      let rejDateDisplay = formatOrdinalDateTime(item.invoiceDate);

      let card = document.createElement("div"); card.className = "contact-summary-card-parent";
      card.innerHTML = `
        <div class="contact-summary-header-row" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display==='block'?'none':'block'" style="cursor:pointer; width:100%;">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:8px;">
            <div>
              <span style="background:#dcfce7; color:#15803d; font-weight:700; padding:3px 8px;">${item.grnNumber}</span>
              <span style="background:#edf2f7; color:var(--text); margin-left:4px; font-weight:700;">Vendor: ${item.vendorName}</span>
              ${item.poNo ? `<span style="background:#e0f2fe; color:#0369a1; margin-left:4px; font-weight:700;">PO: ${item.poNo}</span>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="background:#fef3c7; color:#92400e; font-weight:700; font-size:0.8rem; padding:3px 8px;">${resolvedLineCount}/${totalLineCount} Resolved</span>
              ${rejDateDisplay ? `<span style="background:#cbd5e1; color:#1e293b; font-weight:700; font-size:0.8rem; padding:3px 8px;">${rejDateDisplay}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:none; padding-top:14px; border-top:1px dashed var(--border); margin-top:12px;">
          <div style="overflow-x:auto; margin-bottom:12px; border:1px solid var(--border); border-radius:var(--radius);">
            <table class="store-basket-data-table" style="width:100%; table-layout:fixed; min-width:900px; border-collapse:collapse;">
              <thead><tr style="background:#f8fafc;">
                <th style="width:100px; text-align:center; font-size:0.72rem; padding:8px 6px; white-space:nowrap;">Item Code</th>
                <th style="width:260px; text-align:left; font-size:0.72rem; padding:8px 6px;">Material Name</th>
                <th style="width:80px; text-align:center; font-size:0.72rem; padding:8px 6px; white-space:nowrap;">Missing Qty</th>
                <th style="width:80px; text-align:center; font-size:0.72rem; padding:8px 6px; white-space:nowrap;">Not OK</th>
                <th style="width:110px; text-align:center; font-size:0.72rem; padding:8px 6px; white-space:nowrap;">Pending Qty</th>
                <th style="width:130px; text-align:left; font-size:0.72rem; padding:8px 6px;">Reason for Not OK</th>
                <th style="width:170px; text-align:left; font-size:0.72rem; padding:8px 6px;">Action for Rejected</th>
              </tr></thead>
              <tbody>${trs}</tbody>
            </table>
          </div>
          ${cardHasEditableLine ? `<div style="display:flex; justify-content:flex-end;">
            <button class="nav-btn-styled" style="background:var(--brand);" onclick="commitRejectedMaterialActionToBackend('${item.grnNumber}', this)">${isCompleted ? 'Update Action' : 'Submit Action'}</button>
          </div>` : ''}
        </div>`;
      feed.appendChild(card);
    });

    // Every GRN in the fetched queue may have turned out fully Resolved
    // (dropped above one by one) — show the same empty state the initial
    // zero-results check above shows, instead of leaving a bare toggle bar.
    if (!anyCardRendered) {
      feed.innerHTML = toggleBar + `<div style="text-align:center;padding:30px;color:var(--muted);background:#fff;border:1px solid var(--border);border-radius:6px;">No records found.</div>`;
    }
  } catch(e) { feed.innerHTML = toggleBar + `<p style="color:var(--warn);">${e.message}</p>`; }
}

async function commitRejectedMaterialActionToBackend(grnNum, btn) {
  const banner = document.getElementById('rejected-material-feedback-banner');
  banner.style.display = "none";

  const lineItems = [];
  document.querySelectorAll(`.rej-action-${grnNum}`).forEach(sel => {
    lineItems.push({ rejectionId: sel.dataset.rejid, actionForRejectedMaterial: sel.value });
  });
  if (lineItems.length === 0) return;

  // "Under Deviation" is selectable by anyone (it's just flagging the row
  // for review), but the actual submission from THIS screen is gated to
  // admin users — checked client-side for a fast/clear message, and again
  // server-side (authoritative — never trust this check alone).
  const isAdmin = localStorage.getItem("erpIsUserAdminGlobal") === "true";
  if (!isAdmin && lineItems.some(li => li.actionForRejectedMaterial === "Under Deviation")) {
    banner.style.cssText = "display: block; background: #fef2f2; border-left: 4px solid #dc2626; color: #b91c1c; padding: 16px; border-radius: var(--radius); margin-bottom:15px; font-weight:700;";
    banner.textContent = 'One or more rows are marked "Under Deviation" — discuss with Alok Sir first. Submission with this action can only be done by an admin user in this section.';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;margin-right:6px;vertical-align:middle;"></div> Submitting...';

  showBlockingOverlay("Submitting Action...");
  try {
    const data = await apFetch({
      action: "commitRejectedMaterialAction",
      activeEngineer: appActiveOperatorIdentityString,
      payload: { lineItems: lineItems }
    });
    hideBlockingOverlay();
    if (data.success) {
      const feed = document.getElementById("rejected-material-cards-feed");
      if (feed) feed.innerHTML = "";
      banner.style.cssText = "display: block; background: #dcfce7; border-left: 4px solid #15803d; color: #15803d; padding: 20px; border-radius: var(--radius); margin-bottom:15px;";
      banner.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; text-align:left;">
          <div><strong>Success! Action recorded for ${grnNum}.</strong></div>
          <button class="nav-btn-styled" onclick="
            document.getElementById('rejected-material-feedback-banner').style.display = 'none';
            initializeRejectedMaterialPanel(window.activeRejectedMaterialToggle);
          " style="background: #15803d; color: white; padding:8px 16px; font-weight:700;">Refresh Queue</button>
        </div>`;
    } else {
      alert("Server Error: " + data.error);
      btn.disabled = false; btn.textContent = window.activeRejectedMaterialToggle === 'completed' ? 'Update Action' : 'Submit Action';
    }
  } catch(e) {
    hideBlockingOverlay();
    alert("Network request execution failure: " + e.message);
    btn.disabled = false; btn.textContent = window.activeRejectedMaterialToggle === 'completed' ? 'Update Action' : 'Submit Action';
  }
}
