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

const DEPT_TAB_KEYS = ['accounts', 'design', 'purchase', 'admin'];
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
  if (document.getElementById("mod-purchase-create-po"))     document.getElementById("mod-purchase-create-po").style.display     = canCreatePO ? "block" : "none";
  if (document.getElementById("mod-purchase-authorize-po"))  document.getElementById("mod-purchase-authorize-po").style.display  = canAuthorizePO ? "block" : "none";
  if (document.getElementById("mod-purchase-pps-tracking"))  document.getElementById("mod-purchase-pps-tracking").style.display  = canPPSTracking ? "block" : "none";
  if (document.getElementById("mod-purchase-rejected-material")) document.getElementById("mod-purchase-rejected-material").style.display = canViewRejectedMaterial ? "block" : "none";
  if (document.getElementById("mod-revise-rm-po")) document.getElementById("mod-revise-rm-po").style.display = canReviseRMPO ? "block" : "none";
  if (document.getElementById("mod-authorize-rm-po-revision")) document.getElementById("mod-authorize-rm-po-revision").style.display = canAuthorizeRMPORevision ? "block" : "none";
  if (document.getElementById("mod-search-rm-po")) document.getElementById("mod-search-rm-po").style.display = canSearchRMPO ? "block" : "none";
  if (document.getElementById("mod-search-vendor-costing-info")) document.getElementById("mod-search-vendor-costing-info").style.display = canSearchVendorCostingInfo ? "block" : "none";

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
  if (adminBlock) adminBlock.style.display = canSecurity ? "block" : "none";

  refreshDepartmentTabsBar();
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

  if (DESIGN_WORKSPACE_TARGET_IDS.includes(targetSectionId) && typeof navigateToDesignWorkspacePanel === "function") {
    navigateToDesignWorkspacePanel(targetSectionId);
    return;
  }

  document.getElementById("dashboard-view").style.display = "none";
  document.querySelectorAll('[id^="canvas-module-"]').forEach(p => p.style.display = "none");

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
}

function returnToDashboard() {
  document.querySelectorAll('[id^="canvas-module-"]').forEach(p => p.style.display = "none");
  document.querySelectorAll('[id$="-workspace-enclosure-panel"]').forEach(p => p.style.display = "none");
  const mwc = document.getElementById("module-workspace-container");
  if (mwc) mwc.style.display = "none";
  document.getElementById("dashboard-view").style.display = "flex";
  window.scrollTo(0, 0);
}
