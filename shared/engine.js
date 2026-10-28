/**
 * MOTEUR DE RECOMMANDATION DÉTERMINISTE
 * ---------------------------------------------------------------------------
 * Évalue les règles documentées (selection_rules.json + decision_questions.json),
 * applique les exclusions et avertissements (warnings_and_limitations.json),
 * vérifie les limites techniques produit et produit une décision TRACÉE.
 *
 * Principe : aucune heuristique de nom, aucun mot-clé ne déclenche une
 * recommandation. Une correspondance exige que TOUTES les conditions
 * documentées d'une branche soient vérifiées par les réponses utilisateur.
 * Les conditions non renseignées restent « inconnues » (jamais « vraies »).
 */
import { parseThreshold, thresholdMatches, parseTempRange, parseGap, cleanText } from './specs.js';
import { CATEGORY_LABELS, QUESTION_TO_APPLICATION, APPLICATION_TO_RULE, APPLICATION_TO_PROBLEM, VALUE_SUBTYPES, VALUE_UNIONS, RULE_BEHAVIOUR } from './config.js';

const norm = (s) =>
  typeof s === 'string'
    ? s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
    : '';

export const STATUS = {
  RECOMMENDATION: 'recommendation',
  CONFLICT: 'conflit_documentaire',
  INSUFFICIENT: 'informations_insuffisantes',
  NO_MATCH: 'aucune_correspondance',
  UNAVAILABLE: 'produit_non_documente',
};

export const CANDIDATE_STATUS = {
  CONFIRMED: 'confirme',
  TENTATIVE: 'a_verifier',
  EXCLUDED: 'exclu',
};

/* ------------------------------------------------------------------------- */
/* Correspondance condition ↔ réponse                                        */
/* ------------------------------------------------------------------------- */

function significantTokens(s) {
  return norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
}

/** Compare une valeur de condition documentée à un fait utilisateur. */
export function matchCondition(condValue, factValue) {
  if (factValue === undefined || factValue === null || factValue === '') return null;
  if (typeof condValue === 'boolean') {
    if (typeof factValue === 'boolean') return condValue === factValue;
    const f = norm(String(factValue));
    if (['oui', 'true', 'yes'].includes(f)) return condValue === true;
    if (['non', 'false', 'no'].includes(f)) return condValue === false;
    return null;
  }
  if (typeof condValue === 'number') {
    const f = Number(factValue);
    return Number.isNaN(f) ? null : Math.abs(f - condValue) < 1e-9;
  }
  const c = String(condValue);
  const f = String(factValue);
  if (norm(c) === norm(f)) return true;

  // Seuil documenté vs valeur numérique mesurée
  const ct = parseThreshold(c);
  const numericFact = typeof factValue === 'number' ? factValue : Number(factValue);
  const isNumeric = factValue !== '' && Number.isFinite(numericFact);
  // Seuil DOCUMENTÉ vs réponse utilisateur : la réponse doit satisfaire STRICTEMENT le seuil.
  // Fallback documentaire unique (QUALITATIVE_THRESHOLDS) : seule valeur de réponse acceptée
  // pour une condition qualitative non numérique (« small »).
  const QUALITATIVE_THRESHOLDS = { small: '< M6' };
  if (ct && isNumeric && (ct.value !== null || ct.op === 'range')) {
    const ftNum = parseThreshold(f);
    if (ftNum && ftNum.op === 'range') {
      // « 0.25 mm to 0.50 mm » : la réponse doit être contenue dans la plage documentée
      return ftNum.min >= ct.min - 1e-9 && ftNum.max <= ct.max + 1e-9;
    }
    const r = thresholdMatches(ct, numericFact);
    if (r !== null) return r;
  }
  const qualitative = QUALITATIVE_THRESHOLDS[norm(c)];
  if (ct && ct.value === null && ct.op !== 'range' && qualitative !== undefined) {
    const ftNum = parseThreshold(f);
    const ctNum = parseThreshold(qualitative);
    if (!ftNum || !ctNum || ftNum.value === null) return false;
    return ctNum.op === '<=' ? ftNum.value <= ctNum.value : true;
  }
  // Union documentée « A_or_B » : chaque segment est une alternative
  const cNorm = norm(c);
  const fNorm0 = norm(f);
  if (cNorm.includes('_or_')) {
    const union = VALUE_UNIONS[c] || cNorm.split('_or_');
    if (union.some((u) => norm(u) === fNorm0 || (VALUE_SUBTYPES[norm(u)] || []).includes(fNorm0))) {
      return true;
    }
    // « rigid_iron_steel_aluminum » ne doit pas satisfaire « rigid_or_flexible » uniquement par le mot « rigid ».
    const decomposed = /^(.+?)_or_(.+)$/.exec(cNorm);
    if (decomposed) {
      const tokenize = (x) => norm(x).split('_').filter((t) => t.length >= 4 && t !== 'metal');
      for (const side of [decomposed[1], decomposed[2]]) {
        if (fNorm0 === side) return true;
        const toks = tokenize(side);
        if (toks.length && toks.every((t) => fNorm0.includes(t))) return true;
      }
    }
  }
  // Hiérarchie de valeurs : une réponse « cas particulier » satisfait la condition générique
  if ((VALUE_SUBTYPES[cNorm] || []).includes(fNorm0)) return true;
  // Correspondance lexicale contrôlée (identifiants normalisés type « press_fit »)
  const cTokens = significantTokens(c);
  const fNorm = norm(f);
  if (cTokens.length && cTokens.every((t) => fNorm.includes(t))) return true;
  return false;
}

/* ------------------------------------------------------------------------- */
/* Saisies utilisateur : spécifications pour l'interface                     */
/* ------------------------------------------------------------------------- */

