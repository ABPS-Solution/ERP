// project/security-admin.js — minimal Security & Login Access screen
// (1 Sep 2026). ONLY the "Generate Enrollment Code" admin action is
// ported here — the full 8-tab Portal screen (Permissions Matrix, Login
// Anywhere, Registered Devices, Login Log, Trusted Devices, Office
// Networks, Settings) is separate, later work. Reuses the same
// department -> name personnel-directory data the login screen's own
// dropdowns already fetch (pullGlobalPersonnelDirectory via
// syncPlatformPersonnelDropdownOptionsList, shared/apFetch.js) — this
// panel does its own small fetch of the same action rather than reaching
// into the login screen's now-hidden DOM/globals, since window._personnelTree
// is overwritten by that same login-screen sync on every logout/login.

let saEnrollPersonnelTree = null;

function initializeSecurityAdminPanel() {
  const host = document.getElementById("sa-enroll-panel");
  if (!host) return;
  host.innerHTML = `
    <div style="background:#f8fafc; border:1px solid var(--border); border-radius:var(--radius); padding:18px; max-width:420px;">
      <h3 style="font-size:1rem; font-weight:800; color:var(--brand); margin-bottom:12px;">Generate Enrollment Code</h3>
      <label class="field-label" style="margin-top:0;">Department *</label>
      <select id="sa-enroll-dept-select" onchange="handleSaEnrollDeptChange(this.value)" style="margin-bottom:10px;">
        <option value="">— Select Department —</option>
      </select>
      <label class="field-label">Name *</label>
      <select id="sa-enroll-name-select" disabled style="margin-bottom:14px;">
        <option value="">— Choose Department First —</option>
      </select>
      <button class="nav-btn-styled" onclick="submitGenerateEnrollmentCode()" style="width:100%; padding:9px;">Generate Code</button>
      <div id="sa-enroll-result" style="display:none; margin-top:16px; text-align:center; background:#fff; border:1.5px dashed var(--brand); border-radius:8px; padding:16px;">
        <div style="font-size:0.68rem; font-weight:800; text-transform:uppercase; color:var(--muted); letter-spacing:0.6px;">Enrollment Code</div>
        <div id="sa-enroll-code-display" style="font-size:2rem; font-weight:800; letter-spacing:4px; color:var(--brand); margin:6px 0;"></div>
        <div id="sa-enroll-expiry-display" style="font-size:0.78rem; color:var(--muted);"></div>
      </div>
    </div>
  `;
  loadSaEnrollPersonnelDirectory();
}

async function loadSaEnrollPersonnelDirectory() {
  const deptSelect = document.getElementById("sa-enroll-dept-select");
  if (!deptSelect) return;
  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "pullGlobalPersonnelDirectory" }),
    });
    const data = await res.json();
    if (data.success && data.departmentsList && data.personnelTree) {
      saEnrollPersonnelTree = data.personnelTree;
      deptSelect.innerHTML = '<option value="">— Select Department —</option>';
      data.departmentsList.forEach(deptName => {
        const opt = document.createElement("option");
        opt.value = deptName;
        opt.textContent = deptName;
        deptSelect.appendChild(opt);
      });
    } else {
      deptSelect.innerHTML = '<option value="">Error syncing department parameters</option>';
    }
  } catch (e) {
    deptSelect.innerHTML = '<option value="">Network connection drop</option>';
  }
}

function handleSaEnrollDeptChange(department) {
  const nameSelect = document.getElementById("sa-enroll-name-select");
  if (!nameSelect) return;
  const names = (saEnrollPersonnelTree && saEnrollPersonnelTree[department]) || [];
  nameSelect.innerHTML = '<option value="">— Select Name —</option>';
  names.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name; opt.textContent = name;
    nameSelect.appendChild(opt);
  });
  nameSelect.disabled = names.length === 0;
}

async function submitGenerateEnrollmentCode() {
  const deptSelect = document.getElementById("sa-enroll-dept-select");
  const nameSelect = document.getElementById("sa-enroll-name-select");
  const resultBox = document.getElementById("sa-enroll-result");
  if (resultBox) resultBox.style.display = "none";

  const department = deptSelect ? deptSelect.value : "";
  const name = nameSelect ? nameSelect.value : "";
  if (!department || !name) { showBOQBanner("sa-feedback", "Select a department and name first.", "error"); return; }

  const hit = globalPersonnelEmailLookupCache.find(p => p.name === name && p.department === department);
  if (!hit) { showBOQBanner("sa-feedback", "Could not resolve an account for that person.", "error"); return; }

  try {
    showBlockingOverlay("Generating code...");
    const data = await apFetch({ action: "createDeviceEnrollmentCode", targetEmail: hit.email });
    hideBlockingOverlay();
    if (!data.success) { showBOQBanner("sa-feedback", data.error || "Failed to generate code.", "error"); return; }

    document.getElementById("sa-enroll-code-display").textContent = data.code;
    const expiry = new Date(data.expiresAt);
    document.getElementById("sa-enroll-expiry-display").textContent =
      "Expires " + (isNaN(expiry.getTime()) ? data.expiresAt : expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    if (resultBox) resultBox.style.display = "block";
    showBOQBanner("sa-feedback", `Enrollment code generated for ${escapeHtml(name)}.`, "success");
  } catch (e) {
    hideBlockingOverlay();
    if (e.message !== "SESSION_EXPIRED") showBOQBanner("sa-feedback", "Connection error: " + e.message, "error");
  }
}
