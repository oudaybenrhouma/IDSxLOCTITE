/**
 * IDS server — LOCTITE product selection guide
 * JSON API plus static hosting of the built application.
 */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDataStore } from './dataStore.js';
import { assess, nextDocumentedQuestion, INPUT_SPECS, evaluateRule, evaluateBranch, buildContext, STATUS } from '../shared/engine.js';
import { searchKnowledgeBase } from '../shared/kb.js';
import { parseTempRange, parseGap } from '../shared/specs.js';
import { CATEGORY_LABELS } from '../shared/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.IDS_DATA_DIR ? path.resolve(process.env.IDS_DATA_DIR) : path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';

const store = createDataStore({ dataDir: DATA_DIR });
store.load();

const app = express();
app.use(express.json({ limit: '512kb' }));

const api = express.Router();

/* ------------------------------- Utilitaires ------------------------------ */

function publicProduct(kb, p) {
  if (!p) return null;
  const links = kb.links.get(p.id) || { problems: [], applications: [], warnings: [], questions: [], comparisons: [], rules: [] };
  return {
    ...p,
    categoryLabel: CATEGORY_LABELS[p.category] || p.category,
    parsed: {
      temp: kb.specs.get(p.id)?.temp || parseTempRange(p.temp_range),
      gap: kb.specs.get(p.id)?.gap || null,
    },
    links: {
      problems: links.problems,
      applications: links.applications,
      warnings: links.warnings,
      questions: links.questions,
      comparisons: links.comparisons,
      rules: links.rules,
    },
    sources: kb.derive.productSources(p.id),
    undocumented_specs: [
      (!p.temp_range || !parseTempRange(p.temp_range).parseable) ? 'temp_range' : null,
      (!p.max_gap || !parseGap(p.max_gap).parseable) ? 'max_gap' : null,
      (p.viscosity && !/\d/.test(p.viscosity)) ? 'viscosity' : null,
    ].filter(Boolean),
  };
}

const wrap = (fn) => (req, res, next) => {
  try { fn(req, res, next); } catch (err) {
    next(err);
  }
};

api.get('/health', wrap((req, res) => {
  const s = store.state;
  res.json({
    status: s.kb ? 'ok' : 'indisponible',
    dataValidation: s.kb ? (s.kb.validation.ok ? 'conforme' : 'anomalies') : 'indisponible',
    dataLoadedAt: s.loadedAt,
    dataSource: s.source,
    dataVersion: s.fingerprint,
    products: s.kb ? s.kb.products.length : 0,
    dataErrors: s.kb ? s.kb.validation.errors.length : 0,
    dataWarnings: s.kb ? s.kb.validation.warnings.length : 0,
  });
}));

api.get('/datasets/status', wrap((req, res) => {
  const s = store.state;
  if (!s.kb) {
    res.status(503).json({ error: 'DONNEES_INDISPONIBLES', detail: s.loadError });
    return;
  }
  res.json({
    loadedAt: s.loadedAt,
    dataSource: s.source,
    dataVersion: s.fingerprint,
    stats: s.kb.validation.stats,
    ok: s.kb.validation.ok,
    errors: s.kb.validation.errors,
    warnings: s.kb.validation.warnings,
    info: s.kb.validation.info,
    issues: {
      missingProducts: s.kb.validation.issues.missingProducts,
      danglingNext: s.kb.validation.issues.danglingNext,
      orphanProducts: s.kb.validation.issues.orphanProducts,
      ruleIssues: s.kb.validation.issues.ruleIssues,
      productsWithoutSources: Object.entries(s.kb.validation.issues.productSourceHints)
        .filter(([, refs]) => !refs.length).map(([id]) => id),
    },
    unresolvedItems: s.kb.raw.unresolved_items,
  });
}));

api.post('/datasets/reload', wrap((req, res) => {
  store.load();
  const s = store.state;
  res.json({
    reloadedAt: s.loadedAt,
    dataVersion: s.fingerprint,
    ok: Boolean(s.kb && s.kb.validation.ok),
    errors: s.kb ? s.kb.validation.errors.length : 0,
    warnings: s.kb ? s.kb.validation.warnings.length : 0,
  });
}));

