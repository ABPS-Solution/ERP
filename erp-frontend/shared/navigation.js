// shared/navigation.js — ERP's trimmed port of Portal's shared/navigation.js
// (31 Aug 2026, revised same day to a real two-level department structure —
// previously a flat per-SECTION tab bar with one tab per screen). ERP's 4
// screens now group into 3 departments, mirroring Portal's actual
// dept-tab -> dept-block -> menu-card shape exactly:
//   Accounts department -> Tour Expense Tracker, Daily Cash/UPI Expenses
//   Design department    -> Add/Check Item Code
//   Admin department     -> Security & Login Access
// (Security & Login Access sits under Project department in Portal, but
// ERP has no other Project-department content, so it's grouped under a
// plain "Admin" department tab instead — the tile/permission/panel itself
// is unchanged.) The overall MECHANISM (permission-gated dept-tabs-bar
// built on top of enforceDynamicModuleRoleGateways, module-workspace-
// container / workspace-panel show/hide convention) is carried over
// unchanged from Portal's dept-tabs-bar, now with matching names too.
//
// Each of the 4 screens is currently a placeholder — the real screen
// content (accounts/*.js, design/item-codes.js, project/security-admin.js)
// is later, separate work per the task this file was built for.

// currentActiveModuleContext / canvasLastParentWorkspaceId / navigateToModule
// — ported verbatim from Portal's shared/navigation.js for the Marketing
// port (15 Sep 2026, batch 2). Referenced heavily by marketing/leads.js.
let currentActiveModuleContext = "CARD";
let canvasLastParentWorkspaceId = "workspace-searchCompany";

// checkStorePRNRevisionReminder / checkPurchasePORevisionReminder — ported
// from Portal's shared/navigation.js. Both are called from
// purchase/revise-po.js's navigateToPurchaseWorkspacePanel on every
// navigation into the Purchase enclosure; without them defined at all the
// call would throw a ReferenceError (unlike a missing DOM id, which the
// rest of that function already guards against). Both degrade gracefully
// on their own (try/catch, no-op if the banner elements aren't in the DOM,
// and if erp-backend doesn't yet implement the underlying action the
// catch just leaves the banner hidden) — no ERP-specific adaptation
// needed beyond that.
async function checkStorePRNRevisionReminder() {
  const banners = document.querySelectorAll(".store-prn-revision-reminder-banner-el");
  if (!banners.length) return;
  try {
    const data = await apFetch({ action: "checkBOQsNeedingPRNRevisionCount" });
    const show = data.success && data.count > 0;
    banners.forEach(b => { b.style.display = show ? "block" : "none"; });
  } catch (e) { /* non-critical — leave banner state as-is on network error */ }
}

async function checkPurchasePORevisionReminder() {
  const banner = document.getElementById("purchase-po-revision-reminder-banner");
  if (!banner) return;
  try {
    const data = await apFetch({ action: "checkPRNsNeedingPORevisionCount" });
    banner.style.display = (data.success && data.count > 0) ? "block" : "none";
  } catch (e) { /* non-critical — leave banner state as-is on network error */ }
}

// checkMaterialRequirementDateReminder / checkProductionPlanningReminder —
// ported verbatim from Portal (Batch 7, 16 Sep 2026). Batch 6 deliberately
// left these two out of navigateToStoreWorkspacePanel because they did not
// exist yet; both calls are restored in that function below now.
//
// Note the route name: checkPRNsNeedingRequirementDateRevisionCount, NOT
// ...RequirementDatesCount. The extra "Revision" is load-bearing (Portal,
// 31 Aug 2026) — this banner's wording ("...have changed... need
// revising") only makes sense for an actual revision, so the route it
// calls deliberately EXCLUDES a brand-new PRN that has never had
// requirement dates submitted at all. The other route is correct for
// Purchase's own "N hidden" note and must not be swapped in here.
async function checkMaterialRequirementDateReminder() {
  const banners = document.querySelectorAll(".material-requirement-date-revision-banner-el");
  if (!banners.length) return;
  try {
    const data = await apFetch({ action: "checkPRNsNeedingRequirementDateRevisionCount" });
    const show = data.success && data.count > 0;
    banners.forEach(b => { b.style.display = show ? "block" : "none"; });
  } catch (e) { /* non-critical — leave banner state as-is on network error */ }
}

// Same shape, for Production Planning's own reminder banner — ungated
// count route (checkProductionPlansNeededCount), keyed off a class so
// multiple banners could share one check.
async function checkProductionPlanningReminder() {
  const banners = document.querySelectorAll(".production-planning-reminder-banner-el");
  if (!banners.length) return;
  try {
    const data = await apFetch({ action: "checkProductionPlansNeededCount" });
    const show = data.success && data.count > 0;
    banners.forEach(b => { b.style.display = show ? "block" : "none"; });
  } catch (e) { /* non-critical — leave banner state as-is on network error */ }
}

