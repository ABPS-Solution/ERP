// ═══════════════════════════════════════════════════════════════════════
// store/live-stock.js — ★ PARTIAL FILE (Batch 5 — Purchase, 16 Sep 2026).
//
// Store is Batch 6 and is NOT built yet. Portal's own store/live-stock.js
// is a ~2000-line file (Live Raw Material / Spare / FG Store stock, Store
// Ledger, Consumption Variance, Store-manager ticket approvals). None of
// that belongs to Purchase — but SEVEN functions in it are the live-stock
// pollers the PRN screens depend on, and those screens (Create PRN,
// Authorize PRN, Revise PRN) render inside PURCHASE's own workspace
// enclosure and were ported in this batch:
//
//   refreshRPRNDeltaLiveStock / refreshRevisePRNLiveStock / updateRevisePRNRow
//   refreshAPRNLiveStock / updateAPRNRow
//   refreshPRNCreateLiveStock / updatePRNDecreaseRowPurchaseQty
//
// They are called on a setInterval from store/create-prn.js and
// store/revise-prn.js, so without them every PRN screen's live-stock
// column silently threw on its first poll. This is the SAME class of gap
// that bit the 4 Sep 2026 port (shared/typeahead.js held Create BOQ's own
// init function) — a per-department file list does not see a shared file
// another department quietly owns.
//
// Extracted VERBATIM at Portal's own file path so Batch 6 can copy
// Portal's full store/live-stock.js over this file wholesale, with no
// duplicate function declarations.
//
// ★ BATCH 6: do NOT treat this as "Live Stock is already partly done."
//
// Dependencies, all already present: computeLiveStoreSplit /
// computeRevisePRNStoreDisplay (store/create-prn.js),
// totalCovered_dataset (store/revise-prn.js), trimNum + apFetch (shared).
// refreshPRNLiveStock/updatePRNPurchaseQtyCell (the two functions
// immediately after this block in Portal) are deliberately NOT included —
// they have no caller anywhere in Portal either.
// ═══════════════════════════════════════════════════════════════════════

async function refreshRPRNDeltaLiveStock() {
  const pending = window.rprnPendingCreate;
  if (!pending) { if (window._rprnDeltaStockInterval) clearInterval(window._rprnDeltaStockInterval); return; }
  const itemCodes = pending.lineItems.map(it => it.itemCode).filter(Boolean);
  if (itemCodes.length === 0) return;
  try {
    const data = await apFetch({ action: "fetchLiveMaterialStock", itemCodes });
    if (!data.success) return;
    document.querySelectorAll(".rprn-delta-livestock").forEach(span => {
      const code = span.dataset.itemcode;
      const s = data.stock[code.toUpperCase()] || { raw: 0, spare: 0 };
      const total = s.raw + s.spare;
      span.dataset.liveRaw = s.raw;
      span.dataset.liveSpare = s.spare;
      span.dataset.liveTotal = total;
      const tr = span.closest("tr");
      const inp = tr ? tr.querySelector(".rprn-delta-storeqty") : null;

      const isDecreaseInp = inp && inp.classList.contains("rprn-delta-decrease-storeqty");
      const isIncreaseInp = inp && inp.classList.contains("rprn-delta-increase-storeqty");
      const idxForItem = inp ? Number(inp.dataset.idx) : null;
      const itemForSpan = (idxForItem !== null && !isNaN(idxForItem)) ? pending.lineItems[idxForItem] : null;
      const addBackOwn = (isDecreaseInp || isIncreaseInp) && itemForSpan;
      const baseRaw = addBackOwn ? s.raw + (Number(itemForSpan.storeFromRaw) || 0) : s.raw;
      const baseSpare = addBackOwn ? s.spare + (Number(itemForSpan.storeFromSpare) || 0) : s.spare;
      const effectiveTotal = baseRaw + baseSpare;

      // Overwriting these with the ADD-BACK-INCLUSIVE numbers, not the
      // raw live-only ones — the input's own typing listener reads these
      // exact dataset keys for both its cap and its live split preview.
      // Storing the raw-only numbers here (as before) meant the display
      // text (computed fresh, correctly, right below) and the input's
      // actual cap/typing behavior disagreed — capping you at 50 while
      // showing 70, and re-diverging on every poll cycle.
      span.dataset.liveRaw = baseRaw;
      span.dataset.liveSpare = baseSpare;
      span.dataset.liveTotal = effectiveTotal;

      const currentVal = inp ? (Math.round((parseFloat(inp.value) || 0) * 100) / 100) : 0;
      const split = computeLiveStoreSplit(baseRaw, baseSpare, currentVal);
      span.textContent = `${split.remainingRaw + split.remainingSpare} (Raw: ${split.remainingRaw}, Spare: ${split.remainingSpare})`;
      const bufferedReqForCap = itemForSpan ? (Number(itemForSpan.bufferedRequirement) || 0) : Infinity;
      if (inp) {
        if (!inp.classList.contains("rprn-delta-decrease-storeqty")) {
          if (inp.disabled) { inp.disabled = false; inp.style.opacity = "1"; }
          const cap = Math.min(effectiveTotal, bufferedReqForCap);
          inp.max = cap;
          if (currentVal > cap) { inp.value = Math.round(cap * 100) / 100; inp.dispatchEvent(new Event("input")); }
        } else {
          // Decrease/removed rows have THREE ceilings: the requirement
          // itself (totalCovered), the NEW buffered BOQ requirement (a
          // material removed from the BOQ caps at 0), and how much can
          // genuinely be claimed beyond what this row already holds
          // (effectiveTotal — live stock + this row's own hold).
          const realCap = Math.min(totalCovered_dataset(inp), bufferedReqForCap, effectiveTotal);
          inp.max = realCap;
          if (currentVal > realCap) {
            inp.value = Math.round(realCap * 100) / 100;
            inp.dispatchEvent(new Event("input"));
          }
        }
      }
    });
  } catch(e) { /* silent, retry next interval */ }
}

