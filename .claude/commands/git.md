---
description: Execute git workflows (init, status, add, commit, branch, push, tag, release) only for changes belonging to the current task, with strict data-loss prevention rules.
argument-hint: "[init|status|add|commit|branch|push|tag|release] [args]"
---

# Git Command

**Requested operation:** $ARGUMENTS

Scope rule: `/git` commands touch ONLY changes that belong to the task the user asked for. Unrelated modified/untracked files are reported, never staged, committed, stashed, or reverted.

Safely execute Git workflows automatically. Designed with strict anti-data-loss and anti-overwrite guardrails to protect your codebase.

## Usage

```
/git init                → Initialize repository + create standard .gitignore if missing
/git status              → Display current repository change summary
/git add [path]          → Stage task-related paths with staging verification
/git commit              → Stage ONLY task-related changes + auto-generate conventional commit
/git commit "message"    → Commit with custom message
/git branch <name>       → Create and switch to a new feature/fix branch safely
/git push                → Push to remote repository (create upstream branch if missing)
/git tag v1.0.0          → Create release version tag
/git release v1.0.0      → Execute commit + tag + push sequence
```

---

## Automatic Repository Initialization (`/git init` & Pre-check)

If any `/git` command is run on a directory without a `.git` repository:
1. **Ask the user first** whether to initialize a repository here. Do not run `git init` silently.
2. If approved, run `git init`.
3. Check if `.gitignore` exists:
   - If missing, propose a baseline `.gitignore` protecting: `.env`, `node_modules/`, `vendor/`, `*.log`, `storage/*.key`, `.DS_Store`, `secrets.*` — show it before writing.
4. Report repository initialization status to the user.

---

## Staging Workflow (`/git add [path]`)

When staging files:
1. Inspect `git status` first to view untracked and modified files.
2. Filter out sensitive files (`.env`, `*.key`, `secrets.*`, etc.).
3. Execute staging — prefer explicit paths scoped to the current task:
   ```bash
   # Selective staging (default)
   git add path/to/file

   # NEVER `git add -A` as a routine step: it sweeps unrelated user changes
   # into the commit. Use it only when the user explicitly asks to stage
   # everything and has seen the full `git status` list.
   ```
4. Verify staging results:
   ```bash
   git diff --cached --stat
   ```
   Display the staged index preview to the user.

---

## Automated `/git commit` Workflow

The agent executes the following steps sequentially:

### 1. Check Repository Status
```bash
git status
```
Inspect output — ensure no sensitive files are tracked (`.env`, `*.key`, `secrets.*`).
If sensitive files are detected → **STOP**, report to user, do not proceed.

### 2. Review Changes
```bash
git diff --stat
```
Display a summary of modified files to the user before proceeding.

### 3. Display Preview and Request Confirmation

Before staging any files, present a summary to the user:

```
Files staged for commit:
  modified:   src/auth/login.ts
  modified:   src/auth/logout.ts
  new file:   src/auth/session.ts

Proceed with commit? (yes/no)
```

**STOP and wait for user confirmation.** Do not proceed without explicit affirmative confirmation.

### 4. Stage Changes
Stage exactly the files shown in the confirmation preview (step 3):
```bash
git add <confirmed paths>
```
Verify staged files with `git diff --cached --stat`.

### 5. Generate Commit Message
If no custom message is provided, generate one based on staged changes:
- Inspect `git diff --cached --stat`
- Determine change type: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`
- Format: `type(scope): concise description matching codebase language`

### 6. Commit Staged Changes
```bash
git commit -m "type(scope): concise summary"
```

### 7. Report Result
Display commit hash and message summary to the user.

---

## Safe Branch Management (`/git branch <name>`)

1. Check for uncommitted local changes (`git status --porcelain`).
2. If uncommitted work exists, **ask the user** how to handle it (stash, commit first, or carry over). Do NOT auto-stash — silently moving the user's work into a stash is its own data-loss risk.
3. Create and switch to new branch:
   ```bash
   git checkout -b <branch-name>
   ```
4. If the user chose to stash, offer to restore after the switch: `git stash pop`.

Follow standard branch naming conventions:
```
feat/feature-name
fix/bug-description
refactor/component-area
chore/update-deps
```

---

## Automated `/git push` Workflow

```bash
# Check current active branch
git branch --show-current

# Push changes — set upstream if new branch
git push -u origin <branch>
```

Never push directly to `main` or `master` without warning. If the current branch is main/master → **STOP**, verify if user explicitly intends to push directly to production branches.

---

## Versioning & Tagging (`/git tag` & `/git release`)

### Create Version Tag
```bash
git tag -a v1.0.0 -m "Release v1.0.0"
```
Tags are local until pushed. Ask before `git push origin v1.0.0` — a pushed tag triggers CI/releases and cannot be quietly replaced.

### Semantic Versioning Format (SemVer)
```
v[MAJOR].[MINOR].[PATCH]

MAJOR → Breaking changes
MINOR → Backward-compatible new features
PATCH → Bug fixes
```

### `/git release v1.0.0`
1. Show the full plan (files to stage, commit message, tag, branches to push) and **wait for explicit confirmation**.
2. `git add <confirmed paths>` — only release-related changes
3. `git commit -m "chore: release v1.0.0"`
4. `git tag -a v1.0.0 -m "Release v1.0.0"`
5. `git push -u origin <branch>`
6. `git push origin v1.0.0`

---

## Conventional Commits

Format: `type(scope): concise description`

| Type | When to Use |
|------|-------------|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `chore` | Dependency updates, config, tooling changes |
| `docs` | Documentation changes only |
| `test` | Adding or updating tests |

---

## 🛡️ Anti-Data-Loss & Anti-Overwrite Rules (STRICT)

1. **NO Destructive Discards**: **NEVER** run `git checkout .`, `git restore .`, or `git reset --hard` without explicit user warning and confirmation.
2. **NO Force Overwrites**: **NEVER** use `--force` or `-f` during `push` or `rebase` unless explicitly commanded by the user.
3. **NO Destructive Clean**: **NEVER** run `git clean -fd` without listing files to be deleted first and asking for confirmation.
4. **Stash Guard**: **ALWAYS** stash local uncommitted changes before branch switches or pulls to prevent merge collisions/overwrites.
5. **Secret Protection**: **NEVER** stage sensitive files (`.env`, `*.key`, `secrets.*`).
6. **Master/Main Protection**: **NEVER** push directly to production branches (`main`/`master`) without confirmation.

---

## Related

- /code-review — review code before committing