function requireKb(res) {
  if (!store.kb) {
    res.status(503).json({
      error: 'DONNEES_INDISPONIBLES',
      message: "The datasets could not be loaded. Open the Data quality page for details.",
      detail: store.state.loadError,
    });
    return false;
  }
  return true;
}

/* --------------------------------- Produits ------------------------------- */

api.get('/products', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  const { category, q, application } = req.query;
  let rows = kb.products.map((p) => publicProduct(kb, p));
  if (category) rows = rows.filter((p) => p.category === category);
  if (application) {
    const app = kb.appById.get(application);
    rows = rows.filter((p) => app && p.links.applications.some((a) => a.id === app.id));
  }
  if (q) {
    const ids = new Set(searchKnowledgeBase(kb, String(q), { category: category || undefined }).map((r) => r.id));
    rows = rows.filter((p) => ids.has(p.id));
  }
  res.json({ count: rows.length, products: rows });
}));

api.get('/products/:id', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  const p = kb.productById.get(req.params.id);
  if (!p) {
    const missing = kb.validation.issues.missingProducts.find((m) => m.productId === req.params.id);
    if (missing) {
      res.status(409).json({
        error: 'PRODUIT_REFERENCE_MAIS_NON_DOCUMENTE',
        message: `The product "${req.params.id}" is cited by the documentation but absent from products.json.`,
        references: missing.references,
        hint: kb.aliases[req.params.id]?.canonicalHint || null,
        note: kb.aliases[req.params.id]?.note || null,
      });
      return;
    }
    res.status(404).json({ error: 'PRODUIT_INCONNU', message: `No product with the identifier "${req.params.id}".` });
    return;
  }
  const full = publicProduct(kb, p);
  full.relatedComparisons = kb.raw.comparisons
    .filter((c) => (c.target_products || []).includes(p.id))
    .map((c) => ({ id: c.comparison_id, title: c.title, target_products: c.target_products }));
  full.sourceClaims = full.sources;
  res.json(full);
}));

/* --------------------------------- Recherche ------------------------------ */

api.get('/search', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  const q = String(req.query.q || '').slice(0, 200);
  const category = req.query.category ? String(req.query.category) : undefined;
  const application = req.query.application ? String(req.query.application) : undefined;
  const results = searchKnowledgeBase(kb, q, { category, application });
  res.json({
    query: q,
    count: results.length,
    results: results.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      category: r.category,
      categoryLabel: r.categoryLabel,
      score: r.score,
      applicationsTitles: r.applicationsTitles,
      problemsTitles: r.problemsTitles.slice(0, 3),
      approvals: r.approvals,
      matchReasons: r.matchReasons || [],
    })),
  });
}));

api.get('/search/suggestions', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  const terms = new Set();
  kb.products.forEach((p) => {
    terms.add(p.product_code);
    (p.applications || []).forEach((a) => terms.add(a));
    (p.compatible_materials || []).forEach((m) => terms.add(m.split('(')[0].trim()));
  });
  kb.raw.problems.forEach((p) => terms.add(p.title));
  kb.raw.applications.forEach((a) => terms.add(a.title));
  res.json({ suggestions: [...terms].filter(Boolean).slice(0, 120) });
}));

/* -------------------------------- Applications ---------------------------- */

api.get('/applications', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  res.json({
    applications: kb.raw.applications.map((a) => {
      const rule = kb.derive.applicationRule(a.id);
      const problem = kb.derive.applicationProblem(a.id);
      const questions = kb.raw.decision_questions.filter((q) => (q.options || []).some((o) => o.next) &&
        (kb.derive.questionApplication(q.question_id) === a.id));
      return {
        ...a,
        ruleId: rule ? rule.rule_id : null,
        problemId: problem ? problem.id : null,
        questionIds: questions.map((q) => q.question_id),
        productCount: new Set(a.primary_products || []).size,
      };
    }),
  });
}));