// Same live raw+spare polling as Create/Auth PRN, and the same
// enforce-in-code cap — the input's `max` attribute alone does not stop
// typing, so updateRevisePRNRow also reads it back to actually block
// entering more than what's genuinely available.
async function refreshRevisePRNLiveStock() {
  const st = window.rprnState;
  if (!st) { if (window._rprnStockInterval) clearInterval(window._rprnStockInterval); return; }
  const itemCodes = st.lineItems.map(li => li.itemCode).filter(Boolean);
  if (itemCodes.length === 0) return;
  try {
    const data = await apFetch({ action: "fetchLiveMaterialStock", itemCodes });
    if (!data.success) return;
    document.querySelectorAll(".rprn-livestock").forEach(span => {
      const code = span.dataset.itemcode;
      const idx = Number(span.dataset.idx);
      const li = st.lineItems[idx];
      const s = data.stock[code.toUpperCase()] || { raw: 0, spare: 0 };

      // Add back THIS PRN's own reservation, per pool, using the exact
      // recorded split — not an assumed spare-first guess.
      const reservedRaw = li ? (Number(li.storeFromRaw) || 0) : 0;
      const reservedSpare = li ? (Number(li.storeFromSpare) || 0) : 0;
      const baseRaw = s.raw + reservedRaw;
      const baseSpare = s.spare + reservedSpare;
      const total = baseRaw + baseSpare;

      span.dataset.baseraw = baseRaw;
      span.dataset.basespare = baseSpare;
      span.dataset.reservedraw = reservedRaw;
      span.dataset.reservedspare = reservedSpare;

      const inp = document.querySelector(`.rprn-store[data-idx="${idx}"]`);
      const currentTyped = inp ? (parseFloat(inp.value) || 0) : (li ? Number(li.storeQty) || 0 : 0);
      const disp = computeRevisePRNStoreDisplay(baseRaw, baseSpare, reservedRaw, reservedSpare, currentTyped);
      span.textContent = `${disp.remainingRaw + disp.remainingSpare} (Raw: ${disp.remainingRaw}, Spare: ${disp.remainingSpare})`;

      if (inp && li) {
        const requirementCap = Number(li.bufferedRequirement) || 0;
        const cap = Math.min(requirementCap, total);
        inp.max = cap;
        if (currentTyped > cap) { inp.value = Math.round(cap * 100) / 100; updateRevisePRNRow(idx); }
      }
    });
  } catch (e) { /* silent — quantities still editable without this */ }
}

