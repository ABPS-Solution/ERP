// shared/apFetch.js — ERP's trimmed port of Portal's shared/apFetch.js
// (31 Aug 2026). Same calling convention (single POST /exec bridge,
// { action, ...payload, sessionToken }) and the same session-bootstrap /
// showAppView / logout shape — but stripped of every Marketing/Store/
// Design/etc-specific global and helper, since none of those screens
// exist here. Only Accounts / Add-Check Item Code / Security & Login
// Access are real sections; everything else is a placeholder panel.

const GAS_URL = "https://erp-backend-244281871074.asia-south1.run.app/exec";

// All localStorage keys ERP writes are prefixed "erp" (31 Aug 2026,
// fixing a real cross-app bug — see below) — collected here as one list
// so clearAppLocalStorageKeepingDeviceKeys can remove exactly these and
// nothing else, never a bare .clear().
const ERP_LOCAL_STORAGE_KEYS = [
  "erpSessionToken", "erpSessionExpiry", "erpSessionUser", "erpUserFirstName",
  "erpUserLastName", "erpActiveOperatorSignature", "erpUserPermissions", "erpIsUserAdminGlobal",
  // erpIsUserSuperAdminGlobal (17 Sep 2026, super-admin tier, ported from
  // Portal) — same staleness-safety precedent as erpIsUserAdminGlobal:
  // set fresh from the server's real perm_super_admin flag on login,
  // never trusted stale.
  "erpIsUserSuperAdminGlobal",
  // erpActiveEmailLeadsCache (15 Sep 2026, Marketing port) — Portal's own
  // equivalent key (abps_active_email_leads_cache) is wiped on every full
  // localStorage.clear() there too (session-expiry / logout), so this is
  // cleared on the same paths, not preserved like a device secret.
  "erpActiveEmailLeadsCache",
  // erpPtlTodayOverride (15 Sep 2026, Project department port) — Project
  // Timeline's own admin-only, client-side-only "today" override; several
  // dashboards (admin-dashboard.js, design/purchase dashboards) also read
  // this same key so a test scenario built on the Timeline screen stays
  // consistent everywhere. erpPinvDraftV1 is Project Invoice Generation's
  // in-progress-invoice draft (Portal's own abps_pinv_draft_v1, renamed
  // to this app's convention) — cleared on logout like every other key
  // here, not preserved like a device secret.
  "erpPtlTodayOverride", "erpPinvDraftV1",
  // erpUserDepartment / erpUserProductionSubDept (16 Sep 2026, Batch 7 —
  // Production Planning's lane write-gate). Portal's own equivalents
  // (userDepartment / userProductionSubDept) are unprefixed and would
  // COLLIDE with Portal on this shared origin, hence the erp prefix.
  // Cleared on logout/session expiry like every other identity value.
  "erpUserDepartment", "erpUserProductionSubDept",
  // erp_abps_cpo_draft_v1 (Batch 5, purchase/po.js's CPO_DRAFT_STORAGE_KEY)
  // — RM PO's own draft persistence, a separate mechanism from
  // shared/drafts.js's erpAbpsDraft: prefix (same split Portal's own
  // persistCPODraft/loadPinvDraft have vs. shared/drafts.js — see CLAUDE.md).
  // Registered here (16 Sep 2026 audit) so it's actually cleared on logout
  // instead of silently surviving forever.
  "erp_abps_cpo_draft_v1",
];

// ERP_LOCAL_STORAGE_PREFIXES — section-collapse UI state keyed per-type, so
// it can't sit in the fixed list above (one key per material/spare/BOQ-item
// type). erp_rm_section_*/erp_spare_section_* (store/live-stock.js),
// erp_ml_section_* (purchase/material-list.js). Swept the same way
// erpAbpsDraft: already is. Registered 16 Sep 2026 audit — these were
// previously never cleared on logout.
const ERP_LOCAL_STORAGE_PREFIXES = [
  "erp_rm_section_", "erp_spare_section_", "erp_ml_section_",
];