api.get('/applications/:id', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  const a = kb.appById.get(req.params.id);
  if (!a) { res.status(404).json({ error: 'APPLICATION_INCONNUE' }); return; }
  const rule = kb.derive.applicationRule(a.id);
  const problem = kb.derive.applicationProblem(a.id);
  res.json({
    ...a,
    products: (a.primary_products || []).map((id) => {
      const p = kb.productById.get(id);
      return p ? { id, name: p.name, code: p.product_code, available: true } : { id, name: null, available: false, hint: kb.aliases[id]?.canonicalHint || null };
    }),
    rule: rule || null,
    problem: problem || null,
  });
}));

/* ---------------------------------- Problems ------------------------------ */

api.get('/problems', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  res.json({
    problems: kb.raw.problems.map((p) => {
      const sol = p.recommended_solution || {};
      return {
        ...p,
        productResolutions: {
          primary: sol.primary_product_id ? { id: sol.primary_product_id, available: kb.productById.has(sol.primary_product_id), name: kb.productById.get(sol.primary_product_id)?.name || null } : null,
          alternatives: (sol.alternative_product_ids || []).map((id) => ({ id, available: kb.productById.has(id), name: kb.productById.get(id)?.name || null })),
        },
        applicationId: Object.entries({ APP_THREADLOCKING: 'PROB_001', APP_THREAD_SEALING: 'PROB_002', APP_GASKETING: 'PROB_003', APP_RETAINING: 'PROB_004', APP_PUMP_MAINTENANCE: 'PROB_006' }).find(([, v]) => v === p.id)?.[0] || null,
      };
    }),
  });
}));

api.get('/problems/:id', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  const p = kb.problemById.get(req.params.id);
  if (!p) { res.status(404).json({ error: 'PROBLEME_INCONNU' }); return; }
  res.json(p);
}));

/* ---------------------------------- Questions ---------------------------- */

api.get('/questions', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  const questions = kb.raw.decision_questions.map((q) => ({
    ...q,
    applicationId: kb.derive.questionApplication(q.question_id),
    options: (q.options || []).map((o, i) => ({
      ...o,
      index: i,
      nextExists: o.next ? kb.questionById.has(o.next) : null,
      productAvailable: o.recommended_product_id ? kb.productById.has(o.recommended_product_id) : null,
    })),
  }));
  res.json({ questions, rootQuestionId: 'Q1_APPLICATION_TYPE', inputs: INPUT_SPECS });
}));

/* ------------------------------ Questionnaire ---------------------------- */

api.post('/assistant/next', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  const { questionId, optionIndex } = req.body || {};
  if (!questionId) { res.status(400).json({ error: 'QUESTION_REQUISE' }); return; }
  const q = kb.questionById.get(questionId);
  if (!q) { res.status(404).json({ error: 'QUESTION_INCONNUE', questionId }); return; }
  const r = nextDocumentedQuestion(kb, { questionId, optionIndex });
  res.json({
    questionId,
    hasNext: Boolean(r.question),
    next: r.question || null,
    brokenBranch: r.brokenNext,
    option: Number.isInteger(optionIndex) ? q.options[optionIndex] || null : null,
  });
}));

/* ------------------------------ Recommandation -------------------------- */

