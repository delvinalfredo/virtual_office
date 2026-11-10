---
paths:
  - "**/*.{tsx,jsx,vue,svelte,astro}"
  - "**/*.{html,htm}"
  - "**/*.{css,scss,sass,less}"
  - "**/*.blade.php"
  - "**/*.{twig,erb,razor,cshtml}"
description: Loads together with ui-ux-design whenever a UI file (markup, component, or stylesheet) is read, written, or edited; points the agent at the antislop skills and the Hallmark Floor. Backend files never match these paths.
---
You are working on a UI file. `.claude/rules/ui-ux-design.md` is loaded with this file —
follow it, do not rely on memory of it. It carries the hard bans (glassmorphism,
pill-everything, generic blue-purple gradients, translucent washed-out cards, emoji
as structural UI, AI badge capsules, generic CTAs and buzzwords, fake stats and
testimonials, dead controls), the solid surface hierarchy, the inline SVG favicon
requirement, and the typography and spacing scale.

Invoke the `ui-ux-pro-max` skill first if it is not loaded yet: it routes the
task and loads the `antislop` skill (core) plus `antislop-ui`, and `antislop-human`
when contrast, focus, or keyboard access is in scope. The Hallmark Floor (§5 of
ui-ux-design: tokens only, no tracked-caps labels or eyebrows, no `transition: all`,
`overflow-x: clip`, focus-visible, reduced motion) binds this edit too. A new page,
screen or component goes through `ui-ux-pro-max`, which routes to the `hallmark`
skill. Before handing back, run `.claude/skills/hallmark/scripts/sloplint.mjs` and
`kitlint.mjs` on the changed files when Node is available.