export const INPUT_SPECS = {
  screw_size: {
    label: 'Fastener size',
    question: 'What size are the fasteners involved?',
    type: 'single',
    options: [
      { value: '< M6', label: 'Small screws (below M6)' },
      { value: 'M6 to M20', label: 'Standard bolts / nuts (M6 to M20)' },
      { value: 'M6 to M20 / studs', label: 'Studs M6 to M20' },
      { value: '> 1 inch / studs', label: 'Large studs / bolts (above 1 inch, above M20)' },
    ],
  },
  disassembly: {
    label: 'Disassembly requirement',
    question: 'How easily must the joint come apart again?',
    type: 'single',
    options: [
      { value: 'easy_hand_tools', label: 'Easy removal with hand tools' },
      { value: 'standard_hand_tools', label: 'Removal with standard hand tools' },
      { value: 'health_safety_no_hazard', label: 'Health & safety formulation (no hazard label)' },
      { value: 'permanent_high_strength', label: 'Permanent high-strength lock' },
      { value: 'permanent_heat_required', label: 'Removal requires localised heat' },
    ],
  },
  assembly_status: {
    label: 'Assembly status',
    question: 'Are the fasteners already assembled and tightened?',
    type: 'single',
    options: [
      { value: 'pre_assembled', label: 'Yes, already assembled and tightened (wicking product)' },
      { value: 'not_assembled', label: 'No, the assembly is still to be made' },
    ],
  },
  thread_type: {
    label: 'Thread type',
    question: 'What kind of thread has to be sealed?',
    type: 'single',
    options: [
      { value: 'fine_hydraulic_pneumatic', label: 'Fine threads, hydraulic / pneumatic fittings' },
      { value: 'coarse_metal', label: 'Coarse metal threads (pipework)' },
    ],
  },
  zero_contamination: {
    label: 'Zero-contamination requirement',
    question: 'Is a “zero fluid contamination” requirement imposed?',
    type: 'boolean',
  },
  medium_strength: {
    label: 'Medium strength',
    question: 'Is a medium-strength (removable) hold required?',
    type: 'boolean',
  },
  high_temp: {
    label: 'High circuit temperature',
    question: 'Does the circuit run at high temperature?',
    type: 'boolean',
  },
  requirement: {
    label: 'Specific requirement',
    question: 'Do immediate pressurisation, potable water, gas or plastic fittings apply?',
    type: 'single',
    options: [
      { value: 'immediate_pressure_or_potable_water_or_gas_or_adjustable', label: 'Immediate pressurisation / potable water / gas / adjustable fitting' },
      { value: 'standard', label: 'None of these requirements' },
    ],
  },
  flange_type: {
    label: 'Flange / joint face type',
    question: 'Which type of joint face has to be sealed?',
    type: 'single',
    options: [
      { value: 'rigid_iron_steel_aluminum', label: 'Rigid cast iron / steel / aluminium flange' },
      { value: 'rigid_metal', label: 'Rigid metal flange, high temperature' },
      { value: 'stamped_sheet_metal_flexible', label: 'Stamped sheet metal or flexible joint face' },
      { value: 'rigid_or_flexible', label: 'Rigid or flexible (health & safety formulation)' },
    ],
  },
  gap: {
    label: 'Gap to fill',
    question: 'What is the gap between the surfaces to be sealed?',
    type: 'threshold',
    unit: 'mm',
    options: [
      { value: 0.25, label: '≤ 0.25 mm' },
      { value: 1, label: '0.25 mm to 1 mm' },
      { value: 3, label: 'up to 3 mm' },
    ],
  },
  high_adhesion: {
    label: 'High adhesion',
    question: 'Is high adhesion on sheet metal needed?',
    type: 'boolean',
  },
  health_safety_no_hazard: {
    label: 'Formulation with no hazard label',
    question: 'Is a health & safety formulation (no hazard label) required?',
    type: 'boolean',
  },
  fit_type: {
    label: 'Fit type',
    question: 'What is the fit type of the cylindrical assembly?',
    type: 'single',
    options: [
      { value: 'press_fit', label: 'Press fit (interference)' },
      { value: 'slip_fit', label: 'Slip fit' },
      { value: 'slip_fit_or_worn_keyway', label: 'Slip fit on a worn seat / keyway' },
      { value: 'worn_shaft_housing_large_rebuild', label: 'Heavily worn shaft or housing (rebuild)' },
    ],
  },
  radial_gap: {
    label: 'Measured radial gap',
    question: 'What radial (or lateral) gap was measured?',
    type: 'threshold',
    unit: 'mm',
    options: [
      { value: 0.1, label: '≤ 0.15 mm' },
      { value: 0.2, label: '0.15 mm to 0.25 mm' },
      { value: 0.4, label: '0.25 mm to 0.50 mm' },
      { value: 0.8, label: '> 0.50 mm' },
    ],
  },
  temp_resistance: {
    label: 'Required temperature resistance',
    question: 'Is resistance up to 204 °C (400 °F) required?',
    type: 'single',
    options: [
      { value: 'up to 204 C (400 F)', label: 'Yes, up to 204 °C' },
      { value: 'standard', label: 'No, standard resistance is enough' },
    ],
  },
  temp: {
    label: 'Continuous service temperature',
    question: 'What is the continuous service temperature of the application?',
    type: 'threshold',
    unit: '°C',
    options: [
      { value: 120, label: '≤ 150 °C' },
      { value: 180, label: '150 °C to 204 °C' },
      { value: 260, label: '> 204 °C' },
    ],
  },
  material: {
    label: 'Fitting material',
    question: 'What material are the threads to be sealed?',
    type: 'single',
    options: [
      { value: 'stainless_steel_or_all_metals', label: 'Stainless steel / all metals' },
      { value: 'general_metal_except_stainless', label: 'General metal (except stainless)' },
      { value: 'plastic', label: 'Plastic / thermoplastic' },
    ],
  },
  wear_severity: {
    label: 'Wear severity',
    question: 'What kind of wear is observed?',
    type: 'single',
    options: [
      { value: 'deep_volute_casing_wear', label: 'Deep volute / pump casing wear' },
      { value: 'fine_abrasion_or_impeller_restoration', label: 'Fine abrasion / impeller restoration' },
    ],
  },
  particle_size: {
    label: 'Particle size / wear mechanism',
    question: 'Which wear mechanism dominates?',
    type: 'single',
    options: [
      { value: 'coarse_or_cavitation', label: 'Coarse particles or cavitation' },
      { value: 'fine', label: 'Fine particles' },
    ],
  },
  finish: {
    label: 'Required finish',
    question: 'Is a smooth, low-friction finish required?',
    type: 'single',
    options: [
      { value: 'high_gloss_low_friction', label: 'Yes, high-gloss low-friction finish' },
      { value: 'standard', label: 'No' },
    ],
  },
  environment: {
    label: 'Fluid environment',
    question: 'What chemical environment does the application involve?',
    type: 'single',
    options: [
      { value: 'extreme_chemical_acid_sulfuric_attack', label: 'Severe chemical attack / sulphuric acid' },
      { value: 'standard', label: 'Standard environment' },
    ],
  },
  operatingEnv: {
    label: 'Fluid and safety environment',
    question: 'Does the application involve a fluid with a specific safety requirement?',
    type: 'single',
    options: [
      { value: 'none', label: 'No particular hazard (oil, water, air, hydraulic fluid)' },
      { value: 'oxygen', label: 'Pure oxygen / gaseous chlorine / strong oxidiser' },
      { value: 'plastic_threads', label: 'Threads on thermoplastics (ABS, PC, PVC…)' },
      { value: 'unknown', label: 'I do not know' },
    ],
  },
  materialGroup: {
    label: 'Substrate type',
    question: 'Which materials are being joined?',
    type: 'single',
    options: [
      { value: 'metal', label: 'Metal / metal' },
      { value: 'plastic', label: 'Plastic / composite' },
      { value: 'mixed', label: 'Metal + plastic' },
      { value: 'unknown', label: 'I do not know' },
    ],
  },
};

export const KEY_TO_QUESTION_HINT = {
  screw_size: 'Q2_THREADLOCKING_SIZE',
  disassembly: 'Q2_THREADLOCKING_SIZE',
  assembly_status: 'Q2_THREADLOCKING_SIZE',
  thread_type: 'Q2_THREAD_SEALING_PARAM',
  flange_type: 'Q2_GASKETING_TYPE',
  gap: 'Q2_GASKETING_TYPE',
  fit_type: 'Q2_RETAINING_GAP',
  radial_gap: 'Q2_RETAINING_GAP',
  wear_severity: 'Q2_PUMP_WEAR_TYPE',
  particle_size: 'Q2_PUMP_WEAR_TYPE',
};

/* ------------------------------------------------------------------------- */
/* Évaluation des règles                                                     */
/* ------------------------------------------------------------------------- */