function updateRevisePRNRow(idx) {
  const st = window.rprnState;
  const li = st.lineItems[idx];
  const inp = document.querySelector(`.rprn-store[data-idx="${idx}"]`);
  const req = Number(li.bufferedRequirement) || 0;
  const onOrder = Number(li.onOrderQty) || 0;
  // `max` alone does not stop typing — read it back and cap in code,
  // same enforcement pattern as Create/Authorize PRN.
  const liveMax = inp.max !== '' ? Number(inp.max) : req;
  const cap = Math.min(req, isNaN(liveMax) ? req : liveMax);
  let store = parseFloat(inp.value) || 0;
  if (store > cap) { store = cap; inp.value = store; }
  const rawPurchase = Math.max(0, req - store);
  const isCountUnit = (li.unit || "").toString().trim().toUpperCase() === "NOS";
  const newPurchase = isCountUnit ? Math.ceil(rawPurchase - 1e-9) : rawPurchase;
  const cell = document.getElementById(`rprn-newpurch-${idx}`);
  const bad = newPurchase < onOrder - 1e-9 || store > req + 1e-9;
  inp.style.borderColor = bad ? "#b91c1c" : "var(--brand)";
  cell.style.color = bad ? "#b91c1c" : (Math.abs(newPurchase - (Number(li.purchaseQty)||0)) > 1e-9 ? "#15803d" : "#1a2332");
  cell.textContent = newPurchase.toLocaleString("en-IN",{maximumFractionDigits:2})
    + (newPurchase < onOrder - 1e-9 ? `  (below ${onOrder} on order)` : "");

  // Live-update "Store Available Stock" as the typed quantity changes —
  // spare-first on increase, raw-first release on decrease, matching
  // exactly how the backend will actually reserve/release it on submit.
  const stockSpan = document.querySelector(`.rprn-livestock[data-idx="${idx}"]`);
  if (stockSpan && stockSpan.dataset.baseraw !== undefined) {
    const baseRaw = Number(stockSpan.dataset.baseraw) || 0;
    const baseSpare = Number(stockSpan.dataset.basespare) || 0;
    const reservedRaw = Number(stockSpan.dataset.reservedraw) || 0;
    const reservedSpare = Number(stockSpan.dataset.reservedspare) || 0;
    const disp = computeRevisePRNStoreDisplay(baseRaw, baseSpare, reservedRaw, reservedSpare, store);
    stockSpan.textContent = `${disp.remainingRaw + disp.remainingSpare} (Raw: ${disp.remainingRaw}, Spare: ${disp.remainingSpare})`;
  }
}

async function refreshAPRNLiveStock() {
  const itemCodes = aprnRows.map(r => r.itemCode).filter(Boolean);
  if (itemCodes.length === 0) return;
  try {
    const data = await apFetch({ action: "fetchLiveMaterialStock", itemCodes });
    if (!data.success) return;
    document.querySelectorAll(".aprn-livestock").forEach(span => {
      const code = span.dataset.itemcode;
      const s = data.stock[code.toUpperCase()] || { raw: 0, spare: 0 };
      const tr = span.closest("tr");
      const inp = tr ? tr.querySelector(".aprn-storeqty") : null;
      const idx = inp ? Number(inp.dataset.idx) : null;
      const row = (idx !== null && !isNaN(idx)) ? aprnRows[idx] : null;

      // What THIS pending PRN already holds counts as available TO
      // ITSELF — otherwise the screen would show almost nothing free and
      // force the input down to whatever tiny amount happens to still be
      // genuinely unclaimed, even though the full claim is still
      // legitimately this PRN's to keep or edit. For a Delta PRN's
      // new/increase rows, that claim hasn't been applied to the live
      // pool yet (it only lands at authorize), so the DELTA is what's
      // missing and gets added back. For a resplit revision row, the
      // opposite is true — its claim/release already executed immediately
      // at submission, so the live pool already reflects it; adding the
      // delta back again would double-count a claim or double-release a
      // release. Resplit rows carry the ABSOLUTE current split
      // (newStoreFromRaw/newStoreFromSpare) for exactly this reason.
      const isResplitRow = row && row.changeKind === 'resplit';
      const ownRaw = row ? (isResplitRow ? (Number(row.newStoreFromRaw) || 0) : (Number(row.storeFromRaw) || 0)) : 0;
      const ownSpare = row ? (isResplitRow ? (Number(row.newStoreFromSpare) || 0) : (Number(row.storeFromSpare) || 0)) : 0;
      const baseRaw = s.raw + ownRaw;
      const baseSpare = s.spare + ownSpare;
      const total = baseRaw + baseSpare;

      span.dataset.baseraw = baseRaw;
      span.dataset.basespare = baseSpare;

      const currentTyped = inp ? (parseFloat(inp.value) || 0) : 0;
      const split = isResplitRow
        ? computeRevisePRNStoreDisplay(baseRaw, baseSpare, ownRaw, ownSpare, currentTyped)
        : computeLiveStoreSplit(baseRaw, baseSpare, currentTyped);
      span.textContent = `${split.remainingRaw + split.remainingSpare} (Raw: ${split.remainingRaw}, Spare: ${split.remainingSpare})`;

      if (inp) {
        const requirementCap = row
          ? (row.editable !== false ? (Number(row.bufferedRequirement) || 0) : ((Number(row.previousStoreQty) || 0) + (Number(row.previousPurchaseQty) || 0)))
          : Infinity;
        const cap = Math.min(requirementCap, total);
        inp.max = cap;
        if (currentTyped > cap) {
          inp.value = Math.round(cap * 100) / 100;
          updateAPRNRow(idx, inp.value, window.aprnExpandedId);
        }
      }
    });
  } catch (e) { /* silent — quantities still editable without this */ }
}

