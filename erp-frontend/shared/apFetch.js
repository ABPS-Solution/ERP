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
  // erpActiveEmailLeadsCache (15 Sep 2026, Marketing port) — Portal's own
  // equivalent key (abps_active_email_leads_cache) is wiped on every full
  // localStorage.clear() there too (session-expiry / logout), so this is
  // cleared on the same paths, not preserved like a device secret.
  "erpActiveEmailLeadsCache",
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
function clearAppLocalStorageKeepingDeviceKeys() {
  const pcDeviceSecret = localStorage.getItem("erpAbpsPcDeviceSecret");
  // erpDeviceToken (1 Sep 2026, Google Sign-In restored as a 3rd login
  // mode) — the location-restricted-login device-trust token, same
  // preserved-across-logout treatment Portal gives its own abpsDeviceToken.
  const googleDeviceToken = localStorage.getItem("erpDeviceToken");
  ERP_LOCAL_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
  if (pcDeviceSecret) localStorage.setItem("erpAbpsPcDeviceSecret", pcDeviceSecret);
  if (googleDeviceToken) localStorage.setItem("erpDeviceToken", googleDeviceToken);
}

// driveLink — kept for parity with Portal's convention even though no
// ERP screen serves a Drive-backed document link yet; any future Item
// Code / Accounts doc link should route through this the same way Portal
// does, rather than a bare Drive URL.
function driveLink(url) {
  if (!url) return url;
  const token = localStorage.getItem("erpSessionToken") || "";
  return url + (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
}

async function apFetch(payload) {
  payload.sessionToken = localStorage.getItem("erpSessionToken");
  const res  = await fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) });
  const data = await res.json();
  if (!data.success && data.code === "SESSION_EXPIRED") {
    clearAppLocalStorageKeepingDeviceKeys();
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
    // Portal re-fetches permissions fresh from the server on every load
    // (its getSessionPermissions route) rather than trusting localStorage.
    // erp-backend doesn't have that route yet (no feature routers are
    // mounted — see server.js's own comment), so for now this trusts the
    // permissions cached at login time. Re-check this once
    // getSessionPermissions (or equivalent) exists on the ERP backend —
    // a permission revoked mid-session won't take effect here until the
    // next fresh login.
    appActiveOperatorIdentityString = cachedOperator;
    const savedPerms = localStorage.getItem("erpUserPermissions");
    if (savedPerms) {
      try { userPermissions = JSON.parse(savedPerms); } catch (e) { userPermissions = {}; }
      showAppView();
    } else {
      clearAppLocalStorageKeepingDeviceKeys();
      syncPlatformPersonnelDropdownOptionsList();
      initializeLoginScreen();
    }
  } else {
    clearAppLocalStorageKeepingDeviceKeys();
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

// completeSuccessfulLogin — shared tail end of pinLogin (the only login
// path). isUserAdminGlobal comes straight from the server's real
// perm_admin flag (data.isAdmin).
function completeSuccessfulLogin(data, activeOperatorDisplayName, isUserAdminGlobal) {
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
  appActiveOperatorIdentityString = activeOperatorDisplayName;
  userPermissions = data.permissions;
  showAppView();
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