/**
 * @returns {{branchIndex:number, if:object, status:'match'|'partial'|'fail', satisfied:string[], failed:string[], unknown:string[], thenProductId:string|null, alternativeId:string|null, topcoatId:string|null}|null}
 */
export function evaluateBranch(branch, ctx, ruleId = null) {
  const cond = branch.if || {};
  const satisfied = [];
  const failed = [];
  const unknown = [];
  const substitutions = [];
  const substitutes = (ruleId && RULE_BEHAVIOUR[ruleId]?.genericSubstitutes) || [];
  for (const [key, val] of Object.entries(cond)) {
    const fact = resolveFact(key, ctx);
    const res = matchCondition(val, fact.value);
    if (res === null) unknown.push(key);
    else if (res === true) satisfied.push(key);
    else {
      // Substitution documentée : valeur générique acceptée pour cette règle uniquement
      const sub = substitutes.find((x) => x.key === key && x.branchValue === val && x.acceptedAnswer === fact.value);
      if (sub) {
        satisfied.push(key);
        substitutions.push({ key, branchValue: val, answer: fact.value, reason: sub.reason });
      } else failed.push(key);
    }
  }
  const status = failed.length ? 'fail' : unknown.length ? 'partial' : 'match';
  return {
    if: cond,
    status,
    satisfied,
    failed,
    unknown,
    substitutions,
    thenProductId: branch.then_product_id || null,
    alternativeId: branch.alternative_id || null,
    topcoatId: branch.then_topcoat_id || null,
  };
}

/** Valeur « fait » disponible pour une clé de condition. */
export function resolveFact(key, ctx) {
  const a = ctx.answers || {};
  if (key === 'temp') {
    if (a.operatingTempC !== undefined && a.operatingTempC !== null && a.operatingTempC !== '') {
      const n = Number(a.operatingTempC);
      return { value: Number.isFinite(n) ? n : null, origin: 'entered service temperature' };
    }
    return { value: null, origin: 'not provided' };
  }
  if (key === 'temp_resistance') {
    const v = a.temp_resistance;
    if (!v || v === 'standard') return { value: v === 'standard' ? 'standard' : null, origin: 'exigence utilisateur' };
    return { value: v, origin: 'exigence utilisateur' };
  }
  if (key === 'radial_gap' || key === 'gap') {
    const raw = key === 'radial_gap' ? a.radialGapMm : a.gapMm;
    if (raw !== undefined && raw !== null && raw !== '') {
      const n = Number(raw);
      return { value: Number.isFinite(n) ? n : null, origin: 'mesure utilisateur' };
    }
    return { value: null, origin: 'not provided' };
  }
  const value = a[key];
  return { value: value === undefined ? null : value, origin: 'user answer' };
}

export function evaluateRule(rule, ctx) {
  const branches = (rule.decision_tree || []).map((b, i) => ({ branchIndex: i, ...evaluateBranch(b, ctx, rule.rule_id) }));
  const matches = branches.filter((b) => b.status === 'match');
  const partials = branches.filter((b) => b.status === 'partial');
  return {
    ruleId: rule.rule_id,
    category: rule.category,
    condition: rule.condition,
    branches,
    matches,
    partials,
    /** Produits cibles distincts parmi les branches intégralement satisfaites. */
    matchedProducts: [...new Set(matches.map((m) => m.thenProductId).filter(Boolean))],
    ambiguity: new Set(matches.map((m) => m.thenProductId).filter(Boolean)).size > 1,
  };
}

/* ------------------------------------------------------------------------- */
/* Contexte de sélection                                                     */
/* ------------------------------------------------------------------------- */

export function buildContext(kb, selection = {}) {
  const answers = { ...(selection.answers || {}) };
  // Question d'entrée (Q1) : sert uniquement à déterminer l'application documentée
  const entryQuestion = selection.entryQuestionId ? kb.questionById.get(selection.entryQuestionId) : null;
  const entryOption = entryQuestion && Number.isInteger(selection.entryOptionIndex)
    ? entryQuestion.options?.[selection.entryOptionIndex] || null
    : null;
  // Dérivation des faits à partir de l'option de question documentée choisie
  const q = selection.questionId ? kb.questionById.get(selection.questionId) : null;
  const option = q && Number.isInteger(selection.optionIndex) ? q.options?.[selection.optionIndex] : null;
  const structuralWarning = { code: null, label: null };
  const derived = option ? deriveFactsFromOption(selection.questionId, option) : {};
  Object.entries(derived).forEach(([k, v]) => {
    if (answers[k] === undefined) answers[k] = v;
  });
  let applicationId = selection.applicationId || null;
  if (!applicationId && entryQuestion && Number.isInteger(selection.entryOptionIndex)) {
    applicationId = kb.derive.optionApplication(entryQuestion.question_id, selection.entryOptionIndex);
    if (!applicationId) structuralWarning.label = entryOption?.label || null;
  }
  if (!applicationId && selection.questionId) {
    if (selection.questionId === 'Q1_APPLICATION_TYPE' && Number.isInteger(selection.optionIndex)) {
      applicationId = kb.derive.optionApplication(selection.questionId, selection.optionIndex);
      if (!applicationId) {
        const optLabel = kb.questionById.get(selection.questionId)?.options?.[selection.optionIndex]?.label;
        structuralWarning.label = optLabel || null;
      }
    } else {
      applicationId = QUESTION_TO_APPLICATION[selection.questionId] || null;
    }
  }
  return {
    kb,
    selection,
    question: q,
    option,
    entryQuestion,
    entryOption,
    answers,
    applicationId,
    problemId: selection.problemId || null,
    structuralWarning: applicationId ? null : structuralWarning,
  };
}

