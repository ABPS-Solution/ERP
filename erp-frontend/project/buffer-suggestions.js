// ===========================================================================
// project/buffer-suggestions.js -- Buffer Suggestions (16 Nov 2026).
// Per Type of Material: the buffer % now, what finished BOQs suggest, and an Approve button.
// Data: fetchBufferSuggestions / applyBufferPercent (routes/bufferSuggestions.js).
// ===========================================================================
let bufRows = [];
let bufCap = 15;

function navigateToBufferSuggestions() {
  document.getElementById("dashboard-view").style.display = "none";
  const wc = document.getElementById("module-workspace-container");
  if (wc) wc.style.display = "none";
  document.querySelectorAll(".workspace-panel").forEach(p => p.style.display = "none");
  const c = document.getElementById("canvas-module-buffer-suggestions");
  if (c) c.style.display = "block";
  window.scrollTo(0, 0);
  bufLoad();
}

function bufReturnToMain() {
  const c = document.getElementById("canvas-module-buffer-suggestions");
  if (c) c.style.display = "none";
  enforceDynamicModuleRoleGateways(userPermissions);
  document.getElementById("dashboard-view").style.display = "flex";
}

async function bufLoad() {
  const body = document.getElementById("buf-body");
  body.innerHTML = '<div style="padding:12px; color:#64748b;">Loading...</div>';
  try {
    const d = await apFetch({ action: "fetchBufferSuggestions" });
    if (!d.success) { body.innerHTML = '<div style="padding:12px; color:#b91c1c;">' + escapeHtml(d.error || "Could not load.") + "</div>"; return; }
    bufRows = d.rows; bufCap = d.cap;
    bufRender(d.rows, d.history);
  } catch (e) {
    body.innerHTML = '<div style="padding:12px; color:#b91c1c;">' + escapeHtml(friendlyErr(e)) + "</div>";
  }
}

function bufRender(rows, history) {
  const th = (t, a, w) => '<th style="padding:10px 12px; text-align:' + (a || "center") + '; font-size:0.8rem;' + (w ? ' width:' + w + ';' : '') + '">' + t + "</th>";
  const td = (t, a) => '<td style="padding:10px 12px; text-align:' + (a || "center") + '; font-size:0.88rem;">' + t + "</td>";
  const trs = rows.map((r, i) => {
    const sug = r.enoughData ? trimNum(r.suggestedPercent) + "%" : '<span style="color:#94a3b8;">Not enough data</span>';
    const same = r.enoughData && Number(r.suggestedPercent) === Number(r.currentPercent);
    const action = r.enoughData && !same
      ? '<button type="button" style="width:auto; padding:4px 12px; font-size:0.78rem;" onclick="bufApprove(' + i + ')">Approve ' + trimNum(r.suggestedPercent) + "%</button>"
      : "";
    return "<tr>" + td(escapeHtml(r.typeOfMaterial), "left") + td(trimNum(r.currentPercent) + "%") +
      td(r.boqs + " of " + r.needed) + td(r.averageExtraPercent === null ? "-" : trimNum(r.averageExtraPercent) + "%") +
      td(sug) + td(action +
        ' <button type="button" style="width:auto; padding:4px 12px; font-size:0.78rem; background:#fff; color:var(--brand); border:1.5px solid var(--brand);" onclick="bufSetOwn(' + i + ')">Set my own</button>') + "</tr>";
  }).join("");
  const hist = (history || []).map(h => "<tr>" + td(escapeHtml(h.type_of_material), "left") + td(trimNum(h.old_percent) + "% to " + trimNum(h.new_percent) + "%") +
    td(escapeHtml(h.approved_by || "")) + td(new Date(h.approved_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })) + "</tr>").join("");
  document.getElementById("buf-body").innerHTML =
    '<div style="font-size:0.84rem; color:#334155; margin-bottom:14px; padding:10px 14px; background:#f0f9ff; border-left:4px solid #0369a1; border-radius:var(--radius); line-height:1.5;">Based on finished BOQs (every Job Card complete): how much more than the BOQ quantity production actually used. A suggestion appears once a type has ' +
    (rows[0] ? rows[0].needed : 5) + " finished BOQs. The buffer can never go above " + bufCap + "%. Switchgear and LT Capacitors are decided per item and are not listed.</div>" +
    '<div style="overflow-x:auto;"><table style="width:100%;"><thead><tr>' +
    th("Type of Material", "left", "28%") + th("Buffer now", "center", "12%") + th("Finished BOQs", "center", "14%") + th("Average extra used", "center", "16%") + th("Suggested", "center", "14%") + th("Action", "center", "16%") + "</tr></thead><tbody>" + trs + "</tbody></table></div>" +
    (hist ? '<div style="font-weight:800; margin:22px 0 8px; color:#1e3a8a;">Recent changes</div><div style="overflow-x:auto;"><table style="width:100%;"><thead><tr>' +
      th("Type of Material", "left") + th("Change") + th("Approved by") + th("Date") + "</tr></thead><tbody>" + hist + "</tbody></table></div>" : "");
}

async function bufApply(type, pct) {
  try {
    const d = await apFetch({ action: "applyBufferPercent", typeOfMaterial: type, newPercent: pct });
    if (!d.success) { abpsAlert(d.error || "Could not save."); return; }
    bufLoad();
  } catch (e) { abpsAlert(friendlyErr(e)); }
}

async function bufApprove(i) {
  const r = bufRows[i];
  if (!await abpsConfirm("Change the buffer for " + r.typeOfMaterial + " from " + trimNum(r.currentPercent) + "% to " + trimNum(r.suggestedPercent) + "%? New PRNs will use it.", { title: "Approve buffer", okLabel: "Approve" })) return;
  bufApply(r.typeOfMaterial, r.suggestedPercent);
}

async function bufSetOwn(i) {
  const r = bufRows[i];
  const v = await abpsPrompt("New buffer % for " + r.typeOfMaterial + " (0 to " + bufCap + ")", String(r.currentPercent), { title: "Set buffer" });
  if (v === null || v === undefined || String(v).trim() === "") return;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > bufCap) { abpsAlert("Enter a number from 0 to " + bufCap + "."); return; }
  bufApply(r.typeOfMaterial, n);
}
