/**
 * Base de connaissances : chargement, résolution des références, index de recherche.
 * Les données brutes ne sont jamais modifiées (clonage défensif + gel en profondeur).
 */
import { validateDatasets, DATASET_SCHEMA } from './validate.js';
import { parseTempRange, parseGap, parseSizeLimit, cleanText } from './specs.js';
import { CATEGORY_LABELS, QUESTION_TO_APPLICATION, APPLICATION_TO_RULE, APPLICATION_TO_PROBLEM, Q1_OPTION_APPLICATION_RULES, SEARCH_SYNONYMS } from './config.js';

/**
 * Corrections de renvoi DOCUMENTÉES, sans aucune donnée technique.
 * Chaque entrée est justifiée par l'orthographe du produit dans un autre jeu de données.
 * Toute autre référence inconnue reste non résolue (aucune invention).
 */
export const REFERENCE_ALIASES = {
  PROD_SI5699: {
    target: 'PROD_SI5699?',
    note: "Likely identifier for LOCTITE SI 5699, but it is absent from products.json: no datasheet can be displayed.",
  },
  PROD_PC7226_rebuild: {
    target: null,
    note: "The dataset refers to LOCTITE PC 7226 (rebuild putty). No PC 7226 datasheet exists in products.json.",
  },
};
export const ALIAS_LOOKUP = {
  PROD_SI5699: { canonicalHint: 'LOCTITE SI 5699', targetId: null, note: REFERENCE_ALIASES.PROD_SI5699.note },
  PROD_PC7226_rebuild: { canonicalHint: 'LOCTITE PC 7226', targetId: null, note: REFERENCE_ALIASES.PROD_PC7226_rebuild.note },
};

export function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj)) deepFreeze(v);
  }
  return obj;
}

const norm = (s) => (typeof s === 'string' ? s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '');

