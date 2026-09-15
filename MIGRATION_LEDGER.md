# Portal → ERP Migration Ledger

Tracks every unit of the Portal→ERP migration through `not started` →
`ported` → `deployed` → `click-tested` → `signed off`. Updated in the same
session as the work it tracks — this file is the answer to "did we miss
anything."

Plan: `C:\Users\ashwi\.claude\plans\ok-now-i-think-hazy-scott.md`

---

## Batch 0 — Schema foundation

**Status: signed off** (15 Sep 2026)

- Extracted live `pg_dump --schema-only` of both `portal_test` and `erp`
  (not from migration files) — `migration_planning/portal_test_schema_15sep2026.sql`,
  `erp_schema_15sep2026.sql`.
- Diffed programmatically (`migration_planning/build_batch0.py`) — found
  39 missing tables (marketing 9, qa 3, analytics 7, admin_db 1... wait,
  see exact list below), plus 9 missing `admin_db.users` permission
  columns, 1 renamed permission, 1 missing column on
  `production.finished_goods_inventory`.
- Migration file: `erp-backend/migrations/portal_parity_batch0_schema.sql`.
- **Dry-run validated**: ran the complete file against live ERP inside a
  transaction, confirmed zero errors (39 tables, 31 sequences, 115 ALTER
  statements, 23 triggers all created successfully), then ROLLBACK.
  Verified nothing persisted afterward.
- **Applied for real** the same session — exit code 0, zero errors,
  COMMIT.
- **Data safety verified both before and after**, by row count AND
  content checksum (not just counts):
  - `design.item_codes` — 795 rows, `md5(item_code||material_name)` over
    all rows identical before/after: `535fe62e13d2608341521ec7a8101ed6`
  - `admin_db.users` — 40 rows; permission-rename checksum
    (`person_key || perm_job_card_sheet`) identical before/after:
    `4c6b0c73aa909ebca72db4454cbc829a`; the 2 users who had
    `perm_job_card_in_process_sheet = true` still have
    `perm_job_card_sheet = true` after the rename
  - All 7 Accounts tables checked (`tour_employees`, `tour_advances`,
    `tour_vouchers`, `tour_voucher_lines`, `cash_expenses`,
    `cash_upi_balance`, `travel_tickets`) — row counts identical
    before/after
- **Master data copied** (per the "copy vendor info + buffer %, leave
  item code formats + tour companies as ERP's own" decision):
  `purchase.vendor_information` (3 rows) and
  `purchase.material_buffer_percentage` (38 rows), both from Portal,
  both confirmed empty in ERP before loading.
- Cloud SQL public IP opened and closed twice (dry-run + real apply +
  data copy) — never left open between operations.

### Tables added (39)

**marketing** (9): `companies`, `leads`, `follow_ups`, `tasks`,
`offers_sent`, `cold_introductory_emails_sent`,
`po_invoice_report_information`, `email_lead_notes`, `processed_emails`

**qa** (3): `inspection_calls`, `inspection_documents`,
`product_serial_traceability`

**analytics** (7): `capture_settings`, `invariant_check_results`,
`material_line_outcome`, `pipeline_snapshot`, `prn_line_snapshot`,
`stage_events`, `stock_snapshot`

**admin_db** (1): `document_registry`

**production** (4): `finished_goods_documents`,
`material_requirement_dates_history`, `product_plan_step_job_cards`,
`product_plan_steps`

**project** (7): `invoice_number_counters`, `ld_contractual_date_history`,
`ld_terms`, `project_invoice_documents`, `project_invoice_line_items`,
`project_invoices`, `timeline_milestones`

**store** (8): `inbound_store_ledger`, `material_outward_challans`,
`outbound_store_ledger`, `rejected_missing_material_tracking`,
`spare_blocked_allocations`, `stock_borrow_events`, `stock_sweeps`,
`store_tickets`

**Excluded on purpose** (Customer Queries Received through Email, not in
scope): `project.customer_queries`, `customer_query_breaches`,
`customer_query_communications`, `customer_query_target_history`,
`processed_query_emails`.

### Permissions added/fixed on `admin_db.users`

- Renamed: `perm_job_card_in_process_sheet` → `perm_job_card_sheet`
  (values preserved)
- Added (all default false): `perm_meeting_preparation`,
  `perm_production_planning`, `perm_qa_inspection_timeline`,
  `perm_product_serial_tracking`, `perm_qa_dashboard`,
  `perm_daily_timeline`, `perm_admin_dashboard`, `perm_in_process_sheet`

### Other schema fix

- `production.finished_goods_inventory.qa_approved_at` added (was
  genuinely missing, not a sequence-default false-positive)

---

## Batch 1 — Shared foundation

**Status: ported, committed locally, NOT pushed** (holding for explicit go-ahead —
standing rule, see top of the plan file)

- **Dept-tab scaffolding done**: added `dept-tab-marketing/project/store/qa/production`
  buttons + matching empty `dashboard-*-department-header-block` divs to `index.html`,
  and the 5 keys to `shared/navigation.js`'s `DEPT_TAB_KEYS`. Every new tab/block starts
  and stays hidden — `enforceDynamicModuleRoleGateways` itself is byte-for-byte
  unchanged (confirmed via `git diff`), so nothing currently gates their visibility.
  Verified additive-only: `index.html` diff is +58/-0 lines, `navigation.js` diff is
  +7/-1 (the one line that had to change, the array literal itself).
  Static checks clean: syntax, zero duplicate top-level `let`/`const`, zero missing
  `<script src>`, zero duplicate DOM ids. Loaded locally (erp-frontend preview server,
  port 8082) — zero console errors on load.
- **`shared/*.js` deep merge (apFetch/format/ui/typeahead/pinLogin) — deliberately
  DEFERRED, not done.** ERP's versions of these files have already diverged
  meaningfully from Portal's (different localStorage key prefixing, ERP-specific PIN/
  device flow, a smaller purpose-built set of helpers) — a blind overwrite or
  speculative merge risks breaking the live Accounts/Item Code/Security screens for no
  concrete benefit yet. Per the 4 Sep port's own documented lesson (pre-emptive merging
  caused more problems than it solved), each later batch will pull in the SPECIFIC
  helper functions it actually needs from Portal's shared files, in context, rather
  than this batch guessing ahead of time.