function validateAnswers(answers = {}) {
  const problems = [];
  if (answers.operatingTempC !== undefined && answers.operatingTempC !== '' && answers.operatingTempC !== null) {
    const n = Number(answers.operatingTempC);
    if (!Number.isFinite(n)) problems.push({ field: 'operatingTempC', message: 'Service temperature is not numeric.' });
    else if (n < -273 || n > 2000) problems.push({ field: 'operatingTempC', message: 'Service temperature is outside the plausible range (−273 to 2000 °C).' });
  }
  for (const key of ['radialGapMm', 'gapMm']) {
    const v = answers[key];
    if (v !== undefined && v !== '' && v !== null) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) problems.push({ field: key, message: 'Measured gap is invalid (a positive number in mm is expected).' });
      else if (n > 100) problems.push({ field: key, message: 'Measured gap is above 100 mm: check the unit (mm).' });
    }
  }
  for (const [key, spec] of Object.entries(INPUT_SPECS)) {
    const v = answers[key];
    if (v === undefined || v === null || v === '') continue;
    if (spec.type === 'single' && !spec.options.some((o) => o.value === v)) {
      problems.push({ field: key, message: `Value "${v}" is not recognised for "${spec.label}".` });
    }
    if (spec.type === 'boolean' && typeof v !== 'boolean') {
      problems.push({ field: key, message: `"${spec.label}" expects a yes/no answer.` });
    }
  }
  return problems;
}

api.post('/recommend', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  const body = req.body || {};
  const { problemId, applicationId, questionId, optionIndex, entryQuestionId, entryOptionIndex, answers } = body;
  const inputProblems = validateAnswers(answers || {});
  if (inputProblems.length) {
    res.status(422).json({ error: 'REPONSES_INVALIDES', message: 'Some answers are invalid.', problems: inputProblems });
    return;
  }
  if (questionId && !kb.questionById.has(questionId)) {
    res.status(404).json({ error: 'QUESTION_INCONNUE', questionId });
    return;
  }
  if (applicationId && !kb.appById.has(applicationId)) {
    res.status(404).json({ error: 'APPLICATION_INCONNUE', applicationId });
    return;
  }
  if (problemId && !kb.problemById.has(problemId)) {
    res.status(404).json({ error: 'PROBLEME_INCONNU', problemId });
    return;
  }
  const result = assess(kb, { problemId, applicationId, questionId, optionIndex, entryQuestionId, entryOptionIndex, answers });
  res.json(result);
}));

/* --------------------------------- Comparaison -------------------------- */

api.get('/comparisons', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  res.json({
    comparisons: kb.raw.comparisons.map((c) => ({
      ...c,
      availability: (c.target_products || []).map((id) => ({ id, available: kb.productById.has(id), name: kb.productById.get(id)?.name || null })),
    })),
  });
}));

api.get('/compare', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  const ids = String(req.query.ids || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length < 2) { res.status(400).json({ error: 'DEUX_PRODUITS_MINIMUM' }); return; }
  if (ids.length > 6) { res.status(400).json({ error: 'SIX_PRODUITS_MAXIMUM' }); return; }
  const unknown = ids.filter((id) => !kb.productById.has(id));
  if (unknown.length) {
    res.status(404).json({ error: 'PRODUITS_INCONNUS', ids: unknown });
    return;
  }
  const products = ids.map((id) => kb.productById.get(id));
  const attributes = [
    ['product_code', 'Product code', (p) => p.product_code],
    ['category', 'Documented category', (p) => p.category],
    ['strength', 'Strength', (p) => p.strength],
    ['chemistry', 'Chemistry', (p) => p.chemistry],
    ['color', 'Colour', (p) => p.color],
    ['viscosity', 'Viscosity', (p) => p.viscosity],
    ['max_gap', 'Documented maximum gap', (p) => p.max_gap],
    ['temp_range', 'Temperature range', (p) => p.temp_range],
    ['cure_time', 'Cure time', (p) => p.cure_time],
    ['approvals', 'Approvals', (p) => (p.approvals || []).join(' • ')],
    ['compatible_materials', 'Compatible substrates', (p) => (p.compatible_materials || []).join(' • ')],
    ['applications', 'Applications', (p) => (p.applications || []).join(' • ')],
    ['limitations', 'Limits and exclusions', (p) => p.limitations],
    ['usage_instructions', 'Documented instructions for use', (p) => p.usage_instructions],
  ];
  const rows = attributes.map(([key, label, get]) => {
    const values = products.map((p) => {
      const v = get(p);
      if (v === undefined || v === null || v === '') return { state: 'non_documente', value: null };
      if (typeof v === 'string' && /^n\s*\/\s*a(\s*\(.*\))?$/i.test(v.trim())) return { state: 'non_applicable', value: v.trim() };
      // Un champ composite dont tous les éléments valent N/A est également non applicable
      if (typeof v === 'string' && v.split('•').every((part) => /^\s*n\s*\/\s*a\s*$/i.test(part))) {
        return { state: 'non_applicable', value: v.trim() };
      }
      return { state: 'documente', value: v };
    });
    const distinct = new Set(values.map((x) => (x.value === null ? '__null' : String(x.value))));
    return { key, label, values, differs: distinct.size > 1 };
  });
  const warningsByProduct = products.map((p) => ({
    id: p.id,
    warnings: (kb.links.get(p.id)?.warnings || []).map((w) => ({ id: w.warning_id, title: w.title, severity: w.severity })),
  }));
  res.json({
    ids,
    products: products.map((p) => ({ id: p.id, name: p.name, code: p.product_code, category: p.category })),
    rows,
    warningsByProduct,
    matchedComparisons: kb.raw.comparisons.filter((c) => (c.target_products || []).every((id) => ids.includes(id))),
  });
}));