// clearAppLocalStorageKeepingDeviceKeys — a bare localStorage.clear() must
// never wipe erpAbpsPcDeviceSecret (PIN-login registered-device secret) on
// a session-expiry path. Only executeLogout() should decide whether it
// survives, and it deliberately keeps it too (logging out shouldn't
// un-enroll the device).
//
// ★ Real bug fixed 31 Aug 2026: this used to be a bare `localStorage.clear()`
// with unprefixed key names (sessionToken, userPermissions, etc.) — IDENTICAL
// to the key names Portal's own abps-frontend/shared/apFetch.js uses.
// Portal (abps-solution.github.io/Portal/) and ERP (abps-solution.github.io/ERP/)
// are the SAME origin, just different paths — localStorage is partitioned
// by origin, not by path, so both apps were reading/writing the exact same
// storage bucket. Logging into ERP silently overwrote Portal's session
// token (and vice versa), and `.clear()` wiped BOTH apps' entire storage,
// not just ERP's own. Every key ERP writes is now prefixed "erp" and this
// function only ever removes that specific list — Portal's own keys (and
// anything else sharing this origin) are never touched.
//
// options.keepDrafts (15 Sep 2026, Batch 4 / shared/drafts.js) — form
// autosave drafts (ERP_DRAFT_PREFIX-keyed) survive an INVOLUNTARY session
// expiry, where you come back as the same person, but are cleared on an
// explicit logout, since several devices here are shared. Same rule as
// Portal's own clearAppLocalStorageKeepingDeviceKeys.
function clearAppLocalStorageKeepingDeviceKeys(options) {
  const keepDrafts = !!(options && options.keepDrafts);
  const pcDeviceSecret = localStorage.getItem("erpAbpsPcDeviceSecret");
  // erpDeviceToken (1 Sep 2026, Google Sign-In restored as a 3rd login
  // mode) — the location-restricted-login device-trust token, same
  // preserved-across-logout treatment Portal gives its own abpsDeviceToken.
  const googleDeviceToken = localStorage.getItem("erpDeviceToken");
  ERP_LOCAL_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
  // Section-collapse UI state (ERP_LOCAL_STORAGE_PREFIXES) always clears,
  // regardless of keepDrafts — it's a display preference, not an
  // in-progress form, so there's no reason to preserve it across a
  // session expiry the way drafts are.
  {
    const doomedPrefixed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && ERP_LOCAL_STORAGE_PREFIXES.some(p => k.startsWith(p))) doomedPrefixed.push(k);
    }
    doomedPrefixed.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
  }
  if (!keepDrafts) {
    // Draft keys are prefix-generated (one per form), so they can't sit in
    // the fixed ERP_LOCAL_STORAGE_KEYS list — swept by prefix instead.
    // Still never a bare .clear(): the prefix is erp-scoped, so Portal's
    // own abpsDraft: keys on this same origin are untouched.
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("erpAbpsDraft:")) doomed.push(k);
    }
    doomed.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
  }
  if (pcDeviceSecret) localStorage.setItem("erpAbpsPcDeviceSecret", pcDeviceSecret);
  if (googleDeviceToken) localStorage.setItem("erpDeviceToken", googleDeviceToken);
}

// driveLink — backend-generated document links (BOQ/PRN/PO PDFs, tour
// voucher bills, project invoices...) point at this app's own
// authenticated proxy (GET /api/driveFile/:fileId), not a public Drive
// URL. It used to append the raw, session-lifetime erpSessionToken as
// ?token= here — that put a long-lived credential into every href,
// meaning browser history, any Referer header, and view-source all
// carried it. Fixed (ported from Portal, 17 Sep 2026): this now returns
// the BARE proxy URL, unchanged, and the delegated click handler below
// mints a short-lived, single-purpose file token AT CLICK TIME and
// appends it then — so every existing call site needed zero changes.
function driveLink(url) {
  return url;
}

// applyServerRoleFlags — writes the AUTHORITATIVE, server-computed
// isAdmin/isSuperAdmin/department/productionSubDept from a
// getSessionPermissions response into localStorage. Ported from Portal
// (17 Sep 2026), which added it after a real bug: `isUserAdminGlobal` used
// to be set ONLY at login time and never corrected again for the rest of
// that browser session — so an account moved OUT of the Admin department
// (or out of a Production sub-department) kept showing admin-only controls
// until a fresh login, because nothing ever re-derived it from the real
// perm_admin column. This is called every time getSessionPermissions is
// (window.onload, on every page load), so it self-corrects on the next
// reload — the same freshness guarantee that fetch already gives
// permissions generally.
//
// ERP note: these are UX-only. Every route behind an admin/super-admin/
// sub-department control is separately gated server-side
// (requirePermission, assertCanWriteLane, canAccessLd), which is the real
// enforcement regardless of what these flags say.
function applyServerRoleFlags(permData) {
  localStorage.setItem("erpIsUserAdminGlobal", permData.isAdmin ? "true" : "false");
  localStorage.setItem("erpIsUserSuperAdminGlobal", permData.isSuperAdmin ? "true" : "false");
  localStorage.setItem("erpUserDepartment", permData.department || "");
  // productionSubDept is a TEXT[] column now (19 Sep 2026 — a Production
  // person can belong to more than one sub-department) — stored as a
  // comma-joined string here since localStorage only holds strings; every
  // consumer must split(",") and check membership, not do a single-value
  // equality compare (see production-planning.js's pplanCanWriteLane).
  localStorage.setItem("erpUserProductionSubDept", (permData.productionSubDept || []).join(","));
}

