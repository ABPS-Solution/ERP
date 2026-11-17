// ===========================================================================
// project/items-to-check.js -- Items to check (17 Nov 2026). Own Admin section with its own
// permission (perm_items_to_check); moved out of the Admin Dashboard.
// Data: fetchOddActivityFlags / reviewOddActivityFlag (routes/adminDashboard.js, lib/oddActivity.js).
// ===========================================================================
const ITC_GROUPS = ["Access", "Stock and store", "Purchasing and documents", "System"];
let itcFlags = [];

function initializeItemsToCheckPanel() {
  window.scrollTo(0, 0);
  itcLoad();
}

function exitItemsToCheckBackToMenu() {
  const c = document.getElementById("canvas-module-items-to-check");
  if (c) c.style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

async function itcLoad() {
  const body = document.getElementById("itc-body");
  if (!body) return;
  body.innerHTML = '<div style="padding:12px; color:#64748b;">Loading...</div>';
  try {
    const d = await apFetch({ action: "fetchOddActivityFlags" });
    if (!d.success) { body.innerHTML = '<div style="padding:12px; color:#b91c1c;">' + escapeHtml(d.error || "Could not load the items.") + "</div>"; return; }
    itcFlags = d.flags || [];
    itcRender(itcFlags, d.lastRun);
  } catch (e) {
    body.innerHTML = '<div style="padding:12px; color:#b91c1c;">' + escapeHtml(friendlyErr(e)) + "</div>";
  }
}

function itcWhen(ts) {
  return new Date(ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function itcRender(flags, lastRun) {
  const open = flags.filter(f => !f.reviewed_at);
  const stale = !lastRun || (Date.now() - new Date(lastRun.run_at).getTime()) > 26 * 3600e3;
  const lastTxt = !lastRun ? "The check has not run yet."
    : "Last checked " + itcWhen(lastRun.run_at) + (lastRun.failed ? ". Could not run: " + lastRun.failed : ".");
  const chips = ITC_GROUPS.map(g => {
    const n = open.filter(f => f.group_name === g).length;
    return '<div style="flex:1; min-width:150px; padding:10px 14px; border:2px solid #94a3b8; border-radius:var(--radius); background:' + (n ? "#fef2f2" : "#f0fdf4") + ';">' +
      '<div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#475569;">' + escapeHtml(g) + "</div>" +
      '<div style="font-size:1.4rem; font-weight:800; color:' + (n ? "#b91c1c" : "#15803d") + ';">' + n + "</div></div>";
  }).join("");
  const th = (t, w, a) => '<th style="padding:10px 12px; text-align:' + (a || "left") + '; font-size:0.8rem;' + (w ? " width:" + w + ";" : "") + '">' + t + "</th>";
  const td = (t, a) => '<td style="padding:10px 12px; text-align:' + (a || "left") + '; font-size:0.88rem; vertical-align:top;">' + t + "</td>";
  const rows = ITC_GROUPS.map(g => {
    const list = flags.filter(f => f.group_name === g);
    if (!list.length) return "";
    return '<tr><td colspan="5" style="padding:8px 12px; background:#f1f5f9; font-size:0.75rem; font-weight:800; text-transform:uppercase; color:#1e3a8a;">' + escapeHtml(g) + "</td></tr>" +
      list.map(f => {
        const done = !!f.reviewed_at;
        return '<tr style="' + (done ? "opacity:0.6;" : "") + '">' +
          td('<div style="font-weight:700; color:#0f172a;">' + escapeHtml(f.title) + "</div>") +
          td(f.explanation ? '<div style="font-size:0.8rem; color:#475569; line-height:1.4;">' + escapeHtml(f.explanation) + "</div>" : '<span style="color:#94a3b8;">-</span>') +
          td(f.person_name ? escapeHtml(f.person_name) : '<span style="color:#94a3b8;">-</span>') +
          td(itcWhen(f.first_seen)) +
          td('<button type="button" class="nav-btn-styled" style="padding:5px 14px; font-size:0.8rem;' + (done ? " background:#718096;" : "") + '" onclick="itcReview(' + f.flag_id + "," + (done ? "true" : "false") + ')">' + (done ? "Undo" : "Reviewed") + "</button>", "center") + "</tr>";
      }).join("");
  }).join("");
  document.getElementById("itc-body").innerHTML =
    '<div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:14px;">' +
    '<span style="font-size:0.85rem; color:' + (stale ? "#b91c1c" : "#475569") + '; font-weight:' + (stale ? "700" : "400") + ';">' + escapeHtml(lastTxt) + "</span>" +
    '</div>' +
    '<div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px;">' + chips + "</div>" +
    (flags.length
      ? '<div style="overflow-x:auto;"><table style="width:100%;"><thead><tr>' + th("Unusual Activity", "20%") + th("What it means", "38%") + th("User", "14%") + th("First seen", "16%") + th("Action", "12%", "center") + "</tr></thead><tbody>" + rows + "</tbody></table></div>"
      : '<div style="padding:18px; text-align:center; color:#15803d; font-weight:700; border:2px solid #94a3b8; border-radius:var(--radius); background:#f0fdf4;">Nothing to check.</div>');
}

async function itcReview(id, undo) {
  try {
    const d = await apFetch({ action: "reviewOddActivityFlag", flagId: id, undo: !!undo });
    if (!d.success) { abpsAlert(d.error || "Could not save."); return; }
    itcLoad();
  } catch (e) { abpsAlert(friendlyErr(e)); }
}
