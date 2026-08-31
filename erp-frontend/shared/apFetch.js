// shared/apFetch.js — ERP's trimmed port of Portal's shared/apFetch.js
// (31 Aug 2026). Same calling convention (single POST /exec bridge,
// { action, ...payload, sessionToken }) and the same session-bootstrap /
// showAppView / logout shape — but stripped of every Marketing/Store/
// Design/etc-specific global and helper, since none of those screens
// exist here. Only Accounts / Add-Check Item Code / Security & Login
// Access are real sections; everything else is a placeholder panel.

const GAS_URL = "https://erp-backend-244281871074.asia-south1.run.app/exec";

// clearAppLocalStorageKeepingDeviceKeys — a bare localStorage.clear() must
// never wipe abpsPcDeviceSecret (PIN-login registered-device secret) on a
// session-expiry path. Only executeLogout() should decide whether it
// survives, and it deliberately keeps it too (logging out shouldn't
// un-enroll the device).
function clearAppLocalStorageKeepingDeviceKeys() {
  const pcDeviceSecret = localStorage.getItem("abpsPcDeviceSecret");
  localStorage.clear();
  if (pcDeviceSecret) localStorage.setItem("abpsPcDeviceSecret", pcDeviceSecret);
}

// driveLink — kept for parity with Portal's convention even though no
// ERP screen serves a Drive-backed document link yet; any future Item
// Code / Accounts doc link should route through this the same way Portal
// does, rather than a bare Drive URL.
function driveLink(url) {
  if (!url) return url;
  const token = localStorage.getItem("sessionToken") || "";
  return url + (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
}

async function apFetch(payload) {
  payload.sessionToken = localStorage.getItem("sessionToken");
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
let globalPersonnelEmailLookupCache = [];
let appActiveOperatorIdentityString = "";
// Only the 4 camelCase keys erp-backend/lib/permMap.js actually sends —
// see mapPermissionsForFrontend there. Nothing else exists on this object.
let userPermissions = { itemCodeAccess: false, tourExpense: false, cashExpenses: false, securityLoginAccess: false };

window.scrollTo(0, 0);
document.documentElement.scrollTop = 0;
document.body.scrollTop = 0;
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

window.onload = async function() {
  window.scrollTo(0, 0);
  const token   = localStorage.getItem("sessionToken");
  const expires = localStorage.getItem("sessionExpiry");
  const cachedOperator = localStorage.getItem("activeOperatorSignature");

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
    const savedPerms = localStorage.getItem("userPermissions");
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
      globalPersonnelEmailLookupCache = data.people || [];
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
}

// completeSuccessfulLogin — shared tail end of pinLogin (the only login
// path). isUserAdminGlobal comes straight from the server's real
// perm_admin flag (data.isAdmin).
function completeSuccessfulLogin(data, activeOperatorDisplayName, isUserAdminGlobal) {
  localStorage.setItem("sessionToken",  data.sessionToken);
  localStorage.setItem("sessionExpiry", data.expires);
  localStorage.setItem("sessionUser",   data.email);
  localStorage.setItem("userFirstName", data.firstName);
  localStorage.setItem("userLastName",  data.lastName);
  localStorage.setItem("activeOperatorSignature", activeOperatorDisplayName);
  localStorage.setItem("userPermissions", JSON.stringify(data.permissions));
  localStorage.setItem("isUserAdminGlobal", isUserAdminGlobal ? "true" : "false");
  appActiveOperatorIdentityString = activeOperatorDisplayName;
  userPermissions = data.permissions;
  showAppView();
}

function executeLogout() {
  const outgoingSessionToken = localStorage.getItem("sessionToken");
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
    (localStorage.getItem("userFirstName") || "") + " " + (localStorage.getItem("userLastName") || "");

  if (!userPermissions || Object.keys(userPermissions).length === 0) {
    console.error("showAppView: userPermissions is empty — every section will render hidden.", userPermissions);
  }
  enforceDynamicModuleRoleGateways(userPermissions || {});
}
