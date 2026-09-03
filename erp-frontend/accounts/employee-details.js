// accounts/employee-details.js — "Employee Details" toggle. Name/EMP
// ID/Department/Position are editable inline (EMP ID and Department are
// compulsory server-side); Current Balance never is (it only ever moves
// via Pay Advance / Check Voucher). Add supports a non-zero opening
// balance. Delete removes the employee row entirely — the backend still
// refuses to delete an employee with a non-zero Tour or Daily Cash
// balance, or any advance/voucher/expense/booking history. Ported from
// ABPS Portal (31 Aug 2026), Position + Position-Based Daily Expense
// Limits added when the position-based-limits feature was ported.
//
// NOTE: unlike Portal, this stays Tour Expense's OWN Employee Details
// screen — Daily Cash/UPI/Online Expenses keeps its separate
// accounts/cash-expense-employees.js here rather than the unified
// shared screen Portal later built. Both still read/write the same
// accounts.tour_employees row; unifying the two screens the way Portal
// did is a follow-up, not done in this port.

async function initializeEmployeeDetailsPanel() {
  const panel = document.getElementById("te-panel-employees");
  panel.innerHTML = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:14px;">
      <button class="nav-btn-styled" onclick="edToggleAddForm()">+ Add Employee</button>
    </div>
    <div id="ed-add-form" style="display:none; background:var(--highlight-bg); padding:16px; border-radius:var(--radius); margin-bottom:16px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
        <input type="text" id="ed-new-name" placeholder="Employee Name" style="padding:9px 10px; border:1px solid var(--border); border-radius:6px; flex:1; min-width:160px;">
        <input type="text" id="ed-new-empcode" placeholder="EMP ID *" style="padding:9px 10px; border:1px solid var(--border); border-radius:6px; flex:1; min-width:120px;">
        <input type="text" id="ed-new-dept" placeholder="Department *" style="padding:9px 10px; border:1px solid var(--border); border-radius:6px; flex:1; min-width:140px;">
        <select id="ed-new-position" style="padding:9px 10px; border:1px solid var(--border); border-radius:6px; flex:1; min-width:120px;">
          <option value="Staff">Staff</option><option value="Manager">Manager</option>
        </select>
        <input type="number" id="ed-new-balance" placeholder="Opening Balance" style="padding:9px 10px; border:1px solid var(--border); border-radius:6px; flex:1; min-width:140px;">
      </div>
      <button class="nav-btn-styled" onclick="submitAddEmployee()">Submit</button>
      <button class="nav-btn-styled" onclick="document.getElementById('ed-add-form').style.display='none';">Cancel</button>
    </div>
    <div id="ed-table-wrap" style="overflow-x:auto;"></div>

    <!-- Position-Based Daily Expense Limits (Tour Expense Vouchers only) -->
    <div style="margin-top:28px; padding-top:18px; border-top:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="margin:0;">Position-Based Daily Expense Limits</h3>
        <button class="nav-btn-styled" onclick="elToggleAddForm()">+ Add Limit</button>
      </div>
      <div id="el-add-form" style="display:none; background:var(--highlight-bg); padding:16px; border-radius:var(--radius); margin-bottom:16px;">
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
          <input type="text" id="el-new-type" placeholder="Expense Type (e.g. Food)" style="padding:9px 10px; border:1px solid var(--border); border-radius:6px; flex:1; min-width:160px;">
          <input type="number" id="el-new-manager" placeholder="Manager Daily Limit" style="padding:9px 10px; border:1px solid var(--border); border-radius:6px; flex:1; min-width:140px;">
          <input type="number" id="el-new-staff" placeholder="Staff Daily Limit" style="padding:9px 10px; border:1px solid var(--border); border-radius:6px; flex:1; min-width:140px;">
        </div>
        <button class="nav-btn-styled" onclick="submitAddExpenseLimit()">Submit</button>
        <button class="nav-btn-styled" onclick="document.getElementById('el-add-form').style.display='none';">Cancel</button>
      </div>
      <div id="el-table-wrap" style="overflow-x:auto;"></div>
    </div>`;
  await loadEmployeeDetailsTable();
  await loadExpenseLimitsTable();
}

function edToggleAddForm() {
  const f = document.getElementById("ed-add-form");
  f.style.display = f.style.display === "none" ? "block" : "none";
}

async function loadEmployeeDetailsTable() {
  const wrap = document.getElementById("ed-table-wrap");
  wrap.innerHTML = `<div style="padding:20px; text-align:center; color:var(--muted);">Loading...</div>`;
  try {
    const data = await apFetch({ action: "listAllTourEmployees" });
    if (!data.success) { wrap.innerHTML = `<p style="color:var(--warn);">${escapeHtml(data.error)}</p>`; return; }
    const rows = data.employees.map(e => `
      <tr style="border-bottom:1px solid var(--border); opacity:${e.status === 'Inactive' ? '0.55' : '1'};" data-employee-id="${e.employeeId}" data-balance="${e.balance}">
        <td style="padding:7px;"><input type="text" class="ed-f-name" value="${escapeHtml(e.employeeName)}" style="width:100%; padding:5px; border:1px solid var(--border); border-radius:4px;"></td>
        <td style="padding:7px;"><input type="text" class="ed-f-empcode" value="${escapeHtml(e.empCode || '')}" style="width:100%; padding:5px; border:1px solid var(--border); border-radius:4px;"></td>
        <td style="padding:7px;"><input type="text" class="ed-f-dept" value="${escapeHtml(e.departmentName || '')}" style="width:100%; padding:5px; border:1px solid var(--border); border-radius:4px;"></td>
        <td style="padding:7px;">
          <select class="ed-f-position" style="width:100%; padding:5px; border:1px solid var(--border); border-radius:4px;">
            <option value="Staff" ${e.positionType !== 'Manager' ? 'selected' : ''}>Staff</option>
            <option value="Manager" ${e.positionType === 'Manager' ? 'selected' : ''}>Manager</option>
          </select>
        </td>
        <td style="padding:7px; text-align:right; font-weight:700;">${formatINRComma(e.balance)}</td>
        <td style="padding:7px; text-align:center;">${e.status === 'Active' ? 'Active' : '<span style="color:#b91c1c; font-weight:700;">Inactive</span>'}</td>
        <td style="padding:7px; white-space:nowrap;">
          <button class="nav-btn-styled" style="padding:5px 10px; font-size:0.76rem;" onclick="submitUpdateEmployee(${e.employeeId})">Save</button>
          <button class="nav-btn-styled" style="padding:5px 10px; font-size:0.76rem; background:#b91c1c; color:#fff;" onclick="submitDeleteEmployee(${e.employeeId}, '${escapeHtml(e.employeeName).replace(/'/g, "\\'")}')">Delete</button>
        </td>
      </tr>`).join("");
    wrap.innerHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
        <thead><tr style="background:var(--highlight-bg); text-align:left;">
          <th style="padding:8px;">Name</th><th style="padding:8px;">EMP ID</th><th style="padding:8px;">Department</th>
          <th style="padding:8px;">Position</th>
          <th style="padding:8px; text-align:right;">Current Balance</th><th style="padding:8px;">Status</th><th style="padding:8px;">Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch (e) { wrap.innerHTML = `<p style="color:var(--warn);">${escapeHtml(e.message)}</p>`; }
}

async function submitAddEmployee() {
  const employeeName = document.getElementById("ed-new-name").value.trim();
  const empCode = document.getElementById("ed-new-empcode").value.trim();
  const departmentName = document.getElementById("ed-new-dept").value.trim();
  const positionType = document.getElementById("ed-new-position").value;
  const openingBalance = document.getElementById("ed-new-balance").value;
  if (!employeeName) return showTourFeedback("Employee Name is required.", "error");
  if (!empCode) return showTourFeedback("EMP ID is required.", "error");
  if (!departmentName) return showTourFeedback("Department is required.", "error");

  showBlockingOverlay("Adding employee...");
  try {
    const data = await apFetch({ action: "addTourEmployee", employeeName, empCode, departmentName, positionType, openingBalance });
    hideBlockingOverlay();
    if (data.success) {
      document.getElementById("ed-add-form").style.display = "none";
      ["ed-new-name", "ed-new-empcode", "ed-new-dept", "ed-new-balance"].forEach(id => document.getElementById(id).value = "");
      loadEmployeeDetailsTable();
      showTourSuccess("Employee added.", "Add Another Employee", "switchTourExpenseToggle('employees'); edToggleAddForm();");
    } else {
      showTourFeedback(data.error, "error");
    }
  } catch (e) { hideBlockingOverlay(); showTourFeedback("Network error: " + e.message, "error"); }
}

async function submitUpdateEmployee(employeeId) {
  const row = document.querySelector(`tr[data-employee-id="${employeeId}"]`);
  const employeeName = row.querySelector(".ed-f-name").value.trim();
  const empCode = row.querySelector(".ed-f-empcode").value.trim();
  const departmentName = row.querySelector(".ed-f-dept").value.trim();
  const positionType = row.querySelector(".ed-f-position").value;
  if (!employeeName) return showTourFeedback("Employee Name is required.", "error");
  if (!empCode) return showTourFeedback("EMP ID is required.", "error");
  if (!departmentName) return showTourFeedback("Department is required.", "error");

  showBlockingOverlay("Saving...");
  try {
    const data = await apFetch({ action: "updateTourEmployee", employeeId, employeeName, empCode, departmentName, positionType });
    hideBlockingOverlay();
    if (data.success) { loadEmployeeDetailsTable(); showTourSuccess("Saved.", "Edit Another Employee", "switchTourExpenseToggle('employees')"); }
    else showTourFeedback(data.error, "error");
  } catch (e) { hideBlockingOverlay(); showTourFeedback("Network error: " + e.message, "error"); }
}

async function submitDeleteEmployee(employeeId, employeeName) {
  if (!confirm(`Permanently delete "${employeeName}"? This cannot be undone. (Blocked if their balance isn't 0 or they have any advance/voucher/expense/booking history.)`)) return;
  showBlockingOverlay("Deleting...");
  try {
    const data = await apFetch({ action: "deleteTourEmployee", employeeId });
    hideBlockingOverlay();
    if (data.success) { loadEmployeeDetailsTable(); showTourSuccess(`"${employeeName}" deleted.`, "Back to Employee Details", "switchTourExpenseToggle('employees')"); }
    else showTourFeedback(data.error, "error");
  } catch (e) { hideBlockingOverlay(); showTourFeedback("Network error: " + e.message, "error"); }
}