/** Traduit une option documentée (anglais) en faits comparables aux conditions de règles. */
export function deriveFactsFromOption(questionId, option) {
  const label = norm(option?.label || '');
  const facts = {};
  if (questionId === 'Q2_THREADLOCKING_SIZE') {
    const isPreAssembled = /already assembled|deja assemble|deja serre/.test(label);
    if (isPreAssembled) facts.assembly_status = 'pre_assembled';
    if (/<\s*m6|small screws/.test(label)) facts.screw_size = '< M6';
    else if (/m6 to m20|m6-m20/.test(label)) {
      facts.screw_size = /green formula|health|no hazard|sans etiquette/.test(label) ? 'M6 to M20' : 'M6 to M20';
      if (/permanent|high-strength|permanent high-strength/.test(label) && /stud/.test(label)) facts.screw_size = 'M6 to M20 / studs';
    } else if (/> 1 inch|> m20|large studs|1 inch/.test(label)) facts.screw_size = '> 1 inch / studs';
    if (/easy hand tool|easy hand/.test(label)) facts.disassembly = 'easy_hand_tools';
    else if (/standard hand tool/.test(label)) {
      facts.disassembly = /no hazard|health|green/.test(label) ? 'health_safety_no_hazard' : 'standard_hand_tools';
    } else if (/permanent high-strength|permanent high strength/.test(label)) facts.disassembly = 'permanent_high_strength';
    else if (/permanent/.test(label)) facts.disassembly = 'permanent_heat_required';
    else if (/green formula|no hazard|health/.test(label)) facts.disassembly = 'health_safety_no_hazard';
  }
  if (questionId === 'Q2_THREAD_SEALING_PARAM') {
    if (/fine threads|hydraulic/.test(label)) { facts.thread_type = 'fine_hydraulic_pneumatic'; facts.zero_contamination = true; }
    if (/coarse metal/.test(label)) { facts.thread_type = 'coarse_metal'; facts.medium_strength = true; }
    if (/stainless/.test(label)) { facts.material = 'stainless_steel_or_all_metals'; facts.high_temp = true; }
    if (/immediate pressure|potable|gas|plastic/.test(label)) facts.requirement = 'immediate_pressure_or_potable_water_or_gas_or_adjustable';
    if (/plastic/.test(label)) facts.material = 'plastic';
  }
  if (questionId === 'Q2_GASKETING_TYPE') {
    const gapMatch = label.match(/gap\s*(?:<=|≤|up to)?\s*(\d+(?:[.,]\d+)?)\s*mm/);
    if (gapMatch) facts.gap = Number(gapMatch[1].replace(',', '.'));
    const tempMatch = label.match(/up to\s*(\d+)\s*°\s*c/);
    if (tempMatch && facts.operatingTempC === undefined) facts.statedMaxTempC = Number(tempMatch[1]);
    if (/stamped|flexible/.test(label)) {
      facts.flange_type = 'stamped_sheet_metal_flexible';
      if (facts.gap === undefined) facts.gap = 3;
      facts.high_adhesion = true;
    } else if (/high temperature|204/.test(label)) {
      facts.flange_type = 'rigid_metal';
      facts.high_temp_service = true;
    } else if (/health|eco-formulation|no hazard/.test(label)) {
      facts.flange_type = 'rigid_or_flexible';
      facts.health_safety_no_hazard = true;
    } else if (/rigid cast iron|rigid/.test(label)) {
      facts.flange_type = 'rigid_iron_steel_aluminum';
    }
  }
  if (questionId === 'Q2_RETAINING_GAP') {
    if (/press fit/.test(label)) { facts.fit_type = 'press_fit'; facts.radialGapMm = 0.05; }
    else if (/tight clearance/.test(label)) { facts.fit_type = 'slip_fit'; facts.radialGapMm = 0.15; }
    else if (/standard clearance/.test(label)) { facts.fit_type = 'slip_fit'; facts.radialGapMm = 0.25; }
    else if (/keyway|large gap/.test(label)) { facts.fit_type = 'slip_fit_or_worn_keyway'; facts.radialGapMm = 0.5; }
    else if (/badly worn|metal rebuild/.test(label)) { facts.fit_type = 'worn_shaft_housing_large_rebuild'; facts.radialGapMm = 0.8; }
  }
  if (questionId === 'Q2_PUMP_WEAR_TYPE') {
    if (/volute|erosion|cavitation/.test(label)) { facts.wear_severity = 'deep_volute_casing_wear'; facts.particle_size = 'coarse_or_cavitation'; }
    else if (/impeller|topcoat/.test(label)) { facts.wear_severity = 'fine_abrasion_or_impeller_restoration'; facts.finish = 'high_gloss_low_friction'; }
    else if (/chemical|sulfuric/.test(label)) facts.environment = 'extreme_chemical_acid_sulfuric_attack';
  }
  return facts;
}

/* ------------------------------------------------------------------------- */
/* Vérifications produit (limites, avertissements)                           */
/* ------------------------------------------------------------------------- */

export function applicableWarnings(kb, productId, answers = {}) {
  const list = (kb.links.get(productId)?.warnings || []).map((w) => ({ ...w, trigger: 'produit' }));
  const env = answers.operatingEnv;
  if (env === 'oxygen') {
    for (const w of kb.raw.warnings_and_limitations) {
      if (w.warning_id === 'WARN_OXYGEN_OXIDIZERS' && (w.affected_products || []).includes(productId) && !list.some((x) => x.warning_id === w.warning_id)) {
        list.push({ ...w, trigger: 'answer: oxygen / oxidiser' });
      }
    }
  }
  if (env === 'plastic_threads') {
    for (const w of kb.raw.warnings_and_limitations) {
      if (w.warning_id === 'WARN_PLASTIC_THREAD_ATTACK' && (w.affected_products || []).includes(productId) && !list.some((x) => x.warning_id === w.warning_id)) {
        list.push({ ...w, trigger: 'answer: thermoplastic thread' });
      }
    }
  }
  return list;
}

/** Contrôles « durs » issus de données documentaires (température, jeu, sécurité). */
export function productChecks(kb, product, answers = {}) {
  const checks = [];
  const spec = kb.specs.get(product.id) || {};
  const temp = spec.temp || parseTempRange(product.temp_range);
  const gap = spec.gap || parseGap(product.max_gap);

  // Température de service
  const hasExplicitTemp = answers.operatingTempC !== undefined && answers.operatingTempC !== null && answers.operatingTempC !== '';
  if (hasExplicitTemp) {
    const t = Number(answers.operatingTempC);
    if (temp.parseable) {
      if (t > temp.maxC) {
        checks.push({ severity: 'exclusion', type: 'TEMP_MAX', message: `Service temperature ${t} °C is above the documented limit (${product.temp_range}).` });
      } else if (t < temp.minC) {
        checks.push({ severity: 'exclusion', type: 'TEMP_MIN', message: `Service temperature ${t} °C is below the documented limit (${product.temp_range}).` });
      } else {
        checks.push({ severity: 'ok', type: 'TEMP_OK', message: `Service temperature ${t} °C is inside the documented range (${product.temp_range}).` });
      }
    } else {
      checks.push({ severity: 'verifier', type: 'TEMP_UNKNOWN', message: `The documented temperature range for ${product.name} ("${product.temp_range || 'not documented'}") cannot be used numerically: manual verification required.` });
    }
  } else if (answers.statedMaxTempC) {
    if (temp.parseable && answers.statedMaxTempC > temp.maxC) {
      checks.push({ severity: 'exclusion', type: 'TEMP_MAX', message: `Service announced up to ${answers.statedMaxTempC} °C, which exceeds the documented limit (${product.temp_range}).` });
    } else if (temp.parseable) {
      checks.push({ severity: 'verifier', type: 'TEMP_STATED', message: `Service announced up to ${answers.statedMaxTempC} °C: the documented range (${product.temp_range}) covers this value, but it must be confirmed against the real process.` });
    }
  } else {
    checks.push({ severity: 'info', type: 'TEMP_NOT_PROVIDED', message: `No service temperature given: the documented range (${product.temp_range || 'not documented'}) must be checked against the process.` });
  }

  // Jeu radial / interstitiel
  const measuredGap = answers.radialGapMm ?? answers.gapMm;
  if (measuredGap !== undefined && measuredGap !== null && measuredGap !== '') {
    const g = Number(measuredGap);
    if (gap.parseable && gap.mm !== null) {
      if (g > gap.mm + 1e-9) {
        checks.push({ severity: 'exclusion', type: 'GAP_MAX', message: `Stated gap ${g} mm is larger than the documented maximum gap (${product.max_gap}).` });
      } else {
        checks.push({ severity: 'ok', type: 'GAP_OK', message: `Stated gap ${g} mm is compatible with the documented maximum gap (${product.max_gap}).` });
      }
    } else {
      checks.push({ severity: 'verifier', type: 'GAP_UNKNOWN', message: `The documented maximum gap for ${product.name} ("${product.max_gap || 'not documented'}") is not numeric: automatic comparison is not possible.` });
    }
  }

  // Sécurité : oxygène / oxydants
  if (answers.operatingEnv === 'oxygen') {
    const w = kb.raw.warnings_and_limitations.find((x) => x.warning_id === 'WARN_OXYGEN_OXIDIZERS');
    if (w && (w.affected_products || []).includes(product.id)) {
      checks.push({ severity: 'exclusion', type: 'SAFETY_OXYGEN', message: `Critical warning "${w.title}": use is PROHIBITED on pure oxygen, gaseous chlorine or strong oxidisers.` });
    }
  }
  // Sécurité : thermoplastiques
  if (answers.operatingEnv === 'plastic_threads') {
    const w = kb.raw.warnings_and_limitations.find((x) => x.warning_id === 'WARN_PLASTIC_THREAD_ATTACK');
    if (w && (w.affected_products || []).includes(product.id)) {
      checks.push({ severity: 'exclusion', type: 'PLASTIC_CRACK', message: `Warning "${w.title}": risk of stress cracking on thermoplastics (ABS, PC, PVC).` });
    }
  }

  // Exigence de tenue 204 °C (règle RETAINING)
  if (answers.temp_resistance === 'up to 204 C (400 F)' && temp.parseable && temp.maxC < 200) {
    checks.push({ severity: 'exclusion', type: 'TEMP_REQ', message: `Resistance up to 204 °C requested, but the documented range is ${product.temp_range}.` });
  }

  // Préparation de surface obligatoire
  const needPrep = kb.raw.warnings_and_limitations.find((w) => w.warning_id === 'WARN_SURFACE_PREP_SA25');
  if (needPrep && (needPrep.affected_products || []).includes(product.id)) {
    checks.push({ severity: 'precaution', type: 'SURFACE_PREP', message: 'Surface preparation is mandatory: degreasing plus SA 2.5 abrasive blasting before application.' });
  }
  return checks;
}