// refreshServerRoleFlags — same as applyServerRoleFlags, but fetches its
// own getSessionPermissions first. Used right after login, where the login
// response does carry these fields but a later revocation would not be
// picked up otherwise — fire-and-forget, non-blocking, so it never delays
// showAppView(); until it resolves, the flags keep whatever
// completeSuccessfulLogin already wrote from the login response itself.
async function refreshServerRoleFlags() {
  try {
    const data = await apFetch({ action: "getSessionPermissions" });
    if (data.success) applyServerRoleFlags(data);
  } catch (e) { /* best-effort — the next page load's refresh will catch up */ }
}

// ── File-token click handler (driveFile proxy auth) ─────────────────────
// Mints a short-lived signed token (lib/fileToken.js, ~2min TTL) on demand
// and appends it to the clicked link's href, then opens it — rather than
// caching one on a timer, which would have a staleness window (tab left
// open for hours, clicked right after login before a timer fires). Minting
// fresh at the moment of the click has none of that: it's always valid at
// the instant it's used, and the tiny TTL means a captured/copied link
// stops working almost immediately instead of for the rest of the session.
//
// Delegated (one listener, capture phase) rather than touching each
// driveLink() call site — every one of them renders a plain <a href>.
// Scoped tightly to anchors whose href already points at the driveFile
// proxy, so it never intercepts any other link in the app.
let _fileTokenCache = null; // { token, mintedAt }
async function ensureFileToken() {
  // Reuse a just-minted token for a burst of clicks (e.g. opening several
  // documents from a search results table in a row) — refresh with margin
  // well before the server-side ~120s expiry rather than cutting it close.
  if (_fileTokenCache && (Date.now() - _fileTokenCache.mintedAt) < 60000) {
    return _fileTokenCache.token;
  }
  const data = await apFetch({ action: "mintFileToken" });
  if (!data.success) throw new Error(data.error || "Could not open document.");
  _fileTokenCache = { token: data.fileToken, mintedAt: Date.now() };
  return data.fileToken;
}

document.addEventListener("click", async (e) => {
  const a = e.target.closest && e.target.closest('a[href*="/api/driveFile/"]');
  if (!a) return;
  e.preventDefault();
  // Open the tab synchronously, before the await, so popup blockers (which
  // key off "was this triggered directly by a user gesture") don't eat it
  // — then point it at the real URL once the token is minted.
  const w = window.open('', '_blank');
  try {
    const ft = await ensureFileToken();
    const href = a.href + (a.href.includes("?") ? "&" : "?") + "ft=" + encodeURIComponent(ft);
    if (w) w.location = href; else window.open(href, '_blank');
  } catch (err) {
    if (w) w.close();
    alert("Could not open document: " + err.message);
  }
}, true);

async function apFetch(payload) {
  payload.sessionToken = localStorage.getItem("erpSessionToken");
  const res  = await fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) });
  const data = await res.json();
  if (!data.success && data.code === "SESSION_EXPIRED") {
    clearAppLocalStorageKeepingDeviceKeys({ keepDrafts: true });
    document.getElementById("app-container").style.display   = "none";
    document.getElementById("auth-container").style.display  = "flex";
    const authCard = document.querySelector(".auth-card");
    if (authCard) {
      const msg = document.createElement("div");
      msg.style.cssText = "background:#fff3cd; border:1px solid #ffc107; color:#856404; padding:10px 14px; border-radius:6px; font-size:0.85rem; font-weight:700; margin-bottom:16px; text-align:center;";
      msg.textContent   = "Your session has expired. Please log in again.";
      authCard.insertBefore(msg, authCard.firstChild);
      setTimeout(() => msg.remove(), 6000);
    }
    initializeLoginScreen();
    throw new Error("SESSION_EXPIRED");
  }
  return data;
}

