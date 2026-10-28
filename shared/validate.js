/**
 * Validation des jeux de données — détecte incohérences, références cassées,
 * champs manquants et doublons SANS jamais modifier les fichiers source.
 */
import { parseTempRange, parseGap, cleanText } from './specs.js';

export const DATASET_SCHEMA = {
  products: {
    file: 'products.json',
    required: ['id', 'name', 'product_code', 'category'],
    recommended: ['strength', 'color', 'chemistry', 'viscosity', 'max_gap', 'temp_range', 'cure_time', 'approvals', 'compatible_materials', 'applications', 'limitations', 'usage_instructions'],
    arrays: ['approvals', 'compatible_materials', 'applications'],
  },
  applications: {
    file: 'applications.json',
    required: ['id', 'title'],
    recommended: ['description', 'sub_applications', 'primary_products'],
    arrays: ['sub_applications', 'primary_products'],
  },
  problems: {
    file: 'problems.json',
    required: ['id', 'title', 'recommended_solution'],
    recommended: ['symptoms', 'root_cause', 'selection_criteria'],
  },
  selection_rules: {
    file: 'selection_rules.json',
    required: ['rule_id', 'category', 'decision_tree'],
    recommended: ['condition'],
  },
  comparisons: {
    file: 'comparisons.json',
    required: ['comparison_id', 'title', 'target_products'],
    arrays: ['target_products'],
  },
  decision_questions: {
    file: 'decision_questions.json',
    required: ['question_id', 'text', 'options'],
  },
  warnings_and_limitations: {
    file: 'warnings_and_limitations.json',
    required: ['warning_id', 'title', 'affected_products', 'description'],
    arrays: ['affected_products'],
  },
  source_references: {
    file: 'source_references.json',
    required: ['ref_id', 'source_pdf'],
    recommended: ['pages_referenced', 'topic', 'key_claims_extracted'],
  },
  unresolved_items: {
    file: 'unresolved_items.json',
    required: ['item_id', 'issue_description'],
    recommended: ['field', 'documents_involved', 'action_required'],
  },
};

const PRODUCT_REF_KEYS = /(product_id|product_ids|topcoat_id|alternative_id)$/i;

function keyOf(ds) {
  const first = {
    products: 'id', applications: 'id', problems: 'id', selection_rules: 'rule_id',
    comparisons: 'comparison_id', decision_questions: 'question_id',
    warnings_and_limitations: 'warning_id', source_references: 'ref_id', unresolved_items: 'item_id',
  };
  return first[ds];
}

/**
 * @returns {{ok:boolean, errors:Array, warnings:Array, info:Array, issues:object, stats:object}}
 */
