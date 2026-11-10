---
description: Fix items from a /audit checklist in docs/audits/. Ticks an item only after its fix is verified; deletes the audit file when every item is ticked.
argument-hint: "[audit file] [A-001 A-004 | critical | high | all | close]"
---

# Audit Fix

**Arguments:** $ARGUMENTS

Works through a checklist written by `/audit`. An item is ticked `[x]` **only when its fix is verified**; everything else stays `[ ]`.

## 0. Pick the file and the items

- **File:** the path in `$ARGUMENTS`, else the only file in `docs/audits/audit-*.md`. With several files and none named, list them (name, open count) and ask which one.
- **Items:**
  - IDs (`A-001 A-004`, or a range `A-001..A-005`): those IDs.
  - `critical` / `high` / `medium` / `low`: every open item of that severity and above.
  - `all`: every open item.
  - Nothing given: list the open items grouped by severity and ask which to fix. Do not start fixing a whole audit unasked.
  - `close`: go to step 4.
- Read `docs/PROJECT.md` and the specs the item touches before changing code.

## 1. Fix, one item at a time, Critical first

For each selected open item:

1. Re-read the cited code. If it already behaves correctly (fixed elsewhere, or the finding was wrong), do not change code: confirm with the item's **Verify** step, then tick it with `Fixed: no change needed, <why>`.
2. Make the smallest change that fixes the root cause. Follow the kit rules: UI work goes through `ui-ux-pro-max` (antislop + the Hallmark Floor), security fixes get the `security-review` skill, never weaken a test to make it pass.
3. Run the item's **Verify** step, plus the project's related tests, lint and build.
   - UI files changed: also `node .claude/skills/hallmark/scripts/sloplint.mjs <files>` and `kitlint.mjs <files>`.

## 2. Update the item

**Verified** (every check passed):

```md
- [x] **A-001** · Security · `app/Http/Controllers/LoanController.php:88`
  - Problem: ...
  - Evidence: ...
  - Verify: ...
  - Fixed: added `can:approve-loan` middleware and a policy · Verified: `php artisan test --filter=LoanApprovalTest` 6 passed, staff → 403
```

**Not verified** (the fix failed, a check failed, the Verify step cannot run here, or you are unsure): leave it `[ ]`, revert a fix that broke something else, and add one line:

```md
  - Attempt YYYY-MM-DD: <what was tried> · Not ticked: <the failing check or why it could not be verified>
```

Never tick an item on the strength of the edit alone. A partial fix stays `[ ]`.

After each item, rewrite the header's `Open:` line with the new counts. Edit the file in place (Edit tool); never regenerate the whole file.

## 3. All ticked → delete

When every item in the file is `[x]`, delete the audit file and say so: *"All N items verified; deleted `docs/audits/audit-….md`."* If it was committed, git history keeps it; the deletion shows in `git status` for the user to commit. Keep `docs/audits/README.md`.

## 4. Close early (`close`, or the user asks to delete the audit)

When open items remain:

1. Show what would be lost: every open ID with severity and one-line problem, Critical and High first.
2. Ask once for confirmation. Then delete the file, or keep it if the user declines.

Never delete an audit with open Critical or High items without that confirmation, and never delete one silently.

## 5. Report

In chat: ticked this run (IDs), still open (IDs with the reason each is not ticked), whether the file was deleted, then the kit's **Changes** block listing the code files changed and the audit file (updated or deleted), with the checks actually run.