- **`sw.js` / offline caching — deliberately DEFERRED.** ERP has no service worker at
  all today. Adding one now would change fetch/caching behavior for every already-live
  screen for no current functional need, and Portal's own session history shows this
  exact mechanism causing real confusion (stale-cache debugging) even once mature. Add
  only if/when actually requested.
- **`documentation.js`/`drafts.js` — deliberately DEFERRED to the batches that need
  them** (Batch 9 Cross-cutting for docs; Batch 4 Design for drafts/Create BOQ
  autosave) — porting them now would be dead code with no backend route to call.

### Not pushed yet
Committed to the local ERP git repo only (commit `f9d4d67`). Will not touch the live
GitHub Pages ERP frontend until the user explicitly says to push.

## Batch 2 — Marketing

**Status: click-tested, committed locally, NOT pushed/deployed** — real
login (PIN, Ashwin Kumar/admin), all 10 screens + dashboard opened and
verified against the real DB, entirely on localhost (backend on :8090,
frontend statically served on :8091, temp `GAS_URL`/`db.js` SSL overrides
reverted immediately after — zero diff left in git). Cloud SQL public IP
opened and closed for the DB-side checks/fixes below.

### 4 real bugs found and fixed during click-testing (15 Sep 2026)

1. **`erp_app` DB role had no grant on 7 of Batch 0's new schemas**
   (`marketing`, `qa`, `project`, `production`, `purchase`, `store`,
   `analytics`) — Batch 0's migration ran as `postgres` and never granted
   the app's own runtime role USAGE/SELECT/INSERT/etc. on what it created.
   Every Marketing route calling `marketing.*` 500'd with
   `permission denied for schema marketing`. **This silently affected the
   ALREADY-LIVE Purchase and Store schemas too** — the same gap would have
   broken those in production the moment a query touched a Batch-0-added
   table, not just Marketing. Fixed with `GRANT USAGE`/`GRANT ALL ON ALL
   TABLES`/`ALTER DEFAULT PRIVILEGES` for `erp_app` on all 7 schemas, run
   as `postgres` directly against the live `erp` database — this is a
   database-level fix, not a code deploy, so it is already in effect for
   the real Cloud Run service today.
2. **`shared/navigation.js`'s Marketing Dashboard permission check read
   the wrong key** — `userPermissionsObject.viewMarketingDashboard`
   (copied verbatim from Portal) instead of ERP's own `permMap.js` key,
   `marketingDashboard`. The Dashboard pill never appeared even for a user
   with the permission. Fixed to read `.marketingDashboard`.
3. **`mdCurrentPeriod`/`mdChartFunnel`/etc. — a real regression from
   earlier in THIS session, not from Portal.** An earlier (pre-Batch-2)
   cleanup pass mistook Portal's own misplaced declaration of these
   variables (they live in Portal's `store/revise-prn.js`, not
   `marketing-dashboard.js`, an artifact of the 4 Sep automated split) for
   dead code and deleted it from ERP's `store/revise-prn.js` with no
   replacement. When Batch 2's real `marketing/marketing-dashboard.js`
   landed — genuinely reading/writing these names throughout — nothing
   anywhere declared them, so opening the Marketing Dashboard threw
   `mdCurrentPeriod is not defined` immediately. Fixed properly this time:
   declared in `marketing-dashboard.js` itself (their real, sole owner),
   not reintroduced into the unrelated `revise-prn.js` file.
