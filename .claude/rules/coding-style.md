---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs}"
  - "**/*.{py,php,java,kt,go,rb,rs,cs,swift,dart,scala}"
  - "**/*.{vue,svelte,astro}"
description: Coding style rules — immutability, file organization, error handling, input validation, logging, and the pre-completion quality checklist. Read before writing or reviewing implementation code.
---

# Coding Style

> The principles below are universal. Code examples use JavaScript/TypeScript — adapt syntax to your project's technology stack (Laravel, Java, Python, etc.) recorded in `docs/PROJECT.md`.

## Immutability (prefer, with one exception)

Prefer new objects over mutation in application logic, reducers, view state and anything passed between modules. **Exception:** ORM entities and models (Eloquent, JPA/Hibernate, ActiveRecord, Prisma results used through their own API) are mutated through the framework's API by design; follow the ORM, do not wrap it in copies. Never mutate function arguments or shared module state.

```javascript
// WRONG: Mutation
function updateUser(user, name) {
  user.name = name  // MUTATION!
  return user
}

// CORRECT: Immutability
function updateUser(user, name) {
  return {
    ...user,
    name
  }
}
```

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large components
- Organize by feature/domain, not by type

## Error Handling

ALWAYS handle errors comprehensively:

```typescript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('Operation failed:', error)
  throw new Error('Detailed user-friendly message')
}
```

## Input Validation

ALWAYS validate user input:

```typescript
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
})

const validated = schema.parse(input)
```

## Logging Guidelines

> Code examples use JavaScript/TypeScript. Adapt to project stack recorded in `docs/PROJECT.md` — Laravel: `Log::info()`, Python: `logging.info()`, Java: `logger.info()`.

**NEVER** use `console.log`, `dd()`, `print()`, or `var_dump()` in production code — use the project logger utility.

### Severity Levels

| Level | When to Use |
|-------|-------------|
| `debug` | Internal technical details, development only |
| `info` | Normal operational flow: incoming requests, task completion |
| `warning` | Abnormal conditions that do not cause crashes |
| `error` | Operations failed, requires investigation |

### Log File Organization

Follow the project's existing log layout (`docs/PROJECT.md`). When the project has none, write one structured line per event (JSON or key=value) with a module tag and a request/correlation id, rotated per day by the platform's logger. Do not invent a folder layout the framework does not use.

JS Example:
```javascript
// WRONG: Logging sensitive raw data
console.log('user login', { email, password })

// CORRECT: Use logger utility, sanitize sensitive fields
logger.info('user.login', {
  userId: user.id,
  email: user.email,
  // Passwords MUST NOT be logged
})
```

### File vs Database Logging

- **File-based logs** — for APIs, background jobs, and system services
- **Database-based logs** — for audit applications requiring user/action/date filtering (`activity_logs`, `audit_logs` tables)

Selection is configured per project in `docs/PROJECT.md`.

### Prohibited Log Contents

Refer to `rules/security.md` — passwords, authentication tokens, API keys, and PII must never be logged.

## Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No console.log or raw debug statements
- [ ] No hardcoded configuration values
- [ ] No mutation of arguments or shared state (ORM models excepted)
- [ ] Mutating endpoints are idempotent or guarded against double submit (`rules/security.md`)

## Related

- security — security guidelines
- agent-workflow — agent orchestration
- testing — testing guidelines
- ui-ux-design — UI/UX design & favicon
- coding-standards — detailed coding standards
- backend-engineering — backend patterns
- frontend-engineering — frontend patterns
- ui-ux-pro-max — UI/UX master design