// navigateToModule — ported verbatim from Portal's shared/navigation.js
// (Marketing port, 15 Sep 2026, batch 2). Every Marketing menu card calls
// this directly. Depends on functions/globals living in the already-ported
// marketing/*.js files and shared/typeahead.js — see that batch's own
// verification notes for the full dependency check.
async function navigateToModule(key) {
    window.scrollTo(0, 0);
    setTimeout(() => window.scrollTo(0, 0), 50);
    // 1. Core verification gateway check routing against userPermissions payload mapping
    if (!userPermissions[key]) return alert("Access Denied: Missing permission profile privileges.");

    const canvas = document.getElementById("step2-inline-interaction-canvas");
    if (canvas) {
        canvas.style.display = "none";
    }

    document.getElementById("dashboard-view").style.display = "none";
    document.getElementById("module-workspace-container").style.display = "block";
    document.querySelectorAll(".workspace-panel").forEach(p => p.style.display = "none");

    // Maps keys to the exact workspace element panel DOM IDs
    let targetPanelKeyIdStr = key;
    if (key === "emailLeads") {
        targetPanelKeyIdStr = "emailWhatsapp";
    } else if (key === "commissioningReport") {
        targetPanelKeyIdStr = "commissioningReport";
        // Project ID typeahead needs sharedActiveProjectCodes/sharedProjectMeta
        // populated before the user can type into it — same reasoning
        // Create BOQ's panel-open hook has for the identical component.
        if (typeof ensureSharedProjectTypeaheadData === "function") ensureSharedProjectTypeaheadData();
        const crProjectInput = document.getElementById("commissioning-report-project-ta-input");
        const crCustomerName = document.getElementById("commissioning-report-customer-name");
        if (crProjectInput) crProjectInput.value = "";
        if (crCustomerName) crCustomerName.value = "";
    } else if (key === "purchaseOrder") {
        targetPanelKeyIdStr = "purchaseOrder";
        // Always start fresh — otherwise leaving via Return to Main
        // Dashboard mid-review and coming back shows the previous
        // session's Review Extracted Purchase Order screen instead of
        // the blank upload form.
        if (typeof resetPurchaseOrderWorkspace === "function") resetPurchaseOrderWorkspace();
        // Populate Select Lead / Company dropdown — defined in leads.js since
        // the ERP port, but never actually called anywhere, so it always sat
        // on its placeholder even when real leads existed (e.g. Century
        // Rayon). See fetchAndPopulateUploadLeadDropdowns's own comment.
        if (typeof fetchAndPopulateUploadLeadDropdowns === "function") fetchAndPopulateUploadLeadDropdowns();
        // Populate owner dropdown with marketing engineers
        const poOwnerDrop = document.getElementById("po-owner-of-order-dropdown");
        if (poOwnerDrop) {
          const populatePOOwnerDrop = () => {
            poOwnerDrop.innerHTML = '<option value="">— Select Engineer —</option>';
            cachedEngineers.forEach(eng => {
              const opt = document.createElement("option");
              opt.value = eng.personKey; opt.textContent = eng.name;
              poOwnerDrop.appendChild(opt);
            });
            if (appActiveOperatorIdentityString && cachedEngineers.indexOf(appActiveOperatorIdentityString) !== -1) {
              poOwnerDrop.value = appActiveOperatorIdentityString;
            }
          };
          if (cachedEngineers.length > 0) {
            populatePOOwnerDrop();
          } else {
            poOwnerDrop.innerHTML = '<option value="">Loading engineers...</option>';
            let waitAttempts = 0;
            const waitForEngineers = setInterval(() => {
              waitAttempts++;
              if (cachedEngineers.length > 0 || waitAttempts > 25) {
                clearInterval(waitForEngineers);
                if (cachedEngineers.length > 0) populatePOOwnerDrop();
              }
            }, 200);
          }
          // Always default to logged-in user
          setTimeout(() => {
            if (poOwnerDrop.value === "" && appActiveOperatorIdentityString) {
              poOwnerDrop.value = appActiveOperatorIdentityString;
            }
          }, 300);
        }
    }

    const targetWorkspacePanel = document.getElementById("workspace-" + targetPanelKeyIdStr);
    if (targetWorkspacePanel) targetWorkspacePanel.style.display = "block";

    document.getElementById("multi-contact-records-container").innerHTML = "";
    // Search by Company Name's Back to Search / Create New Entry banner
    // lives in this same shared canvas — clear it so it never carries over
    // into the filter searches (Engineer & Status, Type of Customer, City).
    const staleBannerHook = document.getElementById("split-missing-person-banner-hook");
    if (staleBannerHook) staleBannerHook.innerHTML = "";
    document.getElementById("global-direct-inline-create-entry-btn").style.display = "none";
    document.getElementById("global-direct-inline-collapse-entry-btn").style.display = "none";
    document.getElementById("missing-trigger-notice-block").style.display = "none";

    const taskOutputNode = document.getElementById("task-matrix-results-output-node");
    if (taskOutputNode) taskOutputNode.innerHTML = "";

    currentActiveModuleContext = (key === "cardDetails") ? "CARD" : (key === "searchCompany" ? "DROPDOWN" : "FILTERS");
    resetSequentialFormState();

    if (key === "cardDetails") {
      fileFront = null; fileBack = null;
      const fb = document.getElementById('front-box'); if (fb) { fb.textContent = '📷 Front Side '; fb.classList.remove('done'); }
      const bb = document.getElementById('back-box'); if (bb) { bb.textContent = '📷 Back Side (Optional)'; bb.classList.remove('done'); }
      const fi = document.getElementById('card-front'); if (fi) fi.value = '';
      const bi = document.getElementById('card-back'); if (bi) bi.value = '';
      ['f-company','f-name','f-position','f-phone','f-altphone','f-email','f-website','f-city','f-state','f-country','f-address'].forEach(function(id){ const el=document.getElementById(id); if(el) el.value=''; });
      document.getElementById('step1-card-capture-block').style.display = 'block';
      document.getElementById('step2-new-entry-dropdown').style.display = 'none';
      document.getElementById('step2-inline-interaction-canvas').style.display = 'none';
      document.getElementById('missing-trigger-notice-block').style.display = 'none';
    }

    // Runtime synchronization switches
    if (key === "searchCompany") {
      // Every entry starts fresh, like the first visit — never re-run the
      // previous company search.
      const companyDropdownNode = document.getElementById("lookup-module-company-dropdown");
      if (companyDropdownNode) companyDropdownNode.value = "";
      const companySuggestions = document.getElementById("lookup-module-company-dropdown-suggestions");
      if (companySuggestions) companySuggestions.style.display = "none";
      const companySelectorBlock = document.getElementById("company-dropdown-selector-block");
      if (companySelectorBlock) companySelectorBlock.style.display = "block";
      const inlineCanvasNode = document.getElementById("step2-inline-interaction-canvas");
      if (inlineCanvasNode) inlineCanvasNode.style.display = "none";
      // A half-filled Create New Lead form must not survive leaving the screen.
      const newEntryForm = document.getElementById("step2-new-entry-dropdown");
      if (newEntryForm) newEntryForm.style.display = "none";
      const missingNotice = document.getElementById("missing-trigger-notice-block");
      if (missingNotice) missingNotice.style.display = "none";
      triggerCompanyDropdownArrayFetch();
    } else if (key === "cardDetails") {
      const companyInputTextNode = document.getElementById("f-company");
      if (companyInputTextNode && companyInputTextNode.value.trim() !== "") {
          triggerSequentialSearch('CARD');
      }
    } else if (key === "searchQualification") {
      document.querySelectorAll('input[name="searchQual"]').forEach(cb => cb.checked = false);
      const drawerPanel = document.getElementById("custom-qualifications-sub-drawer");
      if (drawerPanel) drawerPanel.style.display = "block";
      // #selected-quals-display was removed 10 Sep 2026 (see the no-op note
      // in marketing/leads.js). The sibling reset below got its null guard;
      // this site was missed, so the bare deref threw a TypeError right
      // here — and because it threw mid-branch, loadQualFilter() on the
      // next line never ran and Search by Qualification opened permanently
      // empty. Guarded, not deleted, to match the sibling's shape.
      const selQuals = document.getElementById("selected-quals-display");
      if (selQuals) selQuals.textContent = "";
      loadQualFilter();
    } else if (key === "searchStatus") {
      document.querySelectorAll('input[name="leadMatrixStatusFilter"]').forEach(cb => cb.checked = false);
      renderLeadMatrixEngineerCheckboxes();
      const fd = document.getElementById("lead-matrix-active-filters-display");
      if (fd) { fd.style.display = "none"; fd.textContent = ""; }
    } else if (key === "searchTasks") {
      // Filter By Engineers pills were never rendered here at all — see
      // renderTaskMatrixEngineerCheckboxes's own comment (tasks-followups.js)
      // for the full root cause.
      document.querySelectorAll('input[name="taskMatrixStatus"]').forEach(cb => cb.checked = false);
      if (typeof renderTaskMatrixEngineerCheckboxes === "function") renderTaskMatrixEngineerCheckboxes();
      const tfd = document.getElementById("task-matrix-active-filters-display");
      if (tfd) { tfd.style.display = "none"; tfd.textContent = ""; }
    } else if (key === "searchEngineer") {
      // Every entry starts fresh — no engineer pre-selected, no re-run.
      const engineerSelectNode = document.getElementById("engineer-filter-select");
      if (engineerSelectNode) engineerSelectNode.value = "";
    } else if (key === "searchCityState") {
      loadCityStateFilterOptions();
    } else if (key === "emailLeads") {
      executeInboundEmailSyncPipelineFetch();
    } else if (key === "meetingPreparation") {
      if (typeof mprepResetScreen === "function") mprepResetScreen();
      triggerCompanyDropdownArrayFetch();
    }
}

// marketing/project/store/qa/production added 15 Sep 2026 (Batch 1
// scaffolding) — each has an empty dashboard-*-department-header-block in
// index.html but no enforceDynamicModuleRoleGateways visibility logic yet,
// so refreshDepartmentTabsBar's own block-display check keeps all 5 tabs
// hidden until the batch that owns that department adds real gating.
const DEPT_TAB_KEYS = ['accounts', 'design', 'purchase', 'admin', 'marketing', 'project', 'store', 'qa', 'production'];
const DEPT_TAB_STORAGE_KEY = 'erpActiveDeptTab';
// Same reasoning as Portal's deptTabVisibleKeys: selectDepartmentTab must
// consult which departments are actually permission-visible (set once per
// enforceDynamicModuleRoleGateways pass), never live block.style.display —
// after switching tabs, every non-active block sits at display:none from
// that switch itself, indistinguishable from a permission-driven hide.
let deptTabVisibleKeys = DEPT_TAB_KEYS.slice();

