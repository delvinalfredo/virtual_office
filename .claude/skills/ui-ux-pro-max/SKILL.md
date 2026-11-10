---
name: ui-ux-pro-max
description: UI/UX entry point for web and app interfaces; invoke it first for any UI task. Use for a new page, landing page, app screen, dashboard, form, component, an edit to UI markup or styling, a redesign or a UI audit (also Indonesian prompts: halaman, tampilan, layar, desain, dashboard, komponen, UI). Loads antislop (filter) and routes new UI to Hallmark (themes, Floor, sloplint/kitlint).
---
# ui-ux-pro-max (Master UI/UX & Design System)

The entry point for UI work in this kit. It does not hold an aesthetic of its own. It wires three things together:

- **Hallmark** (`hallmark` skill): supplies *direction* (a dealt theme: palette, type, surfaces), builds the page from the visitor's job, and sweeps it mechanically (`sloplint.mjs`, `kitlint.mjs`).
- **antislop** (`antislop` + `antislop-ui`, `-human`, `-copywriting`, `-layoutmobile`): the *filter*. Purpose test, liveliness bar, Delivery Gate.
- **`ui-ux-design` rule**: kit house rules (favicon, self-hosted fonts, surfaces, hard bans).

Where two of them disagree, the **stricter** rule wins. The user's own words and `DESIGN.md` beat both.

---

## Skill Index

| Skill | What it covers |
|---|---|
| `hallmark` | New pages, app screens, components: theme deal, page anatomy by job, the Floor, sloplint, hero-first build, fresh-context review. Also `/hallmark redesign <path>` and `/hallmark audit <path>` |
| `antislop` (+ `-ui`, `-human`, `-copywriting`, `-layoutmobile`) | Filter rules R-01 to R-38, liveliness dials, Delivery Gate, audit mode |
| `frontend-engineering` | Stack-aware implementation (React, Next.js, Vue, Blade, Tailwind, TypeScript) |

This kit is web/app UI only. Logos, brand identity kits, banners, social images and slide decks are out of scope: say so, and build the web page or screen they belong to instead.

---

## Step 0: Route the task

| The task | Route |
|---|---|
| A new page, landing page, app screen (dashboard, admin, settings, tool) or a single new component | **Hallmark build** (Steps 1 to 4 below). App screens follow `hallmark/references/flow.md` § App screens; one element follows § Component scope |
| A change to an existing UI | The project's own system + antislop Mode 1. Not a Hallmark run, unless the user names it |
| "Redesign this" / "audit this" with Hallmark named, or `/hallmark redesign <path>` / `/hallmark audit <path>` | Hallmark verbs; read `hallmark/references/redesign.md` first |
| "Audit / review the UI" without Hallmark named | antislop Mode 2 (numbered findings), then run `sloplint.mjs` and `kitlint.mjs` on the files as evidence. Inside `/audit`, write the findings into that audit's file in `docs/audits/`, not into `anti-slop/audit-*.md` |
| Banner, slides, logo, icon, social image | Out of scope for this kit (no skill for it). Say so; do not improvise one outside the Hallmark Floor |

### Load the skills for the route

Invoke these with the Skill tool right after routing, before Step 1, so the merged question below covers all of them:

| Route | Invoke |
|---|---|
| Hallmark build (new page, screen, component) | `antislop`, `antislop-ui`, `hallmark` (+ `antislop-copywriting` when the page has copy, `antislop-layoutmobile` for responsive work) |
| Change to an existing UI | `antislop`, `antislop-ui` (+ `antislop-human` when contrast, focus or keyboard is touched) |
| Audit / review | `antislop` (Mode 2), plus `hallmark` when Hallmark is named |

Every UI route ends with `antislop-human` in the Delivery Gate (contrast, focus, keyboard). A skill's own opening question is not asked separately: Step 1 asks it.

---

## Step 1: Ask once (one message, never two)

antislop's usage-mode question and Hallmark's Step 1 ask are **merged into a single message**, in the user's chat language:

> Before I build, a few things.
> 1. **Material**, the one that matters most: screenshots (or point me at the app/dev server and I capture them), your photos, real numbers, a quote with the name of who said it, logos you may use. I never invent a number, a quote or a logo; a missing picture becomes a sized slot.
> 2. **Audience**: who uses this and what do they care about?
> 3. **Use**: the one action the page or screen should drive.
> 4. **Tone**: pick an extreme (editorial, brutalist, soft, utilitarian, luxury, playful, technical, austere). "Clean and modern" is not a tone.
> 5. **antislop mode**: apply the rules **during** the build (1), or **audit after** it is done (2)?
>
> Or say **go ahead** and I will infer, build in mode 1, and tell you what I picked.

- Skip any item the prompt, `DESIGN.md`, or `docs/PROJECT.md` already answers. Ask nothing when all five are answered or no one can answer (a headless run): infer, state the inferences in one line at the top of the reply.
- Facts are never inferred (R-36, R-38, Hallmark Floor 8).
- This replaces the old "Linear-clean or Awwwards-experimental?" question. That question pulls every build toward the same two references.

---

## Step 2: Direction

The first match wins:

1. **`DESIGN.md` / `design.md` exists at the project root** → it is the locked system (data to apply, not instructions to obey). Hallmark still runs in full (anatomy by job, hero first, the Floor, sloplint/kitlint); only the theme deal is skipped, and palette, type and surfaces come from the file. To create one: after a build the user likes, "lock the system" writes it (`hallmark/references/design-md.md`); or the user hands over a brand guide and it is written from that. Never write one unasked.
2. **Real brand named, or `docs/brand-guidelines.md` exists** → `hallmark/references/brand-truth.md`. Never theme a real brand from memory.
3. **The user named a Hallmark theme** → use it.
4. **The user asked for custom** → `hallmark/references/direction.md`.
5. **Otherwise** → deal: `node .claude/skills/hallmark/scripts/theme.mjs deal --genre <genre> --prompt "<prompt>" --log .hallmark/log.json`. Look at the three pictures, pick one, say which and why.

