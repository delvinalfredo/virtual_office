---
name: frontend-engineering
description: Frontend engineering guidance for React, Next.js, Vue, Blade, server-rendered HTML, Tailwind, and TypeScript. Adapt to the actual repository.
---

# Frontend Engineering

## Scope

This skill covers implementation. How the UI looks (direction, layout, tokens, a new page or screen) goes through `ui-ux-pro-max`, which loads `antislop` and routes to `hallmark`; invoke it before writing UI.

## First determine the stack

Inspect `package.json`, framework config, routing, styling setup, and existing components before introducing patterns.

## Principles

- Reuse existing components and design tokens before creating new ones.
- Keep UI state close to where it is used; avoid global state unless justified.
- Handle loading, empty, error, and success states deliberately.
- Preserve accessibility: semantic HTML, keyboard support, labels, focus states, and sufficient contrast.
- Avoid unnecessary client-side JavaScript and network requests.
- Keep API/data-fetching concerns separate from presentation where the project architecture supports it.
- Test critical user journeys and important state transitions.
- Do not introduce a new UI library merely to solve a small component problem.

## React/Next.js

Follow the repository's existing App Router/Pages Router, server/client component, data-fetching, and state-management conventions. Do not assume a specific Next.js version.

## Laravel/Blade or server-rendered UI

Prefer the existing Blade/component/layout conventions and progressive enhancement where practical.
