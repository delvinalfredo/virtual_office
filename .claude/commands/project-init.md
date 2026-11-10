---
description: Inspect the repository and create or refresh docs/PROJECT.md (verified facts only) without touching application code.
---

# Project Context

Use this command at the beginning of work on an unfamiliar repository.

It is named `project-init` on purpose: Claude Code's built-in `/init` generates `CLAUDE.md`, and a project command named `init` would shadow it. This command never rewrites `CLAUDE.md`; it maintains `docs/PROJECT.md`.

1. Inspect the repository and identify the actual language/runtime, framework, database, package manager, test/build commands, external integrations, and deployment/container setup.
   - Also trace the application flow in both views the template has. **User Flow**: the main journeys a person takes through the implemented screens or endpoints, one line each with the role (`[checker] Inbox → Loan detail → Approve → Notification`). **System Flow**: entry points, what handles a request or event, where state lands; only paths that cross module boundaries, mirrored by the mermaid flowchart under `### Flow Diagram`.
   - If the repository has no user-facing flow, or no path crosses a module boundary — docs-only, library, tooling repo, or a project with nothing built yet — write `none` in that place. The template's example bullets and example diagram are shape, not content: never leave them standing, never invent a flow to fill them.
   - `## Modules & Access` and `## Environments & Jobs` are filled **only from what the repository shows** (routes and middleware, guards and policies, role enums or tables, `.env.example`, config files, schedulers, queue workers). A row the project does not have reads `none`. An existing application is described as it is, never as it should be.
2. Read `CLAUDE.md` and `docs/PROJECT.md` if present.
3. If `docs/PROJECT.md` is missing, create it from `.claude/PROJECT.template.md` using only verified facts, in exactly the template's shape: same headings in the same order, the `Verified Stack` table with all eight rows filled (`none` where the project has none), one blank line after every heading, one fact per line, no hard wrapping, no example value or example flow left standing.
4. Do not invent versions, architecture, or infrastructure.
   - **Brand-new project** (no application code yet, or only a framework skeleton): after recording what exists (usually `none` in most rows), ask the user once, in one message, what the application will need — main user journeys and roles, whether there is an approval chain, how users will sign in, which environments will exist, any scheduled jobs. Record the answers under the matching headings prefixed with `planned:` (e.g. `- Roles: planned: maker, checker, admin`), so a later agent can tell a decision from a verified fact. Replace `planned:` with the fact once the code exists. Skip the question when the user already gave this in the prompt or in `docs/specs/`.
   - The one fact that is a decision, not an inspection: `Data classification` under `## Conventions`. If the repository shows customer, account, identity, transaction, approval or payroll data (models, tables, specs in `docs/specs/`), ask the user once whether to apply the regulated-data controls of `rules/security.md` and record `regulated` or `standard`. If nothing in the repository suggests such data, record `standard` and say so in one line; the user can change it later.
5. If `docs/PROJECT.md` exists, treat it as a snapshot to verify and refresh rather than as unquestioned truth.
6. Update `docs/PROJECT.md` only with facts verified from the repository; preserve accurate existing information and remove stale facts.
7. Do not modify application code.

The goal is orientation, not a mandatory initialization ceremony.
