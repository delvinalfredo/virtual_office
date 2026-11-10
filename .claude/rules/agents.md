---
description: Agent-selection rules (always loaded — no `paths`). Choose the lightest workflow that is sufficient for the task; do not run every agent for every change.
---

# Agent Workflow

Claude Code already provides subagent orchestration (the Agent tool), plan mode, and task tracking. The custom subagents in `.claude/agents/` add specialization; they are not mandatory for every turn. Delegate to one with the Agent tool using its `name` as the subagent type, and pass it the context it needs — a subagent does not see this conversation.

## Task sizing

- Trivial: typo, formatting, obvious one-line fix → work directly.
- Small: localized bug or small feature → implement + targeted test.
- Medium: multi-file feature/refactor → planner → implement → test → review.
- Large: architecture/database/API/security-sensitive change → architect → planner → implement → tests → review; add security/e2e when relevant.

## Agent selection

- `architect`: architecture, cross-module design, scalability, significant refactor.
- `planner`: implementation plan for medium/large work.
- `tdd-guide`: test-first workflow when business logic or regression coverage warrants it.
- `build-error-resolver`: compiler/build/test failures that need iterative diagnosis.
- `e2e-runner`: critical browser/user journeys; do not run for backend-only changes.
- `code-reviewer`: review before merge/release or when risk is meaningful.
- `security-reviewer`: authentication, authorization, secrets, payments, user input, file uploads, external integrations, or other sensitive paths.
- `refactor-cleaner`: deliberate cleanup after behavior is protected by tests.

## Autonomy

Do not claim a workflow step happened unless it actually ran. Do not fabricate test results, review findings, or architecture updates.

## Persistent Project Context

`docs/PROJECT.md` is a living snapshot of the repository's current verified state, not a changelog.

After implementation/testing, check whether durable project knowledge changed. If it did, invoke the `context-sync` agent or perform the equivalent verification/update before finishing. This applies to normal direct tasks too, not only `/orchestrate` workflows.

Update it for meaningful changes to stack/dependencies, architecture, application flow (entry points, cross-module paths), database/schema, integrations, auth/security boundaries, queues/workers, build/test/deployment, or important operational decisions. Do not update it for trivial edits or temporary debugging notes. Never record secrets. Replace stale facts instead of appending history.

## Pure Conversational Automation (No Slash Commands Needed)
User interacts via natural chat without slash commands (`/orchestrate`, `/project-init`, etc.). `context-sync` and the other agents are spawned as agents, not typed as commands.
1. **Automatic Project Orientation:** If `docs/PROJECT.md` is missing, or is still the unfilled template (no verified facts for this repository), create it before your first edit here by inspecting verified repository facts, using `.claude/PROJECT.template.md` as reference. If it already holds verified facts, use it as-is — never recreate or overwrite it. `.claude/rules/hard-requirements.md` carries this as a hard requirement.
2. **Implicit Workflow Orchestration:** Automatically apply appropriate agent sequences based on task size without requiring manual `/orchestrate` commands:
   - Small: Implement -> targeted test/check -> code review.
   - Medium/Large: Automatically orchestrate (`architect`/`planner` -> implementation -> tests -> `code-reviewer` / `security-reviewer` -> `context-sync`).
3. **Audit requests:** "audit the app", "cek menyeluruh", "cari bug di aplikasi", "review seluruh aplikasi" → run `.claude/commands/audit.md` exactly as the slash command would (report only, one file in `docs/audits/`). "perbaiki hasil audit", "fix A-003", "tutup auditnya" → run `.claude/commands/audit-fix.md`. Name the command you are running so the user knows the rules in it apply.
4. **Automated Verification & Sync:** Always run local tests/checks before completing work, and update `docs/PROJECT.md` automatically whenever durable knowledge changes.

Update project documentation only when public behavior, architecture, APIs, deployment, or important operational knowledge changed. Do not rewrite documentation for every tiny edit.