/* ------------------------------------------------------------------------- */
/* Évaluation complète                                                       */
/* ------------------------------------------------------------------------- */

export function resolveProduct(kb, productId) {
  if (!productId) return null;
  const product = kb.productById.get(productId);
  if (product) return { id: productId, product, resolved: true, kind: 'catalogue' };
  const missing = kb.validation.issues.missingProducts.find((m) => m.productId === productId);
  const alias = (kb.aliases || {})[productId] || null;
  return {
    id: productId,
    product: null,
    resolved: false,
    kind: 'absent_du_catalogue',
    hint: alias?.canonicalHint || inferHint(productId),
    note: alias?.note || 'Cited by the documentation but absent from products.json: no datasheet can be displayed.',
    references: missing?.references || [],
  };
}

function inferHint(productId) {
  const m = /^PROD_(.+)$/.exec(productId || '');
  if (!m) return null;
  return m[1].replace(/_/g, ' ').replace(/(\d)([A-Za-z])/g, '$1 $2').toUpperCase();
}

/**
 * Point d'entrée unique du moteur.
 * @param kb base de connaissances construite par buildKnowledgeBase()
 * @param selection { problemId?, applicationId?, questionId?, optionIndex?, answers? }
 */
export function assess(kb, selection = {}) {
  const ctx = buildContext(kb, selection);
  const answers = ctx.answers;
  const trace = [];
  const addTrace = (step, detail, meta = {}) => trace.push({ step, detail, ...meta });

  const applicationId = ctx.applicationId;
  const app = applicationId ? kb.appById.get(applicationId) : null;
  const rule = app ? kb.derive.applicationRule(applicationId) : null;
  const problem = ctx.problemId ? kb.problemById.get(ctx.problemId) : (applicationId ? kb.derive.applicationProblem(applicationId) : null);

  addTrace('context', `Application: ${app ? app.title : 'not determined'}${problem ? ` • Documented problem: ${problem.title}` : ''}`);
  if (ctx.entryQuestion && ctx.entryOption) {
    addTrace('entry question', `${ctx.entryQuestion.question_id} → "${ctx.entryOption.label}"${app ? ` (application ${app.id})` : ''}.`, { questionId: ctx.entryQuestion.question_id });
  }

  /* --- 1. Candidats : règle documentée ------------------------------- */
  let ruleEval = null;
  const candidates = new Map();
  const primaryIds = new Set();
  const addCandidate = (pid, role, origin) => {
    if (!pid) return;
    const existing = candidates.get(pid);
    if (!existing) candidates.set(pid, { productId: pid, role, origin, origins: [origin] });
    else {
      existing.origins.push(origin);
      if (existing.role !== 'primaire' && role === 'primaire') { existing.role = role; existing.origin = origin; }
    }
    if (role === 'primaire') primaryIds.add(pid);
  };

  if (rule) {
    ruleEval = evaluateRule(rule, ctx);
    addTrace(
      'rule',
      `${rule.rule_id} — ${rule.condition}. Branches satisfied: ${ruleEval.matches.length}, partial: ${ruleEval.partials.length}.`,
      { ruleId: rule.rule_id }
    );
    for (const m of ruleEval.matches) {
      addCandidate(m.thenProductId, 'primaire', { type: 'rule', ruleId: rule.rule_id, branchIndex: m.branchIndex, if: m.if });
      addCandidate(m.alternativeId, 'alternative', { type: 'rule', ruleId: rule.rule_id, branchIndex: m.branchIndex, field: 'alternative_id' });
      addCandidate(m.topcoatId, 'alternative', { type: 'rule', ruleId: rule.rule_id, branchIndex: m.branchIndex, field: 'then_topcoat_id' });
    }
  }

  /* --- 2. Option de question documentée ------------------------------ */
  if (ctx.option?.recommended_product_id) {
    addCandidate(ctx.option.recommended_product_id, 'primaire', {
      type: 'question_option',
      questionId: ctx.question.question_id,
      optionLabel: ctx.option.label,
    });
    addTrace('answer', `Selected option: "${ctx.option.label}" → ${ctx.option.recommended_product_id} (documented mapping of ${ctx.question.question_id}).`);
    (ctx.option.alternative_product_ids || []).forEach((pid) => addCandidate(pid, 'alternative', { type: 'question_option', questionId: ctx.question.question_id }));
    if (ctx.option.alternative_product_id) addCandidate(ctx.option.alternative_product_id, 'alternative', { type: 'question_option' });
  }

  /* --- 3. Problème documenté (solution recommandée) ------------------ */
  if (problem?.recommended_solution?.primary_product_id) {
    const sol = problem.recommended_solution;
    addCandidate(sol.primary_product_id, 'primaire', { type: 'problem', problemId: problem.id });
    addTrace('problem', `Documented solution for the problem "${problem.title}" → ${sol.primary_product_id}${sol.alternative_product_ids?.length ? ` (alternatives: ${sol.alternative_product_ids.join(', ')})` : ''}.`);
    (sol.alternative_product_ids || []).forEach((pid) => addCandidate(pid, 'alternative', { type: 'problem', problemId: problem.id }));
  }

  /* --- 4. Application (produits phares documentés) -------------------- */
  if (app) {
    (app.primary_products || []).forEach((pid, i) => {
      addCandidate(pid, 'application', {
        type: 'application',
        applicationId: app.id,
        subApplication: (app.sub_applications || [])[i] || null,
      });
    });
  }

  /* --- 4 bis. Branches documentées PARTIELLES (condition non renseignée) ---
     Aucune correspondance n'est confirmée à partir de ces branches : les produits sont
     proposés à VÉRIFICATION. L'utilisateur répond à la condition manquante (ex. type de
     joint pour « gap: small ») ; sans cette réponse, la branche ne peut pas être tranchée. */
  if (ruleEval && ruleEval.matches.length === 0 && ruleEval.partials.length) {
    for (const par of ruleEval.partials) {
      const origin = { type: 'rule_partial', ruleId: rule.rule_id, branchIndex: par.branchIndex, if: par.if, unknown: par.unknown };
      [par.thenProductId, par.alternativeId, par.topcoatId].forEach((pid) => addCandidate(pid, 'primaire', origin));
    }
    addTrace('partial branches', `${ruleEval.partials.length} documented branch(es) only partly answered: the products are proposed for verification (no confirmed match).`);
    // Les produits désignés par la liste « produits phares » de l'application restent disponibles
    // comme alternatives documentées, et non comme candidats principaux.
    if (app) {
      for (const [pid, cand] of candidates) {
        if (cand.role === 'application' && cand.origin?.type === 'application') cand.role = 'alternative';
      }
    }
  }

  /* --- 5. Évaluation de chaque candidat ------------------------------ */
  const evaluated = [];
  for (const cand of candidates.values()) {
    const resolution = resolveProduct(kb, cand.productId);
    if (!resolution) continue;
    if (!resolution.resolved) {
      evaluated.push({
        ...cand,
        resolution,
        status: CANDIDATE_STATUS.TENTATIVE,
        unavailable: true,
        checks: [],
        warnings: [],
        reasons: ['Cited by the documentation but absent from the product catalogue: no datasheet is available to support a recommendation for this product.'],
        sources: [],
      });
      continue;
    }
    const p = resolution.product;
    const checks = productChecks(kb, p, answers);
    const warnings = applicableWarnings(kb, p.id, answers);
    const excluded = checks.filter((c) => c.severity === 'exclusion');
    const mustVerify = checks.filter((c) => c.severity === 'verifier');
    const structureOnly = cand.origin?.type === 'rule_partial' || cand.origin?.type === 'application';
    const status = excluded.length
      ? CANDIDATE_STATUS.EXCLUDED
      : mustVerify.length || structureOnly ? CANDIDATE_STATUS.TENTATIVE : CANDIDATE_STATUS.CONFIRMED;
    evaluated.push({
      ...cand,
      resolution,
      status,
      unavailable: false,
      checks,
      warnings,
      reasons: buildReasons(kb, p, cand, checks, ruleEval, ctx),
      sources: kb.derive.productSources(p.id),
    });
  }

  /* --- 5 bis. Invariant : produit documenté absent du catalogue -------
     Si une source documentaire désigne un produit principal qui n'existe pas dans
     products.json, aucune correspondance ne peut être présentée comme confirmée :
     tous les candidats résolus passent en « à vérifier ». */
  const hasUnavailablePrimary = evaluated.some((c) => c.unavailable && c.role === 'primaire');
  if (hasUnavailablePrimary) {
    for (const c of evaluated) {
      if (!c.unavailable && c.status === CANDIDATE_STATUS.CONFIRMED) {
        c.status = CANDIDATE_STATUS.TENTATIVE;
        c.reasons.push('Match not confirmed: the product named by the documented rule is not in the product catalogue.');
      }
    }
  }

  /* --- 6. Conflits documentaires ------------------------------------- */
  const conflicts = [];
  if (ruleEval) {
    if (ruleEval.matches.length === 0 && ruleEval.partials.length === 0) {
      conflicts.push({
        type: 'AUCUNE_BRANCHE',
        ruleId: ruleEval.ruleId,
        message: `No branch of rule ${ruleEval.ruleId} is compatible with the answers provided.`,
        detail: ruleEval.branches.map((b) => ({ if: b.if, failed: b.failed })).filter((b) => b.failed.length),
      });
    }
    if (new Set(ruleEval.matches.map((m) => m.thenProductId).filter(Boolean)).size > 1) {
      conflicts.push({
        type: 'AMBIGUITE_BRANCHES',
        ruleId: ruleEval.ruleId,
        message: `Several documented branches of ${ruleEval.ruleId} are satisfied at the same time and lead to different products.`,
        branches: ruleEval.matches.map((m) => ({ if: m.if, product: m.thenProductId })),
      });
    }
  }
  const evaluatedById = new Map(evaluated.map((c) => [c.productId, c]));
  const usablePrimaries = [...candidates.values()].filter((c) => {
    if (c.role !== 'primaire') return false;
    const ev = evaluatedById.get(c.productId);
    return ev && !ev.unavailable && ev.status !== CANDIDATE_STATUS.EXCLUDED;
  });
  if (usablePrimaries.length > 1) {
    conflicts.push({
      type: 'DIVERGENCE_SOURCES',
      message: `The documented sources lead to different primary products: ${usablePrimaries.map((c) => `${c.productId} (${sourceLabel(c.origin)})`).join(' · ')}.`,
      detail: usablePrimaries.map((c) => ({ product: c.productId, origin: c.origin })),
    });
  }
  const excludedPrimaries = evaluated.filter((c) => c.role === 'primaire' && (c.status === CANDIDATE_STATUS.EXCLUDED || c.unavailable));

  /* --- 7. Produit principal retenu + repli --------------------------- */
  const notExcluded = evaluated.filter((c) => !c.unavailable && c.status !== CANDIDATE_STATUS.EXCLUDED);
  const byRole = (role) => notExcluded.filter((c) => c.role === role);
  let primaryCandidate = byRole('primaire')[0] || byRole('alternative')[0] || byRole('application')[0] || null;
  const documentedPrimaryExcluded = evaluated.filter((c) => c.role === 'primaire' && c.status === CANDIDATE_STATUS.EXCLUDED);
  const documentedPrimaryUnavailable = evaluated.filter((c) => c.role === 'primaire' && c.unavailable);
  const fallback = Boolean(primaryCandidate && !primaryIds.has(primaryCandidate.productId) && (documentedPrimaryExcluded.length || documentedPrimaryUnavailable.length));
  if (fallback) {
    addTrace('fallback', `Documented primary product unavailable or excluded; documented alternative retained: ${primaryCandidate.productId}.`);
    if (primaryCandidate.status === CANDIDATE_STATUS.CONFIRMED) {
      primaryCandidate = { ...primaryCandidate, status: CANDIDATE_STATUS.TENTATIVE, reasons: [...primaryCandidate.reasons, 'Product retained as a fallback: the match does not come from the directly applicable documented branch.'] };
    }
  }

  /* --- 8. Informations manquantes ------------------------------------ */
  const missingInfo = computeMissingInfo(kb, { rule, ruleEval, answers, app, problem, ctx });
  const blockingMissing = missingInfo.filter((m) => m.blocking);

  /* --- 9. Références non résolues ------------------------------------ */
  const unresolvedRefs = evaluated.filter((c) => c.unavailable).map((c) => c.resolution);

  /* --- 10. Statut global --------------------------------------------- */
  let status = STATUS.RECOMMENDATION;
  const structuralGap = !rule && !ctx.option?.recommended_product_id && !problem;
  const allUnavailable = evaluated.length > 0 && evaluated.every((c) => c.unavailable);
  if (structuralGap) {
    status = evaluated.length ? STATUS.INSUFFICIENT : STATUS.NO_MATCH;
  } else if (!evaluated.length) {
    status = STATUS.NO_MATCH;
  } else if (!notExcluded.length) {
    const anyAvailableExcluded = evaluated.some((c) => !c.unavailable);
    status = evaluated.some((c) => c.unavailable) && !anyAvailableExcluded ? STATUS.UNAVAILABLE
      : evaluated.some((c) => c.unavailable) ? STATUS.UNAVAILABLE
      : STATUS.NO_MATCH;
  } else if (conflicts.some((c) => c.type === 'AMBIGUITE_BRANCHES')) {
    status = STATUS.CONFLICT;
  } else if (hasUnavailablePrimary || primaryCandidate.status !== CANDIDATE_STATUS.CONFIRMED || blockingMissing.length || fallback) {
    status = STATUS.INSUFFICIENT;
  }
  const confidence = status === STATUS.RECOMMENDATION ? 'confirme' : primaryCandidate ? 'a_verifier' : 'aucune';

  const escalation = buildEscalation({
    status,
    conflicts,
    missingInfo,
    unresolvedRefs,
    primaryCandidate,
    structuralWarning: ctx.structuralWarning || null,
    ruleEval,
    app,
    fallback,
    documentedPrimaryExcluded,
  });

  return {
    status,
    application: app ? { id: app.id, title: app.title, description: app.description, subApplications: app.sub_applications || [] } : null,
    problem: problem ? {
      id: problem.id,
      title: problem.title,
      symptoms: problem.symptoms,
      root_cause: problem.root_cause,
      selection_criteria: problem.selection_criteria,
      procedure: problem.recommended_solution?.procedure,
    } : null,
    rule: ruleEval ? {
      ruleId: ruleEval.ruleId,
      category: ruleEval.category,
      condition: ruleEval.condition,
      branches: ruleEval.branches,
      matches: ruleEval.matches,
    } : null,
    primary: primaryCandidate,
    confidence,
    excludedPrimaries: excludedPrimaries.map((c) => ({ productId: c.productId, origin: c.origin, unavailable: c.unavailable, checks: c.checks })),
    fallback,
    candidates: notExcluded,
    excluded: evaluated.filter((c) => c.status === CANDIDATE_STATUS.EXCLUDED),
    unavailable: evaluated.filter((c) => c.unavailable),
    missingInfo,
    blockingMissing,
    conflicts,
    unresolvedRefs,
    structuralWarning: ctx.structuralWarning || null,
    structuralGap,
    escalation,
    answers,
    entry: ctx.entryQuestion && ctx.entryOption
      ? { questionId: ctx.entryQuestion.question_id, optionIndex: ctx.selection.entryOptionIndex, label: ctx.entryOption.label, next: ctx.entryOption.next || null, nextExists: ctx.entryOption.next ? kb.questionById.has(ctx.entryOption.next) : null }
      : null,
    trace,
    sourceRefs: collectSources(kb, evaluated, ruleEval),
  };
}