// ── Global error boundary (same shape as Portal's) ─────────────────────
window.onerror = function(message, source, lineno, colno, error) {
  if (message === "SESSION_EXPIRED" || (error && error.message === "SESSION_EXPIRED")) return true;
  console.error("Uncaught error:", message, "at", source, lineno);
  if (!message.includes("fetch") && !message.includes("network")) {
    const appContainer = document.getElementById("app-container");
    if (appContainer && appContainer.style.display !== "none") {
      const banner = document.createElement("div");
      banner.style.cssText = "position:fixed; top:60px; left:50%; transform:translateX(-50%); background:#fee2e2; border:1px solid #fca5a5; color:#b91c1c; padding:10px 20px; border-radius:6px; font-size:0.85rem; font-weight:700; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.1);";
      banner.textContent   = "Something went wrong. Please refresh the page if this keeps happening.";
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 5000);
    }
  }
  return false;
};

window.addEventListener("unhandledrejection", function(event) {
  if (event.reason && event.reason.message === "SESSION_EXPIRED") return;
  console.error("Unhandled Promise rejection:", event.reason);
  const appContainer = document.getElementById("app-container");
  if (appContainer && appContainer.style.display !== "none") {
    const banner = document.createElement("div");
    banner.style.cssText = "position:fixed; top:60px; left:50%; transform:translateX(-50%); background:#fee2e2; border:1px solid #fca5a5; color:#b91c1c; padding:10px 20px; border-radius:6px; font-size:0.85rem; font-weight:700; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.1);";
    banner.textContent = "Network error. Please check your connection and try again.";
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 5000);
  }
});

// ── Session bootstrap globals ───────────────────────────────────────────
let globalPersonnelKeyLookupCache = [];
let appActiveOperatorIdentityString = "";
// Only the camelCase keys erp-backend/lib/permMap.js actually sends —
// see mapPermissionsForFrontend there. Nothing else exists on this object.
// Marketing keys added 15 Sep 2026 (frontend port) — same camelCase names
// Portal's own userPermissions object uses for these (cardDetails,
// searchCompany, etc.); erp-backend/lib/permMap.js's own port must send the
// identical names or every one of these checks silently reads false.
let userPermissions = {
  itemCodeAccess: false, tourExpense: false, cashExpenses: false, travelTickets: false,
  viewAccountsDashboard: false, securityLoginAccess: false,
  cardDetails: false, searchCompany: false, emailLeads: false, meetingPreparation: false,
  purchaseOrder: false, commissioningReport: false, searchTasks: false, searchStatus: false,
  searchQualification: false, searchCityState: false, marketingDashboard: false,
};

window.scrollTo(0, 0);
document.documentElement.scrollTop = 0;
document.body.scrollTop = 0;
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

window.onload = async function() {
  window.scrollTo(0, 0);
  const token   = localStorage.getItem("erpSessionToken");
  const expires = localStorage.getItem("erpSessionExpiry");
  const cachedOperator = localStorage.getItem("erpActiveOperatorSignature");

  // Email Leads in-memory cache bootstrap (15 Sep 2026, Marketing port) —
  // mirrors Portal's own window.onload restore of cachedInboundEmailLeadsArray
  // from abps_active_email_leads_cache. cachedInboundEmailLeadsArray itself
  // is declared in marketing/email-processing.js, which (being a plain
  // <script>, no bundler) has already run its top-level `let` by the time
  // this onload handler executes, so assigning to it here is safe.
  if (localStorage.getItem("erpActiveEmailLeadsCache")) {
    try {
      cachedInboundEmailLeadsArray = JSON.parse(localStorage.getItem("erpActiveEmailLeadsCache"));
    } catch (e) { cachedInboundEmailLeadsArray = []; }
  }

  if (token && expires && new Date() < new Date(expires) && cachedOperator) {
    // ★ CHANGED 17 Sep 2026 — this block used to trust the permissions
    // cached in localStorage at login time, with a comment saying
    // "erp-backend doesn't have getSessionPermissions yet". That comment
    // was stale: the route was ported in Batch 6 (routes/utility.js) and
    // returns the same shape Portal's does, including isAdmin/
    // isSuperAdmin/department/productionSubDept. Now matching Portal's own
    // D1 rule — ALWAYS fetch permissions fresh from the server on every
    // page load, never trust localStorage — which is what makes a
    // mid-session permission revocation (and a department / Production
    // sub-department change) actually take effect on the next reload
    // instead of surviving until a fresh login.
    appActiveOperatorIdentityString = cachedOperator;
    try {
      const permData = await apFetch({ action: "getSessionPermissions" });
      if (permData.success) {
        userPermissions = permData.permissions;
        // Refresh localStorage with the server's authoritative copy.
        localStorage.setItem("erpUserPermissions", JSON.stringify(userPermissions));
        applyServerRoleFlags(permData);
        showAppView();
      } else {
        clearAppLocalStorageKeepingDeviceKeys({ keepDrafts: true });
        syncPlatformPersonnelDropdownOptionsList();
        initializeLoginScreen();
      }
    } catch (e) {
      if (e.message === "SESSION_EXPIRED") return; // apFetch already handled redirect + clear
      clearAppLocalStorageKeepingDeviceKeys({ keepDrafts: true });
      syncPlatformPersonnelDropdownOptionsList();
      initializeLoginScreen();
    }
  } else {
    clearAppLocalStorageKeepingDeviceKeys({ keepDrafts: true });
    syncPlatformPersonnelDropdownOptionsList();
    initializeLoginScreen();
  }
};

