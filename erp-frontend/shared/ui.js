// Number boxes never change on mouse-wheel or Up/Down arrow keys (24 Sep
// 2026, explicit request): scrolling the page with the cursor in a Qty/Rate
// box used to silently change its value. On wheel the box loses focus, so
// the page scrolls normally and the value is left alone. The spinner arrows
// themselves are hidden in index.html's CSS.
(function() {
  document.addEventListener("wheel", function(e) {
    const t = document.activeElement;
    if (t && t.tagName === "INPUT" && t.type === "number" && (e.target === t || t.contains(e.target))) t.blur();
  }, { capture: true, passive: true });
  document.addEventListener("keydown", function(e) {
    const t = e.target;
    if (t && t.tagName === "INPUT" && t.type === "number" && (e.key === "ArrowUp" || e.key === "ArrowDown")) e.preventDefault();
  }, true);
})();

// Ported verbatim from ABPS Portal's shared/ui.js (31 Aug 2026) — generic UI
// helpers (blocking overlay, feedback banners, success-with-reset pattern,
// number-input guard, auto-grow textarea), not department-specific.

(function() {
  function allowsNegative(inp) {
    return !(inp.min !== "" && inp.min != null && Number(inp.min) >= 0);
  }
  document.addEventListener("keydown", function(e) {
    const t = e.target;
    if (!(t && t.tagName === "INPUT" && t.type === "number")) return;
    if (e.key === "e" || e.key === "E" || e.key === "+") { e.preventDefault(); return; }
    if (e.key === "-" && !allowsNegative(t)) { e.preventDefault(); }
  }, true);
  document.addEventListener("input", function(e) {
    const t = e.target;
    if (!(t && t.tagName === "INPUT" && t.type === "number")) return;
    let v = t.value;
    let cleaned = v.replace(/[eE+]/g, "");
    if (!allowsNegative(t)) cleaned = cleaned.replace(/-/g, "");
    if (cleaned !== v) t.value = cleaned;
  }, true);
})();

function showBlockingOverlay(text) {
  let ov = document.getElementById("app-blocking-overlay");
  const msgEl = () => document.getElementById("app-blocking-overlay-text");
  if (ov) { ov.style.display = "flex"; if (msgEl()) msgEl().textContent = text || "Processing..."; return; }
  ov = document.createElement("div");
  ov.id = "app-blocking-overlay";
  ov.style.cssText = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,0.35); backdrop-filter:blur(1px); z-index:99999; display:flex; align-items:center; justify-content:center; cursor:wait;";
  ov.innerHTML = `
    <div style="background:rgba(255,255,255,0.9); border:1px solid var(--border); border-radius:var(--radius); padding:22px 32px; box-shadow:0 8px 28px rgba(0,0,0,0.18); display:flex; align-items:center; gap:14px;">
      <div class="spinner" style="width:22px; height:22px; border:3px solid rgba(0,0,0,0.12); border-top-color:var(--accent); border-radius:50%; animation:spin 0.6s linear infinite;"></div>
      <span id="app-blocking-overlay-text" style="font-weight:700; font-size:0.92rem; color:var(--text);">${text || "Processing..."}</span>
    </div>`;
  ov.addEventListener("click", e => e.stopPropagation());
  document.body.appendChild(ov);
}

function hideBlockingOverlay() {
  const ov = document.getElementById("app-blocking-overlay");
  if (ov) ov.style.display = "none";
}