// ── Position-Based Daily Expense Limits ──────────────────────────────
// Grouped by expense_type — one row shows both the Manager and Staff
// daily limit for that type side by side, since upsertTourExpenseLimit
// takes one (positionType, expenseType) pair per call. positionType/
// expenseType are read-only once a row exists (changing either would
// silently create a NEW row via ON CONFLICT rather than move the old
// one) — only the two limit amounts are editable in place.
function elToggleAddForm() {
  const f = document.getElementById("el-add-form");
  f.style.display = f.style.display === "none" ? "block" : "none";
}

async function loadExpenseLimitsTable() {
  const wrap = document.getElementById("el-table-wrap");
  if (!wrap) return;
  wrap.innerHTML = `<div style="padding:20px; text-align:center; color:var(--muted);">Loading...</div>`;
  try {
    const data = await apFetch({ action: "listTourExpenseLimits" });
    if (!data.success) { wrap.innerHTML = `<p style="color:var(--warn);">${escapeHtml(data.error)}</p>`; return; }
    const byType = {};
    data.limits.forEach(l => {
      const g = (byType[l.expenseType] ||= { expenseType: l.expenseType, managerLimitId: null, managerLimit: '', staffLimitId: null, staffLimit: '' });
      if (l.positionType === 'Manager') { g.managerLimitId = l.limitId; g.managerLimit = l.dailyLimit; }
      else { g.staffLimitId = l.limitId; g.staffLimit = l.dailyLimit; }
    });
    const groups = Object.values(byType);
    if (groups.length === 0) {
      wrap.innerHTML = `<div style="padding:16px; text-align:center; color:var(--muted); background:var(--highlight-bg); border-radius:var(--radius);">No limits configured.</div>`;
      return;
    }
    const rows = groups.map(g => `
      <tr style="border-bottom:1px solid var(--border);" data-expense-type="${escapeHtml(g.expenseType)}">
        <td style="padding:7px; font-weight:700;">${escapeHtml(g.expenseType)}</td>
        <td style="padding:7px;"><input type="number" class="el-f-manager" value="${g.managerLimit}" style="width:100%; padding:5px; border:1px solid var(--border); border-radius:4px;"></td>
        <td style="padding:7px;"><input type="number" class="el-f-staff" value="${g.staffLimit}" style="width:100%; padding:5px; border:1px solid var(--border); border-radius:4px;"></td>
        <td style="padding:7px; white-space:nowrap;">
          <button class="nav-btn-styled" style="padding:5px 10px; font-size:0.76rem;" onclick="submitUpdateExpenseLimit('${escapeHtml(g.expenseType).replace(/'/g, "\\'")}')">Save</button>
          <button class="nav-btn-styled" style="padding:5px 10px; font-size:0.76rem; background:#b91c1c; color:#fff;" onclick="submitDeleteExpenseLimit('${escapeHtml(g.expenseType).replace(/'/g, "\\'")}')">Delete</button>
        </td>
      </tr>`).join("");
    wrap.innerHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
        <thead><tr style="background:var(--highlight-bg); text-align:left;">
          <th style="padding:8px;">Expense Type</th><th style="padding:8px;">Manager Daily Limit</th>
          <th style="padding:8px;">Staff Daily Limit</th><th style="padding:8px;">Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch (e) { wrap.innerHTML = `<p style="color:var(--warn);">${escapeHtml(e.message)}</p>`; }
}

async function submitAddExpenseLimit() {
  const expenseType = document.getElementById("el-new-type").value.trim();
  const managerLimit = document.getElementById("el-new-manager").value;
  const staffLimit = document.getElementById("el-new-staff").value;
  if (!expenseType) return showTourFeedback("Expense Type is required.", "error");
  if (!managerLimit && !staffLimit) return showTourFeedback("At least one of Manager/Staff Daily Limit is required.", "error");

  showBlockingOverlay("Saving...");
  try {
    if (managerLimit) {
      const d = await apFetch({ action: "upsertTourExpenseLimit", positionType: "Manager", expenseType, dailyLimit: managerLimit });
      if (!d.success) { hideBlockingOverlay(); return showTourFeedback(d.error, "error"); }
    }
    if (staffLimit) {
      const d = await apFetch({ action: "upsertTourExpenseLimit", positionType: "Staff", expenseType, dailyLimit: staffLimit });
      if (!d.success) { hideBlockingOverlay(); return showTourFeedback(d.error, "error"); }
    }
    hideBlockingOverlay();
    document.getElementById("el-add-form").style.display = "none";
    ["el-new-type", "el-new-manager", "el-new-staff"].forEach(id => document.getElementById(id).value = "");
    loadExpenseLimitsTable();
  } catch (e) { hideBlockingOverlay(); showTourFeedback("Network error: " + e.message, "error"); }
}

async function submitUpdateExpenseLimit(expenseType) {
  const row = document.querySelector(`tr[data-expense-type="${CSS.escape(expenseType)}"]`);
  const managerLimit = row.querySelector(".el-f-manager").value;
  const staffLimit = row.querySelector(".el-f-staff").value;
  showBlockingOverlay("Saving...");
  try {
    if (managerLimit) {
      const d = await apFetch({ action: "upsertTourExpenseLimit", positionType: "Manager", expenseType, dailyLimit: managerLimit });
      if (!d.success) { hideBlockingOverlay(); return showTourFeedback(d.error, "error"); }
    }
    if (staffLimit) {
      const d = await apFetch({ action: "upsertTourExpenseLimit", positionType: "Staff", expenseType, dailyLimit: staffLimit });
      if (!d.success) { hideBlockingOverlay(); return showTourFeedback(d.error, "error"); }
    }
    hideBlockingOverlay();
    loadExpenseLimitsTable();
  } catch (e) { hideBlockingOverlay(); showTourFeedback("Network error: " + e.message, "error"); }
}

async function submitDeleteExpenseLimit(expenseType) {
  if (!confirm(`Delete the daily limit(s) for "${expenseType}"?`)) return;
  const row = document.querySelector(`tr[data-expense-type="${CSS.escape(expenseType)}"]`);
  showBlockingOverlay("Deleting...");
  try {
    const data = await apFetch({ action: "listTourExpenseLimits" });
    const matches = data.success ? data.limits.filter(l => l.expenseType === expenseType) : [];
    for (const l of matches) {
      await apFetch({ action: "deleteTourExpenseLimit", limitId: l.limitId });
    }
    hideBlockingOverlay();
    loadExpenseLimitsTable();
  } catch (e) { hideBlockingOverlay(); showTourFeedback("Network error: " + e.message, "error"); }
}
