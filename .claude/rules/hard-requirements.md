# Hard requirements

Short on purpose. This file has no `paths` frontmatter, so Claude Code loads it
at session start with the same priority as `CLAUDE.md`. Treat every section as
active for the whole session, even after the opening context has scrolled far up
the transcript.

## Destructive actions need explicit consent

This covers every tool, not only git. Ask first, and name exactly what will be
destroyed:

- `git reset --hard`, `git checkout .`, `git restore .`, `git clean -fd/-fdx`
- `git push --force` / `-f`, including on a feature branch
- `git stash` as a way to move the user's uncommitted work out of the way
- `git push` to `main`/`master`, or a tag push (both trigger CI/releases)
- Deleting files or directories you did not create in this task
- Overwriting a tracked file the user has uncommitted changes in
- `rm -rf`, `docker system prune`
- Anything that destroys database data: `DROP`, `TRUNCATE`, `DELETE`/`UPDATE`
  without `WHERE`, dropping a column, and the framework commands that do it
  (`migrate:fresh/reset/rollback`, `db:wipe`, `prisma migrate reset`,
  `rails db:drop`, `flyway clean`, a hand-run `down()`). Name the database and
  tables first; never against a non-local database. Seeders only on a local or
  empty database.

Never stage or commit `.env`, `*.key`, `secrets.*`, or credentials. If you notice
one already tracked, say so and stop — do not silently rewrite history.

Stage only paths belonging to the task at hand. Unrelated modified or untracked
files are reported, never swept into a commit.

## Changes

Any turn that changed a file ends with a **Changes** block. It is the last block
of the reply — nothing comes after it. Plain text, in the user's own language, no
tool call and no diff dump.

One line per file, always the same shape: `path/to/file` — what changed, and why.

```text
Changes

Backend
- app/Http/Controllers/AuthController.php — added a rate limit to password reset
- app/Models/User.php — new reset_token_expires_at cast

Frontend
- resources/js/pages/Login.tsx — surfaces the 429 with a retry countdown

Tests
- tests/Feature/PasswordResetTest.php — covers the throttle

Verified: php artisan test --filter=PasswordReset (12 passed)
```

- Group by area with a plain heading: Backend, Frontend, Config, Migrations,
  Tests, Docs. Two or more areas → group them. Only one area → the heading may be
  dropped, the `path — change` lines stay.
- State what changed in the code, not what you did: "added X", "removed Y",
  "renamed Z" — not "updated the file".
- Mark new, deleted, and renamed files explicitly. They are the easiest to miss
  and the ones a reader most needs.
- End with what you actually ran to verify (test, build, lint), or say plainly
  that you ran nothing. Never imply verification you did not perform.
- List only files changed **this turn**. Never pad the list, never claim a change
  you did not make, never list a file you only read.
- No file changed → no block at all. Never emit an empty one.
- Subagents skip this. The top-level agent writes the single final block.

## Project context file

`docs/PROJECT.md` is the project's verified state, not a changelog.

- **Missing, or still the unfilled template** → create it before your first edit,
  from inspected facts: runtime, framework, package manager, database, entry
  points, build and test commands. Never invent versions, infrastructure, or
  architecture. On a project with no stack yet, wait until there is something
  real to record; what the user says it *will* need is written as `planned:`.
- **Already accurate** → use it as-is. Never rewrite it wholesale, and never
  regenerate a section that is still true.
- **A recorded fact is now stale** → update **that fact** in the same turn you
  made it stale. This includes facts your own change just altered:
  a new dependency, a new integration or external service, a changed entry point
  or module boundary, a new table or schema, a new queue or worker, a changed
  build/test/deploy command, a changed auth boundary. Example: after adding
  Redis, the `Cache/queue` cell changes from `none` to `Redis (ioredis)` — one
  cell, not a rewrite.
- **A fact your change touched is wrong** → correct or remove it now. Do not
  leave a claim you just disproved standing, and do not report it as a side note
  instead of fixing it.
- **An unrelated claim looks unbacked** → say so and ask before rewriting it.
  The working tree may simply not be the whole story (another branch, uncommitted
  work, a service configured outside the repo), and silently rewriting lines
  outside your task is its own way to corrupt this file.
- **Never write infrastructure, services, or versions the repository does not
  actually contain.** If there is no cache, no queue, and no such dependency, the
  `Cache/queue` row reads `| Cache/queue | none |` — that is the correct value,
  not a gap to fill. The Redis example above is an illustration, not a default:
  most fields in most projects will say `none`.
- **Write it in the template's shape.** `.claude/PROJECT.template.md` is the layout
  contract: same headings in the same order, the `Verified Stack` table with all
  eight rows, one blank line after every heading, one fact per line, no hard
  wrapping, no empty cells, no example row left behind.
- Never write secrets, tokens, credentials, or personal data into it.

## Specs are conditional

- Before implementing a feature, read the project's specs **if any exist** —
  wherever they live (`docs/specs/`, `specs/`, `docs/`, `PRD.md`, an API schema
  file). `docs/specs/` is this kit's convention, not a requirement.
- A new or small project having no specs is normal. Proceed on the request and
  the code. Do not ask for a spec that was never written, and do not invent one.
- If a spec contradicts the code, say so explicitly and ask which is correct
  before implementing.