// ── Unauthenticated department/personnel directory (login screen dropdowns) ──
async function syncPlatformPersonnelDropdownOptionsList() {
  const deptSelect = document.getElementById("app-auth-active-department-identity");
  const nameSelect = document.getElementById("app-auth-active-engineer-identity");
  if (!deptSelect || !nameSelect) return;

  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "pullGlobalPersonnelDirectory" })
    });
    const data = await res.json();

    if (data.success && data.departmentsList && data.personnelTree) {
      globalPersonnelKeyLookupCache = data.people || [];
      window._personnelTree = data.personnelTree;

      deptSelect.innerHTML = '<option value="">— Select Department —</option>';
      data.departmentsList.forEach(deptName => {
        const opt = document.createElement("option");
        opt.value = deptName;
        opt.textContent = deptName;
        deptSelect.appendChild(opt);
      });

      nameSelect.innerHTML = '<option value="">— Choose Department First —</option>';
      nameSelect.disabled = true;
      // Reset the pyramid buttons' visual state to match the reset above —
      // rebuilding deptSelect's <option>s resets its .value to "", but
      // nothing previously touched the buttons' own .active class, so a
      // department clicked before an earlier logout stayed visually
      // highlighted (and Name stayed correctly blank) even though nothing
      // was actually selected any more (found 10 Sep 2026, same bug as
      // Portal's abps-frontend/shared/apFetch.js).
      document.querySelectorAll(".login-dept-btn").forEach(btn => btn.classList.remove("active"));

      // Restore this device's remembered Department + Name — see
      // completeSuccessfulLogin's own comment. erpRememberedLoginDept/Name
      // are NOT in ERP_LOCAL_STORAGE_KEYS, so clearAppLocalStorageKeepingDeviceKeys
      // never wipes them, same treatment as erpAbpsPcDeviceSecret.
      const rememberedDept = localStorage.getItem("erpRememberedLoginDept");
      const rememberedName = localStorage.getItem("erpRememberedLoginName");
      if (rememberedDept && data.departmentsList.includes(rememberedDept)) {
        selectLoginDeptButton(rememberedDept);
        const names = (window._personnelTree && window._personnelTree[rememberedDept]) || [];
        if (rememberedName && names.includes(rememberedName)) nameSelect.value = rememberedName;
      }
    } else {
      deptSelect.innerHTML = '<option value="">Error syncing department parameters</option>';
    }
  } catch (error) {
    console.error("Directory synchronization exception dropped:", error);
    deptSelect.innerHTML = '<option value="">Network connection drop</option>';
  }
}

function handleLoginDepartmentSelectionChange(department) {
  const nameSelect = document.getElementById("app-auth-active-engineer-identity");
  if (!nameSelect) return;
  const names = (window._personnelTree && window._personnelTree[department]) || [];
  nameSelect.innerHTML = '<option value="">— Select Name —</option>';
  names.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name; opt.textContent = name;
    nameSelect.appendChild(opt);
  });
  nameSelect.disabled = names.length === 0;
}

// initializeLoginScreen — ERP's replacement for Portal's
// initializeGoogleAuthPlatformEngine(). PIN-only: no Google Identity
// Services to initialize, no button to mount — just resets the
// Department/Name dropdowns and the PIN input to a fresh state.
function initializeLoginScreen() {
  document.getElementById("auth-container").style.display = "flex";
  document.getElementById("app-container").style.display = "none";
  if (typeof renderPinLoginUiForThisDevice === "function") renderPinLoginUiForThisDevice();
  // Google Sign-In restored as a 3rd mode (1 Sep 2026, shared/googleLogin.js)
  // — mount/re-mount the button on every login-screen show, same as
  // Portal's initializeGoogleAuthPlatformEngine does.
  if (typeof initializeGoogleSignInButton === "function") initializeGoogleSignInButton();
}