/* ------------------------------ Avertissements -------------------------- */

api.get('/warnings', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  res.json({
    warnings: kb.raw.warnings_and_limitations.map((w) => ({
      ...w,
      affected: (w.affected_products || []).map((id) => ({ id, available: kb.productById.has(id), name: kb.productById.get(id)?.name || null })),
    })),
  });
}));

api.get('/sources', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  res.json({
    sources: kb.raw.source_references.map((s) => ({
      ...s,
      linkedProducts: kb.products.filter((p) => (kb.validation.issues.productSourceHints[p.id] || []).includes(s.ref_id))
        .map((p) => ({ id: p.id, name: p.name, code: p.product_code })),
    })),
  });
}));

api.get('/rules', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  res.json({
    rules: kb.raw.selection_rules.map((r) => ({
      ...r,
      evaluatedWithoutAnswers: evaluateRule(r, buildContext(kb, {})),
    })),
  });
}));

/* ------------------------------- Diagnostics ---------------------------- */

api.post('/rules/evaluate', wrap((req, res) => {
  if (!requireKb(res)) return;
  const kb = store.kb;
  const { ruleId, answers } = req.body || {};
  const rule = kb.ruleById.get(ruleId);
  if (!rule) { res.status(404).json({ error: 'REGLE_INCONNUE', ruleId }); return; }
  const problems = validateAnswers(answers || {});
  if (problems.length) { res.status(422).json({ error: 'REPONSES_INVALIDES', problems }); return; }
  const ctx = buildContext(kb, { answers: answers || {} });
  res.json({ ruleId, evaluation: evaluateRule(rule, ctx), branches: (rule.decision_tree || []).map((b) => evaluateBranch(b, ctx, rule.rule_id)) });
}));

/* ------------------------------ Gestion erreurs ------------------------- */

app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'ROUTE_INCONNUE', path: req.originalUrl }));

// eslint-disable-next-line no-unused-vars
app.use('/api', (err, req, res, next) => {
  console.error('[api] erreur', err);
  res.status(500).json({
    error: 'ERREUR_SERVEUR',
    message: "An internal error occurred while processing the request.",
  });
});

/* ------------------------------- Fichiers statiques --------------------- */

const dist = path.join(ROOT, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(200).type('text/plain').send(
      "IDS API started. The interface is not built yet: run `npm run build` or use `npm run dev`."
    );
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    const s = store.state;
    const summary = s.kb ? s.kb.validation.stats : {};
    console.log(`[ids] API ready on http://${HOST}:${PORT} (data: ${DATA_DIR})`);
    console.log(`[ids] products=${summary.products ?? 0} errors=${s.kb?.validation.errors.length ?? '?'} warnings=${s.kb?.validation.warnings.length ?? '?'}`);
  });
}

export { app, store, STATUS };