// ── Permission-driven visibility ────────────────────────────────────────
// userPermissions only ever carries the 4 camelCase keys erp-backend's
// lib/permMap.js sends (itemCodeAccess, tourExpense, cashExpenses,
// securityLoginAccess) — see shared/apFetch.js's userPermissions default.
// Each individual TILE is still gated on exactly one perm; a DEPARTMENT
// tab is visible if any of its tiles are (an OR across the department's
// own tiles only, same as Portal's per-department dashboard logic).
function enforceDynamicModuleRoleGateways(userPermissionsObject) {
  const canTourExpense = userPermissionsObject.tourExpense === true;
  const canCashExpenses = userPermissionsObject.cashExpenses === true;
  const canTravelTickets = userPermissionsObject.travelTickets === true;
  const canViewAccountsDashboard = userPermissionsObject.viewAccountsDashboard === true;
  const canItemCode = userPermissionsObject.itemCodeAccess === true;
  const canSecurity  = userPermissionsObject.securityLoginAccess === true;

  // ── Marketing, ported from Portal's shared/navigation.js — same
  // camelCase permission keys, same card ids (mod-card/mod-email-whatsapp/...).
  const canEnterCard               = userPermissionsObject.cardDetails === true;
  const canViewEmailLeads          = userPermissionsObject.emailLeads === true;
  const canUploadCommissioning     = userPermissionsObject.commissioningReport === true;
  const canUploadPurchaseOrder     = userPermissionsObject.purchaseOrder === true;
  const canSearchCompany           = userPermissionsObject.searchCompany === true;
  const canSearchTasks             = userPermissionsObject.searchTasks === true;
  const canSearchStatus            = userPermissionsObject.searchStatus === true;
  const canSearchQual              = userPermissionsObject.searchQualification === true;
  const canSearchCityState         = userPermissionsObject.searchCityState === true;
  const canMeetingPreparation      = userPermissionsObject.meetingPreparation === true;
  // ERP's permMap.js key is "marketingDashboard", not Portal's
  // "viewMarketingDashboard" — ERP's own dedicated key, not a rename.
  const canViewMarketingDashboard  = userPermissionsObject.marketingDashboard === true;
  const canOrderPaymentProgress    = userPermissionsObject.orderPaymentProgress === true;

  if (document.getElementById("mod-card")) document.getElementById("mod-card").style.display = canEnterCard ? "block" : "none";
  if (document.getElementById("mod-email-whatsapp")) document.getElementById("mod-email-whatsapp").style.display = canViewEmailLeads ? "block" : "none";
  if (document.getElementById("mod-commissioning-report")) document.getElementById("mod-commissioning-report").style.display = canUploadCommissioning ? "block" : "none";
  if (document.getElementById("mod-purchase-order")) document.getElementById("mod-purchase-order").style.display = canUploadPurchaseOrder ? "block" : "none";
  if (document.getElementById("mod-company")) document.getElementById("mod-company").style.display = canSearchCompany ? "block" : "none";
  if (document.getElementById("mod-tasks")) document.getElementById("mod-tasks").style.display = canSearchTasks ? "block" : "none";
  if (document.getElementById("mod-status")) document.getElementById("mod-status").style.display = canSearchStatus ? "block" : "none";
  if (document.getElementById("mod-qual")) document.getElementById("mod-qual").style.display = canSearchQual ? "block" : "none";
  if (document.getElementById("mod-city-state")) document.getElementById("mod-city-state").style.display = canSearchCityState ? "block" : "none";
  if (document.getElementById("mod-meeting-prep")) document.getElementById("mod-meeting-prep").style.display = canMeetingPreparation ? "block" : "none";
  if (document.getElementById("mod-order-payment")) document.getElementById("mod-order-payment").style.display = canOrderPaymentProgress ? "block" : "none";

  // ── Design (BOQ + Catalog & Drawings), ported from Portal's
  // shared/navigation.js — same camelCase permission keys, same card ids
  // (mod-design-*), same "sole gate" note on itemCodeAccess (26 Aug 2026
  // Portal decision — this card has no composite OR fallback here either).
  const canCreateBOQ = userPermissionsObject.createBOQ === true;
  const canAuthorizeBOQ = userPermissionsObject.authorizeBOQ === true;
  const canUpdateBOQ = userPermissionsObject.updateBOQ === true;
  const canAuthorizeBOQUpdate = userPermissionsObject.authorizeBOQUpdate === true;
  const canUploadDrawings = userPermissionsObject.uploadDrawings === true;
  const canViewDesignDashboard = userPermissionsObject.viewDesignDashboard === true;

  if (document.getElementById("mod-design-create-boq"))   document.getElementById("mod-design-create-boq").style.display   = canCreateBOQ ? "block" : "none";
  if (document.getElementById("mod-design-auth-boq"))     document.getElementById("mod-design-auth-boq").style.display     = canAuthorizeBOQ ? "block" : "none";
  if (document.getElementById("mod-design-update-boq"))   document.getElementById("mod-design-update-boq").style.display   = canUpdateBOQ ? "block" : "none";
  if (document.getElementById("mod-design-auth-boq-upd")) document.getElementById("mod-design-auth-boq-upd").style.display = canAuthorizeBOQUpdate ? "block" : "none";
  if (document.getElementById("mod-design-upload-drawings")) document.getElementById("mod-design-upload-drawings").style.display = canUploadDrawings ? "block" : "none";

  // ── Purchase, ported from Portal's shared/navigation.js — same
  // camelCase permission keys, same card ids (mod-purchase-*/mod-*-rm-po*).
  const canCreatePO = userPermissionsObject.createRMPurchaseOrder === true;
  const canAuthorizePO = userPermissionsObject.authorizeRMPurchaseOrder === true;
  const canPPSTracking = userPermissionsObject.ppsTracking === true;
  const canReviseRMPO = userPermissionsObject.reviseRMPO === true;
  const canAuthorizeRMPORevision = userPermissionsObject.authorizeRMPORevision === true;
  const canSearchRMPO = userPermissionsObject.searchRMPO === true;
  const canSearchVendorCostingInfo = userPermissionsObject.searchVendorCostingInfo === true;
  const canViewMaterialListPurchase = userPermissionsObject.materialListForPurchase === true;
  const canViewRejectedMaterial = userPermissionsObject.rejectedMaterial === true;
  const canViewPurchaseDashboard = userPermissionsObject.viewPurchaseDashboard === true;

  if (document.getElementById("mod-purchase-material-list")) document.getElementById("mod-purchase-material-list").style.display = canViewMaterialListPurchase ? "block" : "none";
  // Edit Raw Material Purchase Order is a tab inside Create Raw Material
  // Purchase Order now (19 Sep 2026 — folded in from its own dashboard
  // card, cleaner than a separate section), gated by the same card's
  // visibility. It reuses perm_create_rm_po rather than a new permission
  // column (18 Sep 2026, Checking Draft loop) — editing a pending PO is
  // strictly weaker than creating one, so the same gate applies.
  if (document.getElementById("mod-purchase-create-po"))     document.getElementById("mod-purchase-create-po").style.display     = canCreatePO ? "block" : "none";
  if (document.getElementById("mod-purchase-authorize-po"))  document.getElementById("mod-purchase-authorize-po").style.display  = canAuthorizePO ? "block" : "none";
  if (document.getElementById("mod-purchase-pps-tracking"))  document.getElementById("mod-purchase-pps-tracking").style.display  = canPPSTracking ? "block" : "none";
  if (document.getElementById("mod-purchase-rejected-material")) document.getElementById("mod-purchase-rejected-material").style.display = canViewRejectedMaterial ? "block" : "none";
  if (document.getElementById("mod-revise-rm-po")) document.getElementById("mod-revise-rm-po").style.display = canReviseRMPO ? "block" : "none";
  if (document.getElementById("mod-authorize-rm-po-revision")) document.getElementById("mod-authorize-rm-po-revision").style.display = canAuthorizeRMPORevision ? "block" : "none";
  if (document.getElementById("mod-search-rm-po")) document.getElementById("mod-search-rm-po").style.display = canSearchRMPO ? "block" : "none";
  if (document.getElementById("mod-search-vendor-costing-info")) document.getElementById("mod-search-vendor-costing-info").style.display = canSearchVendorCostingInfo ? "block" : "none";

  // ── Project (15 Sep 2026, Batch 3) — ported from Portal's shared/
  // navigation.js, same camelCase permission keys (erp-backend's
  // lib/permMap.js keeps these deliberately un-renamed) and same card
  // ids. Project Invoice Generation is Store->Dispatch in Portal (its
  // backend permissionCatalog.js entry says so explicitly:
  // department:'store', rowLabel:'Dispatch') — its tile lives in the
  // Store department block below, not this one, and its own visibility
  // is folded into the Store block's OR-gate accordingly.
  const canManufacturingClearance = userPermissionsObject.manufacturingClearance === true;
  const canProjectStatus = userPermissionsObject.projectStatus === true;
  // Project Dispatch Invoice's four permissions (19 Sep 2026, ported from
  // Portal's migrations 208-210) replace the old single
  // perm_project_invoice_generation flag, whose column is now dropped.
  const canCreateProjectDispatchInvoice = userPermissionsObject.createProjectDispatchInvoice === true;
  const canAuthorizeProjectDispatchInvoice = userPermissionsObject.authorizeProjectDispatchInvoice === true;
  const canReviseProjectDispatchInvoice = userPermissionsObject.reviseProjectDispatchInvoice === true;
  const canAuthorizeProjectDispatchInvoiceRevision = userPermissionsObject.authorizeProjectDispatchInvoiceRevision === true;
  const canProjectTimeline = userPermissionsObject.projectTimeline === true;
  const canDailyTimeline = userPermissionsObject.dailyTimeline === true;
  const canViewAdminDashboard = userPermissionsObject.viewAdminDashboard === true;

  if (document.getElementById("mod-manufacturing-clearance")) document.getElementById("mod-manufacturing-clearance").style.display = canManufacturingClearance ? "block" : "none";
  if (document.getElementById("mod-project-timeline")) document.getElementById("mod-project-timeline").style.display = canProjectTimeline ? "block" : "none";
  if (document.getElementById("mod-daily-timeline")) document.getElementById("mod-daily-timeline").style.display = canDailyTimeline ? "block" : "none";
  if (document.getElementById("mod-project-status")) document.getElementById("mod-project-status").style.display = canProjectStatus ? "block" : "none";
  if (document.getElementById("mod-create-project-dispatch-invoice")) document.getElementById("mod-create-project-dispatch-invoice").style.display = canCreateProjectDispatchInvoice ? "block" : "none";
  if (document.getElementById("mod-authorize-project-dispatch-invoice")) document.getElementById("mod-authorize-project-dispatch-invoice").style.display = canAuthorizeProjectDispatchInvoice ? "block" : "none";
  if (document.getElementById("mod-revise-project-dispatch-invoice")) document.getElementById("mod-revise-project-dispatch-invoice").style.display = canReviseProjectDispatchInvoice ? "block" : "none";
  if (document.getElementById("mod-authorize-project-dispatch-invoice-revision")) document.getElementById("mod-authorize-project-dispatch-invoice-revision").style.display = canAuthorizeProjectDispatchInvoiceRevision ? "block" : "none";
  // mod-admin-dashboard-wrapper's own visibility is set below via dashMap,
  // alongside the other dashboard pills — it moved out of the Project
  // block into the Admin block (16 Sep 2026), same as Portal.

  // ── Store (Batch 6, 16 Sep 2026) — ported from Portal's
  // shared/navigation.js, same camelCase permission keys, same card ids.
  // The four PRN cards and Reserve Store Stock belong to this block in
  // Portal too (PRN routes live in routes/purchase.js but the permissions
  // and menu cards are Store's) — they were ported functionally in
  // Batch 5 but had no card here until now.
  const canPurchaseRequestNote  = userPermissionsObject.purchaseRequestNote === true;
  const canAuthorizePRN         = userPermissionsObject.authorizePRN === true;
  const canRevisePRN            = userPermissionsObject.revisePRN === true;
  const canAuthorizePRNRevision = userPermissionsObject.authorizePRNRevision === true;
  const canReserveStoreStock    = userPermissionsObject.reserveStoreStock === true;
  const canGateEntry            = userPermissionsObject.gateEntry === true;
  const canStoreEntryAndGrn     = userPermissionsObject.storeEntryAndGrn === true;
  const canExpectedInbounds     = userPermissionsObject.expectedDeliveries === true;
  const canApproveBOQIncrease   = userPermissionsObject.approveJCIncrease === true;
  const canReleaseTicket        = userPermissionsObject.storeApproveTickets === true;
  const canSearchStoreMat       = userPermissionsObject.storeAdminMatrix === true;
  const canViewLiveStock        = userPermissionsObject.liveStoreStock === true;
  const canViewLiveFinishedStock = userPermissionsObject.liveFinishedGoodsStoreStock === true;
  const canLiveSpareStoreStock  = userPermissionsObject.liveSpareStoreStock === true;
  const canMaterialOutward      = userPermissionsObject.materialOutward === true;
  const canViewStoreDashboard   = userPermissionsObject.viewStoreDashboard === true;

  // ── Production department (Batch 7, 16 Sep 2026) ────────────────────
  // storeCreateTicket's CARD is Production's (Material Issue & Job Cards)
  // even though its screen and routes are Store's — Portal files it the
  // same way, and Batch 6 already wired the permission itself.
  const canAssignMRD             = userPermissionsObject.assignMaterialRequirementDate === true;
  const canReviseMRD             = userPermissionsObject.reviseMaterialRequirementDate === true;
  const canProductionPlanning    = userPermissionsObject.productionPlanning === true;
  const canCreateStoreTicket     = userPermissionsObject.storeCreateTicket === true;
  const canJobCardSheet          = userPermissionsObject.jobCardSheet === true;
  const canAddFinishedGoods      = userPermissionsObject.addFinishedGoodsStore === true;
  const canViewProductionDashboard = userPermissionsObject.viewProductionDashboard === true;

  // ── Quality Assurance department (Batch 8, 16 Sep 2026) ─────────────
  // qaCheck's CARD is QA's (Inward Quality) even though its screen and
  // routes are Store's — Portal files it the same way, and Batch 6
  // already wired the permission itself. fgApproval/inProcessSheet's
  // screens live under production/ (Portal) and qa/ (here) but their
  // routes are Production's (Batch 7) — same "card belongs to a
  // different department than its routes" precedent.
  const canQaCheck               = userPermissionsObject.qaCheck === true;
  const canFgApproval            = userPermissionsObject.fgApproval === true;
  const canInProcessSheet        = userPermissionsObject.inProcessSheet === true;
  const canQaInspectionTimeline  = userPermissionsObject.qaInspectionTimeline === true;
  const canProductSerialTracking = userPermissionsObject.productSerialTracking === true;
  const canViewQaDashboard       = userPermissionsObject.viewQaDashboard === true;
  const canRepairQa              = userPermissionsObject.repairQa === true;
  if (document.getElementById("mod-store-grn"))              document.getElementById("mod-store-grn").style.display              = canQaCheck ? "block" : "none";
  // Currently Being Repaired at ABPS — split out of Raw Materials Q/A
  // Check into its own section/permission (19 Sep 2026).
  if (document.getElementById("mod-repair-qa"))               document.getElementById("mod-repair-qa").style.display               = canRepairQa ? "block" : "none";
  if (document.getElementById("mod-fg-approval"))             document.getElementById("mod-fg-approval").style.display             = canFgApproval ? "block" : "none";
  if (document.getElementById("mod-in-process-sheet"))        document.getElementById("mod-in-process-sheet").style.display        = canInProcessSheet ? "block" : "none";
  if (document.getElementById("mod-qa-inspection-timeline"))  document.getElementById("mod-qa-inspection-timeline").style.display  = canQaInspectionTimeline ? "block" : "none";
  if (document.getElementById("mod-product-serial-tracking")) document.getElementById("mod-product-serial-tracking").style.display = canProductSerialTracking ? "block" : "none";

  if (document.getElementById("mod-purchase-request-note"))  document.getElementById("mod-purchase-request-note").style.display  = canPurchaseRequestNote ? "block" : "none";
  if (document.getElementById("mod-purchase-authorize-prn")) document.getElementById("mod-purchase-authorize-prn").style.display = canAuthorizePRN ? "block" : "none";
  if (document.getElementById("mod-revise-prn"))             document.getElementById("mod-revise-prn").style.display             = canRevisePRN ? "block" : "none";
  if (document.getElementById("mod-authorize-prn-revision")) document.getElementById("mod-authorize-prn-revision").style.display = canAuthorizePRNRevision ? "block" : "none";
  if (document.getElementById("mod-assign-current-stock"))   document.getElementById("mod-assign-current-stock").style.display   = canReserveStoreStock ? "block" : "none";
  if (document.getElementById("mod-store-gate"))             document.getElementById("mod-store-gate").style.display             = canGateEntry ? "block" : "none";
  if (document.getElementById("mod-store-entry"))            document.getElementById("mod-store-entry").style.display            = canStoreEntryAndGrn ? "block" : "none";
  if (document.getElementById("mod-expected-inbounds"))      document.getElementById("mod-expected-inbounds").style.display      = canExpectedInbounds ? "block" : "none";
  if (document.getElementById("mod-stock-sweep"))            document.getElementById("mod-stock-sweep").style.display            = canReserveStoreStock ? "block" : "none";
  if (document.getElementById("mod-boq-increase-approvals")) document.getElementById("mod-boq-increase-approvals").style.display = canApproveBOQIncrease ? "block" : "none";
  if (document.getElementById("mod-store-approvals"))        document.getElementById("mod-store-approvals").style.display        = canReleaseTicket ? "block" : "none";
  if (document.getElementById("mod-store-matrix"))           document.getElementById("mod-store-matrix").style.display           = canSearchStoreMat ? "block" : "none";
  if (document.getElementById("mod-live-store-stock"))       document.getElementById("mod-live-store-stock").style.display       = canViewLiveStock ? "block" : "none";
  if (document.getElementById("mod-live-finished-store-stock")) document.getElementById("mod-live-finished-store-stock").style.display = canViewLiveFinishedStock ? "block" : "none";
  if (document.getElementById("mod-live-spare-store-stock")) document.getElementById("mod-live-spare-store-stock").style.display = canLiveSpareStoreStock ? "block" : "none";
  if (document.getElementById("mod-material-outward"))       document.getElementById("mod-material-outward").style.display       = canMaterialOutward ? "block" : "none";
  const canAuthorizeMaterialOutward = userPermissionsObject.authorizeMaterialOutward === true;
  if (document.getElementById("mod-authorize-material-outward")) document.getElementById("mod-authorize-material-outward").style.display = canAuthorizeMaterialOutward ? "block" : "none";
  if (document.getElementById("mod-search-material-outward")) document.getElementById("mod-search-material-outward").style.display = userPermissionsObject.searchMaterialOutward === true ? "block" : "none";

  // Production cards (Batch 7, 16 Sep 2026)
  if (document.getElementById("mod-assign-material-requirement-date")) document.getElementById("mod-assign-material-requirement-date").style.display = canAssignMRD ? "block" : "none";
  if (document.getElementById("mod-revise-material-requirement-date")) document.getElementById("mod-revise-material-requirement-date").style.display = canReviseMRD ? "block" : "none";
  if (document.getElementById("mod-production-planning")) document.getElementById("mod-production-planning").style.display = canProductionPlanning ? "block" : "none";
  if (document.getElementById("mod-store-ticket"))        document.getElementById("mod-store-ticket").style.display        = canCreateStoreTicket ? "block" : "none";
  if (document.getElementById("mod-job-card-sheet"))      document.getElementById("mod-job-card-sheet").style.display      = canJobCardSheet ? "block" : "none";
  if (document.getElementById("mod-fg-add"))              document.getElementById("mod-fg-add").style.display              = canAddFinishedGoods ? "block" : "none";

  if (document.getElementById("mod-tourexpense"))  document.getElementById("mod-tourexpense").style.display  = canTourExpense  ? "block" : "none";
  if (document.getElementById("mod-cashexpenses")) document.getElementById("mod-cashexpenses").style.display = canCashExpenses ? "block" : "none";
  if (document.getElementById("mod-traveltickets")) document.getElementById("mod-traveltickets").style.display = canTravelTickets ? "block" : "none";
  if (document.getElementById("mod-accounts-dashboard-wrapper")) document.getElementById("mod-accounts-dashboard-wrapper").style.display = canViewAccountsDashboard ? "block" : "none";
  if (document.getElementById("mod-itemcode"))     document.getElementById("mod-itemcode").style.display     = canItemCode     ? "block" : "none";
  if (document.getElementById("mod-security"))     document.getElementById("mod-security").style.display     = canSecurity     ? "block" : "none";

  // Dashboard-wrapper pills (show entire pill wrapper, not just a plain card)
  // — same shape as Portal's own dashMap loop.
  const dashMap = {
    "mod-design-dashboard-wrapper":   canViewDesignDashboard,
    "mod-purchase-dashboard-wrapper": canViewPurchaseDashboard,
    "mod-marketing-dashboard-wrapper": canViewMarketingDashboard,
    "mod-store-dashboard-wrapper":     canViewStoreDashboard,
    "mod-production-dashboard-wrapper": canViewProductionDashboard,
    // Admin Dashboard moved here from the Project block (16 Sep 2026) —
    // it now lives under the same Admin department tab as Security &
    // Login Access, matching Portal's identical move the same day.
    "mod-admin-dashboard-wrapper":     canViewAdminDashboard,
    "mod-qa-dashboard-wrapper":        canViewQaDashboard,
  };
  Object.keys(dashMap).forEach(function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = dashMap[id] ? "" : "none";
  });

  const accountsBlock = document.getElementById("dashboard-accounts-department-header-block");
  if (accountsBlock) accountsBlock.style.display = (canTourExpense || canCashExpenses || canTravelTickets || canViewAccountsDashboard) ? "block" : "none";
  const designBlock = document.getElementById("dashboard-design-department-header-block");
  if (designBlock) designBlock.style.display = (canItemCode || canCreateBOQ || canAuthorizeBOQ || canUpdateBOQ || canAuthorizeBOQUpdate || canUploadDrawings) ? "block" : "none";
  const purchaseBlock = document.getElementById("dashboard-purchase-department-header-block");
  if (purchaseBlock) purchaseBlock.style.display = (canViewMaterialListPurchase || canViewRejectedMaterial || canCreatePO || canAuthorizePO || canPPSTracking || canSearchVendorCostingInfo || canReviseRMPO || canAuthorizeRMPORevision || canSearchRMPO || canViewPurchaseDashboard) ? "block" : "none";
  const adminBlock = document.getElementById("dashboard-admin-department-header-block");
  if (adminBlock) adminBlock.style.display = (canSecurity || canViewAdminDashboard) ? "block" : "none";
  const marketingBlock = document.getElementById("dashboard-marketing-department-header-block");
  if (marketingBlock) marketingBlock.style.display = (canEnterCard || canViewEmailLeads || canUploadCommissioning || canUploadPurchaseOrder || canSearchCompany || canSearchTasks || canSearchStatus || canSearchQual || canSearchCityState || canMeetingPreparation) ? "block" : "none";
  const projectBlock = document.getElementById("dashboard-project-department-header-block");
  if (projectBlock) projectBlock.style.display = (canManufacturingClearance || canProjectTimeline || canDailyTimeline || canProjectStatus || canOrderPaymentProgress) ? "block" : "none";
  // Batch 6 (16 Sep 2026): Store's own screens landed, so this is no
  // longer keyed on Project Invoice Generation alone.
  const storeBlock = document.getElementById("dashboard-store-department-header-block");
  if (storeBlock) storeBlock.style.display = (canCreateProjectDispatchInvoice || canAuthorizeProjectDispatchInvoice || canReviseProjectDispatchInvoice || canAuthorizeProjectDispatchInvoiceRevision || canPurchaseRequestNote || canAuthorizePRN
    || canRevisePRN || canAuthorizePRNRevision || canReserveStoreStock || canGateEntry || canStoreEntryAndGrn
    || canExpectedInbounds || canApproveBOQIncrease || canReleaseTicket || canSearchStoreMat || canViewLiveStock
    || canViewLiveFinishedStock || canLiveSpareStoreStock || canMaterialOutward || canAuthorizeMaterialOutward || canViewStoreDashboard)
    ? "block" : "none";
  // Production department block (Batch 7, 16 Sep 2026)
  const productionBlock = document.getElementById("dashboard-production-department-header-block");
  if (productionBlock) productionBlock.style.display = (canAssignMRD || canReviseMRD || canProductionPlanning
    || canCreateStoreTicket || canJobCardSheet || canAddFinishedGoods || canViewProductionDashboard)
    ? "block" : "none";
  // Quality Assurance department block (Batch 8, 16 Sep 2026)
  const qaBlock = document.getElementById("dashboard-qa-department-header-block");
  if (qaBlock) qaBlock.style.display = (canQaCheck || canFgApproval || canInProcessSheet
    || canQaInspectionTimeline || canProductSerialTracking || canViewQaDashboard)
    ? "block" : "none";

  // A department's sub-heading (.sec-label) sits right before its own
  // .dashboard-grid of .menu-card tiles — every card's display was just
  // set above purely from permissions, so a user holding none of the
  // permissions in one sub-section would otherwise see a bare label with
  // an empty grid under it (e.g. "Catalog & Drawings" with no cards).
  // Hide the pair together whenever every card in that grid ended up
  // hidden. Ported from Portal's shared/navigation.js.
  hideEmptyDashboardSections();

  refreshDepartmentTabsBar();
}