// Recompute purchase qty exactly as the backend does, so what the
// authorizer sees is what gets committed.
function updateAPRNRow(idx, value, prnId) {
  const row = aprnRows[idx];
  if (!row) return;
  const isDecreaseRow = row.changeKind === 'decrease' || row.changeKind === 'removed';
  const totalCovered = (Number(row.previousStoreQty) || 0) + (Number(row.previousPurchaseQty) || 0);
  const buffered = Number(row.bufferedRequirement) || 0;
  const staticCap = isDecreaseRow ? Math.min(totalCovered, buffered) : buffered;
  const inputEl = document.querySelector(`.aprn-storeqty[data-idx="${idx}"]`);
  const liveMax = inputEl && inputEl.max !== '' ? Number(inputEl.max) : staticCap;
  const cap = Math.min(staticCap, isNaN(liveMax) ? staticCap : liveMax);
  let storeQty = parseFloat(value) || 0;
  if (storeQty < 0) storeQty = 0;
  if (storeQty > cap) storeQty = cap;
  if (inputEl) inputEl.value = storeQty;
  row.currentUnassignedStoreQty = storeQty;
  const isCountUnit = (row.unit || "").toString().trim().toUpperCase() === "NOS";
  const cell = document.getElementById(`aprn-purchaseqty-${idx}`);
  // Recomputed against the true buffered BOQ requirement even for
  // deferred rows — the actual purchase_quantity DB field stays locked
  // until the PO is revised, but this preview reflects what's really
  // needed now, same as the Revise PRN screen.
  const raw = Math.max(0, buffered - storeQty);
  row.purchaseQty = isCountUnit ? Math.ceil(raw - 1e-9) : raw;
  if (cell) {
    cell.textContent = trimNum(row.purchaseQty);
    // Green once the authorizer's live edit actually moves this row away
    // from what was originally submitted for review; black if it still
    // matches. Editable rows' original value is purchaseDelta (what the
    // initial cell rendered); non-editable rows' is newPurchaseTotal.
    const originalVal = row.editable !== false ? (Number(row.purchaseDelta) || 0) : (Number(row.newPurchaseTotal) || 0);
    const stillMatchesOriginal = Math.abs(Number(row.purchaseQty) - originalVal) < 1e-9;
    cell.style.color = stillMatchesOriginal ? "#1a2332" : "#15803d";
  }

  // Live-update "Store Available Stock" as the typed quantity changes —
  // spare is consumed first, matching exactly how the backend reserves
  // it on submit, so what's shown updating is what will really happen.
  const tr = inputEl ? inputEl.closest("tr") : null;
  const stockSpan = tr ? tr.querySelector(".aprn-livestock") : null;
  if (stockSpan && stockSpan.dataset.baseraw !== undefined) {
    const baseRaw = Number(stockSpan.dataset.baseraw) || 0;
    const baseSpare = Number(stockSpan.dataset.basespare) || 0;
    // Resplit rows: raw-first release / spare-first extra-claim, same
    // formula Revise PRN's own preview uses and what the backend now
    // actually commits — NOT the generic spare-first-claim formula
    // (computeLiveStoreSplit) Delta PRN rows use, which assumes a fresh
    // claim rather than an edit against an existing specific split.
    const split = row.changeKind === 'resplit'
      ? computeRevisePRNStoreDisplay(baseRaw, baseSpare, Number(row.newStoreFromRaw) || 0, Number(row.newStoreFromSpare) || 0, storeQty)
      : computeLiveStoreSplit(baseRaw, baseSpare, storeQty);
    stockSpan.textContent = `${split.remainingRaw + split.remainingSpare} (Raw: ${split.remainingRaw}, Spare: ${split.remainingSpare})`;
  }
}

