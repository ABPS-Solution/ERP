// Ported verbatim from ABPS Portal's shared/format.js (31 Aug 2026) — these
// are generic display/date helpers, not department-specific, so nothing
// here needed trimming for ERP's 3-section scope.

// buildMaterialDisplayLabel — added 16 Sep 2026 (Batch 5, Purchase).
// store/create-prn.js calls it and it was genuinely missing from ERP,
// so the PRN header product label threw. Portal keeps it here too.
// Client-side mirror of routes/design.js's buildMaterialDisplayLabel — same
// "Name - Rating - Description of Material - Make: X" convention, Make
// only appended when it actually has a value. Used anywhere a screen needs
// to build this label itself instead of getting a ready-made displayLabel
// back from the server.
function buildMaterialDisplayLabel(materialName, rating, descriptionOfMaterial, make) {
  const parts = [(materialName || "").toString().trim()];
  const r = (rating || "").toString().trim();
  if (r) parts.push(r);
  const d = (descriptionOfMaterial || "").toString().trim();
  if (d) parts.push(d);
  const m = (make || "").toString().trim();
  if (m) parts.push(`Make: ${m}`);
  return parts.join(" - ");
}

// boqRowMaterialDisplayText — added 4 Sep 2026 alongside the Design
// department mirror. In Portal this lives in shared/format.js.
function boqRowMaterialDisplayText(row) {
  const name = (row && row.materialName || "").toString();
  const make = (row && row.make || "").toString().trim();
  return make ? `${name} - Make: ${make}` : name;
}

// autoGrowPoField used to be stubbed here ("marketing/leads.js doesn't
// exist in ERP") — now that Marketing has been ported (15 Sep 2026),
// leads.js provides the real one (a thin wrapper over autoGrowTextField,
// matching Portal exactly). Removed here to avoid two competing top-level
// `function autoGrowPoField` declarations across the app's one shared
// script scope.