// completeSuccessfulLogin — shared tail end of both login paths.
// isUserAdminGlobal comes straight from the server's real perm_admin flag
// (data.isAdmin). isUserSuperAdminGlobal (17 Sep 2026, super-admin tier,
// ported from Portal) comes straight from data.isSuperAdmin the same way
// — optional 4th param so an older caller that hasn't been updated still
// works (treated as false, never super admin, the safe default).
function completeSuccessfulLogin(data, activeOperatorDisplayName, isUserAdminGlobal, isUserSuperAdminGlobal) {
  // Remember Department + Name for next time on this device (10 Sep 2026)
  // — read the login screen's own DOM before showAppView() below swaps it
  // away. Saved on real success only, not on every click, so a wrong
  // Department/Name never gets remembered. Deliberately unprefixed-list
  // (erpRememberedLoginDept/Name are not in ERP_LOCAL_STORAGE_KEYS) so
  // they survive clearAppLocalStorageKeepingDeviceKeys the same way
  // erpAbpsPcDeviceSecret/erpDeviceToken already do.
  const deptAtLogin = document.getElementById("app-auth-active-department-identity")?.value;
  if (deptAtLogin) localStorage.setItem("erpRememberedLoginDept", deptAtLogin);
  if (activeOperatorDisplayName) localStorage.setItem("erpRememberedLoginName", activeOperatorDisplayName);
  localStorage.setItem("erpSessionToken",  data.sessionToken);
  localStorage.setItem("erpSessionExpiry", data.expires);
  localStorage.setItem("erpSessionUser",   data.personKey);
  localStorage.setItem("erpUserFirstName", data.firstName);
  localStorage.setItem("erpUserLastName",  data.lastName);
  localStorage.setItem("erpActiveOperatorSignature", activeOperatorDisplayName);
  localStorage.setItem("erpUserPermissions", JSON.stringify(data.permissions));
  localStorage.setItem("erpIsUserAdminGlobal", isUserAdminGlobal ? "true" : "false");
  localStorage.setItem("erpIsUserSuperAdminGlobal", isUserSuperAdminGlobal ? "true" : "false");
  // erpUserDepartment / erpUserProductionSubDept (Batch 7, 16 Sep 2026) —
  // the authoritative, server-computed values off the login response, used
  // by Production Planning's pplanCanWriteLane to mirror the server's own
  // write gate so a user is never shown a control the server will refuse.
  // ★ UPDATED 17 Sep 2026 — this comment used to say "ERP has no such
  // route yet, so these are login-time only and go stale". That is no
  // longer true: getSessionPermissions exists (routes/utility.js, Batch 6)
  // and window.onload now calls applyServerRoleFlags on EVERY page load,
  // so these four flags self-correct on the next reload rather than
  // surviving a department change until a fresh login (Portal's 4 Sep 2026
  // staleness bug). The login response's own values are still written
  // here, so the very first render after login has them immediately.
  localStorage.setItem("erpUserDepartment", data.department || "");
  localStorage.setItem("erpUserProductionSubDept", (data.productionSubDept || []).join(","));
  appActiveOperatorIdentityString = activeOperatorDisplayName;
  userPermissions = data.permissions;
  showAppView();
  // Fire-and-forget, deliberately NOT awaited — showAppView() must not be
  // delayed by a second round trip. Re-derives the same four flags from
  // the server's authoritative getSessionPermissions response, which also
  // applies the device-restriction mask; until it resolves the values
  // written above (from the login response, already masked the same way)
  // are in place, so there is no window where they are unset.
  refreshServerRoleFlags();
}

function executeLogout() {
  const outgoingSessionToken = localStorage.getItem("erpSessionToken");
  if (outgoingSessionToken) {
    fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "logout", sessionToken: outgoingSessionToken }),
    }).catch(e => console.warn("Server-side logout call failed (session will still expire naturally):", e.message));
  }

  clearAppLocalStorageKeepingDeviceKeys();
  appActiveOperatorIdentityString = "";
  document.getElementById("app-container").style.display = "none";
  syncPlatformPersonnelDropdownOptionsList();
  initializeLoginScreen();
}

