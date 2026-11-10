---
description: Full static audit of the application (build, tests, logic bugs, security, UI). Report only, changes no code; writes a numbered checklist to docs/audits/.
argument-hint: "[optional scope: path, module or focus]"
---

# Audit

**Scope:** $ARGUMENTS (empty = the whole application)

A **static** audit: read the code and run the project's own checks. It **changes no application code**. Its only output is one checklist file in `docs/audits/`, which `/audit-fix` works through later.

## 0. Orient

1. Read `docs/PROJECT.md` (stack, build/test commands) and the specs in `docs/specs/` if any exist.
2. Decide the scope: `$ARGUMENTS` if given, otherwise the whole repository except `node_modules/`, `vendor/`, build output and generated files.
3. The next file name is `docs/audits/audit-YYYY-MM-DD-NNN.md`, where today's date and `NNN` = the highest existing number for any date + 1, three digits (`001` when the folder is empty). Create `docs/audits/` if it is missing.

## 1. Collect findings (run in parallel where possible)

Each layer reports findings; **none of them edits a file**. Tell every subagent explicitly: *"Audit only. Do not edit, create or delete any file. Return findings as: severity, category, file:line, problem, evidence, how to verify a fix."*

| Layer | Who | What |
|---|---|---|
| Build & checks | you, with Bash | Run the project's build, typecheck, lint and test commands from `docs/PROJECT.md` (or detected from `package.json`, `composer.json`, `pom.xml`, `Makefile`). Each failure is a finding with the command and the first relevant error lines as evidence. A command that does not exist is not a finding. |
| Logic & code | `code-reviewer` agent | Logic errors, wrong conditions, unhandled errors and promise rejections, null/undefined paths, race conditions, state bugs, broken data flow between modules, dead code that hides a bug, behaviour that contradicts `docs/specs/` |
| Security | `security-reviewer` agent | Authn/authz gaps (missing role checks, IDOR), injection, XSS, CSRF, secrets in code, unsafe file upload, sensitive data in logs or responses, missing rate limits |
| UI (static) | invoke `ui-ux-pro-max` (audit route), which loads `antislop` (Mode 2) and `antislop-human` | Visual and UX bugs readable from code: missing loading/empty/error states, dead buttons and links, broken responsive rules, overflow, missing `:focus-visible`, keyboard traps, contrast (`antislop-human/contrast-check.py`), the Hallmark Floor and kit hard bans. **Write antislop's findings into this audit file, not into `anti-slop/audit-*.md`.** |
| UI lint | you, with Bash | `node .claude/skills/hallmark/scripts/sloplint.mjs <UI files>` (static tier, no `--render`) and `node .claude/skills/hallmark/scripts/kitlint.mjs <UI files>`. Every FAIL is a finding. Skip when the project has no UI files. |

Runtime checks (opening the running app, console errors, network failures) are **out of scope** for this command; say so in the report header.

## 2. Verify before writing

- Read the cited code yourself for every Critical and High finding; drop any you cannot confirm.
- Merge duplicates (the same root cause reported by two layers is one finding listing both files).
- Never invent a finding to fill a category. An empty category is not shown.

## 3. Write the file

Severity: **Critical** (data loss, security hole, money/approval logic wrong, app does not build) · **High** (a user-facing feature broken or wrong) · **Medium** (degraded behaviour, a11y failure, UI bug) · **Low** (code quality, minor visual).

IDs are `A-001`, `A-002`, … in order of severity, and never change after the file is written.

```md
# Audit YYYY-MM-DD-NNN

- Scope: <scope>
- Mode: static (code + build/lint/test); runtime not checked
- Checks run: <each command and its result, e.g. `npm run build` ok, `npm test` 2 failed>
- Open: 20 / 20 · Critical 3 · High 5 · Medium 8 · Low 4

## Critical

- [ ] **A-001** · Security · `app/Http/Controllers/LoanController.php:88`
  - Problem: approval endpoint has no role check; any signed-in user can approve
  - Evidence: `Route::post('/loan/{id}/approve')` has no `can:approve-loan` middleware
  - Verify: `php artisan test --filter=LoanApprovalTest`; as role `staff` the request returns 403

## High
...
```

Every item has exactly these four parts (location in the title line, then Problem, Evidence, Verify). **Verify** must be something `/audit-fix` can actually run or check; "test it" is not a verification.

## 4. Report

In chat: the file path, the counts per severity, the three most serious items in one line each, and which checks could not run. Then remind the user once: *commit this file now (say "commit the audit") so the history keeps it after `/audit-fix` deletes it.* Do not commit on your own.
