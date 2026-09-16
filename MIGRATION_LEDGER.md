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

**Status: ported, committed locally, NOT pushed/deployed — and NOT
click-tested.** No live login was attempted in this session, so every claim
below rests on static verification (byte-level diff against Portal, `node
--check`, runtime `require()` of every touched module, a full `server.js`
boot, a route-collision sweep, an action→route resolution sweep, the
frontend checklist, and a mechanical CSS/markup parity audit) — not on a
real browser.

`routes/purchase.js` (49 routes), `purchase/*.js` (6), `store/create-prn.js`
+ `revise-prn.js`, plus three NEW **partial** files and one new dashboard
route. 10 screens + dashboard.

### Method note — re-diff/repair, same as Batch 4

Purchase already had code from the 4 Sep 2026 pre-migration port. Nothing in
it was trusted: `routes/purchase.js` and all 6 `purchase/*.js` were diffed
line-by-line against Portal's CURRENT code (whitespace/CRLF normalised
first, since ERP is LF and Portal is CRLF — the raw diff looked like
thousands of changed lines and was actually 6–63 real ones per file). The
end state is now:

- `routes/purchase.js` — **byte-identical to Portal's** (verified by an
  empty unified diff).
- `lib/prnSync.js`, `lib/materialRequirementDates.js` — **byte-identical to
  Portal's**.
- `purchase/pps-tracking.js`, `purchase/vendor-costing.js`,
  `store/create-prn.js` — **byte-identical to Portal's**.
- `purchase/material-list.js` (3), `purchase/po.js` (6),
  `purchase/revise-po.js` (10), `store/revise-prn.js` (12),
  `purchase/purchase-dashboard.js` (88) — Portal's current code plus a
  short, enumerated list of deliberate ERP adaptations (below).
- The `canvas-module-purchase-dashboard` markup block is **byte-identical
  to Portal's**.

### Real bugs / gaps found and fixed

**Backend — `routes/purchase.js` (all were stale-vs-Portal)**

1. **★★ `authorizePurchaseOrder` could let two PO lines jointly over-order
   the same PRN+item.** ERP still had the pre-aggregation version: it
   validated each allocation individually against the same stale
   `still_to_order_quantity`, so two lines on one PO targeting the same
   `(prnId, itemCode)` (a legitimate split across two rate/discount rows)
   both passed. Replaced with Portal's `aggByKey` version, which sums every
   allocation per key *before* the `FOR UPDATE` check.
2. **★★ Three `syncLiveRow` calls were firing INSIDE their transaction** —
   `commitPurchaseOrderDraft` (`raw_material_purchase_orders`),
   `authorizePurchaseOrder` (`vendor_performance`), and
   `submitReserveStockChanges` (`stock_reservations`, per-iteration). This
   is exactly Portal's own 15 Sep 2026 landmine: `syncLiveRow` reads via a
   separate pool connection and cannot see an uncommitted row, so its own
   SELECT found nothing and silently pushed no sheet update. Now collected
   and flushed after `withTransaction` resolves, per Portal.
3. **`getCurrentFinancialYearLabel` used the container's clock, not IST** —
   on Cloud Run (UTC) every PO created in the ~5.5h window each 31 Mar night
   IST would have been stamped with the outgoing FY. Portal's IST-aware
   version ported.
4. **The PO PDF's Drive folder name (`fmtDate`) had the same UTC bug** — a
   PO authorized between IST midnight and 05:30 filed under the previous
   day's folder.
5. **`safeErrorMessage` was not used anywhere in this file** — all 45 error
   responses returned a raw `err.message`, leaking Postgres SQLSTATE detail.
   Swept; deliberate business-error messages still pass through unchanged,
   exactly as in Portal.

**Backend — libs**

6. **`lib/prnSync.js` was missing `FOR UPDATE OF m` on both borrow-donor
   queries** (`findAndBorrowForShortfall`'s later-set and cross-BOQ donor
   scans). Without the row lock, two concurrent shortfall borrows can pick
   the same donor `job_card_materials` row and both succeed.
7. **★★ `lib/materialRequirementDates.js` was missing Portal's 5 Sep 2026
   `mli.purchase_quantity > 1e-9` guard.** This matters a lot here:
   `prnNeedsRequirementDatesFragment` is the HARD GATE on
   `fetchMaterialListForPurchase` and Create PO's project picker. Without
   the guard, a GRN arriving and covering a line fully from store drops that
   line's purchase quantity to 0, which the old version read as "changed →
   stale", permanently hiding the whole PRN from Purchase even though every
   line showed "Fully covered from store — no date needed".
8. **`lib/analyticsLog.js` didn't export `recordStageEventOnClient`**, so
   `prnSync.js` carried its own inline no-op stub (and `routes/purchase.js`
   carried a second one). Both call shapes now live in the one module —
   which also means a future real analytics port is a one-file change. (The
   `analytics` schema's 7 tables DO exist in ERP from Batch 0; nothing reads
   them, so these stay no-ops deliberately — flagged below.)
9. **★★ `lib/liveSync.js` dropped Portal's `groupColumn` sibling re-push
   entirely.** All three `groupColumn` tables in ERP's registry
   (`prn_line_items`, `raw_material_po_line_items`, `bill_of_quantity`)
   compute a per-group Sr No that shifts for every sibling when one row is
   added or deleted — without the re-push, those three sheets' Sr No column
   drifts out of step with the DB on every insert. Ported for both
   `syncLiveRow` and `removeLiveRow`, keeping ERP's own 3-arg signature (ERP
   has no `force`/tier gate and its poller passes `awaitable` third — that
   difference is deliberate and untouched).
10. **★★ None of Purchase's 8 tables were in `lib/sheetChangePoller.js`'s
    `REAL_TABLE_TO_REGISTRY_KEY`** — despite all 8 having had `TABLE_REGISTRY`
    entries AND a live `trg_sheet_sync` trigger since the 4 Sep 2026 port. Every
    row they queued hit the "no sheet mapping" branch and was silently
    discarded. Identical to Batch 4's Design finding; the registry and this
    map remain two separate lists nothing cross-checks. All 8 mapped
    (`po_delivery_schedule` deliberately absent, as in Portal — it has no
    trigger).

**Backend — routes that were missing entirely**

11. **`fetchPurchaseDashboardData` did not exist in ERP** — the Purchase
    Dashboard's data fetch was a guaranteed 404. Ported verbatim from
    Portal's `routes/dashboards.js` along with its two helpers
    (`fetchPurchaseTimelineDueOverdue`, `computeExpectedDeliveryTimeline`)
    and the `PURCHASE_TIMELINE_ITEM_PRIORITY`/`_LABELS` constants; all three
    verified byte-identical to Portal after insertion.
    `computePurchaseMilestonesForProjects` was already exported from ERP's
    `routes/timeline.js` (Batch 3), so no circular-import risk — confirmed
    by a real `require()`.
12. **`routes/store.js` did not exist** — the three
    `perm_store_inward_rejected` routes
    (`searchVendorNamesForRejectedMaterial`, `fetchRejectedMaterialQueue`,
    `commitRejectedMaterialAction`) live in Portal's `routes/store.js` but
    drive a screen that renders inside PURCHASE's workspace. Created as an
    explicitly-flagged **partial file** (see "Partial files" below) rather
    than relocating them, so Batch 6 can overwrite it wholesale.
    `fetchLiveMaterialStock` was added to it too — every PRN screen polls it
    on a `setInterval`.
13. **`routes/production.js` did not exist** —
    `checkPRNsNeedingRequirementDatesCount` drives Purchase's Material List
    "N hidden" note. Same partial-file treatment. Kept deliberately ungated,
    exactly as in Portal (badge count, no row data — Portal's own 3 Sep 2026
    audit flagged this and then correctly reversed itself).

**Backend — permission wiring (the 7-place rule)**

14. **Two permissions were missing from ALL 5 code places**:
    `perm_store_inward_rejected` and `perm_purchase_dashboard`. Both columns
    have existed on `admin_db.users` since ERP's founding, but neither was
    in `auth.js`'s `requireSession` SELECT (so `requirePermission` could
    never see them → guaranteed 403), `permMap.js` (so
    `shared/navigation.js`'s already-correct `rejectedMaterial` /
    `viewPurchaseDashboard` checks were always `undefined`, hiding both
    tiles), `permissionCatalog.js` (so neither could ever be granted from
    the Permissions Matrix), `sheetsRegistry.js`, or `sheetsPull.js`.
15. **The other 8 Purchase permissions were missing from 2 of the 7
    places** — no entry in `sheetsRegistry.js`'s users query or
    `sheetsPull.js`'s `USER_PERM_HEADERS`, so they were invisible on the
    Users sheet and un-editable from it. Exactly Batch 4's Design finding.
    Added with Portal's exact header text.
16. **`perm_live_rm_stock` / `_fg_stock` / `_spare_stock` wired across all
    5 places too, early.** These are Store-department (Batch 6) permissions,
    but `fetchLiveMaterialStock` is gated on them in Portal and every PRN
    screen polls it — without a catalog entry they could only have been
    granted by direct SQL, so every PRN screen's live-stock column would
    have 403'd silently for everyone. Labels/rows/headers copied from
    Portal.

**Frontend**

17. **★★★ Seven live-stock poller functions were genuinely missing** —
    `refreshRPRNDeltaLiveStock`, `refreshRevisePRNLiveStock`,
    `updateRevisePRNRow`, `refreshAPRNLiveStock`, `updateAPRNRow`,
    `refreshPRNCreateLiveStock`, `updatePRNDecreaseRowPurchaseQty`. They
    live in Portal's `store/live-stock.js` and are called on a
    `setInterval` from `create-prn.js`/`revise-prn.js`, so every PRN
    screen's live-stock column threw on its first poll. **This is the same
    class of gap that bit the 4 Sep 2026 port** (`shared/typeahead.js` held
    Create BOQ's own init function) — a per-department file list cannot see
    a shared file another department quietly owns. Found by a mechanical
    "every function called, defined anywhere?" sweep, not by reading.
18. **`store/create-prn.js` had never been ported at all** (the 4 Sep port
    explicitly skipped it). Nine of its functions were already referenced by
    ERP's existing markup/JS and were plain `undefined`, so **Create PRN and
    Authorize PRN were dead screens, and Create PO's "Allocate to PRNs"
    picker (`openCPOAllocationPicker`) was dead too**. Ported verbatim.
19. **`buildMaterialDisplayLabel` was missing from `shared/format.js`** —
    `create-prn.js` calls it for the PRN header product label. Ported from
    Portal's own `shared/format.js`.
20. **`exitCanvasToCardView` was referenced but defined nowhere** — a
    **pre-existing Batch 2 bug**, not a Purchase one: `index.html`,
    `marketing/companies.js` and `marketing/leads.js` all wire "Back to
    Search" to it. Portal defines it at the top of `store/qa.js`, so it came
    across with that file and those buttons now work.
21. **★★ `purchase-dashboard.js` called the pre-Batch-2 2-arg
    `showDashboardGlobalToolbar`** — the exact break Batch 4 fixed on the
    Design Dashboard and explicitly flagged here. The Return button did
    nothing and no period buttons rendered. Fixed to the 3-arg form, and the
    now-stale comment explaining the "2-arg ERP convention" corrected.
22. **★★★ The Custom period selector mutated an `<input>`'s `type` at
    runtime** (`date`→`month`→`text`→`number`) — Portal's 8–9 Sep 2026
    landmine (ghosted native date-picker under a text placeholder).
    Rewritten to five dedicated inputs toggled with the `hidden` attribute,
    using ERP's per-dashboard prefixed convention
    (`PD_CUSTOM_TYPE_SUFFIX`/`pdCustomTypeChange`/`pdReadCustomVal`) to
    match `md`/`dd`/`adm`/`ad`, rather than importing Portal's shared
    `dashCustomTypeChange`, which ERP doesn't have.
23. **All four Chart.js configs were missing `maintainAspectRatio:false`** —
    the other half of the same Portal fix. Corrected, and the whole
    `pd-body` markup replaced with Portal's (which carries the
    `position:relative` canvas wrappers, the `dd-stat-row`/`dd-chart-row`/
    `dd-detail-row` structure, and the `stat-live`/`stat-period` tinting ERP
    had none of).
