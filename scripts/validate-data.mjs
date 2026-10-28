#!/usr/bin/env node
/**
 * Command-line dataset validation.
 *
 *   npm run validate:data             # console report, exit code 1 on a blocking error
 *   npm run report:data               # writes docs/rapport-donnees.md
 *   node scripts/validate-data.mjs --data ./other-folder
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDatasets, DATASET_SCHEMA } from '../shared/validate.js';
import { buildKnowledgeBase } from '../shared/kb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const dataDirArg = args.indexOf('--data');
const DATA_DIR = dataDirArg !== -1 ? path.resolve(args[dataDirArg + 1]) : path.join(ROOT, 'data');
const WRITE = args.includes('--write-report');

const raw = {};
const readErrors = [];
for (const [ds, schema] of Object.entries(DATASET_SCHEMA)) {
  const file = path.join(DATA_DIR, schema.file);
  try {
    raw[ds] = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    readErrors.push({ dataset: ds, file: schema.file, code: err instanceof SyntaxError ? 'JSON_INVALID' : 'FILE_UNREADABLE', message: err.message });
    raw[ds] = [];
  }
}

const res = validateDatasets(raw);
const kb = buildKnowledgeBase(raw);

const line = (c = '─') => c.repeat(78);
const out = [];
const log = (s = '') => { out.push(s); console.log(s); };

log(line('═'));
log('  IDS · Loctite selection guide — dataset validation');
log(`  Source: ${DATA_DIR}`);
log(line('═'));

if (readErrors.length) {
  log('\nREAD FAILURES');
  readErrors.forEach((e) => log(`  ✗ [${e.code}] ${e.file} — ${e.message}`));
}

log('\nVOLUME');
for (const [k, v] of Object.entries(res.stats)) log(`  ${k.padEnd(30)} ${v}`);

const section = (title, items, icon) => {
  log(`\n${title} — ${items.length}`);
  items.slice(0, 80).forEach((e) => {
    log(`  ${icon} [${e.code}] ${e.dataset}${e.path ? ` / ${e.path}` : ''}`);
    log(`      ${e.message}`);
  });
  if (items.length > 80) log(`  … ${items.length - 80} additional entr${items.length - 80 === 1 ? 'y' : 'ies'} hidden`);
};

section('BLOCKING ERRORS', res.errors, '✗');
section('WARNINGS', res.warnings, '!');
section('INFORMATION', res.info, 'i');

log(`\n${line()}`);
log('FUNCTIONAL COVERAGE');
const ruleCategories = new Set(kb.raw.selection_rules.map((r) => r.category));
kb.raw.applications.forEach((a) => {
  const rule = kb.derive.applicationRule(a.id);
  log(`  ${a.id.padEnd(24)} rule: ${(rule?.rule_id || 'NONE').padEnd(30)} featured products: ${a.primary_products.length}`);
});
log(`  Rule categories: ${[...ruleCategories].join(', ')}`);
log(`  Applications without a rule: ${kb.derive.applicationsWithoutRule().join(', ') || 'none'}`);
log('\n  Structural notes (derived mappings, not supplied by the data):');
(kb.structuralNotes || []).forEach((n) => log(`    - ${n}`));

log(`\n${line()}`);
const ok = res.ok;
log(ok ? 'RESULT: structure compliant (the warnings still need review).' : `RESULT: ${res.errors.length} blocking error(s) detected.`);
log('The source files have NOT been modified in any way.');
log(line('═'));

if (WRITE) {
  const mdPath = path.join(ROOT, 'docs', 'rapport-donnees.md');
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  const md = [];
  md.push('# Dataset validation report\n');
  md.push(`Generated ${new Date().toISOString()} from \`${DATA_DIR}\`.\n`);
  md.push('## Volume\n');
  md.push('| Dataset | Records |\n| --- | --- |');
  Object.entries(res.stats).forEach(([k, v]) => md.push(`| \`${k}.json\` | ${v} |`));
  md.push('\n## Blocking errors\n');
  if (!res.errors.length) md.push('None.');
  res.errors.forEach((e) => md.push(`- **${e.code}** — \`${e.dataset}\` / \`${e.path}\` : ${e.message}`));
  md.push('\n## Warnings\n');
  if (!res.warnings.length) md.push('None.');
  res.warnings.forEach((e) => md.push(`- **${e.code}** — \`${e.dataset}\` / \`${e.path}\` : ${e.message}`));
  md.push('\n## Product references missing from the catalogue\n');
  md.push('| Reference | Cited by |\n| --- | --- |');
  res.issues.missingProducts.forEach((m) => {
    md.push(`| \`${m.productId}\` | ${m.references.map((r) => `${r.dataset}/${r.recordId}`).join('<br>')} |`);
  });
  md.push('\n## Unresolved points supplied by the sources\n');
  kb.raw.unresolved_items.forEach((u) => md.push(`- **${u.item_id}** (${u.field}) : ${u.issue_description} — *${u.action_required}*`));
  md.push('\n## Structural notes\n');
  (kb.structuralNotes || []).forEach((n) => md.push(`- ${n}`));
  fs.writeFileSync(mdPath, `${md.join('\n')}\n`, 'utf8');
  console.log(`\nReport written to ${mdPath}`);
}

process.exit(ok ? 0 : 1);
