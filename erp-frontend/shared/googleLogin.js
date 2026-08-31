// shared/googleLogin.js — ERP's 3rd login mode (1 Sep 2026), restoring
// Google Sign-In after it was dropped earlier in this session for the
// initial PIN-only build. Ported from ABPS Portal's marketing/leads.js
// (initializeGoogleAuthPlatformEngine / handleGooglePlatformCredentialResponse)
// + shared/apFetch.js (the googleLogin fetch call itself) — kept as its own
// small file rather than folded into apFetch.js since apFetch.js is already
// sizeable and this is a self-contained concern, same reasoning
// shared/pinLogin.js already used for PIN/Enrollment Code.
//
// GOOGLE_CLIENT_ID reuses Portal's literal client ID on purpose, not just as
// a fallback guess — Google OAuth "Authorized JavaScript origins" are
// registered per ORIGIN, not per path, and apFetch.js's own header comment
// already establishes that Portal (abps-solution.github.io/Portal/) and ERP
// (abps-solution.github.io/ERP/) are the SAME origin. The same Web
// Application OAuth client that already has this origin authorized works
// for both apps unchanged. If ERP is ever moved to a different origin, this
// constant (and the Google Cloud Console's authorized-origins list) would
// need updating together.
const GOOGLE_CLIENT_ID = "223982503901-jij5hbl0npjmbqnsgl352pvmq4sk75nt.apps.googleusercontent.com";

// initializeGoogleSignInButton — called once per login-screen show
// (shared/apFetch.js's initializeLoginScreen), same as Portal calls its own
// google.accounts.id.renderButton on every initializeGoogleAuthPlatformEngine
// pass. The mount node is destroyed and recreated each time to avoid stale
// cached event listeners on mobile (same fix Portal's own comment documents).
function initializeGoogleSignInButton() {
  setTimeout(() => {
    const mountNode = document.getElementById("google-auth-button-mount-point");
    if (!mountNode || typeof google === "undefined" || !google.accounts) return;

    const parentContainer = mountNode.parentNode;
    mountNode.remove();

    const freshMountNode = document.createElement("div");
    freshMountNode.id = "google-auth-button-mount-point";
    freshMountNode.style.cssText = "display: flex; justify-content: center; margin-top: 15px; min-height: 40px;";
    parentContainer.appendChild(freshMountNode);

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGooglePlatformCredentialResponse,
      ux_mode: "popup",
      use_fedcm_for_prompt: true
    });

    google.accounts.id.renderButton(
      freshMountNode,
      { theme: "outline", size: "large", width: "320" }
    );
  }, 250);
}

// handleGooglePlatformCredentialResponse — the callback Google Identity
// Services invokes with the signed-in user's ID token. Calls the same
// googleLogin action erp-backend/auth.js already exposes (ported by the
// parallel backend agent to match Portal's action/payload/response shape
// exactly) via a raw fetch (not apFetch — there's no session yet).
async function handleGooglePlatformCredentialResponse(response) {
  const selectedEngineer = document.getElementById("app-auth-active-engineer-identity").value;
  if (!selectedEngineer) {
    alert("Identity Verification Failed: You must select your individual Engineer Name before logging in with your Google Account credentials.");
    return;
  }

  const googleBtnMount = document.getElementById("google-auth-button-mount-point");
  const processingLoader = document.getElementById("auth-portal-processing-loader");

  if (googleBtnMount) googleBtnMount.style.display = "none";
  if (processingLoader) processingLoader.style.display = "flex";

  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "googleLogin",
        idToken: response.credential,
        requestedEngineer: selectedEngineer,
        // Same location-restricted-login device-trust token Portal replays
        // (abpsDeviceToken there) — ERP's own prefixed key, added to
        // ERP_LOCAL_STORAGE_KEYS's preserved-on-clear set in apFetch.js.
        deviceToken: localStorage.getItem("erpDeviceToken") || null,
      })
    });
    const data = await res.json();

    if (data.success) {
      if (data.deviceToken) localStorage.setItem("erpDeviceToken", data.deviceToken);
      const activeDeptRaw = document.getElementById("app-auth-active-department-identity").value || "";
      const isUserAdminGlobal = activeDeptRaw.toLowerCase().includes("admin");
      completeSuccessfulLogin(data, selectedEngineer, isUserAdminGlobal);
    } else if (data.code === "LOCATION_BLOCKED") {
      alert(data.error);
      if (googleBtnMount) googleBtnMount.style.display = "flex";
      if (processingLoader) processingLoader.style.display = "none";
    } else {
      alert("Authentication Error: " + data.error);
      if (googleBtnMount) googleBtnMount.style.display = "flex";
      if (processingLoader) processingLoader.style.display = "none";
    }
  } catch (e) {
    alert("Connection verification failure: " + e.message);
    if (googleBtnMount) googleBtnMount.style.display = "flex";
    if (processingLoader) processingLoader.style.display = "none";
  }
}
