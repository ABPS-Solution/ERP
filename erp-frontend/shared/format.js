// Ported verbatim from ABPS Portal's shared/format.js (31 Aug 2026) — these
// are generic display/date helpers, not department-specific, so nothing
// here needed trimming for ERP's 3-section scope.

// boqRowMaterialDisplayText / autoGrowPoField — added 4 Sep 2026 alongside
// the Design department mirror. In Portal these live in shared/format.js
// and marketing/leads.js respectively; autoGrowPoField's real home
// (marketing/leads.js) doesn't exist in ERP, and it's a small enough
// generic DOM utility (auto-growing a <textarea> to fit its content) that
// it belongs here instead of a new file for one function.
function boqRowMaterialDisplayText(row) {
  const name = (row && row.materialName || "").toString();
  const make = (row && row.make || "").toString().trim();
  return make ? `${name} - Make: ${make}` : name;
}

function autoGrowPoField(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

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
  const dateOnlyMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
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
function formatOrdinalDate(value) {
  if (!value) return '';
  const d = _ordinalDateParse(value);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${day}${_ordinalSuffix(day)} ${month} ${d.getFullYear()}`;
}
function formatOrdinalDateTime(value) {
  if (!value) return '';
  const d = _ordinalDateParse(value);
  if (isNaN(d.getTime())) return '';
  const datePart = formatOrdinalDate(d);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${datePart}, ${time}`;
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
  wrap.style.cssText = 'position:relative; display:inline-block; width:100%; vertical-align:middle;';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  input.style.width = '100%';
  input.style.color = 'transparent';
  input.style.background = 'transparent';
  input.style.position = 'relative';
  input.style.zIndex = '1';

  const overlay = document.createElement('span');
  overlay.style.cssText = 'position:absolute; left:1px; top:0; right:26px; bottom:0; display:flex; align-items:center; padding-left:9px; pointer-events:none; font:inherit; z-index:2;';
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

function enhanceAllDateInputsForDMY() {
  document.querySelectorAll('input[type="date"]').forEach(input => {
    if (input.dataset.dmyEnhanced) {
      if (input._dmySync) input._dmySync();
    } else {
      enhanceOneDateInputForDMY(input);
    }
  });
}
setInterval(enhanceAllDateInputsForDMY, 400);