function hideEmptyDashboardSections() {
  document.querySelectorAll(".sec-label").forEach((label) => {
    const grid = label.nextElementSibling;
    if (!grid || !grid.classList.contains("dashboard-grid")) return;
    const cards = grid.querySelectorAll(".menu-card");
    const anyVisible = Array.from(cards).some((c) => c.style.display !== "none");
    const show = cards.length === 0 || anyVisible;
    label.style.display = show ? "" : "none";
    grid.style.display = show ? "" : "none";
  });
}

// ── Department tab bar ───────────────────────────────────────────────────
function refreshDepartmentTabsBar() {
  const bar = document.getElementById('dept-tabs-bar');
  if (!bar) return;

  const visibleKeys = DEPT_TAB_KEYS.filter(key => {
    const block = document.getElementById(`dashboard-${key}-department-header-block`);
    const tab = document.getElementById(`dept-tab-${key}`);
    const isVisible = !!block && block.style.display !== 'none';
    if (tab) tab.style.display = isVisible ? 'inline-flex' : 'none';
    return isVisible;
  });
  deptTabVisibleKeys = visibleKeys;

  if (visibleKeys.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';

  let activeKey = null;
  try { activeKey = localStorage.getItem(DEPT_TAB_STORAGE_KEY); } catch (e) { /* storage unavailable */ }
  if (!activeKey || !visibleKeys.includes(activeKey)) activeKey = visibleKeys[0];

  selectDepartmentTab(activeKey);
}

function selectDepartmentTab(key) {
  DEPT_TAB_KEYS.forEach(k => {
    const block = document.getElementById(`dashboard-${k}-department-header-block`);
    const tab = document.getElementById(`dept-tab-${k}`);
    if (block && deptTabVisibleKeys.includes(k)) {
      block.style.display = (k === key) ? 'block' : 'none';
    }
    if (tab) {
      const isActive = k === key;
      tab.classList.toggle('active', isActive);
      tab.style.setProperty('--tab-accent', tab.dataset.accent || '');
    }
  });
  try { localStorage.setItem(DEPT_TAB_STORAGE_KEY, key); } catch (e) { /* storage unavailable */ }
}

// handleDepartmentTabClick — same generic-reset-then-select shape as
// Portal's own version: a tab click behaves like Return to Main Dashboard
// first (the user may be deep inside a canvas-module-* screen, where
// dashboard-view itself is hidden), then switches to the clicked department.
function handleDepartmentTabClick(key) {
  const workspaceContainer = document.getElementById('module-workspace-container');
  if (workspaceContainer) workspaceContainer.style.display = 'none';
  // Enclosure panels (module-design-workspace-enclosure-panel,
  // module-purchase-workspace-enclosure-panel, ...) don't match
  // [id^="canvas-module-"], so without this line they stay visible forever
  // once shown — e.g. after opening Create BOQ, switching department tabs
  // left its enclosure (and the leftover "Return to Main Dashboard" header
  // row inside it) rendering below the newly-shown dashboard tile grid.
  // Matches Portal's handleDepartmentTabClick exactly.
  document.querySelectorAll('[id$="-workspace-enclosure-panel"]').forEach(p => p.style.display = 'none');
  document.querySelectorAll('[id^="canvas-module-"]').forEach(p => p.style.display = 'none');

  // Same gap returnToDashboard() already closed 17 Sep 2026:
  // #dashboard-global-toolbar is a fixed-position element outside both
  // sweeps above, so switching department tabs while a Dashboard's toolbar
  // was showing (rather than using its own Return button) left it stuck on
  // screen, overlapping whatever screen the new department opened into.
  const staleToolbar = document.getElementById('dashboard-global-toolbar');
  if (staleToolbar) staleToolbar.style.display = 'none';
  const staleAppHeader = document.querySelector('header');
  if (staleAppHeader) staleAppHeader.style.display = '';
  if (typeof activeDashboardReturnFn !== 'undefined') activeDashboardReturnFn = null;

  if (typeof enforceDynamicModuleRoleGateways === 'function' && typeof userPermissions !== 'undefined') {
    enforceDynamicModuleRoleGateways(userPermissions);
  }
  document.getElementById('dashboard-view').style.display = 'flex';
  window.scrollTo(0, 0);
  selectDepartmentTab(key);
}

// ── Opening / closing the 4 screen panels ────────────────────────────────
// Mirrors Portal's switchActiveDashboardModule/returnToDashboard shape:
// dashboard-view hides, the target canvas-module-* panel shows. Unchanged
// by the department-grouping revision above — a tile still opens its own
// single full-screen panel regardless of which department tab it lives under.
// Design's 6 canvas ids that navigateToDesignWorkspacePanel routes between
// once its own "master enclosure panel" is shown — same shape as Portal's
// switchActiveDashboardModule, which forwards every design-* targetSectionId
// to navigateToDesignWorkspacePanel(targetCanvasModuleId) rather than
// showing the canvas directly here. Design is NOT gated on itemcode's plain
// canvas-module-itemcode id (ERP's own pre-existing screen, left as its own
// direct panel — see design/design-dashboard.js's header comment) — only
// the 5 newly-ported BOQ/Drawings panels use this router.
const DESIGN_WORKSPACE_TARGET_IDS = [
  'design-create-boq', 'design-auth-boq', 'design-update-boq',
  'design-auth-boq-upd', 'design-upload-drawings'
];

function switchActiveDashboardModule(targetSectionId) {
  window.scrollTo(0, 0);
  // Production reminder banners (Batch 7, 16 Sep 2026) — Portal calls both
  // from exactly here, on every dashboard navigation, so the banners are
  // already correct by the time a Production screen renders. Both are
  // no-ops when their banner elements aren't in the DOM.
  checkMaterialRequirementDateReminder();
  checkProductionPlanningReminder();

  if (DESIGN_WORKSPACE_TARGET_IDS.includes(targetSectionId) && typeof navigateToDesignWorkspacePanel === "function") {
    navigateToDesignWorkspacePanel(targetSectionId);
    return;
  }

  document.getElementById("dashboard-view").style.display = "none";
  document.querySelectorAll('[id^="canvas-module-"]').forEach(p => p.style.display = "none");
  // Batch 6: the enclosure CONTAINERS were never swept here. Before Store
  // existed nothing nested inside one was reachable through this router,
  // so it never showed; now Store's 14 canvases live inside
  // module-store-workspace-enclosure-panel and reaching an unrelated
  // top-level panel from one of them would leave the enclosure visible
  // underneath. Same fix, same reasoning, as Portal's own copy.
  document.querySelectorAll('[id$="-workspace-enclosure-panel"]').forEach(p => p.style.display = "none");

  // ── Store department (Batch 6, 16 Sep 2026) ────────────────────────
  // These five targets live inside the Store enclosure, so they route
  // through it rather than through the generic show-one-canvas path
  // below. Copied from Portal's own switchActiveDashboardModule.
  if (targetSectionId === "store-history-matrix" || targetSectionId === "store-live-stock") {
    navigateToStoreWorkspacePanel(targetSectionId);
    return;
  }

  // ── Production department (Batch 7, 16 Sep 2026) ────────────────────
  // Portal inlines these five branches here (enclosure -> hide left
  // controls/centre title -> show canvas -> init). ERP delegates to
  // navigateToStoreWorkspacePanel instead, which does exactly those four
  // things for any target that isn't store-live-stock — the same shortcut
  // the two Store targets just above already take. Identical resulting
  // DOM state, one copy of the enclosure logic instead of six.
  if (["production-planning", "assign-material-requirement-date",
       "revise-material-requirement-date", "job-card-sheet", "fg-add",
       "in-process-sheet", "fg-approval"].includes(targetSectionId)) {
    navigateToStoreWorkspacePanel(targetSectionId);
    return;
  }
  if (targetSectionId === "store-live-finished-goods" || targetSectionId === "live-finished-goods") {
    document.getElementById("module-store-workspace-enclosure-panel").style.display = "block";
    document.querySelectorAll("#module-store-workspace-enclosure-panel .workspace-panel").forEach(p => p.style.display = "none");
    const leftControls = document.getElementById("store-panel-left-controls");
    const centerTitle  = document.getElementById("store-panel-center-title");
    const syncBtn      = document.getElementById("live-stock-sync-btn");
    if (leftControls) leftControls.style.visibility = "visible";
    if (centerTitle)  { centerTitle.style.visibility = "visible"; centerTitle.textContent = "Live Finished Goods Store Stock"; }
    if (syncBtn) {
      syncBtn.removeAttribute("onclick");
      syncBtn.onclick = function() { triggerLiveFinishedGoodsStoreStockMetricsSync(); };
    }
    document.getElementById("canvas-module-store-live-fg").style.display = "block";
    triggerLiveFinishedGoodsStoreStockMetricsSync();
    return;
  }
  if (targetSectionId === "store-live-spare") {
    document.getElementById("module-store-workspace-enclosure-panel").style.display = "block";
    document.querySelectorAll("#module-store-workspace-enclosure-panel .workspace-panel").forEach(p => p.style.display = "none");
    const leftControls = document.getElementById("store-panel-left-controls");
    const centerTitle  = document.getElementById("store-panel-center-title");
    const syncBtn      = document.getElementById("live-stock-sync-btn");
    if (leftControls) leftControls.style.visibility = "visible";
    if (centerTitle)  { centerTitle.style.visibility = "visible"; centerTitle.textContent = "Live Spare Store Stock"; }
    if (syncBtn) {
      syncBtn.removeAttribute("onclick");
      syncBtn.onclick = function() { triggerLiveSpareStoreStockMetricsSync(); };
    }
    document.getElementById("canvas-module-store-live-spare").style.display = "block";
    triggerLiveSpareStoreStockMetricsSync();
    return;
  }
  if (targetSectionId === "authorize-material-outward") {
    document.getElementById("module-store-workspace-enclosure-panel").style.display = "block";
    document.querySelectorAll("#module-store-workspace-enclosure-panel .workspace-panel").forEach(p => p.style.display = "none");
    const leftControlsAMO = document.getElementById("store-panel-left-controls");
    const centerTitleAMO  = document.getElementById("store-panel-center-title");
    if (leftControlsAMO) leftControlsAMO.style.visibility = "hidden";
    if (centerTitleAMO)  centerTitleAMO.style.visibility  = "hidden";
    document.getElementById("canvas-module-authorize-material-outward").style.display = "block";
    initializeAuthorizeMaterialOutwardWorkspace();
    return;
  }
  if (targetSectionId === "search-material-outward") {
    document.getElementById("module-store-workspace-enclosure-panel").style.display = "block";
    document.querySelectorAll("#module-store-workspace-enclosure-panel .workspace-panel").forEach(p => p.style.display = "none");
    const leftControlsSMO = document.getElementById("store-panel-left-controls");
    const centerTitleSMO  = document.getElementById("store-panel-center-title");
    if (leftControlsSMO) leftControlsSMO.style.visibility = "hidden";
    if (centerTitleSMO)  centerTitleSMO.style.visibility  = "hidden";
    document.getElementById("canvas-module-search-material-outward").style.display = "block";
    initializeSearchMaterialOutwardWorkspace();
    return;
  }
  if (targetSectionId === "material-outward") {
    document.getElementById("module-store-workspace-enclosure-panel").style.display = "block";
    document.querySelectorAll("#module-store-workspace-enclosure-panel .workspace-panel").forEach(p => p.style.display = "none");
    const leftControlsMOW = document.getElementById("store-panel-left-controls");
    const centerTitleMOW  = document.getElementById("store-panel-center-title");
    if (leftControlsMOW) leftControlsMOW.style.visibility = "hidden";
    if (centerTitleMOW)  centerTitleMOW.style.visibility  = "hidden";
    document.getElementById("canvas-module-material-outward").style.display = "block";
    initializeMaterialOutwardWorkspace();
    return;
  }

  const target = document.getElementById("canvas-module-" + targetSectionId);
  if (target) target.style.display = "block";

  // Each real screen owns an init function that (re)builds its panel from
  // scratch on open — same convention Portal uses (its own
  // switchActiveDashboardModule calls initializeTourExpensePanel /
  // initializeCashExpensesPanel the same way).
  if (targetSectionId === "tourexpense" && typeof initializeTourExpensePanel === "function") initializeTourExpensePanel();
  if (targetSectionId === "cashexpenses" && typeof initializeCashExpensesPanel === "function") initializeCashExpensesPanel();
  if (targetSectionId === "traveltickets" && typeof initializeTravelTicketsPanel === "function") initializeTravelTicketsPanel();
  if (targetSectionId === "itemcode" && typeof initializeItemCodePanel === "function") initializeItemCodePanel();
  // Project department (15 Sep 2026 port) — same init-on-open convention.
  // project-invoice has no Store enclosure to nest inside here (Store
  // isn't built in ERP yet), so it's a plain top-level panel like the
  // other four, unlike Portal's own copy which nests it under
  // module-store-workspace-enclosure-panel.
  if (targetSectionId === "manufacturing-clearance" && typeof initializeManufacturingClearancePanel === "function") initializeManufacturingClearancePanel();
  if (targetSectionId === "project-timeline" && typeof initializeProjectTimelinePanel === "function") initializeProjectTimelinePanel();
  if (targetSectionId === "daily-timeline" && typeof initializeDailyTimelinePanel === "function") initializeDailyTimelinePanel();
  if (targetSectionId === "project-status" && typeof initializeProjectStatusPanel === "function") initializeProjectStatusPanel();
  if (targetSectionId === "order-payment" && typeof initializeOrderPaymentPanel === "function") initializeOrderPaymentPanel();
  // Project Dispatch Invoice's four sections (19 Sep 2026, ported from
  // Portal's migrations 208-209 -- was one "project-invoice" screen/
  // permission). Each is a plain top-level panel via the generic
  // canvas-module-<targetSectionId> path above, same as project-invoice
  // always was here -- no Store-enclosure routing needed.
  if (targetSectionId === "create-project-dispatch-invoice" && typeof switchCreatePdiTab === "function") switchCreatePdiTab('new');
  if (targetSectionId === "authorize-project-dispatch-invoice" && typeof initializeApdiWorkspace === "function") initializeApdiWorkspace();
  if (targetSectionId === "revise-project-dispatch-invoice" && typeof switchRevisePdiTab === "function") switchRevisePdiTab('select');
  if (targetSectionId === "authorize-project-dispatch-invoice-revision" && typeof initializeArpdiWorkspace === "function") initializeArpdiWorkspace();
  // QA department (Batch 8, 16 Sep 2026) — same init-on-open convention.
  // qa-dashboard is reached via its own dept-dash-pill (navigateToQaDashboard),
  // not through this generic path, so it needs no entry here.
  if (targetSectionId === "qa-inspection-timeline" && typeof initializeQaInspectionTimelinePanel === "function") initializeQaInspectionTimelinePanel();
  if (targetSectionId === "product-serial-tracking" && typeof initializeProductSerialTrackingPanel === "function") initializeProductSerialTrackingPanel();
  // In-app Documentation (Batch 9, 16 Sep 2026) — reached from the header's
  // "Docs" button, not a menu card, so it has no permission gate here; the
  // nav rendered inside the panel is filtered server-side.
  if (targetSectionId === "documentation" && typeof initializeDocumentationPanel === "function") initializeDocumentationPanel();
}

// ── navigateToStoreWorkspacePanel (Batch 6, 16 Sep 2026) ──────────────
// Ported from Portal's own shared/navigation.js. Two deliberate ERP
// adaptations, both defensive rather than behavioural:
//  - checkMaterialRequirementDateReminder / checkProductionPlanningReminder
//    do not exist here yet (Batch 7), so only the PRN reminder is called.
//  - the Production/QA branches (job-card-sheet, in-process-sheet, the
//    two MRD panels, production-planning, fg-add, fg-approval) are not
//    reproduced — none of those canvases exist in ERP yet. Batch 7/8 add
//    their own branches.
// store-grn (Raw Materials Q/A Check) and store-material-request (Create
// Material Issue Ticket) ARE routed here, matching Portal, even though
// their dashboard cards belong to QA/Production and don't exist yet.
function navigateToStoreWorkspacePanel(targetPanelModuleId) {
  window.scrollTo(0, 0);
  setTimeout(() => window.scrollTo(0, 0), 50);
  document.querySelectorAll(".workspace-panel").forEach(p => p.style.display = "none");
  // Approve Excess Material Requests and Gate Entry are their own focused
  // workflows — the "A BOQ has been revised, check Revise PRN" reminder
  // isn't actionable from either screen, just noise on top of them.
  if (["boq-increase-approvals", "store-gate-entry"].includes(targetPanelModuleId)) {
    const banner = document.getElementById("store-prn-revision-reminder-banner");
    if (banner) banner.style.display = "none";
  } else {
    checkStorePRNRevisionReminder();
  }
  if (typeof stopLiveStockPolling === "function") stopLiveStockPolling();
  if (typeof stopPendingTicketsQueuePolling === "function") stopPendingTicketsQueuePolling();

  document.getElementById("dashboard-view").style.display = "none";
  const mwc0 = document.getElementById("module-workspace-container");
  if (mwc0) {
    document.querySelectorAll("#module-workspace-container .workspace-panel").forEach(p => p.style.display = "none");
    mwc0.style.display = "none";
  }

  document.getElementById("module-store-workspace-enclosure-panel").style.display = "block";

  const leftControls = document.getElementById("store-panel-left-controls");
  const centerTitle = document.getElementById("store-panel-center-title");
  const isLiveStock = targetPanelModuleId === 'store-live-stock';
  if (leftControls) leftControls.style.visibility = isLiveStock ? "visible" : "hidden";
  if (centerTitle) {
    centerTitle.style.visibility = isLiveStock ? "visible" : "hidden";
    if (isLiveStock) centerTitle.textContent = "Live Raw Materials Store Stock";
  }
  const syncBtn = document.getElementById("live-stock-sync-btn");
  if (syncBtn && isLiveStock) {
    syncBtn.removeAttribute("onclick");
    syncBtn.onclick = function() { triggerLiveWarehouseStockMetricsSync(); };
  }

  const show = id => { const el = document.getElementById(id); if (el) el.style.display = "block"; };
  if (targetPanelModuleId === 'store-material-request') {
    show("canvas-module-store-material-request");
    initializeMaterialRequestWorkspace();
  } else if (targetPanelModuleId === 'boq-increase-approvals') {
    show("canvas-module-boq-increase-approvals");
    initializeBOQIncreaseApprovalsWorkspace();
  } else if (targetPanelModuleId === 'store-manager-approvals') {
    show("canvas-module-store-manager-approvals");
    initializeStoreManagerApprovalsWorkspace();
  } else if (targetPanelModuleId === 'store-history-matrix') {
    show("canvas-module-store-history-matrix");
    initializeStoreHistoryMatrixWorkspace();
  } else if (targetPanelModuleId === 'store-live-stock') {
    show("canvas-module-store-live-stock");
    triggerLiveWarehouseStockMetricsSync();
  } else if (targetPanelModuleId === 'store-gate-entry') {
    show("canvas-module-store-gate-entry");
    resetGateEntryWorkspaceState();
  } else if (targetPanelModuleId === 'store-entry') {
    show("canvas-module-store-entry");
    const seBanner = document.getElementById("store-entry-runtime-feedback-banner");
    if (seBanner) { seBanner.style.display = "none"; seBanner.innerHTML = ""; }
    initializeStoreEntryWorkspaceQueue();
  } else if (targetPanelModuleId === 'store-grn') {
    show("canvas-module-store-grn");
    const grnBanner = document.getElementById("store-grn-runtime-feedback-banner");
    if (grnBanner) { grnBanner.style.display = "none"; grnBanner.innerHTML = ""; }
    window.activeQAToggle = "pending";
    initializeStoreGrnWorkspaceQueue('pending');
  } else if (targetPanelModuleId === 'repair-qa') {
    show("canvas-module-store-repair-qa");
    const repairBanner = document.getElementById("store-repair-qa-runtime-feedback-banner");
    if (repairBanner) { repairBanner.style.display = "none"; repairBanner.innerHTML = ""; }
    initializeStoreRepairQAWorkspace();
  } else if (targetPanelModuleId === 'stock-sweep') {
    show("canvas-module-stock-sweep");
    initializeStockSweepPanel();
  } else if (targetPanelModuleId === 'assign-current-stock') {
    show("canvas-module-assign-current-stock");
    initializeAssignCurrentStockPanel();
  } else if (targetPanelModuleId === 'expected-inbounds') {
    show("canvas-module-expected-inbounds");
    initializeExpectedInboundsPanel();
  // ── Production department (Batch 7, 16 Sep 2026) ────────────────────
  // These five canvases live inside the SAME store workspace enclosure in
  // Portal, which is why they are routed from here rather than from
  // switchActiveDashboardModule's generic show-one-canvas path. Portal
  // hides store-panel-left-controls / store-panel-center-title for all of
  // them (none of these screens uses the enclosure's sync button or
  // title); ERP's local `show()` helper already does that, so the branches
  // are one line shorter than Portal's, with identical effect.
  } else if (targetPanelModuleId === 'production-planning') {
    show("canvas-module-production-planning");
    initializeProductionPlanningPanel();
  } else if (targetPanelModuleId === 'assign-material-requirement-date') {
    show("canvas-module-assign-material-requirement-date");
    initializeAssignMaterialRequirementDatePanel();
  } else if (targetPanelModuleId === 'revise-material-requirement-date') {
    show("canvas-module-revise-material-requirement-date");
    initializeReviseMRDPanel();
  } else if (targetPanelModuleId === 'job-card-sheet') {
    show("canvas-module-job-card-sheet");
    initializeJCSHWorkspace();
  } else if (targetPanelModuleId === 'fg-add') {
    show("canvas-module-fg-add");
    initializeFGAddWorkspace();
  // ── Quality Assurance department (Batch 8, 16 Sep 2026) — same store
  // enclosure, same reasoning as the Production branches just above.
  } else if (targetPanelModuleId === 'in-process-sheet') {
    show("canvas-module-in-process-sheet");
    initializeIPSHWorkspace();
  } else if (targetPanelModuleId === 'fg-approval') {
    show("canvas-module-fg-approval");
    initializeFGApprovalWorkspace();
  }
}

function returnToDashboard() {
  document.querySelectorAll('[id^="canvas-module-"]').forEach(p => p.style.display = "none");
  document.querySelectorAll('[id$="-workspace-enclosure-panel"]').forEach(p => p.style.display = "none");
  const mwc = document.getElementById("module-workspace-container");
  if (mwc) mwc.style.display = "none";
  document.getElementById("dashboard-view").style.display = "flex";

  // Fixed 17 Sep 2026 (found via live click-test): #dashboard-global-toolbar
  // isn't a canvas-module-*/workspace-enclosure-panel, so the sweeps above
  // never caught it — leaving a Dashboard via this generic escape hatch
  // (rather than the toolbar's own Return button, dashboardGlobalReturnClick)
  // left the Today/Yesterday toolbar permanently stacked on top of whatever
  // screen was visited next. Ported to Portal's identical function too.
  const staleToolbar = document.getElementById("dashboard-global-toolbar");
  if (staleToolbar) staleToolbar.style.display = "none";
  const staleAppHeader = document.querySelector('header');
  if (staleAppHeader) staleAppHeader.style.display = "";
  if (typeof activeDashboardReturnFn !== 'undefined') activeDashboardReturnFn = null;

  window.scrollTo(0, 0);
}

// exitManufacturingClearanceBackToMenu/exitProjectTimelineBackToMenu —
// ported verbatim from Portal's own shared/navigation.js (that's where
// Portal itself declares these two, not per-screen — project-invoice.js's
// own switchPinvMode/production-planning-style screens don't need this
// shape since they route through switchActiveDashboardModule's generic
// canvas-module-* sweep instead, but Manufacturing Clearance/Project
// Timeline's own panel HTML calls these two by name).
function exitManufacturingClearanceBackToMenu() {
  document.getElementById("canvas-module-manufacturing-clearance").style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

function exitProjectTimelineBackToMenu() {
  document.getElementById("canvas-module-project-timeline").style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}
