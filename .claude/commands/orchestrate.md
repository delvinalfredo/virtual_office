---
description: Run a sequential multi-agent workflow (feature, bugfix, refactor, security, or custom) with HANDOFF documents between agents and a final orchestration report.
argument-hint: "[feature|bugfix|refactor|security|custom] [description]"
---

# Orchestrate Command

Sequential agent workflow for complex tasks.

## Usage

`/orchestrate [workflow-type] [task-description]`

## Workflow Types

### feature
Full feature implementation workflow:
```
architect/planner (as needed) -> implementation -> tests -> code-reviewer -> context-sync when durable project knowledge changed
```

### bugfix
Bug investigation and fix workflow:
```
architect -> implementation -> tests -> code-reviewer
```

### refactor
Safe refactoring workflow:
```
architect -> implementation -> tests -> code-reviewer
```

### security
Security-focused review:
```
security-reviewer -> code-reviewer -> architect only when architecture findings require it
```

## Execution Pattern

For each agent in the workflow:

1. **Invoke agent** with the Agent tool (subagent_type = the agent name), passing the previous handoff in the prompt
2. **Collect output** as structured handoff document
3. **Pass to next agent** in chain
4. **Aggregate results** into final report

## Handoff Document Format

Between agents, create handoff document:

```markdown
## HANDOFF: [previous-agent] -> [next-agent]

### Context
[Summary of what was done]

### Findings
[Key discoveries or decisions]

### Files Modified
[List of files touched]

### Open Questions
[Unresolved items for next agent]

### Recommendations
[Suggested next steps]
```

## Build Error Fallback

If build fails in the middle of a chain (during tdd-guide or later):

```
[Agent fails due to build error]
  └─ Automatically invoke build-error-resolver
       └─ Minimal fix, build passes
            └─ Resume next agent in chain
```

build-error-resolver does not alter system architecture — it strictly fixes build errors, then returns control to the chain.

---

## Example: Feature Workflow

```
/orchestrate feature "Add user authentication"
```

Executes:

1. **Planner Agent**
   - Analyzes requirements
   - Creates implementation plan
   - Identifies dependencies
   - Output: `HANDOFF: planner -> tdd-guide`

2. **TDD Guide Agent**
   - Reads planner handoff
   - Writes tests first
   - Implements code to pass tests
   - If build error → invoke build-error-resolver, proceed after green build
   - Output: `HANDOFF: tdd-guide -> e2e-runner`

3. **E2E Runner Agent**
   - Runs critical user flow tests
   - Ensures feature operates end-to-end
   - Output: `HANDOFF: e2e-runner -> code-reviewer`

4. **Code Reviewer Agent**
   - Reviews implementation
   - Checks for issues
   - Suggests improvements
   - Output: `HANDOFF: code-reviewer -> security-reviewer`

5. **Security Reviewer Agent**
   - Security audit
   - Vulnerability check

6. **Context Sync Agent**
   - Sync docs/PROJECT.md with newly completed feature / architectural changes
   - Output: Final Report

## Final Report Format

```
ORCHESTRATION REPORT
====================
Workflow: feature
Task: Add user authentication
Agents: architect/planner (as needed) -> implementation -> tests -> code-reviewer -> context-sync when durable project knowledge changed

SUMMARY
-------
[One paragraph summary]

AGENT OUTPUTS
-------------
Planner: [summary]
TDD Guide: [summary]
E2E Runner: [summary]
Code Reviewer: [summary]
Security Reviewer: [summary]
Context Sync: [docs/PROJECT.md synced]

FILES CHANGED
-------------
[List all files modified]

TEST RESULTS
------------
[Test pass/fail summary]

SECURITY STATUS
---------------
[Security findings]

RECOMMENDATION
--------------
[SHIP / NEEDS WORK / BLOCKED]
```

## Parallel Execution

For independent checks, run agents in parallel:

```markdown
### Parallel Phase
Run simultaneously:
- code-reviewer (quality)
- security-reviewer (security)
- architect (design)

### Merge Results
Combine outputs into single report
```

## Arguments

Received: `$ARGUMENTS`

Accepted forms:
- `feature <description>` - Full feature workflow
- `bugfix <description>` - Bug fix workflow
- `refactor <description>` - Refactoring workflow
- `security <description>` - Security review workflow
- `custom <agents> <description>` - Custom agent sequence

## Custom Workflow Example

```
/orchestrate custom "architect,tdd-guide,code-reviewer" "Redesign caching layer"
```

## Mid-Chain Failure Handling

If an agent fails in the middle of a workflow:
1. Record the last successful phase
2. Report to user: which phase failed and why
3. Await user instructions — retry failed phase, skip, or abort
4. Do NOT proceed to the next agent with an invalid state

Example:
```
ORCHESTRATION INTERRUPTED
==========================
Last successful phase: planner
Failed at: tdd-guide
Reason: [error message]

Options:
- "retry" → retry tdd-guide from scratch
- "skip tdd" → proceed to code-reviewer without tdd
- "abort" → terminate workflow
```

## Tips

1. **Start with planner agent** for complex features
2. **Always include code-reviewer agent** before merge
3. **Use security-reviewer agent** for auth/payment/PII
4. **Keep handoffs concise** - focus on what next agent needs
5. **Run verification** between agents if needed

## Related Agents

- planner — implementation planning
- architect — system design
- tdd-guide — test-driven development
- code-reviewer — code quality review
- security-reviewer — security analysis
- build-error-resolver — fix build errors
- e2e-runner — end-to-end testing
- refactor-cleaner — dead code cleanup
- context-sync — keep PROJECT.md current
- project context — project orientation