function showBOQBanner(elementId, message, type, persist) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const isSuccess = type === "success";
  el.style.borderLeftColor = isSuccess ? "var(--accent)" : "#e53e3e";
  el.style.background      = isSuccess ? "#f0fff4" : "#fff5f5";
  el.style.color           = isSuccess ? "#276749" : "#c53030";
  el.innerHTML  = message;
  el.style.display = "block";
  if (isSuccess && !persist) setTimeout(() => { el.style.display = "none"; }, 6000);
  if (!isSuccess) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showPurchaseFeedback(elementId, message, type, persist) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const ok = type === "success";
  el.style.cssText = `display:block; background:${ok ? '#dcfce7' : '#fee2e2'}; border-left:4px solid ${ok ? '#15803d' : '#b91c1c'}; color:${ok ? '#15803d' : '#b91c1c'}; padding:12px; margin-bottom:12px; border-radius:var(--radius);`;
  el.innerHTML = message;
  if (ok && !persist) setTimeout(() => { el.style.display = "none"; }, 6000);
  if (!ok) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ═══════════════════════════════════════════════════════
// ONE CONSISTENT LOOK FOR EVERY "SUBMIT SUCCEEDED" MOMENT
// ═══════════════════════════════════════════════════════
function showSuccessWithReset(elementId, message, resetButtonLabel, resetFnCall, docLinks) {
  const el = document.getElementById(elementId);
  if (!el) return;
  // An entry with a label but no url means the document failed to generate;
  // say so rather than silently showing no link.
  const links = (docLinks || []).filter(d => d && (d.url || d.label)).map(d => d.url
    ? `<div style="margin-top:8px;"><a href="${d.url}" target="_blank" rel="noopener" style="color:var(--brand); font-weight:700;">${d.label} ↗</a></div>`
    : `<div style="margin-top:8px; font-size:0.8rem; color:#b45309; font-weight:600;">${d.label}: The document could not be created just now. The record is saved; ask an admin to regenerate the document.</div>`
  ).join("");
  el.style.cssText = "display:block; background:#f0fdf4; border-left:4px solid var(--accent); color:#15803d; padding:14px; margin-bottom:14px; border-radius:var(--radius);";
  el.innerHTML = `
    <div style="font-weight:700; font-size:0.92rem;">${message}</div>
    ${links}
    <button class="nav-btn-styled" style="background:var(--accent); color:#fff; margin-top:12px; padding:7px 18px; font-weight:700; font-size:0.82rem;" onclick="${resetFnCall}">+ ${resetButtonLabel}</button>
  `;
}