export function validateDatasets(raw) {
  const errors = [];
  const warnings = [];
  const info = [];
  const push = (arr, code, dataset, path, message, extra = {}) =>
    arr.push({ code, dataset, path, message, ...extra });

  const datasets = {};
  for (const ds of Object.keys(DATASET_SCHEMA)) {
    const val = raw[ds];
    if (val === undefined || val === null) {
      push(errors, 'DATASET_MISSING', ds, ds, `Dataset "${DATASET_SCHEMA[ds].file}" is missing or unreadable.`);
      datasets[ds] = [];
      continue;
    }
    if (!Array.isArray(val)) {
      push(errors, 'DATASET_NOT_ARRAY', ds, ds, `"${DATASET_SCHEMA[ds].file}" must be a JSON array (received: ${typeof val}).`);
      datasets[ds] = [];
      continue;
    }
    datasets[ds] = val;
  }

  // --- Champs requis, types, doublons -----------------------------------
  const ids = {};
  for (const ds of Object.keys(DATASET_SCHEMA)) {
    const schema = DATASET_SCHEMA[ds];
    const k = keyOf(ds);
    const seen = new Map();
    datasets[ds].forEach((rec, i) => {
      const p = `${schema.file}[${i}]`;
      if (!rec || typeof rec !== 'object') {
        push(errors, 'RECORD_NOT_OBJECT', ds, p, 'Unusable record (an object was expected).');
        return;
      }
      for (const f of schema.required) {
        if (rec[f] === undefined || rec[f] === null || rec[f] === '' ||
            (Array.isArray(rec[f]) && rec[f].length === 0)) {
          push(errors, 'FIELD_REQUIRED', ds, `${p}.${f}`, `Required field "${f}" is missing or empty.`, { recordId: rec[k] });
        }
      }
      for (const f of schema.recommended || []) {
        if (rec[f] === undefined || rec[f] === null || rec[f] === '') {
          push(warnings, 'FIELD_MISSING', ds, `${p}.${f}`, `Recommended field "${f}" is absent: the information will be shown as not documented.`, { recordId: rec[k] });
        }
      }
      for (const f of schema.arrays || []) {
        if (rec[f] !== undefined && !Array.isArray(rec[f])) {
          push(errors, 'FIELD_TYPE', ds, `${p}.${f}`, `Field "${f}" must be an array.`, { recordId: rec[k] });
        }
      }
      if (rec[k]) {
        if (seen.has(rec[k])) {
          push(errors, 'DUPLICATE_ID', ds, `${p}.${k}`, `Duplicate identifier "${rec[k]}" (already defined at position ${seen.get(rec[k])}).`, { recordId: rec[k] });
        }
        seen.set(rec[k], i);
      }
    });
    ids[ds] = seen;
  }

  const productIds = new Set(datasets.products.map((p) => p && p.id).filter(Boolean));

  // Collisions de casse / espaces (source classique de références cassées)
  const byNormalized = new Map();
  for (const id of productIds) {
    const norm = String(id).trim().toUpperCase().replace(/[\s-]/g, '');
    if (!byNormalized.has(norm)) byNormalized.set(norm, []);
    byNormalized.get(norm).push(id);
  }
  const caseCollisions = [];
  for (const [, list] of byNormalized) {
    if (list.length > 1) caseCollisions.push(list);
  }

  // --- Références produits --------------------------------------------
  const missingProductRefs = new Map(); // productId -> [{dataset, recordId, field, context}]
  const addMissing = (productId, ref) => {
    if (typeof productId !== 'string' || productIds.has(productId)) return;
    if (!missingProductRefs.has(productId)) missingProductRefs.set(productId, []);
    missingProductRefs.get(productId).push(ref);
  };
  const checkRef = (productId, dataset, recordId, field, context) => {
    if (productId === undefined || productId === null) return;
    if (typeof productId !== 'string') {
      push(errors, 'REF_TYPE', dataset, `${recordId}.${field}`, 'Product reference is not text.', { recordId });
      return;
    }
    addMissing(productId, { dataset, recordId, field, context: cleanText(context) });
  };

  datasets.applications.forEach((a) => {
    (a.primary_products || []).forEach((pid, i) =>
      checkRef(pid, 'applications', a.id, `primary_products[${i}]`, `${a.title}${a.sub_applications ? ` — ${a.sub_applications[Math.min(i, a.sub_applications.length - 1)] || ''}` : ''}`));
  });
  datasets.problems.forEach((pr) => {
    const sol = pr.recommended_solution || {};
    checkRef(sol.primary_product_id, 'problems', pr.id, 'recommended_solution.primary_product_id', pr.selection_criteria || pr.title);
    (sol.alternative_product_ids || []).forEach((pid, i) =>
      checkRef(pid, 'problems', pr.id, `recommended_solution.alternative_product_ids[${i}]`, pr.selection_criteria || pr.title));
  });
  datasets.selection_rules.forEach((r) => {
    (r.decision_tree || []).forEach((branch, bi) => {
      for (const [key, val] of Object.entries(branch)) {
        if (key === 'if') continue;
        if (PRODUCT_REF_KEYS.test(key)) checkRef(val, 'selection_rules', r.rule_id, `decision_tree[${bi}].${key}`, `${r.category} — SI ${JSON.stringify(branch.if)}`);
      }
    });
  });
  datasets.decision_questions.forEach((q) => {
    (q.options || []).forEach((o, oi) => {
      if (o.recommended_product_id) checkRef(o.recommended_product_id, 'decision_questions', q.question_id, `options[${oi}].recommended_product_id`, o.label);
      if (o.alternative_product_id) checkRef(o.alternative_product_id, 'decision_questions', q.question_id, `options[${oi}].alternative_product_id`, o.label);
      if (o.alternative_product_ids) o.alternative_product_ids.forEach((pid, i) =>
        checkRef(pid, 'decision_questions', q.question_id, `options[${oi}].alternative_product_ids[${i}]`, o.label));
    });
  });
  datasets.warnings_and_limitations.forEach((w) => {
    (w.affected_products || []).forEach((pid, i) =>
      checkRef(pid, 'warnings_and_limitations', w.warning_id, `affected_products[${i}]`, w.title));
  });
  datasets.comparisons.forEach((c) => {
    (c.target_products || []).forEach((pid, i) =>
      checkRef(pid, 'comparisons', c.comparison_id, `target_products[${i}]`, c.title));
    for (const [attr, row] of Object.entries(c.comparison_matrix || {})) {
      if (!row || typeof row !== 'object') {
        push(errors, 'COMPARISON_ROW_TYPE', 'comparisons', `${c.comparison_id}.comparison_matrix.${attr}`, 'Unusable matrix row.');
        continue;
      }
      for (const pid of Object.keys(row)) {
        checkRef(pid, 'comparisons', c.comparison_id, `comparison_matrix.${attr}`, c.title);
      }
      for (const pid of c.target_products || []) {
        if (!(pid in row)) {
          push(info, 'COMPARISON_CELL_ABSENT', 'comparisons', `${c.comparison_id}.comparison_matrix.${attr}.${pid}`,
            `Cellule absente pour ${pid} sur « ${attr} » : affichée comme « non documenté » (et non comme absence de capacité).`, { recordId: c.comparison_id });
        }
      }
    }
    if ((c.target_products || []).length < 2) {
      push(errors, 'COMPARISON_TOO_FEW', 'comparisons', `${c.comparison_id}.target_products`, 'A comparison must cover at least two products.', { recordId: c.comparison_id });
    }
  });

  // --- Graphe des questions décisionnelles ------------------------------
  const questionIds = new Set(datasets.decision_questions.map((q) => q && q.question_id).filter(Boolean));
  const danglingNext = [];
  const targetQ = new Set();
  const terminalQuestions = [];
  datasets.decision_questions.forEach((q) => {
    (q.options || []).forEach((o, oi) => {
      if (!o || typeof o.label !== 'string') {
        push(errors, 'QUESTION_OPTION_INVALID', 'decision_questions', `${q.question_id}.options[${oi}]`, 'Option without a usable label.', { recordId: q.question_id });
        return;
      }
      if (o.next) {
        if (!questionIds.has(o.next)) {
          danglingNext.push({ questionId: q.question_id, optionIndex: oi, label: o.label, next: o.next });
          push(errors, 'QUESTION_NEXT_BROKEN', 'decision_questions', `${q.question_id}.options[${oi}].next`,
            `Follow-up question "${o.next}" does not exist: the branch "${o.label}" has no documented questionnaire.`, { recordId: q.question_id });
        } else targetQ.add(o.next);
      } else if (!o.recommended_product_id) {
        terminalQuestions.push({ questionId: q.question_id, optionIndex: oi, label: o.label });
        push(warnings, 'QUESTION_OPTION_DEAD_END', 'decision_questions', `${q.question_id}.options[${oi}]`,
          `Option "${o.label}" has neither a recommended product nor a follow-up question.`, { recordId: q.question_id });
      }
    });
  });
  const roots = datasets.decision_questions.map((q) => q.question_id).filter((id) => !targetQ.has(id));
  const unreachable = datasets.decision_questions.map((q) => q.question_id).filter((id) => !roots.includes(id) && !targetQ.has(id));

  // --- Règles -----------------------------------------------------------
  const ruleIssues = [];
  const ruleCategories = new Set();
  datasets.selection_rules.forEach((r) => {
    ruleCategories.add(r.category);
    const tree = r.decision_tree || [];
    tree.forEach((b, bi) => {
      const ifKeys = Object.keys(b.if || {});
      if (!ifKeys.length) {
        ruleIssues.push({ ruleId: r.rule_id, branch: bi, type: 'EMPTY_CONDITION', message: 'Branch without a condition: it would match systematically (non-deterministic).' });
        push(errors, 'RULE_EMPTY_CONDITION', 'selection_rules', `${r.rule_id}.decision_tree[${bi}].if`, 'Empty condition.', { recordId: r.rule_id });
      }
      if (!b.then_product_id) {
        ruleIssues.push({ ruleId: r.rule_id, branch: bi, type: 'NO_PRODUCT', message: 'Branch without a target product.' });
        push(warnings, 'RULE_NO_PRODUCT', 'selection_rules', `${r.rule_id}.decision_tree[${bi}]`, 'Branch without a target product.', { recordId: r.rule_id });
      }
      // Contraintes de plage de température non numériques -> non évaluables automatiquement
      for (const [k, v] of Object.entries(b.if || {})) {
        if (typeof v === 'string' && /°?\s?C\b/.test(v) && !/\d/.test(v)) {
          push(info, 'RULE_CONDITION_UNPARSABLE', 'selection_rules', `${r.rule_id}.decision_tree[${bi}].if.${k}`, `Condition "${k}: ${v}" cannot be evaluated numerically.`, { recordId: r.rule_id });
        }
      }
    });
  });

  // --- Couverture -------------------------------------------------------
  const referencedBySomething = new Set();
  datasets.applications.forEach((a) => (a.primary_products || []).forEach((p) => referencedBySomething.add(p)));
  datasets.problems.forEach((p) => {
    const s = p.recommended_solution || {};
    if (s.primary_product_id) referencedBySomething.add(s.primary_product_id);
    (s.alternative_product_ids || []).forEach((x) => referencedBySomething.add(x));
  });
  datasets.selection_rules.forEach((r) => (r.decision_tree || []).forEach((b) => Object.entries(b).forEach(([k, v]) => { if (PRODUCT_REF_KEYS.test(k)) referencedBySomething.add(v); })));
  datasets.decision_questions.forEach((q) => (q.options || []).forEach((o) => o.recommended_product_id && referencedBySomething.add(o.recommended_product_id)));
  const orphanProducts = [...productIds].filter((id) => !referencedBySomething.has(id));
  if (orphanProducts.length) {
    push(warnings, 'PRODUCT_ORPHAN', 'products', 'products[*]', `${orphanProducts.length} product(s) are not referenced by any rule, problem, application or question.`, { recordId: orphanProducts.join(', ') });
  }
  const prepProducts = orphanProducts.filter((id) => {
    const p = datasets.products.find((x) => x && x.id === id);
    return p && /^(Cleaner|Primer)/i.test(p.category || '');
  });
  if (prepProducts.length) {
    push(info, 'PRODUCT_PREP_UNLINKED', 'products', 'products[*]',
      `${prepProducts.length} surface-preparation product(s) (cleaner / primer) are not cited by any rule or problem: the application cannot recommend them as a primary solution.`,
      { recordId: prepProducts.join(', ') });
  }

  // --- Traçabilité des sources -----------------------------------------
  const productSourceHints = new Map();
  for (const p of datasets.products) {
    const explicit = Array.isArray(p.source_ref_ids) ? p.source_ref_ids : null;
    const hits = datasets.source_references.filter((s) => {
      if (explicit) return explicit.includes(s.ref_id);
      const hay = `${s.key_claims_extracted || ''} ${s.topic || ''}`;
      const code = String(p.product_code || '').trim();
      const name = String(p.name || '').replace(/LOCTITE®?/i, '').replace(/™/g, '').replace(/Threadlocker|Thread Sealant|Retaining Compound|Flange Sealant|Pipe Sealing Cord/i, '').trim();
      const codeHit = code && new RegExp(`(^|[^\\dA-Za-z])${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\dA-Za-z]|$)`).test(hay);
      const nameHit = name && name.length > 2 && hay.toUpperCase().includes(name.toUpperCase().replace(/\s+/g, ' '));
      return Boolean(codeHit || nameHit);
    });
    productSourceHints.set(p.id, hits.map((h) => h.ref_id));
    if (!hits.length) {
      push(info, 'PRODUCT_SOURCE_NOT_FOUND', 'products', p.id, `No source reference cites ${p.name} explicitly: its specifications are not attached to a source page.`, { recordId: p.id });
    }
  }

  // --- Lisibilité des plages de température -----------------------------
  datasets.products.forEach((p) => {
    if (p.temp_range) {
      const t = parseTempRange(p.temp_range);
      if (!t.parseable) {
        push(info, 'TEMP_RANGE_UNPARSED', 'products', `${p.id}.temp_range`, `Temperature range "${p.temp_range}" cannot be used numerically: manual verification required.`, { recordId: p.id });
      }
    }
    if (p.max_gap) {
      const g = parseGap(p.max_gap);
      if (!g.parseable) {
        push(info, 'GAP_UNPARSED', 'products', `${p.id}.max_gap`, `Maximum gap "${p.max_gap}" is not numeric: automatic comparison is not possible.`, { recordId: p.id });
      }
    }
  });

  // --- Références produits manquantes : niveau de gravité ---------------
  for (const [pid, refs] of missingProductRefs) {
    const severity = refs.some((r) => r.dataset === 'selection_rules' || r.dataset === 'decision_questions') ? errors : warnings;
    push(severity, 'PRODUCT_REF_MISSING', 'products', pid,
      `Product "${pid}" is referenced ${refs.length} time(s) but is ABSENT from the product catalogue: no datasheet available.`,
      { recordId: pid, references: refs });
  }

  const stats = {
    products: datasets.products.length,
    applications: datasets.applications.length,
    problems: datasets.problems.length,
    selection_rules: datasets.selection_rules.length,
    rule_branches: datasets.selection_rules.reduce((n, r) => n + (r.decision_tree || []).length, 0),
    comparisons: datasets.comparisons.length,
    decision_questions: datasets.decision_questions.length,
    warnings: datasets.warnings_and_limitations.length,
    source_references: datasets.source_references.length,
    unresolved_items: datasets.unresolved_items.length,
    missing_product_references: missingProductRefs.size,
    resolved_product_references: [...missingProductRefs.values()].reduce((n, r) => n + r.length, 0),
  };

  const issues = {
    missingProducts: [...missingProductRefs.entries()].map(([productId, references]) => ({ productId, references })),
    danglingNext,
    caseCollisions,
    orphanProducts,
    surfacePrepProducts: orphanProducts.filter((id) => {
      const p = datasets.products.find((x) => x && x.id === id);
      return p && /^(Cleaner|Primer)/i.test(p.category || '');
    }),
    unreachableQuestions: unreachable,
    rootQuestions: roots,
    ruleIssues,
    deadEndOptions: terminalQuestions,
    productSourceHints: Object.fromEntries(productSourceHints),
    ruleCategories: [...ruleCategories],
  };

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    info,
    issues,
    stats,
    validatedAt: new Date().toISOString(),
  };
}