function sourceLabel(origin) {
  if (!origin) return 'unknown source';
  if (origin.type === 'rule') return `rule ${origin.ruleId}`;
  if (origin.type === 'question_option') return `option ${origin.questionId}`;
  if (origin.type === 'problem') return `problem ${origin.problemId}`;
  if (origin.type === 'application') return `application ${origin.applicationId}`;
  return origin.type;
}


function buildReasons(kb, product, cand, checks, ruleEval, ctx) {
  const reasons = [];
  if (cand.origin?.type === 'rule') {
    const branch = (kb.ruleById.get(cand.origin.ruleId)?.decision_tree || [])[cand.origin.branchIndex] || {};
    const condText = Object.entries(branch.if || {}).map(([k, v]) => `${INPUT_SPECS[k]?.label || k} = ${v}`).join(' AND ');
    reasons.push(`Branch ${cand.origin.branchIndex + 1} of rule ${cand.origin.ruleId} satisfied: ${condText || 'no condition'}.`);
  }
  if (cand.origin?.type === 'question_option') {
    reasons.push(`Documented option "${cand.origin.optionLabel}" (${cand.origin.questionId}) mapped to ${product.name}.`);
  }
  if (cand.origin?.type === 'problem') {
    const prob = kb.problemById.get(cand.origin.problemId);
    if (prob) reasons.push(`Recommended solution for the documented problem "${prob.title}"${prob.selection_criteria ? ` — criterion: ${prob.selection_criteria}` : ''}`);
  }
  for (const c of checks) {
    if (c.severity === 'ok') reasons.push(c.message);
  }
  if (cand.role === 'alternative') reasons.push('Documented alternative: prefer it if the conditions shown below match the requirement more closely.');
  return reasons;
}

