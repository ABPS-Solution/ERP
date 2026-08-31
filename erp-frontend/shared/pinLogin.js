// shared/pinLogin.js — ported from ABPS Portal's shared/pinLogin.js
// (31 Aug 2026, revised 1 Sep 2026 to restore Enrollment Code mode).
// PIN + Enrollment Code only — Google Sign-In stays a confirmed exclusion,
// there's no login-mode-btn-google here at all (Portal keeps its own
// hidden pending a separate decision). erp-backend/auth.js's pinLogin and
// redeemDeviceEnrollmentCode routes are already faithful ports of
// Portal's, so this file needed only one real adaptation: Portal derived
// the admin flag from `data.permissions.admin` (a field ERP's permission
// object doesn't carry — see lib/permMap.js's deliberately small
// camelCase list); ERP's pinLogin response instead returns a top-level
// `isAdmin` flag directly, so that's what completeSuccessfulLogin() is
// handed here.

let activeLoginMode = null;

// Called from initializeLoginScreen() (shared/apFetch.js) every time the
// login screen is (re)shown, so the default mode always reflects this
// browser's current enrollment state.
function renderPinLoginUiForThisDevice() {
  const hasDevice = !!localStorage.getItem("erpAbpsPcDeviceSecret");
  selectLoginMode(hasDevice ? 'pin' : 'enroll');
}

function selectLoginMode(mode) {
  activeLoginMode = mode;

  ['pin', 'enroll'].forEach(m => {
    const btn = document.getElementById(`login-mode-btn-${m}`);
    if (btn) {
      btn.style.background = (m === mode) ? 'var(--brand)' : '#e2e8f0';
      btn.style.color = (m === mode) ? '#fff' : '#334155';
    }
    const section = document.getElementById(`login-section-${m}`);
    if (section) section.style.display = (m === mode) ? 'block' : 'none';
  });

  if (mode === 'pin') {
    const hasDevice = !!localStorage.getItem("erpAbpsPcDeviceSecret");
    document.getElementById('pin-login-not-registered-notice').style.display = hasDevice ? 'none' : 'block';
    document.getElementById('pin-login-input-wrap').style.display = hasDevice ? 'flex' : 'none';
    const pinInput = document.getElementById('pin-login-pin-input');
    // .disabled is left `true` after a SUCCESSFUL login (submitPinLoginAttempt
    // only ever re-enables it on failure, since success normally navigates
    // away) — logging back out without a full page refresh re-showed this
    // same input still disabled, with no way to type into it. Always reset
    // it here so re-entering PIN mode never inherits a stale disabled state.
    if (pinInput) { pinInput.value = ''; pinInput.disabled = false; if (hasDevice) pinInput.focus(); }
    const feedback = document.getElementById('pin-login-feedback');
    if (feedback) feedback.style.display = 'none';
  }
}

// selectLoginDeptButton — the pyramid department buttons in index.html
// (31 Aug 2026, replacing the plain <select>) call this instead of
// relying on a native <select> onchange. The hidden <select> itself
// stays the actual source of truth every other read site
// (shared/apFetch.js's handleLoginDepartmentSelectionChange, and this
// file's own submit functions) already reads .value from — setting it
// here and firing the existing onchange handler keeps every one of
// those call sites correct with zero changes needed there.
function selectLoginDeptButton(deptName) {
  const select = document.getElementById("app-auth-active-department-identity");
  if (select) {
    select.value = deptName;
    handleLoginDepartmentSelectionChange(deptName);
  }
  document.querySelectorAll(".login-dept-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.dept === deptName);
  });
}

// Auto-submits the instant a valid 4-digit PIN has been typed — no
// separate "Log In" button.
function handlePinDigitInput() {
  const pinInput = document.getElementById('pin-login-pin-input');
  const digitsOnly = pinInput.value.replace(/\D/g, '').slice(0, 4);
  if (pinInput.value !== digitsOnly) pinInput.value = digitsOnly;
  if (digitsOnly.length === 4) submitPinLoginAttempt();
}