async function refreshPRNCreateLiveStock() {
  const pending = window.prnPendingCreate;
  if (!pending) { if (window._prnCreateStockInterval) clearInterval(window._prnCreateStockInterval); return; }
  const itemCodes = pending.lineItems.map(it => it.itemCode).filter(Boolean);
  if (itemCodes.length === 0) return;
  try {
    const data = await apFetch({ action: "fetchLiveMaterialStock", itemCodes });
    if (!data.success) return;
    document.querySelectorAll(".prn-create-livestock").forEach(span => {
      const code = span.dataset.itemcode;
      const s = data.stock[code.toUpperCase()] || { raw: 0, spare: 0 };
      const total = s.raw + s.spare;
      span.dataset.liveRaw = s.raw;
      span.dataset.liveSpare = s.spare;
      span.dataset.liveTotal = total;
      const tr = span.closest("tr");
      const inp = tr ? tr.querySelector(".prn-create-storeqty") : null;
      const currentVal = inp ? (Math.round((parseFloat(inp.value) || 0) * 100) / 100) : 0;
      // Decrease/removed rows already hold their pre-filled amount from
      // this PRN's PRIOR authorization — that's not a new claim being
      // made, so it needs adding back to the live pool before simulating
      // "what happens if the typed amount is claimed", same as Revise
      // PRN/Authorize PRN already do for their own equivalent rows.
      const isDecreaseInp = inp && inp.classList.contains("prn-create-decrease-storeqty");
      const isIncreaseInp = inp && inp.classList.contains("prn-create-increase-storeqty");
      const idxForItem = inp ? Number(inp.dataset.idx) : null;
      const itemForSpan = (idxForItem !== null && !isNaN(idxForItem)) ? pending.lineItems[idxForItem] : null;
      const addBackOwn = (isDecreaseInp || isIncreaseInp) && itemForSpan;
      const baseRaw = addBackOwn ? s.raw + (Number(itemForSpan.storeFromRaw) || 0) : s.raw;
      const baseSpare = addBackOwn ? s.spare + (Number(itemForSpan.storeFromSpare) || 0) : s.spare;
      const effectiveTotal = baseRaw + baseSpare;
      // Overwriting with the ADD-BACK-INCLUSIVE numbers — the dataset
      // values were set above from s.raw/s.spare/total (live-pool-only,
      // BEFORE this row's own held stock gets added back), so the cap
      // logic below and any other reader of these same dataset keys was
      // silently disagreeing with the "remaining" text this function
      // itself displays two lines down.
      span.dataset.liveRaw = baseRaw;
      span.dataset.liveSpare = baseSpare;
      span.dataset.liveTotal = effectiveTotal;
      const split = computeLiveStoreSplit(baseRaw, baseSpare, currentVal);
      span.textContent = `${split.remainingRaw + split.remainingSpare} (Raw: ${split.remainingRaw}, Spare: ${split.remainingSpare})`;
      const bufferedReqForCap = itemForSpan ? (Number(itemForSpan.bufferedRequirement) || 0) : Infinity;
      if (inp) {
        if (!inp.classList.contains("prn-create-decrease-storeqty")) {
          if (inp.disabled) { inp.disabled = false; inp.style.opacity = "1"; }
          const cap = Math.min(effectiveTotal, bufferedReqForCap);
          inp.max = cap;
          if (currentVal > cap) { inp.value = Math.round(cap * 100) / 100; inp.dispatchEvent(new Event("input")); }
        }
      }
    });
  } catch(e) { /* silent, retry next interval */ }
}

function updatePRNDecreaseRowPurchaseQty(idx, input) {
  const totalCovered = parseFloat(input.dataset.totalCovered) || 0;
  const item = window.prnPendingCreate.lineItems[idx];
  const bufferedReq = Number(item.bufferedRequirement) || 0;
  const liveSpan = document.querySelector(`.prn-create-livestock[data-itemcode="${item.itemCode}"]`);
  const liveCap = (liveSpan && liveSpan.dataset.liveTotal !== undefined) ? Number(liveSpan.dataset.liveTotal) : totalCovered;
  const realCap = Math.min(totalCovered, bufferedReq, isNaN(liveCap) ? totalCovered : liveCap);
  let val = parseFloat(input.value) || 0;
  if (val < 0) { val = 0; input.value = "0"; }
  if (val > realCap) { val = Math.round(realCap * 100) / 100; input.value = val; }
  const purchaseCell = document.getElementById(`prn-create-purchaseqty-${idx}`);
  if (!purchaseCell) return;
  const purchaseQty = Math.max(0, bufferedReq - val);
  const rounded = item.isCountUnit ? Math.ceil(purchaseQty - 1e-9) : purchaseQty;
  purchaseCell.textContent = trimNum(rounded);
}