async function showAppView() {
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("app-container").style.display = "block";
  document.getElementById("dashboard-view").style.display = "flex";
  document.getElementById("module-workspace-container").style.display = "none";
  // Same sweep Portal added 29 Aug 2026 for its own top-level full-screen
  // canvas panels — a panel left open from before a same-tab logout/login
  // must never still be showing after a fresh login.
  document.querySelectorAll(".workspace-panel").forEach(p => { p.style.display = "none"; });

  document.getElementById("display-full-name").textContent =
    (localStorage.getItem("erpUserFirstName") || "") + " " + (localStorage.getItem("erpUserLastName") || "");

  if (!userPermissions || Object.keys(userPermissions).length === 0) {
    console.error("showAppView: userPermissions is empty — every section will render hidden.", userPermissions);
  }
  enforceDynamicModuleRoleGateways(userPermissions || {});
  // cachedEngineers (marketing/leads.js) was never populated anywhere in
  // ERP — the backend's getEngineers route existed but nothing called it,
  // so every consumer (Search Leads/Tasks by Engineer filter pills, the
  // Upload PO Owner of Order dropdown, the Section-5 self-lock check) sat
  // permanently empty. Fire-and-forget, same convention as
  // refreshServerRoleFlags() above — must not delay showAppView().
  if (typeof apFetch === "function") {
    apFetch({ action: "getEngineers" }).then(d => {
      if (d && d.success && Array.isArray(d.engineers)) cachedEngineers = d.engineers;
    }).catch(() => { /* non-fatal — dependent dropdowns just stay empty */ });
  }
}

// ── Stale-but-usable reference data (ported from Portal's shared/apFetch.js,
// 15 Sep 2026, for the Marketing port — leads.js's Search by City/State
// screen calls this) ────────────────────────────────────────────────────
// Dropdown/catalog sources are near-static and are re-fetched on every page
// load; this keeps the last good response and serves it if the network is
// down, so a dropdown never renders empty during an outage. See Portal's
// own copy of this comment for the full "what must never go through this"
// list (permissions, anything a write is keyed on, live queues) — the same
// rules apply here.
const ERP_STALE_PREFIX = "erpStale:";
const ERP_STALE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function erpStaleCacheKey(payload) {
  const { action, sessionToken, ...rest } = payload || {};
  const params = Object.keys(rest).sort().map(k => `${k}=${JSON.stringify(rest[k])}`).join("&");
  return ERP_STALE_PREFIX + action + (params ? "|" + params : "");
}

async function fetchWithStaleCache(payload) {
  const key = erpStaleCacheKey(payload);
  try {
    const data = await apFetch(payload);
    if (data && data.success) {
      try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (_) { /* quota full or private mode — best-effort */ }
    }
    return data;
  } catch (err) {
    if (err && err.message === "SESSION_EXPIRED") throw err;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { cached = null; }
    if (!cached || !cached.data || (Date.now() - cached.ts) > ERP_STALE_MAX_AGE_MS) throw err;
    return { ...cached.data, __stale: true, __syncedAt: cached.ts };
  }
}

// ── Search by Company Name typeahead (ported from Portal's shared/apFetch.js,
// 15 Sep 2026, for the Marketing port) — a type-to-search text input rather
// than a <select>, since the company list runs into the hundreds. The
// suggestion list is a single shared element appended straight to <body>
// with position:fixed, positioned via the input's own getBoundingClientRect
// on every keystroke, so it isn't clipped by any overflow:hidden ancestor.
// Generalized with default args (matching Portal) so Meeting Preparation's
// own company picker can reuse this with a different inputId/ddId pair.
async function triggerCompanyDropdownArrayFetch() {
  try {
    const d = await fetchWithStaleCache({
      action: "getUniqueCompaniesList",
      activeEngineer: appActiveOperatorIdentityString
    });
    if (d.success) window.cachedCompanySearchList = d.companies || [];
  } catch (e) { console.error("Company list refresh failed:", e.message); }
}

function ensureCompanySearchDropdownEl(ddId = "lookup-module-company-dropdown-suggestions") {
  let dd = document.getElementById(ddId);
  if (!dd) {
    dd = document.createElement("div");
    dd.id = ddId;
    dd.className = "company-typeahead-dd";
    dd.style.cssText = "display:none; position:fixed; background:#fff; border:1.5px solid var(--brand); border-radius:4px; z-index:9999; max-height:240px; overflow-y:auto; box-shadow:0 6px 16px rgba(0,0,0,0.15);";
    document.body.appendChild(dd);
  }
  return dd;
}

function handleCompanySearchTypeaheadInput(query, inputId = "lookup-module-company-dropdown", ddId = "lookup-module-company-dropdown-suggestions") {
  const dd = ensureCompanySearchDropdownEl(ddId);
  dd.dataset.inputId = inputId;
  if (!query || query.trim().length < 1) { dd.style.display = "none"; return; }
  const q = query.trim().toLowerCase();
  const matches = (window.cachedCompanySearchList || [])
    .filter(item => (item.displayLabel || "").toLowerCase().includes(q) || (item.companyValue || "").toLowerCase().includes(q))
    .slice(0, 10);
  if (matches.length === 0) { dd.style.display = "none"; return; }
  dd.innerHTML = matches.map(item => `
    <div onmousedown="event.preventDefault(); selectCompanySearchTypeahead('${item.companyValue.replace(/'/g, "\\'")}', '${inputId}', '${ddId}')"
      style="padding:9px 12px; cursor:pointer; font-size:0.88rem; border-bottom:1px solid var(--border);"
      onmouseover="this.style.background='var(--highlight-bg)'" onmouseout="this.style.background=''">${escapeHtml(item.displayLabel)}</div>
  `).join("");
  const input = document.getElementById(inputId);
  const rect = input.getBoundingClientRect();
  dd.style.top = rect.bottom + "px";
  dd.style.left = rect.left + "px";
  dd.style.width = rect.width + "px";
  dd.style.display = "block";
}