/* ------------------------------------------------------------------------- */
/* Informations manquantes + questions dynamiques                            */
/* ------------------------------------------------------------------------- */

export const KEY_ORDER = [
  'screw_size', 'disassembly', 'assembly_status',
  'thread_type', 'material', 'zero_contamination', 'medium_strength', 'high_temp', 'requirement',
  'flange_type', 'gap', 'high_adhesion', 'health_safety_no_hazard',
  'fit_type', 'radial_gap', 'temp_resistance',
  'wear_severity', 'particle_size', 'finish', 'environment',
  'temp', 'operatingEnv', 'materialGroup',
];


const ENV_RELEVANT = new Set(['Threadlocking', 'Thread Sealing', 'Gasketing', 'Retaining', 'Retaining / Repair']);

/**
 * Calcule les informations manquantes en trois niveaux :
 *  - blocking : sans cette réponse, la règle documentée ne peut pas départager les candidats
 *  - verification : utile pour confirmer la correspondance (température, jeu mesuré)
 *  - safety : vérification imposée par un avertissement critique
 */
function computeMissingInfo(kb, { rule, ruleEval, answers, app, problem, ctx }) {
  const missing = [];
  if (ruleEval) {
    const keys = new Set();
    const noConclusiveBranch = ruleEval.matches.length === 0;
    if (noConclusiveBranch) for (const b of ruleEval.partials) b.unknown.forEach((k) => keys.add(k));
    for (const k of keys) {
      const spec = INPUT_SPECS[k];
      if (!spec) continue;
      const blocking = ruleEval.partials.filter((b) => b.unknown.includes(k)).map((b) => b.thenProductId).filter(Boolean);
      missing.push({
        key: k,
        label: spec.label,
        question: spec.question,
        type: spec.type,
        options: spec.options || null,
        unit: spec.unit || null,
        questionId: KEY_TO_QUESTION_HINT[k] || null,
        blocking: true,
        couldResolve: [...new Set(blocking)],
        reason: `A documented criterion of rule ${ruleEval.ruleId} has not been answered: without it, several branches remain open.`,
      });
    }
    if (ruleEval.matches.length === 0 && ruleEval.partials.length === 0) {
      missing.push({
        key: '__conflicting__',
        label: 'Values incompatible with the documented rule',
        question: 'The answers provided rule out every documented branch. Check the values you entered (temperature, gap) or consult an IDS specialist.',
        type: 'notice',
        options: null,
        blocking: true,
        reason: `No branch of ${ruleEval.ruleId} is satisfied.`,
      });
    }
  }
  // Vérifications complémentaires (non bloquantes mais nécessaires à la confirmation)
  const hasTemp = (answers.operatingTempC !== undefined && answers.operatingTempC !== null && answers.operatingTempC !== '') || Boolean(answers.statedMaxTempC);
  const tempDocs = rule ? JSON.stringify((rule.decision_tree || []).map((b) => b.if)).includes('temp') : false;
  if (!hasTemp && (tempDocs || (ruleEval && ruleEval.matches.length))) {
    const spec = INPUT_SPECS.temp;
    missing.push({
      key: 'temp',
      label: 'Continuous service temperature',
      question: spec.question,
      type: 'threshold',
      unit: '°C',
      options: spec.options,
      blocking: false,
      reason: 'Lets us check the documented temperature range of every candidate product.',
    });
  }
  const category = ruleEval ? kb.ruleById.get(ruleEval.ruleId)?.category : null;
  if (category && ENV_RELEVANT.has(category) && !answers.operatingEnv) {
    const spec = INPUT_SPECS.operatingEnv;
    missing.push({
      key: 'operatingEnv',
      label: spec.label,
      question: spec.question,
      type: spec.type,
      options: spec.options,
      blocking: false,
      safety: true,
      reason: 'Verification required by the critical warnings (oxygen / oxidisers, thermoplastics).',
    });
  }
  if (ctx.structuralWarning?.label) {
    missing.push({
      key: '__structural__',
      label: 'No documented questionnaire for this branch',
      question: `No rule and no follow-up question are documented for "${ctx.structuralWarning.label}".`,
      type: 'notice',
      options: null,
      blocking: true,
      reason: 'decision_questions.json et selection_rules.json ne couvrent pas cette application.',
    });
  }
  const seen = new Set();
  return missing
    .filter((m) => (seen.has(m.key) ? false : (seen.add(m.key), true)))
    .sort((a, b) => {
      if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
      return KEY_ORDER.indexOf(a.key) - KEY_ORDER.indexOf(b.key);
    });
}

