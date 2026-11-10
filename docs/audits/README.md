# Audits

Checklists written by `/audit` and worked through by `/audit-fix`.

- One file per audit: `audit-YYYY-MM-DD-NNN.md`, items `A-001`, `A-002`, … grouped Critical, High, Medium, Low.
- `/audit` only reports; it changes no application code. Commit the file after it is written, so history keeps it.
- `/audit-fix A-001 A-003` (or `critical`, `all`) fixes items. An item is ticked `[x]` only after its Verify step passes; anything unverified stays `[ ]` with a note.
- When every item is ticked, `/audit-fix` deletes the file. `/audit-fix close` deletes it early, after showing the open items and asking once.
- Scope is static (code, build, lint, tests, sloplint/kitlint). Runtime behaviour in a running app is not checked.
