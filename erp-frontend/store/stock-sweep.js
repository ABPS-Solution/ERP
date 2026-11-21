let sweepBasket = [];
function initializeStockSweepPanel() {
  sweepBasket = [];
  document.getElementById("sweep-feedback").style.display = "none";
  document.getElementById("sweep-material-search").value = ""; document.getElementById("sweep-material-search").style.height = "";
  document.getElementById("sweep-material-dropdown").style.display = "none";
  const st = document.getElementById("sweep-type");
  if (st) st.value = "Production Return";
  const cdOpt = document.getElementById("sweep-type-countdown-opt");
  if (cdOpt) { cdOpt.hidden = false; cdOpt.disabled = false; }
  const sbtn = document.getElementById("sweep-submit-btn");
  if (sbtn) sbtn.textContent = "Submit Stock Sweep";
  const formBody = document.getElementById("sweep-form-body");
  if (formBody) formBody.style.display = "";
  renderSweepBasket();
  // The item code list is shared with other screens and was only ever filled
  // by them, so opening Stock Sweep first left nothing to search (25 Sep 2026).
  loadItemCodeCatalogIntoCache();
  loadSweepCurrentStock();
}

// Current RM stock per item code (total = available + reserved),
// shown beside each row so Store can see what is already on the shelf.
window.sweepStockByItem = { rm: null };
async function loadSweepCurrentStock() {
  try {
    const rm = await apFetch({ action: "pullLiveInventoryCounts" });
    const toMap = (list) => Object.fromEntries((list || []).map(i =>
      [i.itemCode, (Number(i.availableStock) || 0) + (Number(i.reservedStock) || 0)]));
    window.sweepStockByItem = { rm: rm && rm.success ? toMap(rm.inventory) : null };
    renderSweepBasket();
  } catch (e) { /* columns just show "—" */ }
}

function sweepStockCell(kind, itemCode) {
  const map = (window.sweepStockByItem || {})[kind];
  const v = map ? (map[itemCode] || 0) : null;
  return `<td style="padding:8px; border:1.5px solid #64748b; text-align:center; font-family:monospace; font-weight:700; font-size:1rem;">${v == null ? "—" : fmtQty(v)}</td>`;
}

function handleSweepTypeChange() {
  const type = document.getElementById("sweep-type").value;
  const isCountDown = type === "Count Down";
  document.getElementById("sweep-submit-btn").textContent = isCountDown ? "Submit Count Down" : "Submit Stock Sweep";
}

let sweepSearchMatches = [];
async function handleSweepSearch(query) {
  const dropdown = document.getElementById("sweep-material-dropdown");
  if (!query || query.trim().length < 1) { dropdown.style.display = "none"; return; }
  if (!(window.itemCodeCatalogCache || []).length) {
    dropdown.innerHTML = `<div style="padding:8px 12px; color:var(--muted);">Loading item codes...</div>`;
    dropdown.style.display = "block";
    await loadItemCodeCatalogIntoCache();
    const input = document.getElementById("sweep-material-search");
    if (!input || input.value !== query) return;
  }
  const catalog = window.itemCodeCatalogCache || [];
  const q = query.toLowerCase();
  const matches = materialSearch(catalog, q, 15);
  if (matches.length === 0) {
    dropdown.innerHTML = `<div style="padding:8px 12px; color:var(--muted);">No item code matches "${escapeHtml(query)}".</div>`;
    dropdown.style.display = "block";
    return;
  }
  sweepSearchMatches = matches;
  dropdown.innerHTML = matches.map((item, i) => `
    <div onmousedown="event.preventDefault();" onclick="addSweepSearchMatch(${i})"
      style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #f1f5f9;"
      onmouseover="this.style.background='var(--highlight-bg)'" onmouseout="this.style.background='#fff'">
      <span style="font-family:monospace; color:var(--brand); font-weight:700; margin-right:8px;">${escapeHtml(item.itemCode)}</span>${escapeHtml(item.productName || '')}${item.rating ? ` - <span style="color:var(--brand); font-weight:700;">${escapeHtml(item.rating)}</span>` : ""}${item.make ? ` <span style="color:var(--muted);">- Make: ${escapeHtml(item.make)}</span>` : ""}
    </div>`).join("");
  dropdown.style.display = "block";
}

function addSweepSearchMatch(i) {
  const item = sweepSearchMatches[i];
  if (!item) return;
  addToSweepBasket(item.itemCode, item.productName || '', item.rating || '', item.unit || item.unitType || 'NOS');
}

function addToSweepBasket(itemCode, materialName, rating, unitType) {
  document.getElementById("sweep-material-search").value = ""; document.getElementById("sweep-material-search").style.height = "";
  document.getElementById("sweep-material-dropdown").style.display = "none";
  if (sweepBasket.some(b => b.itemCode === itemCode)) { abpsAlert("This item is already in the sweep list — edit its quantity below instead."); return; }
  sweepBasket.push({ itemCode, materialName, rating: rating || "", unitType: unitType || "NOS", quantity: "" });
  renderSweepBasket();
}

function removeFromSweepBasket(itemCode) {
  sweepBasket = sweepBasket.filter(b => b.itemCode !== itemCode);
  renderSweepBasket();
}

function updateSweepBasketField(itemCode, field, value) {
  const row = sweepBasket.find(b => b.itemCode === itemCode);
  if (row) row[field] = value;
  updateSweepSubmitState();
}