export function buildKnowledgeBase(raw) {
  const validation = validateDatasets(raw);
  const data = {};
  for (const ds of Object.keys(DATASET_SCHEMA)) data[ds] = Array.isArray(raw?.[ds]) ? raw[ds] : [];

  const products = data.products.filter((p) => p && p.id && p.name);
  const productById = new Map(products.map((p) => [p.id, p]));
  const missingIds = new Set(validation.issues.missingProducts.map((m) => m.productId));

  /** Résolution d'une référence produit documentée. */
  function resolveRef(id) {
    if (!id || typeof id !== 'string') return null;
    if (productById.has(id)) return { id, product: productById.get(id), resolved: true, kind: 'catalogue' };
    if (missingIds.has(id)) {
      const alias = ALIAS_LOOKUP[id];
      return {
        id,
        product: null,
        resolved: false,
        kind: 'absent_du_catalogue',
        hint: alias?.canonicalHint || null,
        note: alias?.note || "Cited by the documentation but absent from products.json: datasheet unavailable.",
      };
    }
    return { id, product: null, resolved: false, kind: 'unknown', note: 'Product reference unknown to the datasets.' };
  }

  // Index des liens produit -> problèmes / applications / avertissements
  const links = new Map();
  const ensure = (id) => {
    if (!links.has(id)) links.set(id, { problems: [], applications: [], warnings: [], questions: [], comparisons: [], rules: [] });
    return links.get(id);
  };
  products.forEach((p) => ensure(p.id));
  for (const a of data.applications) {
    (a.primary_products || []).forEach((pid, i) => {
      const l = ensure(pid);
      l.applications.push({ id: a.id, title: a.title, subApplication: (a.sub_applications || [])[i] || null });
    });
  }
  for (const pr of data.problems) {
    const sol = pr.recommended_solution || {};
    if (sol.primary_product_id) ensure(sol.primary_product_id).problems.push({ id: pr.id, title: pr.title, role: 'primaire', selection_criteria: pr.selection_criteria });
    (sol.alternative_product_ids || []).forEach((pid) => ensure(pid).problems.push({ id: pr.id, title: pr.title, role: 'alternative', selection_criteria: pr.selection_criteria }));
  }
  for (const w of data.warnings_and_limitations) {
    (w.affected_products || []).forEach((pid) => ensure(pid).warnings.push(w));
  }
  for (const q of data.decision_questions) {
    (q.options || []).forEach((o) => {
      if (o.recommended_product_id) ensure(o.recommended_product_id).questions.push({ questionId: q.question_id, text: q.text, label: o.label });
      (o.alternative_product_ids || []).forEach((pid) => ensure(pid).questions.push({ questionId: q.question_id, text: q.text, label: o.label, role: 'alternative' }));
      if (o.alternative_product_id) ensure(o.alternative_product_id).questions.push({ questionId: q.question_id, text: q.text, label: o.label, role: 'alternative' });
    });
  }
  for (const c of data.comparisons) {
    (c.target_products || []).forEach((pid) => ensure(pid).comparisons.push({ id: c.comparison_id, title: c.title }));
    for (const row of Object.values(c.comparison_matrix || {})) {
      Object.keys(row || {}).forEach((pid) => {
        const list = ensure(pid).comparisons;
        if (!list.some((x) => x.id === c.comparison_id)) list.push({ id: c.comparison_id, title: c.title });
      });
    }
  }
  for (const r of data.selection_rules) {
    (r.decision_tree || []).forEach((b) =>
      Object.entries(b).forEach(([k, v]) => {
        if (/product_id|alternative_id|topcoat_id/i.test(k)) {
          ensure(v).rules.push({ ruleId: r.rule_id, category: r.category, condition: b.if, field: k });
        }
      })
    );
  }

  // Enrichissement (valeurs calculées, jamais présentées comme documentaires)
  const specs = new Map();
  for (const p of products) {
    specs.set(p.id, {
      temp: parseTempRange(p.temp_range),
      gap: parseGap(p.max_gap),
      size: parseSizeLimit(p.max_gap),
      gapFieldNotice: /max_gap/.test('') ? '' : undefined,
    });
  }

  // Questions -> application
  const questionById = new Map(data.decision_questions.map((q) => [q.question_id, q]));
  const ruleById = new Map(data.selection_rules.map((r) => [r.rule_id, r]));
  const appById = new Map(data.applications.map((a) => [a.id, a]));
  const problemById = new Map(data.problems.map((p) => [p.id, p]));
  const refById = new Map(data.source_references.map((s) => [s.ref_id, s]));
  const warningById = new Map(data.warnings_and_limitations.map((w) => [w.warning_id, w]));

  // Index de recherche plein texte
  const searchIndex = products.map((p) => {
    const l = links.get(p.id) || { problems: [], applications: [], warnings: [] };
    const sources = (validation.issues.productSourceHints[p.id] || []).map((rid) => refById.get(rid)).filter(Boolean);
    const keywords = [
      p.name, p.product_code, p.category, CATEGORY_LABELS[p.category], p.chemistry, p.viscosity,
      p.strength, p.color, p.max_gap, p.temp_range, p.cure_time, p.limitations, p.usage_instructions,
      ...(p.approvals || []), ...(p.compatible_materials || []), ...(p.applications || []),
      ...l.problems.map((x) => x.title), ...l.problems.map((x) => x.selection_criteria),
      ...l.applications.map((x) => x.title), ...l.applications.map((x) => x.subApplication),
      ...l.warnings.map((x) => x.title), ...sources.map((s) => `${s.topic} ${s.key_claims_extracted}`),
    ].filter(Boolean).join(' • ');
    return {
      id: p.id,
      name: p.name,
      code: p.product_code,
      category: p.category,
      categoryLabel: CATEGORY_LABELS[p.category] || p.category,
      applicationsTitles: l.applications.map((x) => x.title),
      problemsTitles: [...new Set(l.problems.map((x) => x.title))],
      approvals: p.approvals || [],
      materials: p.compatible_materials || [],
      normalized: norm(keywords),
      tokens: new Set(norm(keywords).split(/[^a-z0-9+./]+/).filter((t) => t.length > 1)),
    };
  });

  // Correspondance structurelle option → application (vérifiée sur les libellés réels)
  const optionApplicationMap = new Map();
  const structuralNotes = [];
  const q1 = questionById.get('Q1_APPLICATION_TYPE');
  if (q1) {
    (q1.options || []).forEach((o, i) => {
      const rule = Q1_OPTION_APPLICATION_RULES.find((r) => r.pattern.test(o.label || ''));
      if (rule && appById.has(rule.applicationId)) {
        optionApplicationMap.set(`${q1.question_id}:${i}`, rule.applicationId);
      } else if (rule) {
        structuralNotes.push(`Option ${i} of ${q1.question_id} ("${o.label}") maps to ${rule.applicationId}, which is absent from applications.json.`);
      } else {
        structuralNotes.push(`Option ${i} of ${q1.question_id} ("${o.label}") has no identifiable matching application.`);
      }
    });
  }
  for (const [qid, appId] of Object.entries(QUESTION_TO_APPLICATION)) {
    if (appId && !appById.has(appId)) structuralNotes.push(`Question ${qid} maps to ${appId}, which is absent from applications.json.`);
  }
  for (const a of data.applications) {
    const hasRule = Boolean(APPLICATION_TO_RULE[a.id] && ruleById.get(APPLICATION_TO_RULE[a.id]));
    const reachable = [...optionApplicationMap.values()].includes(a.id);
    if (!hasRule) structuralNotes.push(`Application ${a.id}: no documented selection rule in selection_rules.json.`);
    if (!reachable) structuralNotes.push(`Application ${a.id}: not reachable from the documented questionnaire (decision_questions.json).`);
  }

  const kb = {
    raw: data,
    structuralNotes,
    validation,
    products,
    productById,
    specs,
    links,
    questionById,
    ruleById,
    appById,
    problemById,
    refById,
    warningById,
    searchIndex,
    aliases: ALIAS_LOOKUP,
    productsByCategory: products.reduce((acc, p) => {
      (acc[p.category] ||= []).push(p);
      return acc;
    }, {}),
    helpers: { norm, cleanText, resolveProductsIn: (ids) => (ids || []).map(resolveRef).filter(Boolean) },
    derive: {
      questionApplication: (qid) => QUESTION_TO_APPLICATION[qid] || null,
      optionApplication: (qid, index) => optionApplicationMap.get(`${qid}:${index}`) || null,
      applicationsWithoutRule: () => data.applications.filter((a) => !(APPLICATION_TO_RULE[a.id] && ruleById.get(APPLICATION_TO_RULE[a.id]))).map((a) => a.id),
      applicationRule: (aid) => (APPLICATION_TO_RULE[aid] ? ruleById.get(APPLICATION_TO_RULE[aid]) || null : null),
      applicationProblem: (aid) => (APPLICATION_TO_PROBLEM[aid] ? problemById.get(APPLICATION_TO_PROBLEM[aid]) || null : null),
      productSources: (pid) => (validation.issues.productSourceHints[pid] || []).map((rid) => refById.get(rid)).filter(Boolean),
    },
  };
  return kb;
}