function escapeHtml(value) {
  return (value === null || value === undefined ? "" : String(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// A server string as a JS argument inside an inline on*="..." handler:
// JSON gives a safe JS literal, escapeHtml keeps it inside the attribute.
function jsArg(value) {
  return escapeHtml(JSON.stringify(value === null || value === undefined ? "" : String(value)));
}

function fmtQty(n) {
  return (Number(n) || 0).toString();
}

// Trims trailing zeros from a NUMERIC-column value Postgres returns as a
// string like "2.000" -- shows "2" for whole numbers, "2.5" if that's
// what's actually there, never a padded decimal.
function formatQtyTrimmed(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (isNaN(n)) return String(value);
  return String(parseFloat(n.toFixed(6)));
}

// Trimmed + comma-grouped (Indian digit grouping) — "16000" -> "16,000".
// Ported here (not left duplicated per-file like Portal's tour-shell.js /
// cash-expense-shell.js both do) since it's a generic formatter used by
// every accounts/*.js screen.
function formatINRComma(n) {
  return Number(trimNum(n)).toLocaleString('en-IN');
}

function trimNum(n) {
  const x = Number(n) || 0;
  return Number.isInteger(x) ? String(x) : x.toFixed(2);
}

function formatDateDMY(value) {
  if (!value) return "";
  const s = String(value);
  const dateOnlyMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, yyyy, mm, dd] = dateOnlyMatch;
    return `${dd}-${mm}-${yyyy}`;
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value || "";
  return `${get('day')}-${get('month')}-${get('year')}`;
}

// Ordinal display date ("4th Sep 2026") — ported from Portal's
// shared/format.js, used throughout the Accounts Tour Expense /
// Travel-Hotel Booking screens ported from there.
// A bare "YYYY-MM-DD" is parsed as that literal calendar date (not shifted
// by the browser's local timezone) — everything else falls back to a plain
// `new Date(value)` parse.
function _ordinalDateParse(value) {
  if (value instanceof Date) return value;
  const s = String(value);
  const dateOnlyMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, yyyy, mm, dd] = dateOnlyMatch;
    return new Date(+yyyy, +mm - 1, +dd);
  }
  return new Date(s);
}
function _ordinalSuffix(day) {
  return (day % 10 === 1 && day !== 11) ? 'st'
    : (day % 10 === 2 && day !== 12) ? 'nd'
    : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
}
// One set of month names for every screen and document (matches
// abps-backend/lib/docDate.js): September is always "Sept".
const APP_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
function formatOrdinalDate(value) {
  if (!value) return '';
  const d = _ordinalDateParse(value);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = APP_MONTH_NAMES[d.getMonth()];
  return `${day}${_ordinalSuffix(day)} ${month} ${d.getFullYear()}`;
}
function formatOrdinalDateTime(value) {
  if (!value) return '';
  const d = _ordinalDateParse(value);
  if (isNaN(d.getTime())) return '';
  // Always IST, whatever the viewing device's own time zone is.
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(d).map(x => [x.type, x.value]));
  const day = Number(p.day);
  const suffix = (day % 10 === 1 && day !== 11) ? 'st'
    : (day % 10 === 2 && day !== 12) ? 'nd'
    : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
  return `${day}${suffix} ${APP_MONTH_NAMES[Number(p.month) - 1]} ${p.year}, ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

// ═══════════════════════════════════════════════════════
// DATE INPUT FORMAT ENHANCER — force DD/MM/YYYY display
// ═══════════════════════════════════════════════════════
function formatDMYFromISO(iso) {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

function enhanceOneDateInputForDMY(input) {
  if (input.dataset.dmyEnhanced) return;
  input.dataset.dmyEnhanced = "1";

  const wrap = document.createElement('span');
  // min-width:0 matters on a narrow (mobile) grid column — a flex/grid
  // item's default min-width is its content's min-content size, which for
  // an inline-block can refuse to shrink below that and silently overflow
  // its column instead of respecting width:100%.
  wrap.style.cssText = 'position:relative; display:inline-block; width:100%; min-width:0; max-width:100%; vertical-align:middle; box-sizing:border-box;';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  input.style.width = '100%';
  input.style.color = 'transparent';
  input.style.background = 'transparent';
  input.style.position = 'relative';
  input.style.zIndex = '1';

  // overflow:hidden + nowrap/ellipsis is defensive — the formatted text
  // should always fit, but a narrow mobile column must never let it
  // visually spill past the box's own border.
  const overlay = document.createElement('span');
  overlay.style.cssText = 'position:absolute; left:1px; top:0; right:26px; bottom:0; display:flex; align-items:center; padding-left:9px; pointer-events:none; font:inherit; z-index:2; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;';
  wrap.appendChild(overlay);

  const sync = () => {
    const formatted = formatDMYFromISO(input.value);
    overlay.textContent = formatted || 'dd/mm/yyyy';
    overlay.style.color = formatted ? 'inherit' : '#9ca3af';
  };
  input.addEventListener('input', sync);
  input.addEventListener('change', sync);
  input._dmySync = sync;
  sync();
}

// Formats a native <input type="time"> value ("HH:MM", always 24-hour
// regardless of locale) into a friendly "h:mm AM/PM" string.
function formatTimeAMPMFromHM(hm) {
  if (!hm) return '';
  const parts = hm.split(':');
  if (parts.length < 2) return '';
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

// Same overlay technique as enhanceOneDateInputForDMY, for the same
// underlying reason: on mobile Safari/Chrome, a native <input type="time">'s
// OWN displayed digits are rendered by the browser's internal time-picker
// widget at a size that largely ignores the input's own font-size/line-
// height CSS — this made "Time of Meeting" render as oversized, mismatched-
// looking text next to a normally-sized Date of Meeting field (which
// already had this same transparent-input-plus-custom-overlay treatment).
// Hiding the native text (color:transparent) and drawing our own small,
// consistently-styled "h:mm AM/PM" overlay on top fixes this the same way
// the date fix did, without touching the native picker itself — clicks
// still fall through and open it normally.
function enhanceOneTimeInputForAMPM(input) {
  if (input.dataset.ampmEnhanced) return;
  input.dataset.ampmEnhanced = "1";

  const wrap = document.createElement('span');
  wrap.style.cssText = 'position:relative; display:inline-block; width:100%; min-width:0; max-width:100%; vertical-align:middle; box-sizing:border-box;';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  input.style.width = '100%';
  input.style.color = 'transparent';
  input.style.background = 'transparent';
  input.style.position = 'relative';
  input.style.zIndex = '1';

  const overlay = document.createElement('span');
  overlay.style.cssText = 'position:absolute; left:1px; top:0; right:26px; bottom:0; display:flex; align-items:center; padding-left:9px; pointer-events:none; font:inherit; z-index:2; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;';
  wrap.appendChild(overlay);

  const sync = () => {
    const formatted = formatTimeAMPMFromHM(input.value);
    overlay.textContent = formatted || '--:-- --';
    overlay.style.color = formatted ? 'inherit' : '#9ca3af';
  };
  input.addEventListener('input', sync);
  input.addEventListener('change', sync);
  input._ampmSync = sync;
  sync();
}

function enhanceAllTimeInputsForAMPM() {
  document.querySelectorAll('input[type="time"]').forEach(input => {
    if (input.closest('#reusable-child-modules-template')) return;
    if (input.dataset.ampmEnhanced) {
      if (input._ampmSync) input._ampmSync();
    } else {
      enhanceOneTimeInputForAMPM(input);
    }
  });
}

function enhanceAllDateInputsForDMY() {
  // #reusable-child-modules-template (Follow-up/Task forms) is a hidden
  // master copy that gets cloneNode(true)'d fresh for every lead — never
  // enhance the master itself, or every clone inherits the wrapper/overlay
  // markup and transparent input styling via cloneNode WITHOUT the sync
  // event listeners cloneNode can't copy, leaving Target Date / Next
  // Follow-Up Date looking frozen and unresponsive on every clone.
  document.querySelectorAll('input[type="date"]').forEach(input => {
    if (input.closest('#reusable-child-modules-template')) return;
    if (input.dataset.dmyEnhanced) {
      if (input._dmySync) input._dmySync();
    } else {
      enhanceOneDateInputForDMY(input);
    }
  });
}
setInterval(enhanceAllDateInputsForDMY, 400);

// ── Follow-up timestamp helpers (Batch 6, 16 Sep 2026) ────────────────
// Ported verbatim from Portal's shared/format.js. Needed by
// store/qa.js's renderIsolatedFollowUpTimeline — which despite living in
// a Store-named file is a MARKETING lead-card helper (an artifact of
// Portal's own 4 Sep 2026 automated file split), called by
// marketing/companies.js and marketing/leads.js. Batch 5's partial
// store/qa.js extracted only exitCanvasToCardView, so that renderer was
// genuinely undefined in ERP and lead View Details' follow-up timeline
// threw; the full qa.js port in Batch 6 fixes that, and these three
// helpers are what it needs.
function formatPlainTimeOfDay(rawStr) {
  if (!rawStr) return "";
  const m = rawStr.toString().trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  let hours = parseInt(m[1], 10);
  const minutes = m[2];
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12; hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

function formatCleanDateOnly(rawStr) {
  return formatDateDMY(rawStr);
}

// Extracts the YYYY-MM-DD portion from a raw date/timestamp value so it can
// be assigned directly to a native <input type="date">.value -- that input
// ONLY accepts YYYY-MM-DD; assigning it a DD-MM-YYYY string (e.g. from
// formatCleanDateOnly) silently fails and leaves the field blank. Was
// missing from this file entirely (never ported from Portal) -- every
// caller (marketing/tasks-followups.js's Edit Task flow and its own
// Task Matrix "Overdue"/date-bucket logic) threw
// "toDateInputValue is not defined" for every filter EXCEPT the two whose
// bucket math happened not to call it.
function toDateInputValue(rawStr) {
  if (!rawStr) return "";
  const m = rawStr.toString().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

// Combines a plain event_date + event_time pair (see formatPlainTimeOfDay)
// into "h:mm am/pm DD-MM-YYYY" for a created/last-edited timestamp column.
function formatFollowUpTimestamp(dateVal, timeVal) {
  const datePart = formatCleanDateOnly(dateVal);
  const timePart = formatPlainTimeOfDay(timeVal);
  if (!datePart && !timePart) return "";
  return `${timePart} ${datePart}`.trim();
}

// Item-code search: matches the full "Name - Rating - Make" text (so a
// name copied from another screen finds its item), ignoring extra spaces.
// Gate Entry's uploaded Invoice / Challan as "open in new tab" links.
// drive_image_url holds "invoiceUrl, challanUrl" (either may be missing).
function gateDocLinksHtml(docUrls, invoiceNumber, challanNumber) {
  const urls = String(docUrls || "").split(",").map(u => u.trim()).filter(Boolean);
  if (!urls.length) return '<span style="font-size:0.78rem; color:var(--muted); margin-left:6px;">No invoice / challan uploaded</span>';
  let labels;
  if (urls.length >= 2) labels = ["View Invoice", "View Challan"];
  else if (invoiceNumber && !challanNumber) labels = ["View Invoice"];
  else if (challanNumber && !invoiceNumber) labels = ["View Challan"];
  else labels = ["View Invoice / Challan"];
  return urls.slice(0, 2).map((u, i) => `<a href="${escapeHtml(driveLink(u))}" target="_blank" rel="noopener" onclick="event.stopPropagation();"
    style="display:inline-block; margin-left:6px; padding:3px 9px; border:1px solid var(--brand); border-radius:4px; color:var(--brand); font-weight:700; font-size:0.78rem; text-decoration:none; background:#fff;">${labels[i] || "View Document"} ↗</a>`).join("");
}

function itemCatalogMatches(it, query) {
  return materialSearchScore(it, query) > 0;
}

// ── Forgiving material search (3 Oct 2026) ────────────────────────────
// One search used by every material picker. Ignores spaces/punctuation
// ("bus bar" = "busbar", "50x6" = "50 x 6"), takes words in any order,
// tolerates 1-2 wrong letters per word, understands shop-floor short forms
// (MATERIAL_SEARCH_ALIASES) and ranks the best match first.
const MATERIAL_SEARCH_ALIASES = {
  al: "aluminium", alu: "aluminium", aluminum: "aluminium", alluminium: "aluminium", allu: "aluminium",
  cu: "copper", cop: "copper", cap: "capacitor", caps: "capacitor", capa: "capacitor",
  fg: "fiber glass", fibre: "fiber", frp: "fiber glass", ss: "stainless steel",
  gi: "galvanized", hdg: "hot dip galvanized", galvanised: "galvanized",
  lugs: "lug", bolts: "bolt", nuts: "nut", washers: "washer", fuses: "fuse", lamps: "lamp",
  sleve: "sleeve", sleev: "sleeve", washar: "washer", wahhar: "washer", condactor: "conductor",
  woodn: "wooden", hardner: "hardener", pepar: "paper", sander: "sand", matrial: "material",
  thred: "thread", thard: "thread", buuble: "bubble", buble: "bubble", strech: "stretch", sterch: "stretch",
  insuleatar: "insulator", insulater: "insulator", contator: "contactor", contactar: "contactor",
  channal: "channel", groment: "grommet", cabal: "cable", cabel: "cable", termanal: "terminal",
  vaccum: "vacuum", vacum: "vacuum", favi: "fevi", putti: "putty", teap: "tape",
  ct: "current transformer", pt: "potential transformer", rvt: "residual voltage transformer",
  mcb: "mcb", mccb: "mccb", acb: "acb", vcb: "vcb", la: "arrester", sa: "surge arrester",
  pfc: "power factor controller", apfc: "apfc", ind: "indicating", ex: "exhaust"
};

function msNormText(t) {
  return String(t == null ? "" : t).toLowerCase()
    .replace(/&/g, " and ")
    .replace(/(\d)\s*x\s*(\d)/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9.]+/g, " ").replace(/(^|\s)\.|\.(\s|$)/g, " ")
    .replace(/\s+/g, " ").trim();
}

function msEditDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v); if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}

function msAllowedTypos(word) {
  if (/^\d/.test(word) || word.length <= 3) return 0;
  return word.length <= 6 ? 1 : 2;
}

// Score one query word against an item's words / compact text. 0 = no match.
function msWordScore(qw, words, compact) {
  if (/^\d/.test(qw)) {
    const qn = qw.replace(/^0+(?=\d)/, "");
    for (const w of words) if (w === qw || (/^\d/.test(w) && w.replace(/^0+(?=\d)/, "") === qn)) return 10;
    return 0;
  }
  let best = 0;
  for (const w of words) {
    if (w === qw) return 10;
    if (qw.length >= 2 && w.startsWith(qw)) best = Math.max(best, 7);
  }
  if (best) return best;
  if (qw.length >= 4 && compact.includes(qw)) return 6;
  const allowed = msAllowedTypos(qw);
  if (allowed) {
    for (const w of words) {
      if (w.length < 3 || /^\d/.test(w)) continue;
      const d = msEditDistance(qw, w, allowed);
      if (d <= allowed) best = Math.max(best, 5 - d);
      else if (w.length > qw.length) {
        const dp = msEditDistance(qw, w.slice(0, qw.length), allowed);
        if (dp <= allowed) best = Math.max(best, 3 - dp);
      }
    }
  }
  return best;
}

function msDefaultFields(it) {
  return [it.combinedName, it.productName, it.materialName, it.rating, it.make, it.itemCode, it.typeOfMaterial];
}

const _msPrepCache = new WeakMap();
function msPrepare(item, getFields) {
  const key = (item && typeof item === "object") ? item : null;
  const cached = key && !getFields ? _msPrepCache.get(key) : null;
  if (cached) return cached;
  const parts = (getFields || msDefaultFields)(item).filter(Boolean).map(msNormText);
  const words = Array.from(new Set(parts.join(" ").split(" ").filter(Boolean)));
  const prep = { parts, words, compact: parts.join("").replace(/ /g, "") };
  if (key && !getFields) _msPrepCache.set(key, prep);
  return prep;
}

// Returns 0 when the item does not match; otherwise higher = better.
function materialSearchScore(item, query, getFields) {
  const qText = msNormText(query);
  if (!qText) return 0;
  const prep = msPrepare(item, getFields);
  const parts = prep.parts, words = prep.words, compact = prep.compact;
  const qCompact = qText.replace(/ /g, "");
  let score = 0;
  for (const raw of qText.split(" ")) {
    let s = msWordScore(raw, words, compact);
    const alias = MATERIAL_SEARCH_ALIASES[raw];
    if (alias) {
      const aWords = msNormText(alias).split(" ");
      const aScore = Math.min(...aWords.map(a => msWordScore(a, words, compact)));
      s = Math.max(s, aScore);
    }
    if (!s) return 0;
    score += s;
  }
  if (qCompact.length >= 3 && compact.includes(qCompact)) score += 8;
  const main = parts[0] || "";
  if (main.startsWith(qText.split(" ")[0])) score += 3;
  return score;
}

// Ranked search: best matches first, at most `limit` results.
function materialSearch(list, query, limit, getFields) {
  const scored = [];
  (list || []).forEach((item, i) => {
    const s = materialSearchScore(item, query, getFields);
    if (s > 0) scored.push({ item, s, i });
  });
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  return scored.slice(0, limit || scored.length).map(x => x.item);
}