function renderSweepBasket() {
  const body = document.getElementById("sweep-basket-body");
  if (sweepBasket.length === 0) {
    body.innerHTML = '<tr id="sweep-basket-empty"><td colspan="6" style="padding:14px; border:1.5px solid #64748b; text-align:center; color:var(--muted);">No items added yet.</td></tr>';
  } else {
    body.innerHTML = sweepBasket.map(b => `
      <tr>
        <td style="padding:8px; border:1.5px solid #64748b; font-family:monospace; text-align:center;">${b.itemCode}</td>
        <td style="padding:8px; border:1.5px solid #64748b;">${escapeHtml(b.materialName)}${b.rating ? ` - <span style="color:var(--brand); font-weight:700;">${escapeHtml(b.rating)}</span>` : ""}</td>
        ${sweepStockCell("rm", b.itemCode)}
        <td style="padding:8px; border:1.5px solid #64748b; font-family:monospace; color:#334155; text-align:center; font-size:1rem;">${b.unitType || "NOS"}</td>
        <td style="padding:8px; border:1.5px solid #64748b; text-align:center;"><input type="number" min="0" step="any" required value="${b.quantity}" oninput="updateSweepBasketField(${jsArg(b.itemCode)},'quantity',this.value)" style="width:90px; padding:5px; border:1px solid var(--border); border-radius:4px; text-align:center; font-size:1rem; font-weight:700;"></td>
        <td style="padding:8px; border:1.5px solid #64748b;"><button onclick="removeFromSweepBasket(${jsArg(b.itemCode)})" style="background:none; border:none; color:#c0435a; cursor:pointer; font-size:1rem;">✕</button></td>
      </tr>`).join("");
  }
  updateSweepSubmitState();
}

// Submit stays enabled with blank quantities so the inline banner can
// name the offending rows, rather than a silently dead button.
function updateSweepSubmitState() {
  document.getElementById("sweep-submit-btn").disabled = sweepBasket.length === 0;
}

async function submitStockSweep() {
  const missing = sweepBasket.filter(b => (String(b.quantity ?? '').trim() === '' || !(parseFloat(b.quantity) >= 0)));
  if (missing.length > 0) {
    showBOQBanner("sweep-feedback",
      `<strong>Quantity Required:</strong> Enter a quantity of 0 or more for: ${missing.map(m => m.itemCode).join(", ")}.`,
      "error");
    document.getElementById("sweep-feedback").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  document.getElementById("sweep-feedback").style.display = "none";
  if (document.getElementById("sweep-type").value === "Count Down") return submitStockCountDown();
  showBlockingOverlay("Recording Stock Sweep...");
  try {
    const data = await apFetch({
      action: "commitStockSweep",
      operatorName: appActiveOperatorIdentityString,
      sweepItems: sweepBasket.map(b => ({
        itemCode: b.itemCode,
        quantity: parseFloat(b.quantity),
        sweepType: document.getElementById("sweep-type").value,
      }))
    });
    if (data.success) {
      let msg = `Sweep recorded: ${data.itemsProcessed} item(s) added and auto-distributed to BOQs.`;
      if (data.notFound && data.notFound.length) msg += ` NOT found in catalog (skipped): ${data.notFound.join(", ")}.`;
      sweepBasket = [];
      renderSweepBasket();
      const docLinks = [{ url: data.pdfUrl ? driveLink(data.pdfUrl) : "", label: "Download Stock Sweep Record PDF" }];
      showSuccessWithReset("sweep-feedback", msg, "Record Another Sweep", "initializeStockSweepPanel()", docLinks);
      const formBody = document.getElementById("sweep-form-body");
      if (formBody) formBody.style.display = "none";
    } else {
      showBOQBanner("sweep-feedback", data.error || "Failed to record sweep.", "error");
    }
  } catch(e) {
    showBOQBanner("sweep-feedback", friendlyErr(e), "error");
  } finally {
    hideBlockingOverlay();
  }
}


async function submitStockCountDown() {
  const lines = sweepBasket.map(b => `${b.itemCode}: -${fmtQty(parseFloat(b.quantity))}`).join("\n");
  if (!(await abpsConfirm("Lower RM Store stock for:\n" + lines + "\n\nIf free stock isn't enough, the newest PRNs lose their reservation and will need to purchase it.", { okLabel: "Count Down", title: "Count down stock" }))) return;
  showBlockingOverlay("Recording Count Down...");
  try {
    const data = await apFetch({
      action: "commitStockWriteDown",
      operatorName: appActiveOperatorIdentityString,
      items: sweepBasket.map(b => ({ itemCode: b.itemCode, quantity: parseFloat(b.quantity) })),
    });
    if (data.success) {
      const releasedCount = (data.results || []).reduce((n, r) => n + (r.released || []).length, 0);
      let msg = `Count down ${escapeHtml(data.batchId)} recorded for ${(data.results || []).length} item(s).`;
      if (releasedCount) msg += ` ${releasedCount} PRN reservation(s) were reduced and now show that quantity as to-purchase.`;
      sweepBasket = [];
      renderSweepBasket();
      showSuccessWithReset("sweep-feedback", msg, "Record Another", "initializeStockSweepPanel()", []);
      const formBody = document.getElementById("sweep-form-body");
      if (formBody) formBody.style.display = "none";
    } else {
      showBOQBanner("sweep-feedback", escapeHtml(data.error || "Failed to record count down."), "error");
    }
  } catch (e) {
    showBOQBanner("sweep-feedback", escapeHtml(friendlyErr(e)), "error");
  } finally {
    hideBlockingOverlay();
  }
}
