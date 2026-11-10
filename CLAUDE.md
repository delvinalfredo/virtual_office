# Project Agent Instructions

This repository uses Claude Code with project-local subagents, rules, commands, and skills under `.claude/`:

- `.claude/agents/` — subagents (delegate with the Agent tool)
- `.claude/commands/` — slash commands (`/project-init`, `/plan-feature`, `/tdd`, `/code-review`, `/build-fix`, `/e2e`, `/git`, `/refactor-clean`, `/orchestrate`, `/audit`, `/audit-fix`)
- `.claude/rules/` — rules; files without `paths` load every session, path-scoped ones load when a matching file is opened
- `.claude/skills/` — skills, invoked by description match or by name
- `docs/PROJECT.md` — verified project facts

## Core behavior

- Inspect the repository before making framework-specific assumptions.
- Prefer existing project conventions over generic patterns.
- Make the smallest safe change that solves the requested problem.
- Use Claude Code's native tools (Read, Grep, Glob, Edit, LSP when a language server is configured, Bash for tests and git, the Agent tool for subagents) instead of recreating them with shell commands — e.g. Grep instead of `grep`, Read instead of `cat`.
- Do not run heavyweight workflows for trivial changes.
- Never invent test results or claim a subagent ran if it did not.
- Ask before destructive operations when the repository or task makes the consequence unclear.

## Workflow

When using slash commands: `/plan-feature` for planning, `/code-review` for review, `/tdd` for tests, `/e2e` for browser journeys, `/build-fix` for build failures, `/audit` for a full static audit written to `docs/audits/` and `/audit-fix` to work through it.
- The same without slash commands: a request to audit, review the whole app, find bugs or check for problems across the application runs `.claude/commands/audit.md` as written (report only, file in `docs/audits/`); a request to fix, work through, tick or close an audit file runs `.claude/commands/audit-fix.md`. Say which command you are running.
When chatting naturally without slash commands: agent automatically triggers appropriate workflows, runs tests before completing, and auto-syncs `docs/PROJECT.md`.

- Before implementing a feature, read the project's specs **if any exist** — wherever they live (`docs/specs/`, `specs/`, `docs/`, `PRD.md`, an API schema). Having none is normal for a new project; proceed without one.

- Any UI task — a new page, screen or component, an edit to markup or styling, a UI review — starts by invoking the `ui-ux-pro-max` skill, before any other UI skill and before asking anything. It loads `antislop` + `antislop-ui` (and the other antislop skills the task needs), routes new UI to the `hallmark` skill (theme deal, Floor, sloplint/kitlint), and asks antislop's during/after question inside its one opening message, so do not ask that question on its own first. Also read `.claude/rules/ui-ux-design.md`. These are not always-on; the path-scoped `ui-ux-design` and `ui-edit-guard` rules also load when a UI file is opened, but reading first is cheaper than rewriting.

## Project context

Keep verified project facts in `docs/PROJECT.md` as the living project context.

### Context maintenance
- Read `docs/PROJECT.md` before significant changes when it exists.
- After completing work, determine whether durable project knowledge changed.
- If durable knowledge changed, update `docs/PROJECT.md` before finishing. Prefer the `context-sync` agent for this.
- Durable knowledge includes stack/dependencies, architecture, application flow (entry points, cross-module paths), database design, integrations, auth/security boundaries, queues, testing/build/deployment, and important operational decisions.
- Do not update PROJECT.md for trivial implementation details or temporary debugging state.
- Replace stale facts rather than accumulating contradictory history.
- Never put secrets, tokens, credentials, API keys, or personal data in PROJECT.md.
- If uncertain whether a fact is current, verify it against the repository before recording it.

## Security

Treat authentication, authorization, payment/financial flows, secrets, personal data, file uploads, and external API credentials as high-risk. Apply the `security-review` skill and delegate to the `security-reviewer` subagent when appropriate.
<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read `.claude/skills/antislop/SKILL.md` (core) and then the skill for the task:
- UI / visual: `.claude/skills/antislop-ui/SKILL.md`
- Copy & text: `.claude/skills/antislop-copywriting/SKILL.md`
- People: `.claude/skills/antislop-human/SKILL.md`
- Mobile / responsive: `.claude/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `.claude/skills/antislop-code/SKILL.md`
Before starting, ask the user when antislop applies: during the work, or after it is done.
<!-- antislop:end -->
