#!/usr/bin/env node
// claude-agent-kit companion to sloplint: the kit's own house rules that Hallmark upstream does not hold.
//   K1 FAIL  a font CDN (the visitor's IP goes to a third party; self-host with @fontsource or local .woff2)
//   K2 FAIL  a remote image, script, stylesheet or CSS url() (offline-safe: everything ships with the page)
//   K3 FAIL  an HTML document with <head> but no favicon (the kit's no-plain-tab rule)
//   K4 WARN  the old kit default accent (Tailwind indigo/violet) used as a literal
// Usage: node kitlint.mjs <file|dir> [...]   exit 1 when any FAIL
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const EXT = new Set(['.html', '.htm', '.css', '.scss', '.jsx', '.tsx', '.vue', '.svelte', '.astro', '.php', '.twig', '.erb', '.cshtml']);
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'vendor', '.hallmark']);
const files = [];
const walk = (p) => {
  const st = statSync(p);
  if (st.isDirectory()) { for (const n of readdirSync(p)) if (!SKIP.has(n)) walk(join(p, n)); }
  else if (EXT.has(extname(p).toLowerCase()) || p.endsWith('.blade.php')) files.push(p);
};
const args = process.argv.slice(2);
if (!args.length) { console.error('usage: node kitlint.mjs <file|dir> [...]'); process.exit(2); }
args.forEach(walk);

const FONT_CDN = /(fonts\.googleapis\.com|fonts\.gstatic\.com|api\.fontshare\.com|use\.typekit\.net|fonts\.bunny\.net|cdn\.fonts\.net)/g;
const REMOTE = [
  /<img[^>]+src=["'](https?:)?\/\/[^"']+/gi,
  /<script[^>]+src=["'](https?:)?\/\/[^"']+/gi,
  /<link[^>]+rel=["']stylesheet["'][^>]+href=["'](https?:)?\/\/[^"']+/gi,
  /<link[^>]+href=["'](https?:)?\/\/[^"']+["'][^>]+rel=["']stylesheet/gi,
  /<source[^>]+src(set)?=["'](https?:)?\/\/[^"']+/gi,
  /url\(\s*["']?(https?:)?\/\/[^)]+\)/gi,
  /@import\s+(url\()?["']?(https?:)?\/\/[^;]+/gi,
];
const ACCENT = /#(6366f1|8b5cf6|7c3aed|4f46e5)\b/gi;

let fails = 0, warns = 0;
const lineOf = (src, i) => src.slice(0, i).split('\n').length;
const out = (tier, code, f, src, i, msg) => { console.log(`${tier.padEnd(4)} ${code}  ${f}:${lineOf(src, i)}  ${msg}`); tier === 'FAIL' ? fails++ : warns++; };

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(FONT_CDN)) out('FAIL', 'K1', f, src, m.index, `font CDN (${m[1]}): self-host with @fontsource/<family> or local .woff2 + @font-face`);
  const seen = new Set();
  for (const re of REMOTE) for (const m of src.matchAll(re)) {
    if (seen.has(m.index) || FONT_CDN.test(m[0])) { FONT_CDN.lastIndex = 0; continue; }
    FONT_CDN.lastIndex = 0; seen.add(m.index);
    out('FAIL', 'K2', f, src, m.index, `remote asset: ${m[0].slice(0, 90)}`);
  }
  if (/<head[\s>]/i.test(src) && !/<link[^>]+rel=["'][^"']*icon/i.test(src)) out('FAIL', 'K3', f, src, src.search(/<head[\s>]/i), 'no favicon in <head> (inline SVG data: URI, drawn for this product)');
  for (const m of src.matchAll(ACCENT)) out('WARN', 'K4', f, src, m.index, `${m[0]} is the generic AI indigo/violet; take the accent from the theme or DESIGN.md`);
}
console.log(`\nkitlint: ${files.length} file(s) · ${fails} FAIL · ${warns} WARN`);
process.exit(fails ? 1 : 0);