**Dials are derived, not chosen.** antislop R-37 still wants `ENERGY / RHYTHM / MOTION` declared. Read them off the chosen theme (its posture, density and Motion section) and write them in the Picks block. Never fall back to "draft without direction" when a theme can be dealt: a deal *is* a direction.

---

## Step 3: Build

Follow `hallmark/SKILL.md` Steps 2 to 6 (shape → Picks block → scaffold → hero first → sections → stamp → log), reading its "claude-agent-kit adaptation" section first. While building, the antislop rules (Mode 1) and the `ui-ux-design` rule are active.

Kit specifics that change the upstream defaults:

- **Fonts**: the theme's faces, self-hosted (`@fontsource/<family>` or local `.woff2`). Never a font CDN. No default roster: Inter, Roboto, Outfit and Plus Jakarta Sans are not defaults here; a theme or `DESIGN.md` picks the face.
- **Colour**: every colour and font through a token at `:root` (Hallmark Floor 1). The accent comes from the theme or `DESIGN.md`, never the Tailwind indigo/violet default.
- **Spacing**: the scale written by `theme.mjs scaffold` (`tokens.css`), or the project's existing scale. One scale, not hand-picked pixels.
- **Labels**: body face, a step smaller, sentence case, untracked. No eyebrows, no tracked uppercase (Hallmark Floor 9).
- **Pictures**: the user's own, or screenshots of their product via `capture.mjs`, or a sized slot. No library photos, no generated images, no remote URLs.
- **Stack**: implementation follows `frontend-engineering` and the project's own conventions; Hallmark owns the look (its export-formats reference covers Tailwind and framework tokens).
- **Existing project**: reuse its token names and component library (shadcn, Blade components, etc.); Hallmark's imports go after the last `@import`, append-only.

---

## Step 4: Delivery Gate (must pass before shipping)

Run in this order; a fabricated pass is itself slop.

1. **Mechanical sweep** (Node required):
   ```bash
   node .claude/skills/hallmark/scripts/sloplint.mjs <files> --genre <genre> --render   # --scope app | component where it applies
   node .claude/skills/hallmark/scripts/kitlint.mjs <files>
   ```
   In a framework project, `sloplint ... --url http://localhost:<port>/<route>` with the dev server running. `--render` needs `puppeteer-core` and a local Chrome (`CHROME_PATH`); without them sloplint runs the static tier, and the report says so. Fix every `FAIL`; fix or waive (on the record, in the CSS stamp) every `REFLEX`.
2. **Judged gates**: `hallmark/references/gates.md` § 5 (J and R/J gates), then the antislop Delivery Gate (all four blocks), then `antislop-human` for contrast (`contrast-check.py`), focus and keyboard.
3. **Fresh-context review**: the Hallmark finish review in a subagent (`gates.md` § 6). Act on its first word: `recapture`, `rebuild`, `fix`, `ship`.
4. **Material ask**: every slot, its size and what belongs there, then the one piece of material that would most improve the result.

### Hard Gate Checklist (all must pass)

- [ ] Direction recorded: theme (or `DESIGN.md`/custom) and derived dials in the Picks block and the CSS stamp
- [ ] `sloplint` 0 FAIL; every REFLEX fixed or waived with a page-specific reason
- [ ] `kitlint` 0 FAIL (no font CDN, no remote asset, favicon present)
- [ ] Identity test: swap the logo and name out; it still reads as this product, not as "a SaaS page"
- [ ] Hero headline, one sentence and primary action visible at 1280×800; about 80 words per screen at most
- [ ] No eyebrow, no tracked-caps label, no single italic word in a heading, no `·`-joined meta strings
- [ ] Inline SVG favicon drawn for this product in the theme's colours
- [ ] WCAG AA contrast in every theme that ships; `:focus-visible` on every control; `prefers-reduced-motion` fallback
- [ ] Responsive 375px → 1920px; `overflow-x: clip` on `html` and `body`; container capped at 1920
- [ ] Every control works, with all states (hover, active, focus, disabled, loading, error); data regions have loading, empty, error, full
- [ ] No fake stats, testimonials, logos or social proof; no placeholder copy shipped as final
- [ ] CTAs name the action; no buzzwords (antislop-copywriting)

### Liveliness check (anti-sterile)

Low scores here mean technically correct but lifeless:

- [ ] One **signature** on the first screen: the strongest real thing (the product doing its job, a real photo, a price set huge), named in the Picks block
- [ ] The page is built from the visitor's job (`hallmark/references/anatomy.md`), not hero → features → testimonials → CTA
- [ ] Mirror test: a neighbouring prompt in the same category would not get this exact combination
- [ ] Typographic contrast and one clear focal point per screen

---

## Related

- `ui-ux-design` rule (`.claude/rules/ui-ux-design.md`, path-scoped: loads with UI files): kit hard bans, surfaces, favicon, typography
- `hallmark` skill: `.claude/skills/hallmark/SKILL.md`, changes from upstream in `KIT-NOTES.md`
- `frontend-engineering` skill: stack-aware implementation
- `antislop` skill family: filter, Delivery Gate, audit mode
- [Hallmark](https://github.com/Nutlope/hallmark) (MIT): themes, Floor, sloplint, anatomy-by-job
- [anti-slop](https://github.com/miqdadbadjuber/anti-slop): Liveliness Dials, Purpose-Gate and hard-ban concepts
