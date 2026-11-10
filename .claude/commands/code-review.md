---
description: Comprehensive security, quality, performance, and style review of uncommitted changes.
argument-hint: "[optional path or focus]"
---

# Code Review

**Focus (optional):** $ARGUMENTS

Comprehensive security and quality review of uncommitted changes:

1. Get changed files (including new files Git does not track yet):
   ```bash
   git status --porcelain   # modified, staged, AND untracked (??) files
   ```
   Review untracked files by reading them in full — `git diff` never shows new files, so a diff-only review silently skips brand-new code.

2. For each changed file, check for:

**Security Issues (CRITICAL):**
- Hardcoded credentials, API keys, tokens
- SQL injection vulnerabilities
- XSS vulnerabilities  
- Missing input validation
- Insecure dependencies
- Path traversal risks

**Code Quality (HIGH):**
- Functions > 50 lines
- Files > 800 lines
- Nesting depth > 4 levels
- Missing error handling
- console.log statements
- TODO/FIXME comments
- Missing JSDoc for public APIs

**Best Practices (MEDIUM):**
- Mutation patterns (use immutable instead)
- Emoji usage in code/comments
- Missing tests for new code
- Accessibility issues (a11y)

3. Generate report with:
   - Severity: CRITICAL, HIGH, MEDIUM, LOW
   - File location and line numbers
   - Issue description
   - Suggested fix

4. Block commit if CRITICAL or HIGH issues found

Never approve code with security vulnerabilities!

## Related Agents

- code-reviewer — code quality and security review
- security-reviewer — deep security vulnerability analysis
