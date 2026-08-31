// shared/pinLogin.js — ported from ABPS Portal's shared/pinLogin.js
// (31 Aug 2026), trimmed to PIN-ONLY (no Google Sign-In, no self-service
// Enrollment Code mode on the login screen — enrolling a device/PIN is
// admin-driven, via Security & Login Access, not something an end user
// self-serves from here; submitDeviceEnrollmentCode/redeemDeviceEnrollment
// Code stay live on erp-backend/auth.js for that admin-driven flow, just
// not wired to any UI here). erp-backend/auth.js's pinLogin route is
// already a faithful port of Portal's, so this file needed only one real
// adaptation: Portal derived the admin flag from `data.permissions.admin`
// (a field ERP's permission object doesn't carry — see lib/permMap.js's
// deliberately small camelCase list); ERP's pinLogin response instead
// returns a top-level `isAdmin` flag directly, so that's what
// completeSuccessfulLogin() is handed here.

// Called from initializeLoginScreen() (shared/apFetch.js) every time the
// login screen is (re)shown. Portal's version picked between PIN/Google/
// Enroll modes here — ERP has only the one PIN screen, so this just shows
// the "not registered" notice when this browser has no enrolled device yet
// (nothing to switch INTO — the operator has to be enrolled by an admin).
function renderPinLoginUiForThisDevice() {
  const hasDevice = !!localStorage.getItem("abpsPcDeviceSecret");
  document.getElementById('pin-login-not-registered-notice').style.display = hasDevice ? 'none' : 'block';
  document.getElementById('pin-login-input-wrap').style.display = hasDevice ? 'flex' : 'none';
  const pinInput = document.getElementById('pin-login-pin-input');
  // .disabled is left `true` after a SUCCESSFUL login (submitPinLoginAttempt
  // only ever re-enables it on failure, since success normally navigates
  // away) — logging back out without a full page refresh re-showed this
  // same input still disabled, with no way to type into it. Always reset
  // it here so re-entering the login screen never inherits a stale
  // disabled state.
  if (pinInput) { pinInput.value = ''; pinInput.disabled = false; if (hasDevice) pinInput.focus(); }
  const feedback = document.getElementById('pin-login-feedback');
  if (feedback) feedback.style.display = 'none';
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
  const deviceSecret = localStorage.getItem("abpsPcDeviceSecret");

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
