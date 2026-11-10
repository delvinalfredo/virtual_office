---
paths:
  - "**/*.{test,spec}.*"
  - "**/test_*.py"
  - "**/*_test.*"
  - "**/{test,tests,__tests__,e2e}/**"
description: Testing guidelines — what earns a permanent test, coverage priorities, TDD workflow, and failure triage. Read before writing or reviewing tests.
---

# Testing Guidelines

This guide applies to all written code — adapt testing frameworks to the project stack recorded in `docs/PROJECT.md`.

## Core Principles

New logic gets tested — but tests are a permanent load, not proof of work. A
test earns its place only where a plausible bug would fail it: behavior,
boundaries, invariants, transitions, precedence, real errors.

- Write tests **before** or **alongside** the implementation when the logic is uncertain enough that a plausible bug would break it.
- For one-off verification of a change, a throwaway script or smoke run is enough — do not commit permanent tests just so the change "has tests".
- Tests must execute deterministically without manual setup steps, be isolated, and pass in a full-suite run.
- Never assert implementation details (wiring, field copies, defaults, mock echoes, source text) — assert what a consumer observes.
- Unmaintainable tests are as detrimental as having no tests at all. Delete an existing test that pins wording or incidental behavior rather than re-pinning it.

## Coverage Priority

**Recommended Tests Required For:**
- Core business logic and calculations
- Authentication and permission checks
- Input validation pathways
- Error handling and edge case execution paths

**Optional (Use Engineering Judgment):**
- Cosmetic UI styling
- Simple getter/setter methods without logic
- Generated scaffolding / boilerplate code

## TDD Workflow (When Using `/tdd`)

```
RED      → Write a failing test first
GREEN    → Implement minimal code required for tests to pass
REFACTOR → Clean up code while ensuring tests remain green
```

## Target Coverage

- Minimum 80% coverage for core domain logic
- 100% coverage for auth, payments, and financial calculations

## Agent Support

- Use tdd-guide agent to enforce test-driven workflows
- Use e2e-runner agent for critical end-to-end user flows
- If tests are omitted, code-reviewer agent will flag missing tests during review

## Troubleshooting

If tests fail:
1. Fix the underlying implementation, not the test (unless the test specification itself is incorrect).
2. Verify test isolation — ensure no shared mutable state exists between test runs.
3. Invoke tdd-guide agent for assistance.

## Related

- coding-style — coding standards
- security — security guidelines
- tdd-guide — test-driven development
- e2e-runner — end-to-end runner
- code-reviewer — code reviewer