24. **The Purchase Dashboard's stat tiles had drifted**: ERP used
    `dash-stat-row` with a `pd-s-matcov` "materials covered" pair that
    Portal replaced with `pd-s-actioninprogress` (Action-in-Progress GRNs).
    The dashboard JS and markup now agree with the backend's actual
    response shape.
25. **`pd-period-btns` and `pd-custom-zone` did not exist in `index.html`
    at all**, even though `purchase-dashboard.js` read `#pd-custom-type`.
    Both added to the shared `dashboard-global-toolbar`, mirroring `dd-`.
26. **`revise-po.js` was missing Portal's blanket `.workspace-panel`
    sweep** in `navigateToPurchaseWorkspacePanel` — reaching Purchase
    directly from a Design/Store/Project canvas (without Return to Main
    Dashboard first) left that panel visible underneath. Ported, keeping
    ERP's guarded `getElementById` for the two enclosure panels.
27. **`data-allow-negative="true"` was missing from all three Round Off
    inputs** (Create PO, Revise PO, Approve PO Revision) — `shared/ui.js`'s
    number-input guard blocks negatives unless a field opts in, so a
    negative round-off was silently unenterable.
28. **Stale `isExp`/`isExp2` variable names** in `revise-po.js`'s Approve PO
    Revision card — left over from before migration 155's Local/Import
    rename. The comparisons were already correct (`=== 'Import'`); Portal
    renamed them 6 Sep 2026 and ERP hadn't.
29. **The 11 Sep 2026 Description-of-Material auto-fill was missing** —
    `selectCPOMaterial` (`po.js`) now sets
    `row.additionalDescription = combinedName` on material selection.
30. **Stale date-formatting convention throughout** — `formatDateDMY` /
    hand-rolled `"10 Aug 2026"` helpers instead of the house-wide
    `formatOrdinalDate` / `formatOrdinalDateTime` (7 Sep 2026) across
    `po.js`, `revise-po.js`, `pps-tracking.js`, `vendor-costing.js`,
    `purchase-dashboard.js`.
31. **`apFetch` instead of `fetchWithStaleCache`** on 4
    `pullLiveActiveProjectCodes` feeds (po.js ×2, pps-tracking.js,
    revise-prn.js) — all near-static dropdown lists, exactly what that
    helper exists for. It already existed in ERP.