/** Expansion d'un terme français vers les termes documentés (interface uniquement). */
export function expandTerms(terms) {
  const extra = new Set();
  for (const t of terms) {
    const syn = SEARCH_SYNONYMS[t];
    if (syn) syn.forEach((s) => extra.add(norm(s)));
  }
  return [...extra];
}

/** Recherche pondérée dans l'index (déterministe, sans dépendance externe). */
export function searchKnowledgeBase(kb, query, filters = {}) {
  const q = norm(query).trim();
  const terms = q.split(/\s+/).filter(Boolean);
  const expanded = expandTerms(terms);
  let rows = kb.searchIndex;
  if (filters.category) rows = rows.filter((r) => r.category === filters.category);
  if (filters.application) {
    const app = kb.appById.get(filters.application);
    rows = rows.filter((r) => app && r.applicationsTitles.includes(app.title));
  }
  if (!terms.length) {
    return rows
      .map((r) => ({ ...r, score: 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
  const scored = [];
  for (const row of rows) {
    let score = 0;
    const code = norm(row.code || '');
    const name = norm(row.name || '');
    if (code && terms.every((t) => code.includes(t))) score += 120;
    if (name.includes(q)) score += 80;
    for (const t of terms) {
      if (code === t) score += 150;
      else if (code.includes(t)) score += 60;
      if (name.includes(t)) score += 35;
      if (row.tokens.has(t)) score += 12;
      else if (row.normalized.includes(t)) score += 6;
      if (norm(row.categoryLabel).includes(t)) score += 10;
      if (row.approvals.some((a) => norm(a).includes(t))) score += 8;
    }
    // Termes équivalents français → documentation (pondération volontairement inférieure)
    for (const t of expanded) {
      if (row.tokens.has(t)) score += 9;
      else if (row.normalized.includes(t)) score += 5;
    }
    if (score > 0) {
      const reasons = [];
      if (code && terms.some((t) => code.includes(t))) reasons.push(`code produit ${row.code}`);
      if (terms.some((t) => name.includes(t))) reasons.push('nom du produit');
      if (terms.some((t) => row.tokens.has(t) || row.normalized.includes(t))) reasons.push('description / application / problème');
      if (terms.some((t) => norm(row.categoryLabel).includes(t))) reasons.push('catégorie');
      if (terms.some((t) => row.approvals.some((a) => norm(a).includes(t)))) reasons.push('homologation');
      if (expanded.some((t) => row.tokens.has(t) || row.normalized.includes(t))) reasons.push('terme équivalent (interface FR)');
      scored.push({ ...row, score, matchReasons: [...new Set(reasons)] });
    }
  }
  return scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'));
}