export function buildEscalation({
  status, conflicts, missingInfo, unresolvedRefs, primaryCandidate,
  structuralWarning, ruleEval, app, fallback, documentedPrimaryExcluded,
}) {
  const triggers = [];
  for (const c of conflicts.filter((x) => x.type !== 'DIVERGENCE_SOURCES')) triggers.push(c.message);
  if (unresolvedRefs.length) {
    triggers.push(`Product reference(s) missing from the catalogue: ${unresolvedRefs.map((u) => `${u.id}${u.hint ? ` (${u.hint})` : ''}`).join(', ')}.`);
  }
  if (structuralWarning?.label) {
    triggers.push(`Branch without selection data: "${structuralWarning.label}". No documented rule in selection_rules.json for this option.`);
  }
  const blocking = missingInfo.filter((m) => m.blocking && m.key !== '__structural__');
  if (blocking.length) {
    triggers.push(`Documented criterion/criteria missing: ${blocking.map((m) => m.label).join(', ')}.`);
  }
  if (documentedPrimaryExcluded?.length) {
    triggers.push(`Documented primary product excluded by its own limits: ${documentedPrimaryExcluded.map((c) => `${c.productId} (${c.checks.filter((x) => x.severity === 'exclusion').map((x) => x.message).join(' ')})`).join(' · ')}. ${fallback ? 'A documented alternative is proposed and must be confirmed technically.' : ''}`.trim());
  }
  if (status === STATUS.NO_MATCH) {
    triggers.push('No product in the catalogue satisfies all the documented criteria provided.');
  }
  if (status === STATUS.UNAVAILABLE) {
    triggers.push('The product(s) named by the documented rules are not in the product catalogue: no datasheet can be displayed or confirmed.');
  }
  if (status === STATUS.INSUFFICIENT && !ruleEval) {
    triggers.push('No documented selection rule exists for this application: the list of documented products is not a recommendation.');
  }
  if (primaryCandidate && primaryCandidate.status === CANDIDATE_STATUS.TENTATIVE && !triggers.length) {
    triggers.push('Match not confirmed: at least one technical value must be verified before approval (see the points to check).');
  }
  // Vérifications non bloquantes sur le produit retenu (température, jeu, préparation de surface)
  const verifications = [];
  if (primaryCandidate && !primaryCandidate.unavailable) {
    (primaryCandidate.checks || []).filter((c) => c.severity === 'verifier').forEach((c) => verifications.push(c.message));
    missingInfo.filter((m) => !m.blocking).forEach((m) => verifications.push(`Criterion not answered, to be confirmed: ${m.label}.`));
  }
  for (const v of verifications) if (!triggers.includes(v)) triggers.push(v);
  const required = triggers.length > 0;
  const hardProblem = conflicts.some((c) => c.type !== 'DIVERGENCE_SOURCES')
    || Boolean(structuralWarning?.label)
    || status === STATUS.NO_MATCH
    || status === STATUS.UNAVAILABLE
    || missingInfo.some((m) => m.blocking);
  return {
    required,
    level: required ? (hardProblem ? 'escalade' : 'verification') : 'aucune',
    triggers,
    contact: {
      team: 'IDS technical team',
      label: 'Send the case to an IDS technical specialist',
    },
  };
}

export function collectSources(kb, evaluated, ruleEval) {
  const map = new Map();
  const add = (ref) => { if (ref && !map.has(ref.ref_id)) map.set(ref.ref_id, ref); };
  for (const c of evaluated) (c.sources || []).forEach(add);
  if (ruleEval) sourcesForRule(kb, ruleEval).forEach(add);
  return [...map.values()];
}

export function sourcesForRule(kb, ruleEval) {
  const refs = new Map();
  const productIds = new Set();
  for (const b of ruleEval.branches) {
    if (b.thenProductId) productIds.add(b.thenProductId);
    if (b.alternativeId) productIds.add(b.alternativeId);
  }
  for (const pid of productIds) {
    (kb.validation.issues.productSourceHints[pid] || []).forEach((rid) => {
      const ref = kb.refById.get(rid);
      if (ref) refs.set(ref.ref_id, ref);
    });
  }
  return [...refs.values()];
}

/* ------------------------------------------------------------------------- */
/* Prochaine question du parcours guidé (documenté)                          */
/* ------------------------------------------------------------------------- */

export function nextDocumentedQuestion(kb, selection = {}) {
  const q = selection.questionId ? kb.questionById.get(selection.questionId) : null;
  const option = q && Number.isInteger(selection.optionIndex) ? q.options?.[selection.optionIndex] : null;
  if (option?.next) {
    const next = kb.questionById.get(option.next);
    if (next) return { asked: true, question: next, brokenNext: null };
    return { asked: true, question: null, brokenNext: { from: q.question_id, next: option.next, label: option.label } };
  }
  return { asked: true, question: null, brokenNext: null };
}
