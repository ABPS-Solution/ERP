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

const DEPT_TAB_KEYS = ['accounts', 'design', 'admin'];
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

  if (document.getElementById("mod-tourexpense"))  document.getElementById("mod-tourexpense").style.display  = canTourExpense  ? "block" : "none";
  if (document.getElementById("mod-cashexpenses")) document.getElementById("mod-cashexpenses").style.display = canCashExpenses ? "block" : "none";
  if (document.getElementById("mod-traveltickets")) document.getElementById("mod-traveltickets").style.display = canTravelTickets ? "block" : "none";
  if (document.getElementById("mod-accounts-dashboard-wrapper")) document.getElementById("mod-accounts-dashboard-wrapper").style.display = canViewAccountsDashboard ? "block" : "none";
  if (document.getElementById("mod-itemcode"))     document.getElementById("mod-itemcode").style.display     = canItemCode     ? "block" : "none";
  if (document.getElementById("mod-security"))     document.getElementById("mod-security").style.display     = canSecurity     ? "block" : "none";

  const accountsBlock = document.getElementById("dashboard-accounts-department-header-block");
  if (accountsBlock) accountsBlock.style.display = (canTourExpense || canCashExpenses || canTravelTickets || canViewAccountsDashboard) ? "block" : "none";
  const designBlock = document.getElementById("dashboard-design-department-header-block");
  if (designBlock) designBlock.style.display = canItemCode ? "block" : "none";
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
  document.querySelectorAll('[id^="canvas-module-"]').forEach(p => p.style.display = 'none');
  const workspaceContainer = document.getElementById('module-workspace-container');
  if (workspaceContainer) workspaceContainer.style.display = 'none';

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
function switchActiveDashboardModule(targetSectionId) {
  window.scrollTo(0, 0);
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
  const mwc = document.getElementById("module-workspace-container");
  if (mwc) mwc.style.display = "none";
  document.getElementById("dashboard-view").style.display = "flex";
  window.scrollTo(0, 0);
}