function selectCompanySearchTypeahead(companyValue, inputId = "lookup-module-company-dropdown", ddId = "lookup-module-company-dropdown-suggestions") {
  const input = document.getElementById(inputId);
  if (input) input.value = companyValue;
  const dd = document.getElementById(ddId);
  if (dd) dd.style.display = "none";
  if (typeof window.onCompanySearchTypeaheadSelect === "function" && ddId !== "lookup-module-company-dropdown-suggestions") {
    window.onCompanySearchTypeaheadSelect(companyValue, inputId, ddId);
  }
}

// Department selection no longer drives a "Prepared By" picker -- that
// field was removed (Prepared By is now silently set to the logged-in
// operator's name at submit time, not chosen from a select). This
// handler is now a no-op, kept only because the <select> in index.html
// still has onchange="handleCBOQDepartmentChange(this.value)" wired to
// it. It used to reach into #cboq-prepared-by directly with no
// null-check, which threw on every Department change once that element
// was removed -- surfaced to users as a misleading "Network error"
// banner via the global unhandledrejection handler.
function handleCBOQDepartmentChange(department) {
  // Intentionally empty.
}

document.addEventListener("click", (e) => {
  document.querySelectorAll(".company-typeahead-dd").forEach((dd) => {
    const inputId = dd.dataset.inputId || "lookup-module-company-dropdown";
    if (!e.target.closest(`#${inputId}`) && !e.target.closest(`#${dd.id}`)) {
      dd.style.display = "none";
    }
  });
});

// Ported from Portal's shared/apFetch.js for the Marketing port — Search by
// Type of Customer's "Other Types of Customer" sub-drawer.
async function loadQualFilter() {
  const container = document.getElementById("qual-filter-checkboxes");
  if (!container) return;

  container.innerHTML = '<p style="font-size:0.75rem; color:var(--brand); font-weight:600; margin:0; display:flex; align-items:center; gap:6px;"><span class="spinner" style="display:inline-block; width:10px; height:10px; border:2px solid var(--border); border-top-color:var(--brand); border-radius:50%; animation:spin 0.8s linear infinite;"></span> Loading Other Types of Customer...</p>';

  try {
    const data = await fetchWithStaleCache({
      action: "getUniqueQualifications",
      activeEngineer: appActiveOperatorIdentityString
    });
    if (data.success) {
      // Baseline core options to strip from the 'Others' sub-drawer completely
      const baselineCoreQualifications = [
        "industry", "epc", "govt/psu", "consultant",
        "developer", "electrical contractor", "dealer", "vendor"
      ];

      // Use a local Set to deduplicate raw text values coming from rows
      let uniqueCustomQualsSet = new Set();
      data.quals.forEach(q => {
        let cleanQual = q.toString().trim();
        if (!cleanQual) return;

        if (baselineCoreQualifications.indexOf(cleanQual.toLowerCase()) === -1) {
          uniqueCustomQualsSet.add(cleanQual);
        }
      });

      // CRITICAL OVERWRITE FIX: Empty the container right before rendering
      // This stops multiple navigateToModule clicks from stacking copies back-to-back!
      container.innerHTML = "";
      let customOptionsCount = 0;

      uniqueCustomQualsSet.forEach(cleanQual => {
        const cleanId = "custom_q_" + cleanQual.replace(/\s+/g, '_');

        container.innerHTML += `
          <input type="checkbox" name="searchQual" value="${cleanQual}" id="${cleanId}" onchange="updateSelectedDisplay()">
          <label for="${cleanId}">${cleanQual}</label>
        `;
        customOptionsCount++;
      });

      if (customOptionsCount === 0) {
        container.innerHTML = '<p style="font-size:0.75rem; color:var(--muted); font-weight:600; padding:4px 0;">No unlisted custom Type of Customer yet.</p>';
      }
    }
  } catch(e) { console.error("Custom Types of Customer load failed:", e.message); }
}