4. **`routes/utility.js` was never ported to ERP at all** —
   `getUniqueCompaniesList`/`getUniqueQualifications`/
   `getUniqueCityStatePayloadTree`/`getEngineers`/`getStoreOperatorsList`/
   `pullLiveActiveProjectCodes` are genuinely missing shared
   infrastructure the ported Marketing screens (Search Company/
   Qualification/City-State typeaheads, engineer directories) call
   directly — a real dependency-tracing gap in both the original plan and
   the porting agent's own sweep, only surfaced by an actual 404 while
   clicking through Search by Company Name. Ported a trimmed version
   (excludes `getSessionPermissions` — ERP bakes permissions into the
   login response instead of a separate re-fetch call, confirmed no ERP
   frontend file calls that action — and `sendWeeklyAdminDigest`, which
   needs `lib/mailer.js`/env vars ERP doesn't have yet) to
   `erp-backend/routes/utility.js`, mounted in `server.js` right after
   `itemCodes`.

### Known, expected gap (not a bug)

- **Marketing Dashboard's data** 404s on `fetchMarketingDashboardData` —
  that route lives in Portal's `routes/dashboards.js`, squarely Batch 9
  (Cross-cutting), not Batch 2. The dashboard's full layout/stat-tile/
  chart structure renders correctly; only the data-fetch is out of scope
  until Batch 9.

### Verified in the click-test

All 10 screens open cleanly with no console errors after the 4 fixes
above: Marketing Dashboard (structure), Create New Leads Details, Leads
Received through Email (engineer directory populated, correct empty
state), Upload Purchase Order, Upload Commissioning Report, Search by
Company Name, Search by Type of Customer, Search by City/State/Country,
Search Leads by Engineer/Status, Search Tasks by Engineer/Status.
Permission gating confirmed correct both ways: Meeting Preparation
correctly hidden for a user without `perm_meeting_preparation`, every
other of Ashwin's 10 held Marketing permissions correctly shown.

`routes/marketing.js` (29 routes), `meetingPrep.js` (2), `marketing/*.js`
(7 files). 10 screens + dashboard.

- **Backend**: `routes/marketing.js` (3206 lines) + `routes/meetingPrep.js`
  (617 lines) ported verbatim, mounted in `server.js`. All 7-place
  permission wiring done: `permMap.js`, `auth.js`'s `requireSession`
  SELECT, `sheetsRegistry.js`'s users query + new `companies`/`leads`/
  `follow_ups`/`tasks`/`offers_sent`/`cold_introductory_emails_sent`/
  `po_invoice_report_information` TABLE_REGISTRY entries,
  `sheetsPull.js`'s USER_PERM_HEADERS, `permissionCatalog.js`'s
  PERMISSION_CATALOG + DEPARTMENT_META marketing entry (Sheet header
  self-heals, no manual step). `sheetChangePoller.js`'s
  REAL_TABLE_TO_REGISTRY_KEY map extended for all 7 marketing tables —
  confirmed via live `pg_trigger` query that Batch 0 already created
  `trg_sheet_sync` on all 7, so live sync should work immediately.
  `lib/gemini.js`, `lib/gmail.js` (new), `lib/gmailDomainDelegation.js`,
  `lib/safeError.js` (new), `lib/drive.js` (`uploadFileReplacingExisting`
  appended) all ported/merged, verified nothing else in ERP broke
  (Item Code AI's `normalizeItemCodeText`/`checkItemCodeNearDuplicate`
  confirmed still present/exported). `routes/projects.js` stub file
  holds only `generateAbpsProjectId` (Project department itself is
  Batch 3, not yet built) — its header comment corrects an
  agent-introduced factual error (project.* schema DOES already exist
  from Batch 0, just no routes/real data flow yet).
- **Frontend**: 7 files ported to `erp-frontend/marketing/`
  (business-card.js, companies.js, email-processing.js, leads.js,
  marketing-dashboard.js, meeting-prep.js, tasks-followups.js).
  `index.html` gained the full `module-workspace-container` block (all
  Marketing workspace panels + the New Lead form + reusable child-module
  template), the `canvas-module-marketing-dashboard` block, the 3
  `sec-label` menu-card sections under the Marketing dept-tab block, and
  `md-period-btns`/`md-custom-zone` in the shared dashboard toolbar.
  `shared/navigation.js` gained `navigateToModule()` + its permission
  gating in `enforceDynamicModuleRoleGateways`. `shared/apFetch.js`
  gained `loadQualFilter()`, `fetchWithStaleCache`, the company-search
  typeahead trio, and `erpActiveEmailLeadsCache` in
  `ERP_LOCAL_STORAGE_KEYS`. `accounts/accounts-dashboard.js`'s
  `showDashboardGlobalToolbar` generalized to a 3-arg signature so two
  dashboards can share one toolbar element.
  **Two real fatal-collision bugs found and fixed proactively** (before
  ever loading the page): (1) `store/revise-prn.js` carried dead
  `mdChartFunnel`/`mdCurrentPeriod` variables (leftover from the 4 Sep
  Design/Purchase port) that collided with `marketing-dashboard.js`'s
  own top-level declarations of the same names — removed the two dead
  lines only, verified the adjacent `dd*` variables in the same block
  are genuinely used by `design/design-dashboard.js` and left them
  alone. (2) `marketing/leads.js`'s `handleLoginDepartmentSelectionChange`/
  `initializeGoogleAuthPlatformEngine` would have shadowed ERP's own
  working login-dropdown functions (different directory-cache shape) —
  removed both from the ported file with an explanatory comment.
- **Verification**: `node -c` clean across all touched/new files, zero
  duplicate top-level `let`/`const` across the whole `erp-frontend` tree,
  every local `<script src>` resolves (only the 2 expected external CDN
  scripts show as "missing" by the local-file check).
- **Not yet done**: real login + click-test of every screen (per the
  plan's definition of done), `marketing_dept_permissions.sql` migration
  file was created then deleted as redundant (Batch 0 already added all
  11 columns). No DB writes beyond Batch 0 were needed for this batch.

## Batch 3 — Project core

**Status: click-tested, committed locally, NOT pushed/deployed** — real
login (PIN, Ashwin Kumar/admin), all 6 permissions granted through the
real Permissions Matrix UI (not SQL), all 6 screens opened and verified
against the real DB, same localhost setup as Batch 2.

`routes/projects.js` (2552 lines, replaced the 60-line stub —
`generateAbpsProjectId` merged in place), `routes/timeline.js` (1761),
`routes/dailyTimeline.js` (68), `routes/adminDashboard.js` (36). Manufacturing
Clearance, Project Timeline, Daily Timeline, Project Status, Project Invoice
Generation (filed under Store → Dispatch, matching Portal's own current
placement), Admin Dashboard (filed under the Project department header, per
Portal's own placement).

- **Backend libs ported**: `lib/ld.js`, `lib/businessDays.js`,
  `lib/productionFlows.js`, `lib/dailyTimeline.js`, `lib/adminDashboard.js`,
  `lib/materialLeadTime.js`, `lib/projectInvoicePdf.js`,
  `lib/projectInvoiceTemplate.js`, `lib/projectReviewTemplate.js`,
  `lib/marketingInvoiceSync.js`, `lib/productionPlanStepJc.js`. New stub
  `routes/qaInspection.js` (exports `computeQaInspectionQueueRows` → `[]`) —
  QA department itself is Batch 8, but `dailyTimeline.js`/`adminDashboard.js`
  both import this function. `lib/drive.js` gained `renameFolder` (was
  missing). `routes/design.js` and `routes/dashboards.js` both needed a few
  more of their own already-existing functions exported (not new code, just
  visibility) for `routes/projects.js`/`routes/adminDashboard.js` to import.
- **Permissions, all 7 places**: `perm_manufacturing_clearance`,
  `perm_project_status`, `perm_project_invoice_generation`,
  `perm_project_timeline`, `perm_daily_timeline`, `perm_admin_dashboard` —
  confirmed live on `admin_db.users` (Batch 0), wired through `auth.js`,
  `permMap.js`, `sheetsRegistry.js`, `sheetsPull.js`, `permissionCatalog.js`
  (+ `project`/`dashboard-project` `DEPARTMENT_META` rows).
- **Frontend**: 6 files ported to `erp-frontend/project/`
  (manufacturing-clearance.js 844 lines, project-timeline.js 2463,
  daily-timeline.js 550, project-status.js 397, project-invoice.js 1536 —
  filed under `project/` not `production/`, correcting Portal's own
  misplacement, admin-dashboard.js 203 — rewritten to use ERP's own local
  `adm`-prefixed custom-period pattern since Portal's shared
  `dashCustomTypeChange`/`ddShowAllWorkspaceEnclosures` helpers don't exist
  in ERP). `index.html` filled the empty `dashboard-project-department-
  header-block`, added a Dispatch section to Store's block, inserted all 6
  panels (~700 lines) + `.pstat-*` CSS + Admin Dashboard toolbar HTML,
  added 6 script tags. `shared/navigation.js` gained the exit-back-to-menu
  functions Portal declares centrally (not per-screen) + full permission
  gating for all 6 cards. Real fix made during the port itself:
  `project-status.js` had 4 misplaced duplicate exit-functions (Portal's
  automated-split artifact) — removed, and its real
  `initializeProjectStatusPanel`/`exitProjectStatusBackToMenu` added in
  their correct owner file.

### 1 real bug found and fixed during click-testing (15 Sep 2026)

- **`lib/dailyTimeline.js`'s `gatherCustomerQueryItems()` crashed the WHOLE
  Daily Timeline screen** — it queried `project.customer_queries`
  unconditionally, a table deliberately excluded from this entire migration
  (Customer Queries Received through Email is out of scope) and never
  created by Batch 0. One rejected promise inside a `Promise.all` failed
  the entire fetch with a 500. The route-file-level grep both porting
  agents did for the Customer-Queries exclusion missed this because it's a
  `lib/` file, not one of the 4 route files directly named in the
  exclusion check. Fixed to return `[]` immediately — matches this whole
  migration's documented exclusion, not a partial workaround.

### Verified in the click-test

All 6 screens (Manufacturing Clearance, Project Timeline, Daily Timeline,
Project Status, Project Invoice Generation, Admin Dashboard) open cleanly
with no console/server errors after the fix above. Admin Dashboard renders
real live data (₹6,748 cash box balance, ₹57,000 tour advances outstanding)
— confirms its cross-department queries work correctly even with zero
Project-department data yet. Permission-driven dept-tab-bar confirmed
correct: "Project" and "Store" tabs only appeared after their respective
permissions were granted through the real UI and a fresh login (ERP bakes
permissions into the login response, not a live re-fetch — a grant needs
sign-out/sign-in to take effect, by design).

## Batch 4 — Design

**Status: ported, committed locally, NOT pushed/deployed — and NOT
click-tested.** No live login was attempted in this session, so every
claim below rests on static verification (per-function diff against
Portal, `node -c`, runtime `require()` of every touched module, a full
`server.js` boot, the frontend checklist) — not on a real browser.

`routes/design.js` (20 BOQ/drawings routes here + 10 item-code routes in
the pre-existing `routes/itemCodes.js` = Portal's 31, +1 new). 6 screens
+ dashboard.

### Method note — this was a re-diff/repair, not a fresh port

Design already had code from the 4 Sep 2026 pre-migration port. Rather
than trust it, every function in `routes/design.js` and every
`design/*.js` file was mechanically split and diffed against Portal's
CURRENT code with comments stripped. That found **24 functions with real
(non-comment) divergence** out of ~50. All are now reconciled: a
re-run of the same diff shows Portal's `routes/design.js` and ERP's
matching function-for-function, and 5 of the 8 `design/*.js` files are
now byte-identical to Portal.

### Real bugs / gaps found and fixed

**Backend — `routes/design.js`**

1. **★★★ The 13 Sep 2026 "Drive/PDFShift I/O out of `withTransaction`"
   rework (Portal §100.1) had never reached ERP.** `submitBOQAuthorize`
   still generated both BOQ PDFs, uploaded them to Drive, and created a
   Drive folder per Job Card **inside the authorization transaction** —
   holding a DB connection open across several external API calls, and
   (worse) rolling the entire authorization back if any of it failed.
   Reworked to Portal's current shape: the transaction commits first,
   then `regenerateBoqPdfs` runs post-commit with `pdfPending` as the
   degraded-response signal, and Job Card folders are best-effort
   non-fatal.
2. **`retryPendingBoqPdfs` did not exist** — the sweep that makes
   `pdf_url IS NULL` a real retry signal. Added the function, the
   admin-only `POST /retryPendingBoqPdfs`, and
   `POST /internal/retryPendingBoqPdfs` in `routes/sheetsInternal.js`
   (Cloud-Scheduler-callable; required lazily so this pre-`requireSession`
   router doesn't pull the Design module into startup). **A Cloud
   Scheduler job for it still needs creating by hand** — same as Portal's
   own, see follow-ups below.
3. **★★ `applyBoqRevision` still had the 5→3→5 Job Card bug** Portal
   fixed 7 Sep 2026. The create/decrease branches were `if/else` keyed on
   `currentMaxSet`, which counts `'Excess/Orphaned'` cards — so raising an
   order quantity back to a previously-higher number produced **no Job
   Cards at all** for the revived sets, leaving the project with fewer
   producible Job Cards than units ordered. Replaced with Portal's
   independent-branches version that revives an orphaned set and creates
   only genuinely-absent set numbers.
4. **`createBOQDraft` had no duplicate guard.** Portal refuses a second
   BOQ whose `material_rows` are identical to an existing
   `'Pending Authorization'` BOQ for the same product (double-click /
   retry-after-timeout). ERP silently minted a new `variant_seq` instead.
5. **`regenerateBoqPdfs` skipped the Cloud Storage secondary copy** —
   both `uploadPdf` calls were missing, so every revision's PDFs existed
   only in Drive.
6. **`checkGeminiRateLimit` was never called** from either AI path
   (`searchItemCodeSemantic`, `createMaterialDescription`) even though
   ERP's `lib/gemini.js` exports it and `admin_db.gemini_call_log` exists.
   Both call sites added.
7. **`safeErrorMessage` was not used anywhere in this file** — all 19
   error responses returned a raw `err.message`, leaking Postgres
   SQLSTATE detail to the client. Swept; deliberate business-error
   messages pass through unchanged, exactly as in Portal.
8. **`resolveAllowedBoqProducts.pendingNames` returned bare product
   names**, not Portal's `"Name - Rating"` — so two ratings of the same
   product were indistinguishable in the "BOQs pending for:" list.

**Backend — dashboard + wiring**

9. **`fetchDesignDashboardData` did not exist in ERP at all** — the
   Design Dashboard's data fetch was a guaranteed 404. Ported verbatim
   from Portal's `routes/dashboards.js` along with its
   `fetchDesignTimelineDueOverdue` helper and the two label/priority
   constants. Verified no circular import (`dashboards.js` → `timeline.js`
   → nothing back) by actually loading both at runtime. Every table it
   touches (`design.boq_drafts`, `boq_update_requests`, `item_codes`,
   `project.projects`, `customer_po_line_items`, `admin_db.audit_log`)
   already exists in `erp`.
10. **7-place permission rule: 6 of Design's 7 permissions were missing
    from 2 of the 7 places.** `perm_create_boq` / `perm_authorize_boq` /
    `perm_update_boq` / `perm_authorize_boq_update` /
    `perm_upload_drawings` / `perm_design_dashboard` had no entry in
    `lib/sheetsRegistry.js`'s users query or `lib/sheetsPull.js`'s
    `USER_PERM_HEADERS` (only `perm_item_code_access` did) — so they were
    invisible on the Users sheet and un-editable from it. Added to both,
    with Portal's exact header text. The other 5 places were already
    correct.
11. **`design.boq_drafts` / `design.bill_of_quantity` were missing from
    `lib/sheetChangePoller.js`'s `REAL_TABLE_TO_REGISTRY_KEY`** despite
    having had `TABLE_REGISTRY` entries since 4 Sep 2026 — so any
    `trg_sheet_sync` row they queued hit the "no sheet mapping" branch and
    was silently discarded. This is the exact 15 Sep 2026 Portal landmine
    (registry tier list and poller map are two separate lists that nothing
    cross-checks). Both mapped; Portal maps the same two.

**Frontend**

12. **★★★ `showDashboardGlobalToolbar` call was broken — a regression
    introduced by Batch 2, not by the 4 Sep port.** Batch 2 generalized
    the signature to `(title, periodBtnsId, returnFn)` but never updated
    the two pre-existing callers. `design-dashboard.js` still passed
    `("Design Dashboard", exitDesignWorkspacePanelBackToMenu)`, so the
    exit function was being used as a DOM id and `returnFn` was
    `undefined` — **the Design Dashboard's Return button did nothing and
    no period buttons rendered**. Fixed. (`purchase-dashboard.js` has the
    identical break — left for Batch 5, see follow-ups.)
13. **The Design Dashboard's period toolbar did not exist in
    `index.html` at all** — no `dd-period-btns`, no `dd-custom-zone`, even
    though `design-dashboard.js` read `#dd-custom-type` / `#dd-custom-val`.
    Both added.
14. **★★★ The Custom period selector mutated an `<input>`'s `type` at
    runtime** (`date`→`month`→`text`→`number`) — the exact pattern
    Portal's 8-9 Sep 2026 landmine documents as leaving native rendering
    artifacts (a ghosted date-picker under a text placeholder). Rewritten
    to five dedicated inputs toggled with the `hidden` attribute, using
    ERP's own per-dashboard prefixed convention (`ddCustomTypeChange` /
    `ddReadCustomVal` / `DD_CUSTOM_TYPE_SUFFIX`), matching the `md`/`adm`/
    `ad` dashboards already live here rather than importing Portal's
    shared `dashCustomTypeChange`, which ERP doesn't have.
15. **Both Chart.js configs were missing `maintainAspectRatio:false`**
    and the canvases had no `position:relative; min-height:0` wrapper —
    the other half of the same Portal fix. Corrected via the dashboard
    markup replacement (below) plus the JS options.
16. **Design Dashboard stat rows had drifted structurally**: ERP had
    5+5 tiles using `dash-stat-row`, Portal has 4+6 using `dd-stat-row` /
    `dd-chart-row` / `dd-detail-row`, with `stat-live` / `stat-period`
    tinting (Portal's 6 Sep 2026 live-vs-period-filtered visual cue) on
    every tile — ERP had none of it. Two tile labels also differed.
    ERP's entire `dd-body` block was replaced with Portal's 113 lines
    verbatim; the two are now byte-identical.
17. **`ddSetPeriod` de-activated every dashboard's period buttons**
    (`.dd-period-btn` unscoped) instead of only Design's. Scoped to
    `#dd-period-btns` per Portal.
18. **Stale shared-helper usage across the BOQ screens**: `formatDateDMY`
    / `formatDateTimeDMY` instead of the house-wide `formatOrdinalDate` /
    `formatOrdinalDateTime` convention (7 Sep 2026) in 5 places;
    hand-rolled `style.height = scrollHeight` instead of
    `autoGrowTextField` / `autoGrowAllIn` in 6 places; `apFetch` instead
    of `fetchWithStaleCache` on 5 near-static dropdown feeds; `step="0.01"`
    instead of `step="1"` on 3 Design Rate inputs. All of these helpers
    already existed in ERP — they just weren't being used.
19. **Select BOQ was still a native `<select>`** on Revise BOQ. Portal
    moved it to the generic wrapping dropdown (`shared/ui.js`'s
    `genericDropdown*`, 5 Sep 2026) because a BOQ label is long enough to
    be truncated and a native `<select>` cannot wrap its options. Both the
    `index.html` markup and `update-boq.js`'s 7 call sites converted;
    `shared/ui.js` already had the widget.
20. **`cboq-product-rating` had lost `white-space:pre-wrap;
    word-break:break-word;` and `box-sizing:border-box`** — a long
    auto-filled rating would not wrap correctly in its auto-growing
    textarea.
21. **`input.boq-center-num { text-align: center !important; }` was
    missing from ERP's `<style>` block** — the one CSS rule the Design
    screens reference that ERP did not define, so every numeric BOQ cell
    rendered left-aligned instead of centred. Copied verbatim.
22. **`shared/drafts.js` did not exist** (Batch 1 deferred it here
    explicitly). Ported, with the one mandatory ERP adaptation: the
    localStorage key prefix is `erpAbpsDraft:`, not Portal's `abpsDraft:`
    (CLAUDE.md §3 — same origin as Portal). `clearAppLocalStorageKeepingDeviceKeys`
    gained Portal's `{ keepDrafts }` option and a prefix sweep, so drafts
    survive an involuntary session expiry but are cleared on explicit
    logout, exactly as in Portal; the three involuntary call sites now
    pass `keepDrafts: true`, `executeLogout` deliberately does not.
    Wired into Create BOQ via `shared/typeahead.js` (`abpsDraftAttach` /
    `abpsDraftOfferRestore`) and `resetCreateBOQForm`'s `abpsDraftClear`.

### CSS / markup parity audit

Ran a mechanical audit: every class referenced by Portal's Design
`index.html` sections AND by all 8 `design/*.js` files (static
`class="..."`, JS template strings, `classList.*`, `className =`), checked
against ERP's `<style>` block. **30 classes referenced; exactly one was
missing** (`boq-center-num`, item 21 above) — the rest were already
covered by the Marketing/Project style-block repair earlier in this
session. Rule bodies were compared, not just presence.

Markup structure was diffed block-for-block, not spot-checked:
- **Design workspace enclosure** (all 5 BOQ/Drawings canvases): now
  **byte-identical** to Portal's, verified by a zero-output `diff` of the
  253-line block.
- **Design Dashboard canvas**: now **byte-identical** to Portal's 113-line
  block.
- `lib/itemCodeFormat.js` (server) and `design/item-code-format.js`
  (client preview mirror) were already **logic-identical** to Portal —
  only a reflowed comment differs. The template engine, all five
  placeholder kinds, and every auto-calc (mH→ohm, Total kVAr, Reactor
  kVAr + BIL lookup, APFC Rated Current, and the Fiber Glass Tie Rod
  structural match) are in sync. No changes needed.

**One deliberate non-change**: ERP's base `.dd-stat-card` rule is
`height:auto; min-height:80px; overflow:visible` where Portal's is
`height:100%; overflow:hidden`. Aligning it to Portal would re-break
Marketing/Accounts, whose chart cards sit in ERP-only `dash-stat-row` /
`dash-chart-row-3` rows rather than Portal's `dd-stat-row`. Design's own
markup now uses Portal's `dd-*` row classes, whose rules ARE identical in
both, so Design renders identically without touching the shared base.

### Add / Check Item Code — drift audit only (per the standing decision)

Audited, not rewritten. `routes/itemCodes.js` holds all 10 item-code
routes with **zero path collision** against `routes/design.js` (verified
globally across all route files). Function-level diff of
`design/item-codes.js` shows the only Portal functions absent are
Store-department helpers (`handleSENameSearch`,
`selectStoreEntryItemCodeMatch`, `reopenSEMaterialSearch`,
`selectSENameMatch` — Batch 6), a Project split artifact
(`exitProjectStatusBackToMenu`), and `navigateToDesignWorkspacePanel`
(deliberately relocated to `design-dashboard.js` in ERP, documented in
that file's header). The item-code AI feature
(`normalizeItemCodeText` / `checkItemCodeNearDuplicate` /
`ITEM_CODE_HOUSE_STYLE`) is present and intact. **No changes made.**

### Verification actually performed

- Per-function diff of `routes/design.js` vs Portal, comments stripped —
  now clean except the 11 item-code functions that live in
  `routes/itemCodes.js` by design.
- `node -c` on every backend file touched and every `.js` under
  `erp-frontend` — clean.
- Runtime `require()` of all 7 touched backend modules + a full
  `server.js` boot — clean (no circular import, no missing export).
- Zero duplicate top-level `let`/`const` across `erp-frontend`.
- Every `<script src>` in `index.html` resolves to a real file.
- Zero duplicate DOM ids in `index.html`.
- Zero duplicate route paths across all `erp-backend/routes/*.js`.
- Navigation sweeps confirmed to cover every Design panel id (all match
  `canvas-module-design-*` / `*-workspace-enclosure-panel` AND carry
  `class="workspace-panel"`, so all three sweep selectors reach them).
- `DESIGN_ROOT_FOLDER_ID`, `PRODUCTION_DRIVE_FOLDER_ID` and
  `GCS_BUCKET_NAME` confirmed **set live** on the `erp-backend` Cloud Run
  service (queried directly, not assumed). No new Drive folder or
  spreadsheet is needed for this batch — the DESIGN spreadsheet is
  registered and `boq_drafts` / `bill_of_quantity` already have
  `TABLE_REGISTRY` entries with tab names matching Portal's exactly.

**NOT verified: anything requiring a running browser.** No screen was
opened, no BOQ was created, authorized or revised, no PDF was generated,
and the Design Dashboard's new route was never called against real data.

### Flagged for human follow-up (deliberately NOT touched)

- **`purchase/purchase-dashboard.js:255` has the identical broken
  2-arg `showDashboardGlobalToolbar` call** as item 12 — the Purchase
  Dashboard's Return button and period buttons are currently dead the
  same way. One-line fix, but Purchase is Batch 5 and that file is due a
  full re-diff anyway.
- **A Cloud Scheduler job for `/internal/retryPendingBoqPdfs` does not
  exist on ERP** (Portal created its own 14 Sep 2026). The route is live
  and callable; without the job, a BOQ whose PDF failed post-commit stays
  `pdf_url IS NULL` until someone triggers the admin route by hand.
- **`syncLiveRow` is called in `routes/design.js` for 5 tables with no
  `TABLE_REGISTRY` entry** — `projects`, `job_card_materials`,
  `job_card_number`, `raw_material_store`, `spare_store`. These no-op
  silently (by design, see `lib/liveSync.js`), so nothing breaks, but
  those rows never reach a sheet. `projects` arguably belongs to Batch 3;
  the other four are Store/Production (Batches 6/7). Not added here
  because doing so would create sheet tabs for departments that don't
  exist yet. (`material_descriptions` is unregistered in Portal too — not
  a gap.)
- **`update-boq.js` still carries the pre-11-Sep-2026 `jclh*` global
  names** (`jclhWorkspaceInitInProgress` etc.) where Portal now has
  `jcsh*`, from the Job Card Sheet / In Process Sheet split. They are
  genuinely dead in ERP today (nothing references them — the owning
  screen is Batch 7 Production / Batch 8 QA). Left alone.
- **`lib/permissionCatalog.js`'s `DEPARTMENT_META` has no
  `dashboard-design` entry** (Portal does). Confirmed harmless here:
  ERP's Permissions Matrix is data-driven (`getPmCardOrder()` strips the
  `dashboard-` prefix and folds it into the `design` card), and nothing
  filters `PERMISSION_CATALOG` by `DEPARTMENT_META`, so
  `perm_design_dashboard` is fully grantable from the UI. Noted only so a
  future reader doesn't mistake it for the QA-style "permission can never
  be granted" bug.
- **`item_codes` is `tier: 'scheduled'` in ERP but `'live'` in Portal.**
  Inside the "Add/Check Item Code left alone" boundary, and the poller
  maps it either way, so sync works — flagged for the drift audit, not
  changed.

## Batch 5 — Purchase

**Status: not started**

`routes/purchase.js` (49), `purchase/*.js` (6), `store/create-prn.js` +
`revise-prn.js`. 10 screens + dashboard.

## Batch 6 — Store

**Status: not started**

`routes/store.js` (51), `store/*.js` (14 files). 17 screens + dashboard.

## Batch 7 — Production

**Status: not started**

`routes/production.js` (24), `productionPlanning.js` (14),
`production/*.js` (8). 7 screens + dashboard.

## Batch 8 — QA

**Status: not started**

`routes/qaInspection.js` (7), `productSerialTracking.js` (4), `qa/*.js`
(4). 6 screens + dashboard.

## Batch 9 — Cross-cutting

**Status: not started**

`routes/dashboards.js` (7), `documentation.js`, `docs/content/**`. 8
dashboards + in-app Documentation.

---

## Prerequisites — Drive folders & Spreadsheets provided so far

All under `abps.digitalization@gmail.com` (same account the backend already
uses — no sharing step needed). Registered in `sheetsRegistry.js`'s
SPREADSHEET_IDS as each is provided; env vars for Drive folders get set on
`erp-backend`'s Cloud Run service only when the owning batch actually starts
(a Cloud Run env-var update deploys a new revision immediately, so this
waits for the batch, not just the ID).

**Spreadsheets** (all registered in `SPREADSHEET_IDS`, no TABLE_REGISTRY
entries yet — those land with each batch):
- MARKETING: `1o1o1_s25nEBrNdos4nLyeLsOTXlAIHAGMD8qGIg_350`
- PROJECT: `1TOjs1cR24R2iStUSipj6u0J_tlb2Y8XOypUQJ_DN3vo`
- STORE: `1arkmwahCxIcAB5fsGU6fpt7cTV3_a5QF9NVaEmVEGok` (called "Store", not
  "Inventory", despite the plan's original INVENTORY naming)
- QA: `1ahDjaJgGbiIMqvHiTFg82296cxwfHy221-U5nDbaEyc`
- PRODUCTION: `1FFj_c48NtRBvFMQVIKrCHe3R6LZXkOfNhgsN7UiK5og`

**Drive folders** (not yet set as Cloud Run env vars — recorded here for
when each batch starts):
- Marketing root: `1i0-2nc0dBMoK3rX4MttsmG4BbhWHSAH5`'s siblings — visiting
  cards, PO, commissioning report, contract review (set up alongside
  Batch 2's start, exact ids in that session's history)
- `PROJECT_DRIVE_FOLDER_ID`: `1n04oaqUCummSOz3CaGvGMjGeZuYOrhnF`
  (sub: ABPS Project Database Sheets `15OcPrCWaR65rUOErZRR5yuS1Jvjns8aI`)
- `QA_DRIVE_FOLDER_ID`: `1pX4ngjMQ3-iszr2oJ4vt-XPl1EnXZVjV`
  (sub: ABPS QA Database Sheets `1uNMLYeKzcJwRbeP8pi1yAH-0XDBR56t4`)
- `PRODUCTION_DRIVE_FOLDER_ID`: `1SjVwKK3VVjSDIbxn2BL07OpUr-01pSIp`
  (sub: ABPS Production Database Sheets `1GTNNbo-nIWqp2bmVg96EiiLEB7DuDxHL`)
- Store (`Store_ERP` root `1NckZsvQR9q9vcfxl1Wfl3OTRbubq6OKk`):
  - `STORE_MATERIAL_ISSUE_TICKETS_DRIVE_FOLDER_ID`: `19DzIf4n3njXbyPcGv3RQhwdPnRPYZp-s`
  - `MATERIAL_OUTWARD_DRIVE_FOLDER_ID`: `1PjymA91DRR_BZopC1fPK2WTx_sTF5dLd`
    (Service Delivery Challan and Material Out Request Form)
  - `STORE_DRIVE_FOLDER_ID`: `1jwWLVpPhvGflUCDuv-4XYu9JZvuNjHlk` (Stock Sweeps)
  - `INVOICE_FOLDER_ID`: `1eijm29umA2oxnQ-J4h59o4Wz1X9NKLTK` (Gate Entry Invoice)
  - `CHALLAN_FOLDER_ID`: `1fznjUrkO2l1O8YAUXLT7pK2HTnuwv60Q` (Gate Entry Challan)
  - Sub: ABPS Store Database Sheets `1NEc3zUgPdBUNd324FdH90Ddym8VPJTrD`
    (not an env var — just a place to keep the STORE spreadsheet if wanted)

## Cross-batch infrastructure fixes (not specific to one batch)

Found and fixed during Batch 2/3 click-testing, but affect ERP as a
whole, not just Marketing/Project — recorded here since they don't
belong to any one batch's own section above.

- **`erp_app` DB role missing GRANT on 7 of Batch 0's schemas**
  (`marketing`/`qa`/`project`/`production`/`purchase`/`store`/`analytics`)
  — silently affected the already-live Purchase/Store schemas too, not
  just the new ones. Fixed directly against the database (`GRANT USAGE`/
  `GRANT ALL ON ALL TABLES,SEQUENCES`/`ALTER DEFAULT PRIVILEGES`, run as
  `postgres`). Already in effect for production.
- **★★★ ERP's Drive/Sheets/Gmail OAuth connection was dead, with no way
  to reconnect** — `routes/gmailAuth.js` never existed in ERP.
  Root-caused a user-reported "Failed to load file" on Tour Voucher bill
  links AND every "invalid_grant" Sheet-sync failure seen since
  31 Aug 2026. Fixed by porting `routes/gmailAuth.js` from Portal
  verbatim, mounting it, and setting `GMAIL_CONNECT_SECRET`/
  `GMAIL_OAUTH_REDIRECT_URI` on `erp-backend` (revision `erp-backend-
  00061-p7w` for the env vars, `erp-backend-00062-8jw` for the code,
  both confirmed live). **Still needs a human to visit the connect URL
  once and click Allow** — see `HANDOFF.md` for the exact link and
  current status; this is the one piece of this fix that could not be
  completed by an agent.
- **`routes/utility.js` never existed in ERP at all** until Batch 2's
  screens 404'd on it. Ported a trimmed version (excludes
  `getSessionPermissions`/`sendWeeklyAdminDigest`, which ERP doesn't
  need/have infra for). If a future batch's screen 404s on a
  dropdown-feed action that isn't obviously department-specific, check
  Portal's `routes/utility.js` before writing a new route from scratch.

## Already done / left alone (per explicit decision, not tracked further)

- **Accounts** — real data, mature, left alone. Drift-audit only.
- **Add/Check Item Code** — real data, mature, left alone. Drift-audit only.
- **Security & Login Access** — mature, must stay identical Portal↔ERP.
  Left alone. Drift-audit only.
