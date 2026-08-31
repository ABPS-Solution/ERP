// shared/navigation.js — ERP's trimmed port of Portal's shared/navigation.js
// (31 Aug 2026). Portal's version drives 7 departments and dozens of
// workspace panels; ERP has exactly 4 sections — Tour Expense Tracker,
// Daily Cash/UPI Expenses, Add/Check Item Code, and Security & Login
// Access — each gated by its own single perm column (no umbrella
// "Accounts" grouping), each a single top-level "canvas-module-*" panel
// with its own dashboard card. The overall MECHANISM (permission-gated
// section-tabs-bar built on top of enforceDynamicModuleRoleGateways,
// module-workspace-container / workspace-panel show/hide convention) is
// carried over unchanged from Portal's dept-tabs-bar.
//
// Each of the 4 sections is currently a placeholder — the real screen
// content (accounts/*.js, design/item-codes.js, project/security-admin.js)
// is later, separate work per the task this file was built for.

const SECTION_TAB_KEYS = ['tourexpense', 'cashexpenses', 'itemcode', 'security'];
const SECTION_TAB_STORAGE_KEY = 'erpActiveSectionTab';
// Same reasoning as Portal's deptTabVisibleKeys: selectSectionTab must
// consult which sections are actually permission-visible (set once per
// enforceDynamicModuleRoleGateways pass), never live block.style.display —
// after switching tabs, every non-active block sits at display:none from
// that switch itself, indistinguishable from a permission-driven hide.
let sectionTabVisibleKeys = SECTION_TAB_KEYS.slice();

// ── Permission-driven visibility ────────────────────────────────────────
// userPermissions only ever carries the 4 camelCase keys erp-backend's
// lib/permMap.js sends (itemCodeAccess, tourExpense, cashExpenses,
// securityLoginAccess) — see shared/apFetch.js's userPermissions default.
// Each of ERP's 4 sections is gated on exactly ONE of those, no OR'ing.
function enforceDynamicModuleRoleGateways(userPermissionsObject) {
  const canTourExpense = userPermissionsObject.tourExpense === true;
  const canCashExpenses = userPermissionsObject.cashExpenses === true;
  const canItemCode = userPermissionsObject.itemCodeAccess === true;
  const canSecurity  = userPermissionsObject.securityLoginAccess === true;

  if (document.getElementById("mod-tourexpense"))  document.getElementById("mod-tourexpense").style.display  = canTourExpense  ? "block" : "none";
  if (document.getElementById("mod-cashexpenses")) document.getElementById("mod-cashexpenses").style.display = canCashExpenses ? "block" : "none";
  if (document.getElementById("mod-itemcode"))     document.getElementById("mod-itemcode").style.display     = canItemCode     ? "block" : "none";
  if (document.getElementById("mod-security"))     document.getElementById("mod-security").style.display     = canSecurity     ? "block" : "none";

  const tourExpenseBlock = document.getElementById("dashboard-tourexpense-section-header-block");
  if (tourExpenseBlock) tourExpenseBlock.style.display = canTourExpense ? "block" : "none";
  const cashExpensesBlock = document.getElementById("dashboard-cashexpenses-section-header-block");
  if (cashExpensesBlock) cashExpensesBlock.style.display = canCashExpenses ? "block" : "none";
  const itemCodeBlock = document.getElementById("dashboard-itemcode-section-header-block");
  if (itemCodeBlock) itemCodeBlock.style.display = canItemCode ? "block" : "none";
  const securityBlock = document.getElementById("dashboard-security-section-header-block");
  if (securityBlock) securityBlock.style.display = canSecurity ? "block" : "none";

  refreshSectionTabsBar();
}

// ── Section tab bar ──────────────────────────────────────────────────────
function refreshSectionTabsBar() {
  const bar = document.getElementById('section-tabs-bar');
  if (!bar) return;

  const visibleKeys = SECTION_TAB_KEYS.filter(key => {
    const block = document.getElementById(`dashboard-${key}-section-header-block`);
    const tab = document.getElementById(`section-tab-${key}`);
    const isVisible = !!block && block.style.display !== 'none';
    if (tab) tab.style.display = isVisible ? 'inline-flex' : 'none';
    return isVisible;
  });
  sectionTabVisibleKeys = visibleKeys;

  if (visibleKeys.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';

  let activeKey = null;
  try { activeKey = localStorage.getItem(SECTION_TAB_STORAGE_KEY); } catch (e) { /* storage unavailable */ }
  if (!activeKey || !visibleKeys.includes(activeKey)) activeKey = visibleKeys[0];

  selectSectionTab(activeKey);
}

function selectSectionTab(key) {
  SECTION_TAB_KEYS.forEach(k => {
    const block = document.getElementById(`dashboard-${k}-section-header-block`);
    const tab = document.getElementById(`section-tab-${k}`);
    if (block && sectionTabVisibleKeys.includes(k)) {
      block.style.display = (k === key) ? 'block' : 'none';
    }
    if (tab) {
      const isActive = k === key;
      tab.classList.toggle('active', isActive);
      tab.style.setProperty('--tab-accent', tab.dataset.accent || '');
    }
  });
  try { localStorage.setItem(SECTION_TAB_STORAGE_KEY, key); } catch (e) { /* storage unavailable */ }
}

// handleSectionTabClick — same generic-reset-then-select shape as Portal's
// handleDepartmentTabClick: a tab click behaves like Return to Main
// Dashboard first (the user may be deep inside a canvas-module-* screen,
// where dashboard-view itself is hidden), then switches to the clicked
// section.
function handleSectionTabClick(key) {
  document.querySelectorAll('[id^="canvas-module-"]').forEach(p => p.style.display = 'none');
  const workspaceContainer = document.getElementById('module-workspace-container');
  if (workspaceContainer) workspaceContainer.style.display = 'none';

  if (typeof enforceDynamicModuleRoleGateways === 'function' && typeof userPermissions !== 'undefined') {
    enforceDynamicModuleRoleGateways(userPermissions);
  }
  document.getElementById('dashboard-view').style.display = 'flex';
  window.scrollTo(0, 0);
  selectSectionTab(key);
}

// ── Opening / closing the 4 section panels ──────────────────────────────
// Mirrors Portal's switchActiveDashboardModule/returnToDashboard shape:
// dashboard-view hides, the target canvas-module-* panel shows.
function switchActiveDashboardModule(targetSectionId) {
  window.scrollTo(0, 0);
  document.getElementById("dashboard-view").style.display = "none";
  document.querySelectorAll('[id^="canvas-module-"]').forEach(p => p.style.display = "none");

  const target = document.getElementById("canvas-module-" + targetSectionId);
  if (target) target.style.display = "block";
}

function returnToDashboard() {
  document.querySelectorAll('[id^="canvas-module-"]').forEach(p => p.style.display = "none");
  const mwc = document.getElementById("module-workspace-container");
  if (mwc) mwc.style.display = "none";
  document.getElementById("dashboard-view").style.display = "flex";
  window.scrollTo(0, 0);
}