function autoGrowTextField(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
function autoGrowAllIn(container) {
  (container ? container.querySelectorAll("textarea") : document.querySelectorAll("textarea"))
    .forEach(autoGrowTextField);
}

// ═══════════════════════════════════════════════════════
// GENERIC WRAPPING DROPDOWN — ported verbatim from Portal's shared/ui.js.
// For any picker whose option text is too long for a native <select>
// (browsers never wrap a native <select>'s own option rows onto multiple
// lines — no CSS can override that; it has to be a plain div-based
// dropdown instead). Markup convention per baseId:
//   <input type="hidden" id="{baseId}">                      -- holds .value, unchanged for every existing caller
//   <div id="{baseId}-display" class="gwd-display" onclick="toggleGenericDropdown('{baseId}')">
//     <span id="{baseId}-display-text">...</span><span>▾</span>
//   </div>
//   <div id="{baseId}-list" class="gwd-list"></div>
// A single delegated click-outside handler (below) closes every open
// .gwd-list, keyed off the shared class rather than one id per widget.
// ═══════════════════════════════════════════════════════
function genericDropdownPopulate(baseId, options, onSelectCallback) {
  const list = document.getElementById(`${baseId}-list`);
  if (!list) return;
  if (!options || options.length === 0) {
    list.innerHTML = `<div style="padding:8px 10px; color:var(--muted); font-size:0.82rem;">No options.</div>`;
    return;
  }
  list.innerHTML = options.map((o, i) => `
    <div data-idx="${i}" style="padding:8px 10px; cursor:pointer; border-bottom:1px solid #f1f5f9; font-size:0.82rem; line-height:1.35;"
      onmouseover="this.style.background='var(--highlight-bg)'" onmouseout="this.style.background='#fff'">${o.label}</div>`).join("");
  Array.from(list.children).forEach((el, i) => {
    el.onclick = (e) => { e.stopPropagation(); genericDropdownSelect(baseId, options[i].value, options[i].label, onSelectCallback); };
  });
}
function genericDropdownSelect(baseId, value, label, onSelectCallback) {
  const hidden = document.getElementById(baseId);
  if (hidden) hidden.value = value;
  const textEl = document.getElementById(`${baseId}-display-text`);
  if (textEl) textEl.textContent = label;
  const list = document.getElementById(`${baseId}-list`);
  if (list) list.style.display = "none";
  if (onSelectCallback) onSelectCallback(value);
}
function genericDropdownReset(baseId, placeholderText) {
  const hidden = document.getElementById(baseId);
  if (hidden) hidden.value = "";
  const textEl = document.getElementById(`${baseId}-display-text`);
  if (textEl) textEl.textContent = placeholderText;
  const list = document.getElementById(`${baseId}-list`);
  if (list) { list.innerHTML = ""; list.style.display = "none"; }
}
function genericDropdownSetDisabled(baseId, disabled) {
  const disp = document.getElementById(`${baseId}-display`);
  if (!disp) return;
  disp.dataset.disabled = disabled ? "1" : "0";
  disp.style.opacity = disabled ? "0.5" : "1";
  disp.style.cursor = disabled ? "not-allowed" : "pointer";
  disp.style.background = disabled ? "#f1f5f9" : "#fff";
  disp.style.color = disabled ? "var(--muted)" : "var(--text)";
}
function toggleGenericDropdown(baseId) {
  const disp = document.getElementById(`${baseId}-display`);
  if (!disp || disp.dataset.disabled === "1") return;
  const list = document.getElementById(`${baseId}-list`);
  if (!list) return;
  const isOpen = list.style.display === "block";
  document.querySelectorAll(".gwd-list").forEach(l => { l.style.display = "none"; });
  list.style.display = isOpen ? "none" : "block";
}
document.addEventListener("click", (e) => {
  if (e.target.closest(".gwd-display") || e.target.closest(".gwd-list")) return;
  document.querySelectorAll(".gwd-list").forEach(l => { l.style.display = "none"; });
});


// abpsConfirm — on-page OK / Cancel box used instead of the browser's
// confirm() popup. Returns a Promise<boolean>; callers await it.
function abpsConfirm(message, opts) {
  return new Promise(resolve => {
    const o = opts || {};
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.5); z-index:100000; display:flex; align-items:center; justify-content:center; padding:16px;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff; border-radius:10px; max-width:480px; width:100%; padding:22px 24px; box-shadow:0 12px 36px rgba(0,0,0,0.25); border:2px solid #94a3b8;';
    const title = document.createElement('div');
    title.style.cssText = 'font-size:1.05rem; font-weight:800; color:var(--brand); margin-bottom:10px;';
    title.textContent = o.title || 'Please confirm';
    const msg = document.createElement('div');
    msg.style.cssText = 'font-size:0.92rem; color:#111827; white-space:pre-line; line-height:1.5; margin-bottom:18px;';
    msg.textContent = String(message == null ? '' : message);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; justify-content:flex-end; gap:10px;';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'nav-btn-styled';
    cancel.style.cssText = 'background:#e2e8f0; color:#111827; padding:8px 20px; font-weight:700; width:auto;';
    cancel.textContent = o.cancelLabel || 'Cancel';
    const ok = document.createElement('button');
    ok.type = 'button'; ok.className = 'nav-btn-styled';
    ok.style.cssText = 'background:var(--brand); padding:8px 22px; font-weight:700; width:auto;';
    ok.textContent = o.okLabel || 'OK';
    const done = (v) => { document.removeEventListener('keydown', onKey, true); wrap.remove(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); done(true); } };
    cancel.onclick = () => done(false);
    ok.onclick = () => done(true);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) done(false); });
    document.addEventListener('keydown', onKey, true);
    row.append(cancel, ok); box.append(title, msg, row); wrap.appendChild(box);
    document.body.appendChild(wrap);
    ok.focus();
  });
}