async function submitPinLoginAttempt() {
  const engineerSelect = document.getElementById("app-auth-active-engineer-identity");
  const pinInput = document.getElementById("pin-login-pin-input");
  const feedback = document.getElementById("pin-login-feedback");
  const deviceSecret = localStorage.getItem("erpAbpsPcDeviceSecret");

  const showFeedback = (msg, isError) => {
    if (!feedback) return;
    feedback.style.display = "block";
    feedback.style.color = isError ? "var(--warn)" : "var(--accent)";
    feedback.textContent = msg;
  };

  const selectedName = engineerSelect ? engineerSelect.value : '';
  const email = resolveEmailForSelectedEngineerName(selectedName);

  if (!selectedName) return showFeedback("Select your name first.", true);
  if (!email) return showFeedback("Could not resolve an account for that name. Contact your administrator.", true);
  const pin = pinInput.value.trim();
  if (!/^\d{4}$/.test(pin)) return showFeedback("Enter your 4-digit PIN.", true);
  if (!deviceSecret) return showFeedback("This device is not set up for PIN login. Contact your administrator.", true);

  pinInput.disabled = true;
  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "pinLogin", deviceSecret, email, pin }),
    });
    const data = await res.json();

    if (data.success) {
      completeSuccessfulLogin(data, selectedName, !!data.isAdmin);
    } else {
      showFeedback(data.error || "Login failed.", true);
      pinInput.value = "";
      pinInput.disabled = false;
      pinInput.focus();
    }
  } catch (e) {
    showFeedback("Connection error: " + e.message, true);
    pinInput.disabled = false;
  }
}

// The login screen's Name dropdown is populated with DISPLAY NAMES only
// (handleLoginDepartmentSelectionChange, shared/apFetch.js) — PIN login
// needs the actual email. globalPersonnelEmailLookupCache (shared/apFetch.js)
// is the directory response's flat {department, name, email} list. Matched
// on department AND name together, not name alone, since two people in
// different departments could share a display name.
function resolveEmailForSelectedEngineerName(name) {
  if (!name) return null;
  const dept = document.getElementById("app-auth-active-department-identity")?.value || '';
  const hit = globalPersonnelEmailLookupCache.find(p => p.name === name && p.department === dept);
  return hit ? hit.email : null;
}

// submitDeviceEnrollmentCode — ported from Portal, unauthenticated (raw
// fetch to GAS_URL, same as submitPinLoginAttempt above — apFetch attaches
// a sessionToken this screen doesn't have yet). Response shape confirmed
// against erp-backend/auth.js's redeemDeviceEnrollmentCode:
// { success, deviceSecret, deviceLabel }.
async function submitDeviceEnrollmentCode() {
  const engineerSelect = document.getElementById("app-auth-active-engineer-identity");
  const codeInput = document.getElementById("device-enrollment-code-input");
  const labelInput = document.getElementById("device-enrollment-label-input");
  const pinInput = document.getElementById("device-enrollment-pin-input");
  const pinConfirmInput = document.getElementById("device-enrollment-pin-confirm-input");
  const feedback = document.getElementById("device-enrollment-feedback");

  const showFeedback = (msg, isError) => {
    if (!feedback) return;
    feedback.style.display = "block";
    feedback.style.color = isError ? "var(--warn)" : "var(--accent)";
    feedback.textContent = msg;
  };

  const selectedName = engineerSelect ? engineerSelect.value : '';
  if (!selectedName) return showFeedback("Select your name first.", true);
  const email = resolveEmailForSelectedEngineerName(selectedName);
  if (!email) return showFeedback("Could not resolve an account for that name. Contact your administrator.", true);
  const code = (codeInput.value || "").trim().toUpperCase();
  const deviceLabel = (labelInput.value || "").trim();
  const pin = pinInput.value.trim();
  const pinConfirm = pinConfirmInput.value.trim();

  if (!code) return showFeedback("Enter the enrollment code.", true);
  if (!deviceLabel) return showFeedback("Give this device a label (e.g. \"My Laptop\").", true);
  if (!/^\d{4}$/.test(pin)) return showFeedback("Choose a 4-digit PIN.", true);
  if (pin !== pinConfirm) return showFeedback("PIN and Confirm PIN don't match.", true);

  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "redeemDeviceEnrollmentCode", code, email, deviceLabel, pin }),
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem("erpAbpsPcDeviceSecret", data.deviceSecret);
      showFeedback(`✅ This device is set up as "${data.deviceLabel}". Reloading...`, false);
      setTimeout(() => window.location.reload(), 1200);
    } else {
      showFeedback(data.error || "Enrollment failed.", true);
    }
  } catch (e) {
    showFeedback("Connection error: " + e.message, true);
  }
}