32. **PPS Tracking and Revise PRN's "Select PRN" were still native
    `<select>`s** — Portal moved both to the generic wrapping dropdown
    (`shared/ui.js`'s `genericDropdown*`, 5 Sep 2026) because a PRN label is
    long enough to truncate and a native `<select>` cannot wrap. Both the
    `index.html` markup and all the JS call sites converted; the widget
    already existed in ERP.
33. **PPS Tracking's work queues and the "All Received" status fix were
    missing** — ERP still had the flat (ungrouped-by-project) queue
    renderer, and the status cell that reads "From store" for a line whose
    purchase quantity dropped to 0 *after* a PO was already raised and fully
    received. Both are Portal's current behaviour; file is now
    byte-identical.
34. **★★ `project/security-admin.js` silently shadowed PPS Tracking's date
    helpers.** It defined `formatTime12h`/`formatDateTimeDMY` under Portal's
    own bare names, on the (previously true) assumption ERP had no Purchase
    module. `pps-tracking.js` declares both too, and security-admin.js loads
    LAST — so its DD/MM/YYYY versions would have won globally and handed PPS
    Tracking the wrong format. Two same-named `function` declarations are
    not a fatal `SyntaxError` the way two top-level `let`s are, so this had
    no symptom beyond wrong-looking dates. Renamed to `saFormatTime12h` /
    `saFormatDateTimeDMY` (behaviour for that screen unchanged) rather than
    diverging `pps-tracking.js` from Portal.

### Partial files (a deliberate, flagged pattern — read before Batch 6/7)

Three Store/Production-owned files were needed by Purchase's own screens.
Rather than relocating their contents (which would guarantee a duplicate
route path / duplicate function declaration when Batch 6 or 7 copies
Portal's real file), each was created **at Portal's own file path,
containing only the extracted block, with a loud header** saying so:

| File | Contains | Owner batch |
|---|---|---|
| `erp-backend/routes/store.js` | the 3 `perm_store_inward_rejected` routes + `fetchLiveMaterialStock` + `ABPS_REPAIR_ACTIONS` | Batch 6 |
| `erp-backend/routes/production.js` | `checkPRNsNeedingRequirementDatesCount` only | Batch 7 |
| `erp-frontend/store/qa.js` | the Store Inward Rejected & Missing Material screen + `exitCanvasToCardView` | Batch 6 |
| `erp-frontend/store/live-stock.js` | the 7 PRN live-stock pollers (Portal lines 1070–1403) | Batch 6 |

**Batch 6 / Batch 7: none of these mean "Store/Production is already partly
done."** Replace each with Portal's full file and confirm the extracted
block comes across unchanged.

### ERP adaptations kept (the complete list)

- `material-list.js` — `erp_ml_section_*` localStorage prefix (3 sites).
- `po.js` — `erp_abps_cpo_draft_v1`, `erpIsUserAdminGlobal`,
  `erpSessionToken`.
- `store/qa.js` — `erpIsUserAdminGlobal`.
- `purchase-dashboard.js` — `erpPtlTodayOverride`; ERP's per-dashboard
  custom-period convention; ERP's 3-arg `showDashboardGlobalToolbar`; and
  ERP's own `navigateToPurchaseDashboard` /
  `exitPurchaseWorkspacePanelBackToMenu` (Portal keeps these in
  `marketing/marketing-dashboard.js` and `production/production-dashboard.js`).
- `revise-po.js` — guarded `getElementById` for the two enclosure panels.
- `store/revise-prn.js` — the `md*` dashboard globals stay OUT (they live in
  `marketing/marketing-dashboard.js` here; see Batch 2 bug #3).
- `routes/purchase.js` + `lib/prnSync.js` — `recordStageEvent` /
  `recordStageEventOnClient` resolve to `lib/analyticsLog.js`'s no-op stubs.

**No new localStorage keys were introduced**, so nothing needed adding to
`ERP_LOCAL_STORAGE_KEYS`.

### CSS / markup parity audit

Mechanical audit: every class referenced by Portal's Purchase `index.html`
sections (workspace enclosure, dashboard canvas, Upload RM PO) AND by all 8
Purchase/PRN JS files AND by the two extracted Store blocks — static
`class="..."`, JS template strings, `className =`, `classList.*` — checked
against ERP's `<style>` block, comparing rule *bodies*, not just presence.
**70 classes referenced; zero styled in Portal but missing in ERP.** (45 of
the 70 have no CSS rule in *either* system — they are pure JS selector
hooks.) The Design/Marketing/Project style-block repairs from earlier
batches had already covered everything Purchase needs.

Markup structure diffed block-for-block:
- **Purchase workspace enclosure** (all 13 canvases): the only two
  differences were the Select PRN dropdowns (item 32 above). Now matching.
- **Purchase Dashboard canvas**: ERP's 130-line block replaced with Portal's
  127-line block; now **byte-identical**, verified by a zero-output diff.
- **Store Inward Rejected & Missing Material panel**: already identical to
  Portal's; no change needed.
- **Upload RM PO panel**: ERP's `overflow-x:auto` wrapper fix (10 Sep 2026)
  is present and correct; left alone.

### Verification actually performed

- Byte-level diff of `routes/purchase.js`, `lib/prnSync.js`,
  `lib/materialRequirementDates.js` vs Portal — all empty.
- `node --check` on every backend file touched and every `.js` under
  `erp-frontend` — clean.
- Runtime `require()` of every touched backend module + two full
  `server.js` boots — clean (no circular import, no missing export).
- Zero duplicate route paths across all `erp-backend/routes/*.js`.
- **All 47 distinct `apFetch` actions** used by the Purchase/PRN screens
  resolve to a real backend route (this sweep is what surfaced items 12, 13
  and 16).
- Mechanical "called but defined nowhere" sweep across all 10
  Purchase/PRN/Store-partial frontend files plus every `on*=` handler in
  `index.html` (this is what surfaced items 17, 19, 20).
- Zero duplicate top-level `let`/`const`, zero duplicate `function` names,
  zero duplicate DOM ids, every `<script src>` resolves.
- Navigation sweeps confirmed to reach every Purchase panel: all match
  `[id$="-workspace-enclosure-panel"]` or `[id^="canvas-module-"]`, and all
  10 menu-card ids exist and are gated.
- 7-place permission table re-checked for all 13 columns — all green.
- `PURCHASE_ROOT_FOLDER_ID`, `RAW_MATERIAL_PO_FOLDER_ID`,
  `PPS_DRIVE_FOLDER_ID`, `GCS_BUCKET_NAME`, `PDFSHIFT_API_KEY_1..4`
  confirmed **set live** on the `erp-backend` Cloud Run service (queried
  directly, not assumed). `SPREADSHEET_IDS.PURCHASE` is registered and all 9
  Purchase `TABLE_REGISTRY` entries were verified identical to Portal's
  (meta AND query text).
- The PPS Document feature (migration 194, ported 11 Sep 2026) re-verified
  rather than re-ported: `regeneratePPSDocument` is now byte-identical to
  Portal's, and its env var is live.

**NOT verified: anything requiring a running browser.** No screen was
opened, no PRN was created/authorized/revised, no PO was drafted,
authorized or revised, no delivery schedule was saved, no PDF was
generated, and neither `fetchPurchaseDashboardData` nor the rejected-material
routes were ever called against real data.

### Flagged for human follow-up (deliberately NOT touched)

- **`handleCBOQDepartmentChange` is referenced by `index.html`
  (`#cboq-department`'s `onchange`) but defined nowhere in `erp-frontend`.**
  Portal keeps it in `shared/apFetch.js`. This is a **pre-existing Batch 4
  (Design) gap** surfaced by this batch's dependency sweep, not a Purchase
  one — Create BOQ's department dropdown currently throws on change. Left
  for Design's owner to confirm intended behaviour before porting.
- **`lib/analyticsLog.js` is still a no-op stub** even though Batch 0
  created all 7 `analytics` tables. Both `recordStageEvent` and
  `recordStageEventOnClient` now live there, so making it real is a
  one-file change whenever that's wanted.
- **`lib/sheetChangePoller.js`'s map and `TABLE_REGISTRY` remain two
  independent lists with no cross-check.** This has now caused the same
  silent-discard bug twice (Design in Batch 4, Purchase here). A tiny
  startup assertion — "every registry entry whose real table has a
  `trg_sheet_sync` trigger must appear in the poller map" — would end the
  class.
- **`erp_abps_cpo_draft_v1` and `erp_ml_section_*` are not in
  `ERP_LOCAL_STORAGE_KEYS`**, so they survive an explicit logout. This
  matches Portal's own behaviour for the same two features (its
  `abps_cpo_draft_v1` isn't swept either), so it was left alone rather than
  silently diverging — but it does technically sit outside CLAUDE.md §3's
  "register every key" rule.
- **`purchase.po_delivery_schedule` has no `trg_sheet_sync` trigger** in
  either system, so its rows never reach the Sheet. Same in Portal; noted
  only so it isn't mistaken for a porting omission.
- **`syncLiveRow` is called for several tables with no `TABLE_REGISTRY`
  entry** (`projects`, `job_card_materials`, `raw_material_store`,
  `spare_store`, `stock_reservations`). These no-op silently by design, so
  nothing breaks — but those rows never reach a sheet. Store/Production
  batches' concern, same as Batch 4 flagged.
- **A Cloud Scheduler job for `/internal/retryPendingBoqPdfs` still does not
  exist on ERP** (carried forward from Batch 4, unchanged).

## Batch 6 — Store

**Status: ported, committed locally, NOT pushed/deployed — and NOT
click-tested.** No live login was attempted in this session, so every claim
below rests on static verification (byte-level copy from Portal, `node
--check` on every backend and frontend file, runtime `require()` of every
touched backend module, two full `server.js` boots, a route-collision
sweep, an action→route resolution sweep, a "called but defined nowhere"
sweep across every `on*=` handler in `index.html`, a DOM-id/div-balance
check, and a mechanical CSS/markup parity audit) — not on a real browser.

`routes/store.js` (51 routes — replaced Batch 5's 246-line partial),
`store/*.js` (12 files ported/replaced), `production/job-cards.js` (new),
plus 4 routes added to the `routes/production.js` partial, 1 to
`routes/utility.js`, 1 to `routes/dashboards.js`, and 2 new `lib/` files.
14 canvases + dashboard.

### Method note — a straight port, not a re-diff

Unlike Batches 4/5, Store had no stale 4 Sep 2026 code to reconcile:
`routes/store.js`, `store/qa.js` and `store/live-stock.js` existed only as
Batch 5's deliberately-flagged **partial** files. Each was confirmed to be a
strict subset of Portal's current file (function-by-function) and then
replaced wholesale, so the extracted blocks came across unchanged. The end
state:

- `routes/store.js` — Portal's file **verbatim**, zero edits (no `.email`
  references to rename, no `syncLiveRow` inside a transaction to move).
- `store/create-prn.js`, `store/revise-prn.js` — re-diffed against Portal:
  `create-prn.js` is byte-identical, `revise-prn.js` differs only by Batch
  2's documented `md*` deviation. No drift.
- All 12 newly-ported `store/*.js` are Portal's current files with the
  enumerated ERP adaptations below and nothing else.

### Real bugs / gaps found and fixed

**Backend**

1. **★★ `u.production_sub_dept` was never selected by ERP's
   `requireSession`** — so `req.user.production_sub_dept` was always
   `undefined` and `lib/productionScope.js`'s `resolveTicketDepartmentLock`
   returned `{ blocked: true }` for **every** Production user. Create
   Material Issue Ticket would have refused outright for exactly the people
   it exists for. `resolveProductionSubDeptScope` (Purchase/Production
   Material Requirement Dates, Batch 5) was silently scoping to `null` for
   the same reason — a **pre-existing Batch 5 bug**, not a Store one. The
   column exists on `admin_db.users` and has since ERP's founding; only the
   SELECT was missing.
2. **`getSessionPermissions` genuinely had to be ported.** Batch 2's note
   in `routes/utility.js` ("ERP bakes permissions into the login response,
   confirmed no ERP frontend file calls this action") was true when written
   and is now stale — `store/tickets.js` calls it on every entry to Create
   Material Issue Ticket, and it is the **only** source of
   `ticketOutgoingUseLock`, the server-computed Outgoing Use lock that
   `routes/store.js`'s `submitEngineerMaterialTicket` independently
   enforces. Recomputing that lock client-side would let the two drift, so
   the route was ported rather than worked around. ERP still also bakes
   permissions into the login response — this is additive.
3. **Five routes Store's screens call did not exist in ERP.** Found by the
   action→route sweep, not by reading: `fetchStoreDashboardData` (Portal's
   `routes/dashboards.js` — the Store Dashboard's data fetch was a
   guaranteed 404; ported verbatim and deliberately **reuses** this file's
   existing `computeExpectedDeliveryTimeline` rather than a second copy, so
   Store and Purchase can never drift on what counts as overdue), and four
   from Portal's `routes/production.js` —
   `getLiveFinishedGoodsInventory` (Live FG Store Stock),
   `fetchJobCardMaterials` (the ticket item dropdown + stock pill),
   `fetchPendingBOQIncreaseTickets` (Approve Excess Material Request) and
   `fetchJobCardsForProject` (the Project → BOQ → Job Card cascade). All
   four were added to the existing `routes/production.js` **partial** file
   at Portal's own path, permission gates unchanged, so Batch 7 can still
   copy Portal's full file over it without a duplicate-path collision.
4. **`lib/pdf.js` was missing `generateMaterialIssueTicketPdf` /
   `generateStockSweepPdf`**, and `lib/storeLedgerExcel.js` /
   `lib/consumptionVarianceExcel.js` did not exist at all. All ported
   verbatim (`exceljs` is already a dependency).
5. **7-place permission rule — 11 columns were missing from at least one
   place.** New to all 5 code places: `perm_gate_entry`,
   `perm_store_entry_and_grn`, `perm_expected_deliveries`,
   `perm_approve_job_card_increase`, `perm_approve_store_tickets`,
   `perm_search_store_tickets`, `perm_material_outward`,
   `perm_store_dashboard`. Also surfaced early, same precedent as Batch 5's
   live-stock permissions: `perm_qa_check` (its screen and routes are
   Store's; its dashboard card is QA's, Batch 8) and
   `perm_create_store_ticket` (screen and routes Store's, card Production's,
   Batch 7) — without a catalog entry neither could ever be granted from
   the Permissions Matrix, so both ported screens would have 403'd.
   `lib/permissionCatalog.js` gained a `qa` `DEPARTMENT_META` row and a
   `dashboard-store` row to match.
6. **★ `perm_authorize_prn_revision` was missing from all 5 code places —
   a Batch 5 gap.** Authorize PRN Revision's screen was ported in Batch 5
   but the permission was never wired, so `requirePermission` could never
   see it and the card could never be shown. Added.
7. **The PRN and Material-Requirement-Date permissions were missing from
   the Users sheet** (`lib/sheetsRegistry.js`'s users query and
   `lib/sheetsPull.js`'s `USER_PERM_HEADERS`) despite being wired
   everywhere else in Batches 3/5 — the same 2-of-7 gap Batches 4 and 5
   each found. All 18 Store/PRN/MRD headers added with Portal's exact
   header text; the Sheet's header row self-heals on the next sync
   (`ensureTabFormatted` rewrites A1 from this list), no manual step.
8. **All 10 Store tables were missing from BOTH `TABLE_REGISTRY` and
   `lib/sheetChangePoller.js`'s `REAL_TABLE_TO_REGISTRY_KEY`**, even though
   every one of them already carries a live `trg_sheet_sync` trigger
   (verified against the Batch 0 and 4 Sep migration files). Anything they
   queued hit the "no sheet mapping" branch and was silently discarded —
   the third batch in a row to hit this class. Both lists now carry the
   same 10 Portal maps; `receipt_attributions` and `stock_borrow_events`
   stay deliberately absent in both systems (pure audit tables).

**Frontend**

9. **★★ `renderIsolatedFollowUpTimeline` / `editIsolatedFollowUpItem` were
   genuinely undefined in ERP — a pre-existing Batch 2 bug.** They live in
   Portal's `store/qa.js` (an artifact of its own 4 Sep automated split)
   but are MARKETING lead-card helpers, called by `marketing/companies.js`
   and `marketing/leads.js`; Batch 5's partial `qa.js` extracted only
   `exitCanvasToCardView`, so lead View Details' follow-up timeline threw.
   The full `qa.js` port fixes it, and the three helpers it needs
   (`formatPlainTimeOfDay`, `formatCleanDateOnly`, `formatFollowUpTimestamp`)
   were ported into `shared/format.js`.
10. **`updateSelectedLiveStockPillCounter` was awaited unguarded from
    `store/tickets.js` and defined nowhere** — same class of gap as Batch
    5's seven missing live-stock pollers. It lives in Portal's
    `production/job-cards.js`, which turned out to contain **nothing but**
    Create Material Issue Ticket helpers (it and
    `handleCreateTicketProjectChange`, after Portal deleted that file's dead
    Job Card creation screen on 3 Sep 2026). Ported as a complete file, not
    a partial — Batch 7 should leave it alone.
11. **The four Store Entry / GRN item-code helpers Batch 4 explicitly
    flagged as Batch 6's** (`handleSENameSearch`,
    `selectStoreEntryItemCodeMatch`, `reopenSEMaterialSearch`,
    `selectSENameMatch`) live in Portal's `design/item-codes.js` and were
    absent here. `store/grn.js` calls three of them. Ported verbatim into
    ERP's own `design/item-codes.js` rather than relocated, so the two
    systems' files stay comparable.
12. **The four PRN cards and Reserve Store Stock had no menu card at all.**
    Batch 5 ported Create PRN / Authorize PRN / Revise PRN / Authorize PRN
    Revision functionally (routes, screen JS, and the panels inside the
    Purchase enclosure) but their dashboard tiles belong to Portal's STORE
    dept-block, which ERP had never built — so all four screens were
    unreachable from the dashboard. Added along with the rest of Portal's
    Store block (rows 1-5, sections and order copied verbatim).
13. **`switchActiveDashboardModule` never swept the enclosure
    CONTAINERS.** Before Store existed nothing nested inside one was
    reachable through that router, so it never showed; with Store's 14
    canvases inside `module-store-workspace-enclosure-panel`, reaching an
    unrelated top-level panel from a Store screen would have left the
    enclosure rendering underneath. Added the
    `[id$="-workspace-enclosure-panel"]` sweep Portal's own copy has.
    (`returnToDashboard` and `handleDepartmentTabClick` already had it from
    Batch 4; `navigateToModule` uses the blanket `.workspace-panel` sweep.)
14. **★★★ The Custom period selector would have mutated an `<input>`'s
    `type` at runtime** — Portal's `store-dashboard.js` delegates to its
    shared `dashCustomTypeChange`/`dashReadCustomVal`, which ERP does not
    have, and which carry Portal's own pre-8-Sep behaviour. Rewritten to
    ERP's per-dashboard convention (`SD_CUSTOM_TYPE_SUFFIX` /
    `sdCustomTypeChange` / `sdReadCustomVal`, five dedicated inputs toggled
    with `hidden`), matching `md`/`dd`/`pd`/`adm`/`ad` exactly. The
    `sd-period-btns` and `sd-custom-zone` markup was cloned from ERP's own
    `pd-` blocks in the shared `dashboard-global-toolbar`, so it is
    structurally identical to the four dashboards already live here.
15. **Portal's `store-dashboard.js` ends with a misplaced Production
    Dashboard block** (`navigateToProductionDashboard` + the start of its
    `pd2*` engine globals — another automated-split artifact). Dropped
    rather than carried across as permanently-broken dead code: it calls
    `ddShowAllWorkspaceEnclosures` / `pd2ReturnToMain`, neither of which
    exists in ERP. Batch 7 owns it and should file it in
    `production/production-dashboard.js`, its real home. `sd*` globals,
    `navigateToStoreDashboard` and `sdReturnToMain` moved the other way —
    Portal declares them in `marketing/marketing-dashboard.js`; here they
    live in `store/store-dashboard.js`, the same choice Batch 5 made for
    `navigateToPurchaseDashboard`.
16. **All three `typeof`-guarded forward references were verified as
    guarded, not missing**: `pd2LoadDashboard` (Batch 7),
    `resetJCSHWorkspace` (Batch 7), `resetIPSHWorkspace` (Batch 8). They
    stay no-ops until their own batch lands, exactly as in Portal.

### A stale claim in Portal's own docs, corrected

Portal's `CLAUDE.md` still says "`routes/store.js:2072`'s Material Issue
Ticket PDF upload still uses `PRODUCTION_DRIVE_FOLDER_ID` — same gap, not
yet fixed", and this batch's brief repeated it as something to port as-is.
Portal's **current** code does not do that: the upload reads
`process.env.STORE_MATERIAL_ISSUE_TICKETS_DRIVE_FOLDER_ID`. Nothing in
ERP's `routes/store.js` references `PRODUCTION_DRIVE_FOLDER_ID` at all.
The gap is closed in Portal; only its doc is stale.

### ERP adaptations kept (the complete list)

- `store/qa.js` — `erpIsUserAdminGlobal` (2 sites).
- `store/live-stock.js` — `erp_rm_section_*` / `erp_spare_section_*`
  localStorage prefixes (6 sites), matching Batch 5's `erp_ml_section_*`
  precedent. These are per-viewer collapse-state conveniences, so like
  Portal's own equivalents they are NOT in `ERP_LOCAL_STORAGE_KEYS` —
  flagged below.
- `store/store-dashboard.js` — ERP's per-dashboard custom-period
  convention; ERP's 3-arg `showDashboardGlobalToolbar`; ERP's own
  `navigateToStoreDashboard`/`sdReturnToMain`; Portal's misplaced
  Production Dashboard block removed (items 14/15).
- `shared/navigation.js`'s `navigateToStoreWorkspacePanel` — Portal's
  function minus the Production/QA branches (`job-card-sheet`,
  `in-process-sheet`, the two MRD panels, `production-planning`, `fg-add`,
  `fg-approval`) whose canvases do not exist here yet, and minus
  `checkMaterialRequirementDateReminder`/`checkProductionPlanningReminder`
  (Batch 7). Every `getElementById(...).style` was made defensive.
- `routes/production.js` / `routes/store.js` / `routes/utility.js` —
  `recordStageEvent` still resolves to `lib/analyticsLog.js`'s no-op stub.

**One new localStorage key family** (`erp_rm_section_*`,
`erp_spare_section_*`) was introduced, correctly `erp`-prefixed.

### CSS / markup parity audit

Mechanical audit: every class referenced by the ported Store `index.html`
markup (enclosure + 14 canvases + dashboard canvas) AND by all 12
`store/*.js` files AND `production/job-cards.js` — static `class="..."`,
JS template strings, `className =`, `classList.*` — checked against ERP's
`<style>` block, comparing rule **bodies**, not just presence.
**68 classes referenced; 37 styled in Portal; exactly 3 missing in ERP**
(31 have no rule in either system — pure JS selector hooks):
`gate-upload-row`, `gate-meta-grid`, `gate-verification-footer`. All three
plus their two `@media` variants and the `#canvas-module-store-gate-entry`
-scoped table rules were copied verbatim (Portal's whole "GATE ENTRY MOBILE
RESPONSIVENESS" block).

Three further body-level differences were examined and deliberately left:
`.dd-stat-card`'s base rule (ERP's `height:auto; overflow:visible` vs
Portal's `height:100%; overflow:hidden` — Batch 4's documented non-change,
aligning it would re-break Marketing/Accounts), and
`.pill-group.business-potential-pills` (Marketing, out of scope). Every
other difference was rule ORDER only.

Markup was taken directly from Portal, not re-authored:
- **Store workspace enclosure** — Portal's lines 1015-1516 + 2123-2345,
  i.e. the enclosure header/banner and all 14 Store canvases, verbatim.
  Portal's Production/QA/Project-Invoice canvases that share this enclosure
  were excluded (Batches 7/8; Project Invoice Generation is already its own
  top-level panel from Batch 3).
- **Store Dashboard canvas** — Portal's 121-line block verbatim.
- **Store dept-block** — Portal's sections, card ids, labels and order
  verbatim; row labels match `lib/permissionCatalog.js`'s `rowLabel`s.

### Verification actually performed

- `node --check` on every backend file and every `.js` under
  `erp-frontend` — clean.
- Runtime `require()` of all 13 touched backend modules + a full
  `server.js` boot — clean (no circular import, no missing export).
  `routes/utility.js` now requires `../auth`; confirmed no cycle.
- Zero duplicate route paths across all `erp-backend/routes/*.js`
  (re-checked after each of the three route insertions).
- **All 66 distinct `apFetch` actions** used by `store/*.js` and
  `production/job-cards.js` resolve to a real backend route — this sweep
  is what surfaced items 2 and 3.
- Mechanical "called but defined nowhere" sweep across all 14 Store/PRN
  frontend files, `production/job-cards.js`, and every `on*=` handler in
  `index.html` — this is what surfaced items 9, 10 and 11. Now returns
  only the two `typeof`-guarded Batch 7/8 forward references.
- Zero duplicate top-level `let`/`const`, zero duplicate `function` names
  across the whole `erp-frontend` tree.
- Every `<script src>` in `index.html` resolves; `<div>` balance is 0; zero
  duplicate DOM ids (the one reported hit is Portal's own HTML comment
  containing the literal text `id="store-panel-center-title"`).
- All 20 Store panel/control ids that `navigateToStoreWorkspacePanel`,
  `switchActiveDashboardModule` and `store/*.js` reference were confirmed
  present in `index.html`.
- Navigation sweeps confirmed to reach the new enclosure: it carries
  `class="workspace-panel"` and matches `[id$="-workspace-enclosure-panel"]`,
  so `returnToDashboard`, `handleDepartmentTabClick`, `navigateToModule`
  and (now) `switchActiveDashboardModule` all clear it.
- **Migration 201 ID generation — verified, the specific check this batch
  was asked for.** All four `allocateSequentialDocNumber` call sites
  (`allocateNextGateNumber` line 235, `allocateNextGrnNumber` 428,
  `allocateNextTicketId` 1553, `allocateNextStockSweepBatchId` 3399) were
  confirmed to sit **inside** a `withTransaction(async (client) => {`
  callback opened 1-5 lines earlier, and to pass that transaction's own
  `client` — never the shared `pool`. The helper itself does a single
  atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` on
  `client.query`. This is Portal's current post-201 shape verbatim.
- **`syncLiveRow`/`removeLiveRow` inside a transaction — scanned, zero
  hits.** A brace-depth scan over the whole of `routes/store.js` found no
  sync call inside any `withTransaction` body; Portal's current file is
  already clean of the 15 Sep 2026 landmine.
- Store's own `store.*` tables confirmed present in ERP and confirmed to
  carry `trg_sheet_sync` (7 from Batch 0's migration, 3 from the 4 Sep
  mirror migration) before mapping them in the poller.

**NOT verified: anything requiring a running browser or a live database.**
No screen was opened, no Gate Entry / GRN / QA check / ticket / stock sweep
/ delivery challan was created, no PDF or Excel export was generated,
`fetchStoreDashboardData` was never called against real data, and the four
migration-201 counter tables were never queried live (see follow-ups).

### Flagged for human follow-up (deliberately NOT touched)

- **★★★ Five Drive env vars are NOT set on `erp-backend`** —
  `INVOICE_FOLDER_ID`, `CHALLAN_FOLDER_ID`, `STORE_DRIVE_FOLDER_ID`,
  `MATERIAL_OUTWARD_DRIVE_FOLDER_ID`,
  `STORE_MATERIAL_ISSUE_TICKETS_DRIVE_FOLDER_ID` (queried live, not
  assumed). Gate Entry's invoice/challan uploads silently skip without the
  first two; Stock Sweep, Material Outward and the Material Issue Ticket
  PDF each hard-refuse with "…root folder is not configured on the server."
  The folder IDs are already recorded in this file's Prerequisites section.
  Not set here because a Cloud Run env-var update deploys a new revision,
  and this batch was explicitly local-only:
  ```
  gcloud run services update erp-backend --region asia-south1 \
    --update-env-vars INVOICE_FOLDER_ID=1eijm29umA2oxnQ-J4h59o4Wz1X9NKLTK,\
  CHALLAN_FOLDER_ID=1fznjUrkO2l1O8YAUXLT7pK2HTnuwv60Q,\
  STORE_DRIVE_FOLDER_ID=1jwWLVpPhvGflUCDuv-4XYu9JZvuNjHlk,\
  MATERIAL_OUTWARD_DRIVE_FOLDER_ID=1PjymA91DRR_BZopC1fPK2WTx_sTF5dLd,\
  STORE_MATERIAL_ISSUE_TICKETS_DRIVE_FOLDER_ID=19DzIf4n3njXbyPcGv3RQhwdPnRPYZp-s
  ```
  (Verify the VPC-egress flags from CLAUDE.md §2 survive that update.)
- **★★ The migration-201 counter tables could not be verified live.**
  Portal's CLAUDE.md states migration 201 was applied to both databases and
  that these four tables were created in `erp` ahead of Store being built,
  but there is no ERP migration file for them and no session had DB access
  to confirm. If they are genuinely absent, **every** Gate Entry, GRN,
  Material Issue Ticket and Stock Sweep fails outright. A new idempotent
  `erp-backend/migrations/store_document_number_counters.sql` re-asserts
  only the Store half of migration 201 (`CREATE TABLE IF NOT EXISTS` ×4,
  plus explicit `GRANT ... TO erp_app`, since a table created later by
  `postgres` does not inherit Batch 2's one-off grant fix). **Run it once
  before the first Gate Entry** — it is a no-op if the tables already
  exist. It deliberately does NOT replay migration 201's Lead/Company
  zero-padding (Batch 2's) or its dead `prn_id`/`po_no` DEFAULT drops
  (Batch 5's).
- **Raw Materials Q/A Check and Create Material Issue Ticket have no
  dashboard card yet.** Their routes (`routes/store.js`) and screens
  (`store/qa.js`, `store/tickets.js`, `production/job-cards.js`) and
  canvases are all in place and permission-wired, but Portal files their
  menu cards under QA (`perm_qa_check`, Batch 8) and Production
  (`perm_create_store_ticket`, Batch 7). Batch 7/8 only need to add the
  card — `navigateToStoreWorkspacePanel('store-grn')` and
  `('store-material-request')` already work.
- **`erp_rm_section_*` / `erp_spare_section_*` are not in
  `ERP_LOCAL_STORAGE_KEYS`**, so they survive an explicit logout. This
  matches Portal's behaviour for the same feature and Batch 5's identical
  decision for `erp_ml_section_*`, but it does sit outside CLAUDE.md §3's
  "register every key" rule.
- **`fetchJobCardsForProject` and `fetchJobCardMaterials` are gated on
  permission columns ERP's `requireSession` does not yet SELECT**
  (`perm_add_finished_goods_store`, `perm_fg_approval`,
  `perm_in_process_sheet`, `perm_job_card_sheet`). Harmless today —
  `requirePermission` takes an array and `perm_create_store_ticket` is
  selected, so a Store/Production ticket user passes — but Batches 7/8 must
  add those four columns to the SELECT or their own screens will 403.
- **`lib/sheetChangePoller.js`'s map and `TABLE_REGISTRY` remain two
  independent lists with no cross-check.** This has now caused the same
  silent-discard bug in Batch 4 (Design), Batch 5 (Purchase) and Batch 6
  (Store). A startup assertion — "every registry entry whose real table has
  a `trg_sheet_sync` trigger must appear in the poller map" — would end the
  class. Third batch flagging it.
- **The STORE spreadsheet's 10 tabs will auto-create on first sync**
  (`ensureTabFormatted`/`getOrCreateSheetId`), same as QA's did in Portal —
  no manual Sheets step is expected, but nothing confirmed it here.
- **A Cloud Scheduler job for `/internal/retryPendingBoqPdfs` still does
  not exist on ERP** (carried forward from Batches 4/5, unchanged).

## Batch 7 — Production

**Status: ported, pushed, deployed, and live click-tested (16 Sep 2026).**
Code was committed the same day this batch was ported, then carried live
by the many `erp-backend`/`erp-frontend` deploys done for unrelated fixes
later in that same session — by the time anyone checked, Batch 7 had
already been serving in production for hours without anyone having
actually clicked through it. A dedicated click-test pass (logged in as
Ashwin Kumar, PIN 2310) covered all 6 screens + Dashboard and found two
real bugs, both fixed and deployed the same day — see below.

`routes/production.js` (24 routes, replacing the Batch 5/6 partial),
`routes/productionPlanning.js` (14 routes, new file),
`production/*.js` (5 new frontend files + 1 already present),
`fetchProductionDashboardData` + `fetchProductionTimelineDueOverdue` into
`routes/dashboards.js`. 6 screens + dashboard.

### What Production actually is (the scope question, answered)

The brief asked whether `perm_create_store_ticket` is a 4th distinct
Production screen. **It is not.** Read from Portal's real `index.html`
Production dept-block, the department is 6 screens + a dashboard:

| Card | Permission | Screen lives in |
|---|---|---|
| Assign Material Requirement Date | `perm_assign_material_requirement_date` | Production |
| Revise Material Requirement Date | `perm_revise_material_requirement_date` | Production |
| Production Planning | `perm_production_planning` | Production |
| Create Material Issue Ticket | `perm_create_store_ticket` | **Store** (`store/tickets.js`, `routes/store.js`) — only the CARD is Production's |
| Job Card Sheet | `perm_job_card_sheet` | Production |
| Add to Finished Goods Store | `perm_add_finished_goods_store` | Production |
| 📊 Dashboard | `perm_production_dashboard` | Production |

So Create Material Issue Ticket needed **only a menu card** — exactly what
Batch 6 predicted. Its screen, routes and canvas were already in place and
permission-wired; `navigateToStoreWorkspacePanel('store-material-request')`
already worked.

**Confirmed QA-owned, deliberately left for Batch 8**: FG Approval
(`perm_fg_approval`, `production/fg-approval.js`) and In Process Sheet
(`perm_in_process_sheet`) — both moved to QA in Portal on 8 Sep / 11 Sep
2026. Neither screen was ported. Their **routes** did come across, because
they live inside Portal's `routes/production.js` and this batch ports that
file whole (see below).

### Method note — a straight port, with three assembled files

`routes/production.js`, `routes/productionPlanning.js`,
`lib/serialTraceSnapshot.js`, `lib/jobCardSheetTemplates.js`,
`production/job-card-sheet.js` and
`production/material-requirement-dates.js` are **byte-identical to
Portal** (verified with a real `diff`, not asserted — `production.js` is
identical past its 21-line ERP header). Three files needed real assembly
or adaptation, each documented in its own header: `production-dashboard.js`,
`production-planning.js`, `finished-goods.js`.

### Real bugs / gaps found and fixed

**Backend**

1. **★★★ F7 confirmed and fixed, and it was wider than described.** Six
   Production permission columns were missing from `auth.js`'s
   `requireSession` SELECT — `perm_production_planning`,
   `perm_job_card_sheet`, `perm_add_finished_goods_store`,
   `perm_production_dashboard`, plus QA's `perm_fg_approval` /
   `perm_in_process_sheet`. `requirePermission` reads `req.user[col]`, so
   an unselected column is `undefined` and therefore always falsy. The
   brief's note that this ALSO breaks `routes/design.js` was verified
   directly: `design.js:110` and `:132` (Material Descriptions —
   `fetchMaterialDescriptions` / `createMaterialDescription`) both list
   `perm_add_finished_goods_store` in their `requirePermission` array, so
   an Add-to-FG-Store-only user 403'd on Design's routes too, for a reason
   nothing in Design would ever suggest. All six added, with a comment at
   the SELECT explaining why `perm_add_finished_goods_store` in particular
   must not be dropped again.
2. **All 6 columns were missing from all 5 backend permission places**,
   not just `auth.js` — `lib/permMap.js`, `lib/permissionCatalog.js`,
   `lib/sheetsRegistry.js`'s users query and `lib/sheetsPull.js`'s
   `USER_PERM_HEADERS` had none of them. Fourth batch running to find the
   registry/pull pair out of sync. Header text copied verbatim from
   Portal ("Add Finished Goods Store", "Add Finished Goods Store
   Approval", …); the Sheet's header row self-heals on the next sync via
   `ensureTabFormatted`, no manual Sheets step. A `dashboard-production`
   `DEPARTMENT_META` row was added to match, and QA's two entries were
   catalogued early under the existing `qa` department — same precedent
   as Batch 6 surfacing `perm_qa_check`, and necessary because without a
   catalog entry a permission can never be granted from the Permissions
   Matrix at all.
3. **★★ `fetchProductionDashboardData` did not exist in ERP, and neither
   did a helper it calls.** The route was found missing by the
   action→route sweep (a guaranteed 404 on the Dashboard's only fetch)
   and ported from Portal's `routes/dashboards.js`. A follow-up
   undefined-identifier scan of the ported block then caught
   **`fetchProductionTimelineDueOverdue`** — a module-level helper the
   route calls but which sits ~1,400 lines earlier in Portal's file and
   so was outside the copied range. Ported too, along with the
   `computeProductionMilestonesForProjects` import it needs. Without that
   second catch the route would have thrown `ReferenceError` on every
   call while looking perfectly well-formed. It deliberately **reuses**
   ERP's existing `computeExpectedDeliveryTimeline` and
   `resolveDashboardToday` / `istDayKey` / `getPeriodBounds` rather than
   introducing second copies.
4. **`lib/pdf.js` had no `generateJobCardOrInProcessSheetPdf`** and
   `lib/jobCardSheetTemplates.js` did not exist, so both sheet-PDF routes
   would have thrown on `require`. Ported verbatim (the templates file
   only needs `pdf-lib`, already a dependency), including the 11 Sep 2026
   `stretchHeight` epsilon fix and the per-product-type `fontSize`
   tuning, since it is a byte-identical copy.
5. **`lib/serialTraceSnapshot.js` did not exist** — `addFinishedGoodsItem`
   calls `buildAndStoreSerialTraceSnapshot` after commit. Ported verbatim;
   its target table `qa.product_serial_traceability` was confirmed to
   exist in ERP (Batch 0) rather than assumed. It never throws by design,
   so a miss here would have been silent.
6. **`lib/analyticsLog.js` lacked `recordMaterialLineOutcome`** (called by
   `approveFinishedGoodsItem`). Added as a **no-op stub** alongside the
   two existing ones rather than a real port — that file's own header
   already documents the decision: ERP's `analytics` tables exist but
   nothing reads them and no capture layer is built.
7. **All 4 `production.*` tables were missing from BOTH `TABLE_REGISTRY`
   and `lib/sheetChangePoller.js`'s `REAL_TABLE_TO_REGISTRY_KEY`**, even
   though every one of them already carries a live `trg_sheet_sync`
   trigger in ERP (three from the Design/Purchase mirror migration,
   `finished_goods_documents` from Batch 0 — verified against the
   migration files, not assumed). Anything they queued hit the "no sheet
   mapping" branch and was silently discarded. **Fourth consecutive batch
   to hit this class** (Design, Purchase, Store, now Production). Note the
   registry key for `production.job_cards` is `job_card_number`, not
   `job_cards` — Portal's historical name, and what
   `routes/production.js`'s own `syncLiveRow` calls pass.
8. **`admin_db.users.production_sub_dept` was not reaching the frontend at
   all.** Production Planning's lane write-gate needs department +
   sub-department; Portal gets them from `getSessionPermissions` via
   `applyServerRoleFlags`, a route ERP does not have. Rather than build
   that route (out of scope), `pinLogin`'s response now carries
   `department` / `productionSubDept`, which meant joining
   `admin_db.departments` into its existing user lookup (it was a bare
   `SELECT *`). See item 12 for the frontend half and the staleness
   caveat this creates.

**Frontend**

9. **★★ `production/production-dashboard.js` could not be copied — Portal's
   copy is broken in three directions at once.** Portal's 4 Sep 2026
   automated split scattered this one feature: `navigateToProductionDashboard`
   and every `pd2*` module global sit at the END of Portal's
   `store/store-dashboard.js` (Batch 6 dropped them and flagged them for
   this batch); `pd2ReturnToMain` sits in `marketing/marketing-dashboard.js`;
   and Portal's own `production-dashboard.js` starts mid-engine and **ends
   with `navigateToMarketingDashboard`, `exitPurchaseWorkspacePanelBackToMenu`
   and the PRN/stock-sweep globals `prnCurrentData` / `prnStoreQtyLocked` /
   `sweepBasket`** — all of which already exist in ERP in their real
   owners. Copying that tail would have been a **fatal duplicate top-level
   `let`**, killing the whole app at load. The file was assembled instead:
   globals + both nav functions + Portal's lines 1-227 only.
10. **The Custom period selector would have mutated an `<input>`'s `type`
    at runtime** — the same landmine Batch 6 hit. Portal's
    `pd2CustomTypeChange` / `pd2LoadCustom` delegate to its shared
    `dashCustomTypeChange("pd2")` / `dashReadCustomVal("pd2")`, which do
    not exist in ERP and carry Portal's own pre-8-Sep behaviour. Rewritten
    to ERP's per-dashboard convention (`PD2_CUSTOM_TYPE_SUFFIX` /
    `pd2CustomTypeChange` / `pd2ReadCustomVal`, five dedicated inputs
    toggled with `hidden`), matching `md`/`dd`/`pd`/`sd`/`adm`/`ad`
    exactly. The `pd2-period-btns` and `pd2-custom-zone` markup was cloned
    from ERP's own `sd-` blocks in the shared `dashboard-global-toolbar`,
    so all 15 `pd2-*` control ids are structurally identical to the five
    dashboards already live here.
11. **`localStorage.getItem("ptlTodayOverride")`** in the dashboard's fetch
    would have silently read nothing — ERP's key is `erpPtlTodayOverride`
    (Portal and ERP share the `abps-solution.github.io` ORIGIN and
    localStorage partitions by origin, not path). Fixed.
12. **`production-planning.js` read three unprefixed keys** —
    `isUserAdminGlobal`, `userDepartment`, `userProductionSubDept` — which
    on this shared origin read **Portal's own values**, not ERP's. All
    three switched to `erp`-prefixed equivalents, with
    `erpUserDepartment` / `erpUserProductionSubDept` newly written at
    login (item 8) and registered in `ERP_LOCAL_STORAGE_KEYS`.
    `pplanCanWriteLane` was changed to **fail OPEN on an unknown
    department** rather than Portal's fail-closed: ERP has no
    `getSessionPermissions` refresh, so these are login-time-only and a
    pre-existing session would otherwise have every Stage 4 control hidden
    with no way to tell why. `routes/productionPlanning.js`'s
    `assertCanWriteLane` is untouched and remains the real enforcement —
    worst case is a clear server error instead of a pre-hidden button.
13. **`checkMaterialRequirementDateReminder` / `checkProductionPlanningReminder`
    were genuinely undefined** — Batch 6 explicitly deferred them. Ported
    verbatim into `shared/navigation.js` and called from
    `switchActiveDashboardModule`, which is where Portal calls them (NOT
    from `navigateToStoreWorkspacePanel`, where the brief's reading of
    Batch 6's note might suggest). The route name matters and is easy to
    get wrong: `checkPRNsNeedingRequirementDateRevisionCount`, **not**
    `...RequirementDatesCount` — the extra "Revision" is what excludes a
    brand-new PRN that has never had dates submitted, which is Portal's
    own 31 Aug 2026 fix. The other route is correct for Purchase's "N
    hidden" note and must not be swapped in.
14. **`initializeFinishedGoodsAddWorkspace` is called but defined
    nowhere** — found by the called-but-undefined sweep. Traced to
    Portal's `shared/typeahead.js`, which ERP deliberately did not port.
    It turns out to be **dead in Portal too**: its only caller is the "+
    Add Another Item" button inside `submitFinishedGoodsAddEntry`'s own
    success banner, which that same (unreachable) screen renders. The live
    screen is `initializeFGAddWorkspace`. Left in place per the
    flag-don't-delete rule, with a header explaining it is unreachable AND
    that its `addFinishedGoodsItem` payload shape
    (`qaDone`/`storeIncharge`/`totalStock`) is one the current route no
    longer accepts — so it must not simply be wired up.
15. **`production/job-cards.js` was verified, not overwritten.** A real
    `diff` (line-endings normalised) confirms it is byte-identical to
    Portal past its 17-line Batch 6 header. Left untouched, as its header
    instructs.
16. **The five Production canvases live inside the STORE enclosure**, as
    in Portal, so `switchActiveDashboardModule` delegates all five targets
    to `navigateToStoreWorkspacePanel` — the same shortcut ERP already
    takes for `store-history-matrix` / `store-live-stock`. Portal inlines
    six near-identical enclosure blocks instead; ERP's `show()` helper
    already hides `store-panel-left-controls` / `store-panel-center-title`
    for any non-`store-live-stock` target, so the resulting DOM state is
    identical with one copy of the logic. Verified by reading the helper,
    not assumed.

### ERP adaptations kept (the complete list)

- `production/production-dashboard.js` — assembled from three Portal
  locations; ERP's per-dashboard custom-period convention; ERP's
  `navigateToStoreDashboard`-shaped navigation (no
  `ddShowAllWorkspaceEnclosures` here); `erpPtlTodayOverride`.
- `production/production-planning.js` — three `erp`-prefixed localStorage
  keys; `pplanCanWriteLane` fails open on unknown department.
- `production/finished-goods.js` — one added comment block only (item 14);
  no code change.
- `routes/production.js` — 21-line ERP header; otherwise identical.
  `recordMaterialLineOutcome` resolves to the no-op stub.
- `auth.js` / `shared/apFetch.js` — `department` / `productionSubDept` on
  the login response and two new `erp`-prefixed localStorage keys.

**Two new localStorage keys** (`erpUserDepartment`,
`erpUserProductionSubDept`), both correctly `erp`-prefixed and both
registered in `ERP_LOCAL_STORAGE_KEYS`.

### CSS / markup parity audit

Mechanical audit: every class referenced by the ported Production markup
(5 workspace canvases + the dashboard canvas + the dept-block) AND by all
5 `production/*.js` files — static `class="..."`, JS template strings,
`className =`, `classList.*`, `querySelectorAll('.x')` — checked against
ERP's `<style>` block and against Portal's, comparing whether a rule
exists at all.

**53 classes referenced; exactly 1 flagged, and it is a false positive.**
`.spinner` has no CSS rule in **either** system — it is a pure JS hook,
with every spinner fully inline-styled at each call site. What actually
matters is the `@keyframes spin` those inline styles reference, and that
is present in both (`index.html` line 47 here, line 41 in Portal).
**Net: zero real CSS gaps.** Nothing needed copying — the Batch 4/5/6
proactive parity work had already brought across everything Production
reuses (`dd-stat-card`, `stat-live`, `stat-period`, `dd-period-btn`,
`gwd-display`/`gwd-list`, `menu-card`, `sec-label`, `panel-title`, the
dept-block family).

Markup was taken directly from Portal, not re-authored:
- **5 workspace canvases** — Portal's `index.html` lines 1518-1597,
  1680-1709, 1711-1751, 1753-1777, 1779-1926, verbatim, inserted inside
  the existing store enclosure where Portal also nests them. Portal's
  `canvas-module-in-process-sheet` and `canvas-module-fg-approval` sit
  between these in its file and were deliberately skipped (Batch 8).
- **Production Dashboard canvas** — Portal's lines 4368-4501, verbatim.
- **Production dept-block** — Portal's lines 969-997: sections, card ids,
  labels and order verbatim; row labels match `permissionCatalog.js`'s
  `rowLabel` values exactly.
Each slice was `<div>`-balance-checked before insertion.

### Verification actually performed

- `node --check` on every touched backend file and **every** `.js` under
  `erp-frontend` — clean.
- **Full `server.js` boot** (not just `require`) — loaded, GeoIP warmed,
  listening. No circular import, no missing export. `routes/dashboards.js`
  now requires `./store` for `ABPS_REPAIR_ACTIONS`; confirmed `store.js`
  does not require `dashboards.js`, so no cycle.
- **Zero duplicate route paths** across all `erp-backend/routes/*.js`
  (full-path comparison — a first-segment-only check produces two false
  positives, `gmailAuth` and `internal`, which are sub-path routers).
  24 + 14 routes registered.
- **All 23 distinct `apFetch` actions** used by the 5 new frontend files
  resolve to a real backend route — this sweep is what surfaced item 3.
- **Called-but-defined-nowhere sweep** across the 5 new files against
  every function/const/`window.x` defined anywhere in `erp-frontend` —
  surfaced items 13 and 14; now returns nothing real.
- **Static DOM id check**: every `getElementById("literal")` in the 5 new
  files resolves to an id present in `index.html` (or is created at
  runtime by that same file). All present.
- Zero duplicate top-level `let`/`const`, zero duplicate `function` names
  across the whole `erp-frontend` tree — the specific check that would
  have caught item 9.
- Every `<script src>` resolves; `<div>` balance 1480/1480; zero duplicate
  DOM ids (the single reported hit is the known HTML-comment false
  positive on `store-panel-center-title`, same as Batch 6).
- All 15 `pd2-*` toolbar control ids confirmed present exactly once.
- **Byte-identity claims verified with real `diff`s**, not asserted —
  `productionPlanning.js`, `serialTraceSnapshot.js`,
  `jobCardSheetTemplates.js`, `job-card-sheet.js`,
  `material-requirement-dates.js` and `production/job-cards.js` are all
  byte-identical to Portal; `production.js` is identical past its header;
  the only diffs in `finished-goods.js` / `production-planning.js` are the
  documented adaptations above and nothing else.
- **`syncLiveRow`/`removeLiveRow` inside a transaction — scanned, zero
  hits** in both production route files (brace-depth scan). Portal's
  current files are already clean of the 15 Sep 2026 landmine.
- Navigation sweeps confirmed: all six new canvases match
  `[id^="canvas-module-"]`, which `switchActiveDashboardModule`,
  `returnToDashboard`, `handleDepartmentTabClick` and `navigateToModule`
  all already sweep blanket-style. `'production'` was already in
  `DEPT_TAB_KEYS`.
- All 4 `production.*` tables confirmed to carry `trg_sheet_sync` in ERP's
  own migration files before being mapped in the poller.
- `PRODUCTION_DRIVE_FOLDER_ID` confirmed **set live** on `erp-backend`
  (`1SjVwKK3VVjSDIbxn2BL07OpUr-01pSIp`, matching this file's
  Prerequisites section) — queried, not assumed.
- **Google OAuth reconnection confirmed working**, queried live: the
  `/api/gmailAuth/callback` returned **200 at 07:05:38 on 16 Sep 2026**
  with `drive.file` + `spreadsheets` + `gmail.*` scopes, and there are
  **zero `invalid_grant` errors after that timestamp** (they were
  continuous before it). Production's Job Card image / FG document
  uploads are therefore building on a working dependency.

**NOT verified: anything requiring a running browser or a live database.**
No Production screen was opened, no requirement date was assigned or
revised, no production plan was submitted, no Job Card Sheet PDF was
generated, no FG entry was created or approved, and
`fetchProductionDashboardData` was never run against real data. No login
credentials were available in this session, so the live click-test the
brief asked for could not be done — see follow-ups.

### ★★★ Live click-test (16 Sep 2026, later the same day) — two real bugs found and fixed

Logged in as Ashwin Kumar (Admin, PIN 2310). Covered: Production
Dashboard, Assign Material Requirement Date, Revise Material Requirement
Date (both tabs), Production Planning (both tabs), Job Card Sheet, Add to
Finished Goods Store, Create Material Issue Ticket (the menu-card-only
entry point into Store's own screen). Both bugs below are the exact
failure shape this whole batch's own header comment warned about —
Portal's Aug 2026 automated file split scattering one screen's
functions/state across 2-3 unrelated files, so a "port this file" pass
correctly brings over the functions that visibly belong to a screen but
misses the ones a search of that screen's own file would never surface.

1. **`pd2ChartDept is not defined`** — Production Dashboard threw the
   instant any chart tried to render. Portal declares
   `let pd2ChartDept = null, pd2ChartTrend = null, pd2ChartCompletion =
   null;` in **`marketing/marketing-dashboard.js`**, not
   `store/store-dashboard.js` (the file this port's own header comment
   says it drew the pd2* globals from) — a third scattered location the
   port missed. Fixed by adding the declaration directly into ERP's
   `production/production-dashboard.js`, with a comment explaining why.
2. **`initializeJCSHWorkspace is not defined`** — Job Card Sheet threw on
   entry, every time, never rendering the panel-open project-typeahead
   priming. Portal splits this one screen's support code across THREE
   files: `resetJCSHWorkspace`/`handleJCSHProjectChange` correctly landed
   in `production/job-card-sheet.js` (the file that visibly "is" Job Card
   Sheet), but `initializeJCSHWorkspace` itself lives in
   `shared/typeahead.js` and its `jcshWorkspaceInitInProgress` guard
   variable lives in `design/update-boq.js` — neither an obvious home for
   Job Card Sheet code, so both were missed. Fixed by consolidating both
   into ERP's `production/job-card-sheet.js` instead of replicating
   Portal's own scatter.

Also investigated and confirmed **NOT a bug**: typing into "Project ID or
Customer Name" on Revise MRD's "Other Requirement Dates Revisions" tab
showed no typeahead matches. `pullLiveActiveProjectCodes` genuinely
returns zero rows — a live `SELECT * FROM project.projects` against the
`erp` database confirmed the table is completely empty. This is expected:
**Project department hasn't been ported to ERP yet** (a future batch,
separate from Production), so nothing has ever inserted a real row into
`project.projects` here — every BOQ/PRN/PO/PPS test project id used this
session so far was a bare string with no backing project row. Nothing to
fix; this closes once Project department is built.

Everything else rendered cleanly with no console errors: the Dashboard's
own stat tiles (all correctly `0` against empty test data), both MRD
screens' tab bars and locked-history blocks, Production Planning's two
tabs, Add to Finished Goods Store's full field set including the FG
Documents upload zones, and Create Material Issue Ticket's Outgoing
Use/BOQ/Job Card cascade.

**Still not exercised end to end** (no real data existed to drive it):
Production Planning's actual submit initial plan → revise target → mark
a Job Card done/undone flow, and the sub-department write-gate refusing
a wrong-department user — needs a real BOQ authorized into a Stage-4-
tracked flow first. Same gap Portal's own CLAUDE.md §43.9 documents for
Stage 4 there.
- **★★ The Sheets API is in a quota storm on `erp-backend` right now.**
  Immediately after the OAuth fix, `invalid_grant` was replaced by
  continuous `Quota exceeded for ... sheets.googleapis.com` on nearly every
  table — the backlog accumulated during the multi-day outage is draining
  all at once. This is **not caused by Batch 7**, but Batch 7 adds 4 more
  synced tables to that load. Portal hit the identical failure on 15 Sep
  2026 and the root cause there was **cron alignment**, not write pacing:
  three sheet-sync Scheduler jobs all firing on the same minute against
  one shared per-user quota. Worth checking whether ERP's Scheduler jobs
  are aligned the same way and staggering their start minutes
  (`*/5`, `3-59/10`, `7-59/15`) before adding more synced tables.
- **The 4 Production tables' PRODUCTION spreadsheet tabs will auto-create
  on first sync** (`ensureTabFormatted` / `getOrCreateSheetId`), same as
  every other department — no manual Sheets step expected, but nothing
  confirmed it here, and the quota storm above will delay it.
- **`department` / `productionSubDept` are login-time only.** They ride on
  `pinLogin`'s response because ERP has no `getSessionPermissions`
  equivalent. If someone's department or Production sub-department changes
  mid-session, Production Planning's *display* gate stays stale until
  their next login (the server gate is always correct). **When a
  `getSessionPermissions` route is eventually added to ERP, refresh these
  two alongside `erpIsUserAdminGlobal`** — that is exactly Portal's 4 Sep
  2026 `isUserAdminGlobal` staleness bug, pre-empted here rather than
  repeated. A comment at the write site says so.
- **QA's `perm_fg_approval` / `perm_in_process_sheet` are now fully wired
  in all 5 backend places and their ROUTES are live**, but their screens
  and menu cards are not built. Batch 8 must add
  `qa/fg-approval.js`, `qa/in-process-sheet.js`, the two canvases and the
  QA dept-block cards — and must **NOT** re-create the routes, which
  already exist inside `routes/production.js`. `QA_DRIVE_FOLDER_ID` is
  confirmed **NOT set** on `erp-backend` (queried live); Batch 8 needs it.
- **`lib/sheetChangePoller.js`'s map and `TABLE_REGISTRY` remain two
  independent lists with no cross-check.** This has now caused the same
  silent-discard bug in Batches 4, 5, 6 and 7 — four in a row. A startup
  assertion ("every registry entry whose real table has a `trg_sheet_sync`
  trigger must appear in the poller map") would end the class outright.
  Fourth batch flagging it; it is the single highest-value piece of
  cross-batch hygiene left.
- **`recordMaterialLineOutcome` is a no-op here**, so
  `analytics.material_line_outcome` stays empty in ERP even though the
  table exists. Consistent with the rest of `lib/analyticsLog.js`;
  flagged only so nobody later reads an empty table as a bug.
- **Batch 6's five Store Drive env vars are now set** (verified live:
  `INVOICE_FOLDER_ID`, `CHALLAN_FOLDER_ID`, `STORE_DRIVE_FOLDER_ID`,
  `MATERIAL_OUTWARD_DRIVE_FOLDER_ID`,
  `STORE_MATERIAL_ISSUE_TICKETS_DRIVE_FOLDER_ID`). That Batch 6 follow-up
  can be considered closed.

## Batch 8 — QA

**Status: ported, integrated, verified via static checks + a mocked-DOM
smoke test in a real browser — NOT click-tested against live data (no
login credentials in this session).**

Built with 4 parallel agents (each a genuinely new, disjoint file —
unlike Batches 4-7's "repair existing scaffolding" work, there was no
prior QA code in ERP to reconcile against), then one coordination pass to
integrate their output into the shared files they were deliberately kept
out of.

**Ported**: `routes/qaInspection.js` (7 routes — replaced a pre-existing
stub that only exported a no-op `computeQaInspectionQueueRows` for
`dailyTimeline.js`'s `require`), `routes/productSerialTracking.js` (4
routes, new), `routes/qaDashboard.js` (1 route, new — kept as its own
file rather than appended into `routes/dashboards.js`, matching
`adminDashboard.js`/`dailyTimeline.js`'s existing precedent; Batch 9 can
decide whether to fold it in later), `lib/serialTraceSnapshot.js`
(already existed from Batch 7, confirmed byte-identical to Portal — no
work needed), `qa/qa-inspection-timeline.js`, `qa/product-serial-tracking.js`,
`qa/qa-dashboard.js`, `qa/in-process-sheet.js`, `qa/fg-approval.js`
(ported from Portal's `production/fg-approval.js` — Portal keeps it
under `production/` despite being QA-owned, a known file-split artifact;
ERP places it correctly under `qa/`). `lib/jobCardSheetTemplates.js`'s
`IN_PROCESS_TABLES` (Thyristor Switches + Thyristor Switching Panel, 15
Sep 2026 formats) was already byte-identical to Portal from the
Production port — confirmed via diff, nothing to add.

**Schema**: none needed. The entire `qa` schema
(`inspection_calls`/`inspection_documents`/`product_serial_traceability`)
and all 6 QA permission columns were already live from Batch 0's
upfront schema-parity migration (signed off 15 Sep 2026) — this was the
first batch that got to skip a migration step entirely.

**Coordination pass** (done after the 4 agents finished, to avoid
parallel edits to shared files): mounted the 3 new routers in
`server.js`; replaced the empty Batch-1 QA dept-block scaffold in
`index.html` with the full section (Inward Quality/Finished Goods/
Inspection/Traceability + Dashboard pill, copied verbatim from Portal);
added the 5 new canvas panels (`qa-inspection-timeline`/
`product-serial-tracking` as standalone top-level panels, matching
Portal; `fg-approval`/`in-process-sheet` nested inside
`module-store-workspace-enclosure-panel` alongside `job-card-sheet`,
also matching Portal); added `qad-period-btns`/`qad-custom-zone` to the
shared dashboard toolbar (ERP's own generic `[id$="-period-btns"]`
convention, confirmed already correct — no per-dashboard hardcoded-list
bug to inherit from Portal here); added the `.psn-*` CSS block; added 5
`<script src="qa/*.js">` tags; wired `shared/navigation.js` (new
`canQaCheck`/`canFgApproval`/`canInProcessSheet`/
`canQaInspectionTimeline`/`canProductSerialTracking`/`canViewQaDashboard`
vars, 5 card-visibility toggles, the QA dept-block's own OR-condition,
the `mod-qa-dashboard-wrapper` dashMap entry, two new
`navigateToStoreWorkspacePanel` branches for `fg-approval`/
`in-process-sheet`, and two new init-on-open hooks in
`switchActiveDashboardModule` for the two standalone panels).

**★ Real permission-wiring gap found and fixed**: `perm_qa_inspection_timeline`
and `perm_product_serial_tracking` were confirmed by two separate
agents to be completely unwired in ERP — not in `auth.js`'s
`requireSession` SELECT, `lib/permMap.js`, `lib/permissionCatalog.js`,
`lib/sheetsRegistry.js`, or `lib/sheetsPull.js` — despite an earlier
Batch 7 note in this file claiming they were "already wired in all 5
backend places." That claim was wrong; both were fixed in all 5 places
during the coordination pass. Separately, `perm_qa_dashboard` (added by
the QA Dashboard agent) was missing only from `lib/sheetsRegistry.js` —
three of that agent's own edit attempts on that one file were blocked
by the auto-mode permission classifier ("Modify Shared Resources");
the coordination pass's edit to the same file went through without
issue. **If a future permission's wiring is ever reported as "already
done" by an earlier batch's notes, verify it live with grep before
trusting it** — this is the second time in this file a "confirmed
wired" claim turned out to be false (see the Batch 7 section's
`perm_fg_approval`/`perm_in_process_sheet` note for the first).

**Verified**: `node -c` on every touched/new file; a `require()` load
test on all 3 new route files plus every file that cross-references them
(`dailyTimeline.js`, `timeline.js`, `production.js`, `adminDashboard.js`)
— all clean; a repo-wide route-path collision sweep (zero duplicates);
a duplicate top-level `let`/`const`/`function` scan across all of
`erp-frontend` (zero duplicates); every `<script src>` in `index.html`
resolves to a real file; and a live browser smoke test (mocked
`userPermissions`, no real login) confirming all 5 QA menu-cards + the
dashboard pill render and gate correctly, the QA dept-tab appears, and
all 6 screens (`store-grn`, `fg-approval`, `in-process-sheet`,
`qa-inspection-timeline`, `product-serial-tracking`, `qa-dashboard`)
navigate cleanly with zero JS exceptions (only expected 401s from
data-fetch calls with no real session).

**Not done / flagged for later**:
- `QA_DRIVE_FOLDER_ID` env var is NOT set on `erp-backend` — confirmed
  in a prior session and unchanged. `uploadQaInspectionDocument` will
  return a clean "QA Drive root folder is not configured on the
  server." error until it's set (no gcloud credentials available in
  this session to set it).
- `SPREADSHEET_IDS.QA` — not confirmed either way this session; check
  before assuming QA's Sheet mirror works end to end.
- `admin_db.document_registry` (Portal's 4 Sep 2026 Drive-ACL security
  feature) was never ported to ERP at all — `lib/drive.js`'s
  `uploadFile()` here only takes 4 params (no `registry` arg), confirmed
  by the QA Inspection Timeline agent. Pre-existing gap, not introduced
  by this batch, not fixed here.
- No real click-through against live data — every verification above is
  static/mocked. Submit a real Raw Materials Q/A Check, FG Approval
  decision, In Process Sheet download, QA Inspection Timeline milestone
  date, and a Product Serial Number Tracking search/record against real
  data before fully trusting this batch, the same caveat every prior
  batch in this file carries.
- Not pushed or deployed — per the standing rule, ERP changes need the
  user's explicit go-ahead each time.

## Batch 9 — Cross-cutting

**Status: Part B (Documentation) ported, committed locally, NOT
pushed/deployed. Part A (dashboard data routes) audited and found
ALREADY COMPLETE — one real bug fixed. Neither part click-tested against
a real login** (no credentials this session); Documentation WAS render-
tested in a real browser against a local stub of its own new route.

`routes/documentation.js`, `shared/documentation.js`, `docs/content/**`
(76 files), `scripts/checkDocsCoverage.js`. Plus a full drift audit of
all 8 dashboards' data routes and the 4 recurring dashboard bug classes.

### Part A — dashboard data-fetch routes: already done, not missing

The brief expected several dashboards to still be 404ing on a route that
was never ported. **That is stale.** Every batch from 4 onward ported its
own department's dashboard route as it went, and Batch 2's explicitly-
flagged Marketing gap was closed somewhere along the way too. Verified
mechanically, not by reading notes: Portal's `routes/dashboards.js` and
ERP's were split function-by-function and diffed **comment-stripped**.

| Dashboard | ERP location | Result |
|---|---|---|
| Marketing | `routes/dashboards.js` | code-identical (comments only) |
| Design | `routes/dashboards.js` | byte-identical |
| Purchase | `routes/dashboards.js` | code-identical |
| Store | `routes/dashboards.js` | code-identical |
| Production | `routes/dashboards.js` | code-identical |
| Accounts | `routes/dashboards.js` | code-identical bar the bug below |
| QA | `routes/qaDashboard.js` | code-identical |
| Admin | `routes/adminDashboard.js` | byte-identical |

Shared helpers were diffed the same way and are all code-identical:
`getPeriodBounds`, `buildPeriodBuckets`, `resolveDashboardToday`,
`istParts`/`istDayKey`/`istMidnight`/`istWeekMonday`/`istWeekKey`/
`istMonthKey`, `computeExpectedDeliveryTimeline`, and all three
`fetch*TimelineDueOverdue` helpers. The only non-comment differences
anywhere were **declaration ORDER** of four module-level constants
(`DESIGN_/PURCHASE_TIMELINE_ITEM_PRIORITY`/`_LABELS`, `MONTH_NAMES`) —
hoisting-irrelevant, left alone rather than churned.

**1 real bug found and fixed.** `fetchAccountsDashboardData` returned a
raw `err.message` to the client — the only one of the 8 dashboard routes
still doing so. It predates Portal's 7 Sep 2026 `safeErrorMessage` sweep
and was never touched by a port, so it leaked Postgres SQLSTATE detail on
any failure. `safeErrorMessage` was already imported at the top of the
file (the ported routes use it); only this one call site was stale.
Deliberate business-error messages still pass through unchanged.

**The four recurring dashboard bug classes were re-swept and all 8 are
clean** — this is the audit the brief asked for, done against the code,
not assumed from earlier batches' claims:
- `showDashboardGlobalToolbar` — all 8 call sites use the 3-arg ERP
  signature `(title, periodBtnsId, returnFn)`. No 2-arg holdout survives
  (Batch 4 fixed Design, Batch 5 fixed Purchase).
- Runtime `<input>.type` mutation — **zero hits anywhere in
  `erp-frontend`**. All 8 dashboards carry the 5-dedicated-inputs-toggled-
  with-`hidden` pattern (`ad`/`md`/`dd`/`pd`/`sd`/`pd2`/`qad`/`adm`), and
  all 8 `*-period-btns` + `*-custom-zone` blocks exist exactly once in
  `index.html`. (The two `.type =` hits in `marketing/leads.js` are
  `createElement` on a brand-new element, not a mutation of a rendered
  input — not this bug class.)
- Chart.js `maintainAspectRatio:false` — **every** chart config on every
  dashboard has it: the per-file count of `maintainAspectRatio` equals the
  count of `new Chart(` in all 8 files (7/7, 3/3, 2/2, 6/6, 3/3, 3/3, 2/2,
  3/3 = 29 charts).
- `syncLiveRow` inside `withTransaction` — not applicable: every dashboard
  route is read-only and contains no sync call at all (checked).

**Permission wiring re-verified live with grep for all 8 dashboard
columns** (per this file's own twice-burned rule about trusting a prior
"confirmed wired" note): all 8 present in all 5 backend places
(`auth.js`'s `requireSession` SELECT, `permMap.js`, `permissionCatalog.js`,
`sheetsRegistry.js`, `sheetsPull.js`). Separately, **all 67
`PERMISSION_CATALOG` columns** were confirmed present in the
`requireSession` SELECT — this matters for Part B, which reads
`req.user[dbColumn]` for every one of them and would silently hide a
section whose column wasn't selected.

**No new backend code was written for Part A** beyond the one-line
`safeErrorMessage` fix.

### Part B — in-app Documentation, ported

- **`erp-backend/routes/documentation.js`** — Portal's file verbatim plus
  an ERP port-note header. Two routes (`fetchDocumentationNav`,
  `fetchDocumentationArticle`), mounted in `server.js` behind
  `requireSession` with **no permission column of its own** (deliberate,
  avoids the 7-place rule — same reasoning as Portal). Visibility is a
  read of the permissions the requester already holds, narrowed further by
  `req.deviceRestrictedPermissions` for a restricted PIN-login device.
  No logic change was needed; two ERP facts are recorded in its header:
  ERP's catalog gives `perm_accounts_dashboard` the REAL `accounts`
  department (Portal uses synthetic `dashboard-accounts`) — harmless,
  `DASHBOARD_REAL_DEPT` falls through to the entry's own department, so
  the `dashboard-accounts` row is simply unused here; and
  `perm_customer_query_management` doesn't exist in ERP's catalog.
- **`erp-backend/docs/content/**`** — all 76 article files copied, NOT
  regenerated. Four ERP-specific content edits, all made because the
  Portal text described something that genuinely does not exist here:
  `project/perm_customer_query_management.html` deleted outright;
  the Customer Queries row removed from `project/_overview.html`'s section
  table; the "a Customer Query opens directly on Current Pending Queries"
  clause removed from `project/perm_daily_timeline.html`'s click-through
  list; `getting-started.html`'s "Welcome to the ABPS Portal" →
  "ABPS ERP"; and `accounts/_overview.html`'s "not inside the Portal" →
  "not inside this system".
  Content depth is inherited from Portal as-is: **Marketing/Project/
  Design/Purchase/Store carry the deep second-pass rewrite; Production/
  QA/Accounts still carry the shallower first-pass content** (Portal's
  own standing next task, see its CLAUDE.md).
- **`erp-backend/scripts/checkDocsCoverage.js`** — ported with one
  deliberate fix (see the real-bug note below). Reports **67/67 sections
  written, 0 orphaned**.
- **`erp-frontend/shared/documentation.js`** — byte-for-byte from Portal
  apart from a port-note header.
- **`erp-frontend/index.html`** — "Docs" header button (Portal's own
  entry point: `switchActiveDashboardModule('documentation')`),
  `canvas-module-documentation` panel, the `.doc-*` CSS block verbatim
  from Portal (so an article file stays portable between the two
  systems), and the script tag.
- **`erp-frontend/shared/navigation.js`** — one init-on-open line. **No
  sweep-list change was needed**, unlike Portal: ERP's
  `switchActiveDashboardModule` / `returnToDashboard` /
  `handleDepartmentTabClick` use blanket `[id^="canvas-module-"]` and
  `[id$="-workspace-enclosure-panel"]` selectors, where Portal maintains
  hardcoded id lists (the exact shape that produced Portal's own 5 Sep
  2026 missing-id landmine).

### Real bug found and fixed in the ported tooling

**Portal's `scripts/checkDocsCoverage.js` cannot pass on its own
content.** It groups and orphan-checks on the raw `p.department`, but a
dashboard permission's department is the synthetic `dashboard-xxx` key
while `routes/documentation.js` files its article under the REAL
department (`realDeptForCatalogEntry`). So every written `*_dashboard.html`
article — 8 of them, all present in Portal — reports as `ORPHANED` and
the script exits 1. ERP's copy applies the same mapping the route uses,
so the two agree and it exits 0. **Portal was not touched** (this session
is read-only against that repo); flagged below for whoever owns it.

### Verification actually performed

- Comment-stripped, function-by-function diff of all 8 dashboard routes
  and all 12 shared dashboard helpers vs Portal (the sweep that found the
  `err.message` bug).
- `node --check` on every touched backend file and **every** `.js` under
  `erp-frontend` — clean.
- Runtime `require()` of `routes/documentation.js` (both route paths
  registered) and a **full `server.js` boot** — loaded, GeoIP warmed,
  listening.
- Zero duplicate route paths across all `erp-backend/routes/*.js`.
- Zero duplicate top-level `let`/`const`, zero duplicate `function` names
  across the whole `erp-frontend` tree; every `<script src>` resolves;
  zero duplicate DOM ids (the single hit is the known
  `store-panel-center-title` HTML-comment false positive, same as Batches
  6/7).
- **CSS parity audit**: every `class="..."` value used across all 76
  article files was checked against ERP's `<style>` block —
  **zero unstyled classes**.
- **Functional route test** (an express harness mounting the real router
  with a stubbed session, exercising the real files on disk):
  - admin nav returns all 8 departments with 11/5/7/10/17/6/7/4 sections
    plus Getting Started;
  - a `perm_tour_expense`-only user sees exactly one department with
    exactly one section;
  - that same user on a device restricted to `perm_cash_expenses` sees
    the Accounts card with **zero** sections (device narrowing works);
  - requesting `perm_gate_entry` as that user is refused with Access
    Denied;
  - a dashboard article (`perm_marketing_dashboard`) resolves under its
    REAL department, and a `dept:qa` overview resolves;
  - a path-traversal key (`../../../auth`) is refused as "Unknown
    article" — the catalog whitelist holds;
  - **all 67 catalog articles load successfully** for an admin, none
    falling through to the "hasn't been written yet" placeholder.
- **Real browser render** (`erp-frontend` served locally, the new route
  behind a local stub): the Docs button opens the panel, the nav tree
  renders 27 clickable items with department colours, a department
  expands, and Gate Entry's article loads with its `doc-steps` numbering
  intact — **zero JS exceptions**.

**NOT verified: anything requiring a real login or the live database.**
No Documentation screen was opened as a real user against `erp-backend`,
and no dashboard route was run against real data this session.

### Flagged for human follow-up (deliberately NOT touched)

- **Portal's own `scripts/checkDocsCoverage.js` is broken** (the orphan
  false-positive above). One-line fix there; not applied, since this
  session treats Portal as read-only.
- **Production / QA / Accounts documentation is still first-pass depth**
  in both systems. Portal's own CLAUDE.md lists the deep rewrite of those
  three as its standing next task; when Portal does it, re-copy those
  three directories here rather than writing ERP-specific content.
- **Article content was copied, not re-verified against ERP's screens.**
  Every article describes Portal's version of a screen. The ports are
  faithful, so this should read correctly — but wherever a batch kept a
  documented ERP adaptation (Project Invoice Generation being a plain
  top-level panel rather than nested under Store, `pplanCanWriteLane`
  failing open, the per-dashboard custom-period convention), the article
  still describes Portal's behaviour. Worth a pass once ERP's screens are
  actually click-tested.
- **`erp-backend/` is gitignored**, so `routes/documentation.js`,
  `docs/content/**` and `scripts/checkDocsCoverage.js` are **not in any
  commit** — they exist on local disk only and reach production only via
  `gcloud run deploy erp-backend --source ./erp-backend`. The frontend
  half IS committed. Deploying one half without the other leaves the Docs
  button opening a screen whose two routes 404.
- **No Documentation-specific env var, Drive folder, spreadsheet or
  migration is needed** — the feature is filesystem + catalog only.
  Nothing new to set before deploying.

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
