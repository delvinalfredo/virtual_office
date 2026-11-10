---
name: backend-engineering
description: Backend engineering guidance for Laravel/PHP, Java/Spring Boot, REST APIs, PostgreSQL/MySQL, queues, integrations, and Docker. Adapt to the actual repository stack; never assume a framework.
---

# Backend Engineering

## First determine the stack

Inspect the repository before applying patterns. Look for `composer.json`, `artisan`, `pom.xml`, `build.gradle`, `package.json`, Docker files, migrations, and existing service/repository patterns.

## Principles

- Prefer the repository's existing architecture over introducing a new pattern.
- Keep controllers/HTTP handlers thin; put business rules in appropriate services/domain components.
- Validate inputs at boundaries and authorize sensitive operations.
- Use parameterized queries/ORM APIs; never concatenate user input into SQL.
- Make external API calls resilient: timeout, retry only when safe, idempotency where relevant, and structured error handling.
- Never log secrets, tokens, passwords, full payment credentials, or sensitive personal data.
- Keep database transactions as narrow as practical.
- For financial/payment operations, explicitly reason about idempotency, duplicate requests, race conditions, and rollback/compensation.
- Add tests for business rules and failure paths.
- Prefer existing project conventions over generic examples from this skill.

## Laravel

When Laravel is detected, prefer Laravel-native conventions already present in the repo: Form Requests, policies/gates, service classes where useful, jobs/events for asynchronous work, Eloquent/query builder, migrations, queues, and feature tests.

## Spring Boot

When Spring Boot is detected, inspect existing controller/service/repository conventions, DTO validation, transaction boundaries, exception handling, configuration properties, and test style before changing architecture.

## Database

For PostgreSQL/MySQL changes:
- inspect schema and migrations first;
- check indexes and query plans when performance is relevant;
- avoid destructive migrations without an explicit rollback/backup strategy;
- verify transaction/isolation implications for concurrent writes.
