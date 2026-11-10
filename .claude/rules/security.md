---
description: (always loaded — no `paths`) Security guidelines — mandatory pre-commit checks, secret management, and the response protocol when a vulnerability is found. Read before touching auth, user input, secrets, or API endpoints.
---

# Security Guidelines

> The principles below are universal. Code examples use JavaScript/TypeScript — adapt syntax to your project's technology stack (Laravel: `env()` + `.env`, Python: `os.environ`, Java: `System.getenv()`, etc.) recorded in `docs/PROJECT.md`.

## Recommended Security Checks

Before ANY commit:
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs validated
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized HTML)
- [ ] CSRF protection enabled
- [ ] Authentication/authorization verified
- [ ] Rate limiting on all endpoints
- [ ] Error messages don't leak sensitive data

## Secret Management

```typescript
// NEVER: Hardcoded secrets
const apiKey = "sk-proj-xxxxx"

// ALWAYS: Environment variables
const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  throw new Error('OPENAI_API_KEY not configured')
}
```

## Sensitive Data in Regulated Applications (banking, finance, personal data)

Whether these controls apply is a **project decision recorded once** in `docs/PROJECT.md` under `## Conventions`, as `Data classification: regulated` or `Data classification: standard`.

- **Recorded `regulated`** → every item below applies; nothing has to be said in the prompt.
- **Recorded `standard`** → the list below is off. The generic checks above, masking of passwords and tokens, and authorization on mutating endpoints still apply to every project.
- **Not recorded yet** → the first time a task touches data that looks like customer, account, card, identity, transaction, approval or payroll data, ask once: *"This project handles data that looks regulated (accounts, identity numbers, approvals). Apply the regulated-data controls (masking, maker–checker, audit trail, idempotency)? yes / no"*. Write the answer to `docs/PROJECT.md` Conventions and do not ask again. If no one can answer (an unattended run), apply the controls and say so.
- `/project-init` asks the same question when it creates `docs/PROJECT.md` and the stack or domain suggests such data.

- **Masking.** Account numbers, card numbers, NIK/KTP, NPWP, phone numbers and e-mail are masked in logs, error messages, screenshots, exports and the UI by default (`****1234`, `08xx-xxxx-1234`). The full value shows only on the screen that needs it, behind the role that owns it.
- **Authorization on every mutating endpoint.** Create, update, approve, reject, reverse, release and export each check the caller's role *and* ownership of the record (no IDOR: `/loan/{id}/approve` verifies the caller may approve *this* loan). A missing check is Critical.
- **Maker–checker.** An approval is never performed by the same user who submitted the item; enforce it in code, not only in the UI.
- **Audit trail.** Every approval, rejection, reversal, limit change and role change records who, when, from which value to which value, and from where (IP or channel), in an append-only store. Deleting or editing audit rows is never a feature.
- **Idempotency.** Approvals, transfers and postings are idempotent (an idempotency key or a state check) so a double-click or a retried request cannot run twice. Money and limit arithmetic uses decimal types, never binary floats.
- **Sessions.** Server-side timeout for internal applications, re-authentication for high-risk actions, no credentials or tokens in URLs.
- **Nothing real leaves the code.** Customer or employee data never goes into `docs/PROJECT.md`, `docs/plans/`, `docs/audits/`, test fixtures, seeders, commit messages or chat; use synthetic values. Secrets stay in the environment (`.env`, vault), never in the repository.
- **UI side.** Destructive or financial actions get an explicit confirmation naming the amount or the record; the primary action is never pre-focused on a confirm dialog.

The `security-reviewer` agent reports against this list when the project is `regulated`; `/audit` grades a missing control here as Critical in a `regulated` project and does not raise it in a `standard` one.

## Security Response Protocol

If security issue found:
1. STOP immediately
2. Use security-reviewer agent
3. Fix CRITICAL issues before continuing
4. Rotate any exposed secrets
5. Review entire codebase for similar issues

## Related

- coding-style — coding standards
- agent-workflow — agent orchestration
- security-reviewer — security agent
- security-review — security patterns
