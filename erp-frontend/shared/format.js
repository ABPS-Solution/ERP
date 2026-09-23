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
