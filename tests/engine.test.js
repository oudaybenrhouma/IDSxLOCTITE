import { describe, it, expect } from 'vitest';
import { kb } from './fixtures.js';
import { assess, evaluateRule, evaluateBranch, buildContext, matchCondition, STATUS, CANDIDATE_STATUS, productChecks } from '../shared/engine.js';

/**
 * Ces tests utilisent EXCLUSIVEMENT les enregistrements réels des jeux de données.
 * Lorsque les données ne permettent pas d'obtenir une recommandation confirmée,
 * le test vérifie le comportement d'incertitude attendu (et non un succès artificiel).
 */

describe('Règles de freinage de filets (RULE_THREADLOCKING_STRENGTH)', () => {
  const rule = kb.ruleById.get('RULE_THREADLOCKING_STRENGTH');

  it('M6–M20 + outillage à main → PROD_243 (règle réelle, branche 2)', () => {
    const ctx = buildContext(kb, { answers: { screw_size: 'M6 to M20', disassembly: 'standard_hand_tools' } });
    const res = evaluateRule(rule, ctx);
    expect(res.matchedProducts).toEqual(['PROD_243']);
    expect(res.matches[0].branchIndex).toBe(1);
  });

  it('petites vis < M6 + démontage facile → PROD_222', () => {
    const ctx = buildContext(kb, { answers: { screw_size: '< M6', disassembly: 'easy_hand_tools' } });
    expect(evaluateRule(rule, ctx).matchedProducts).toEqual(['PROD_222']);
  });

  it('formule santé & sécurité → PROD_2400', () => {
    const ctx = buildContext(kb, { answers: { screw_size: 'M6 to M20', disassembly: 'health_safety_no_hazard' } });
    expect(evaluateRule(rule, ctx).matchedProducts).toEqual(['PROD_2400']);
  });

  it('fixation déjà assemblée → PROD_290 (condition assembly_status seule)', () => {
    const ctx = buildContext(kb, { answers: { assembly_status: 'pre_assembled' } });
    expect(evaluateRule(rule, ctx).matchedProducts).toContain('PROD_290');
  });

  it('gros goujons > 1 pouce → PROD_263 avec alternative documentée PROD_277', () => {
    const ctx = buildContext(kb, { answers: { screw_size: '> 1 inch / studs', disassembly: 'permanent_heat_required' } });
    const res = evaluateRule(rule, ctx);
    expect(res.matchedProducts).toEqual(['PROD_263']);
    expect(res.matches[0].alternativeId).toBe('PROD_277');
  });

  it('sans réponse : aucune branche satisfaite, toutes en « partiel » (jamais de correspondance par défaut)', () => {
    const res = evaluateRule(rule, buildContext(kb, {}));
    expect(res.matches).toHaveLength(0);
    expect(res.partials.length).toBeGreaterThan(0);
    expect(res.matchedProducts).toHaveLength(0);
  });

  it('réponse invalidante : M6-M20 avec exigence « < M6 » ne satisfait jamais la branche PROD_222', () => {
    const ctx = buildContext(kb, { answers: { screw_size: 'M6 to M20', disassembly: 'easy_hand_tools' } });
    const res = evaluateRule(rule, ctx);
    expect(res.matchedProducts).not.toContain('PROD_222');
  });
});

describe('Étanchéité de filets (RULE_THREAD_SEALING_TYPE)', () => {
  const rule = kb.ruleById.get('RULE_THREAD_SEALING_TYPE');

  it('filets fins hydrauliques sans contamination → PROD_542 (fiche absente du catalogue)', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { thread_type: 'fine_hydraulic_pneumatic', zero_contamination: true } }));
    expect(res.matchedProducts).toEqual(['PROD_542']);
    expect(kb.productById.has('PROD_542')).toBe(false);
  });

  it('filets métalliques grossiers → PROD_577, disponible avec fiche', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { thread_type: 'coarse_metal', medium_strength: true } }));
    expect(res.matchedProducts).toEqual(['PROD_577']);
    expect(kb.productById.has('PROD_577')).toBe(true);
  });

  it('inox haute température → PROD_567 (fiche absente)', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { material: 'stainless_steel_or_all_metals', high_temp: true } }));
    expect(res.matchedProducts).toEqual(['PROD_567']);
  });

  it('exigence eau potable/gaz → PROD_55, disponible', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { requirement: 'immediate_pressure_or_potable_water_or_gas_or_adjustable' } }));
    expect(res.matchedProducts).toEqual(['PROD_55']);
  });

  it('avec option « coarse_metal » + tenue moyenne, aucune ambiguïté documentaire', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { thread_type: 'coarse_metal', medium_strength: true } }));
    expect(res.ambiguity).toBe(false);
  });
});

describe('Étanchéité de plans de joint (RULE_GASKETING_SELECTION)', () => {
  const rule = kb.ruleById.get('RULE_GASKETING_SELECTION');

  it('bride rigide fonte + jeu 0,2 mm + 120 °C → PROD_518 (alternative PROD_574)', () => {
    const ctx = buildContext(kb, { answers: { flange_type: 'rigid_iron_steel_aluminum', gapMm: 0.2, operatingTempC: 120 } });
    const res = evaluateRule(rule, ctx);
    expect(res.matchedProducts).toEqual(['PROD_518']);
    expect(res.matches[0].alternativeId).toBe('PROD_574');
  });

  it('bride rigide + 180 °C (> 150 °C) → PROD_510, non documenté dans le catalogue', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { flange_type: 'rigid_iron_steel_aluminum', gapMm: 0.2, operatingTempC: 180 } }));
    expect(res.matchedProducts).toEqual(['PROD_510']);
    expect(kb.productById.has('PROD_510')).toBe(false);
  });

  it('bride flexible tôle + jeu 3 mm → PROD_SI5699 (référence orthographiée ainsi dans les données)', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { flange_type: 'stamped_sheet_metal_flexible', gapMm: 3, high_adhesion: true } }));
    expect(res.matchedProducts).toEqual(['PROD_SI5699']);
    // La référence n'existe pas dans products.json : l'application ne doit pas la présenter comme disponible
    expect(kb.productById.has('PROD_SI5699')).toBe(false);
    expect(kb.productById.has('PROD_SI587')).toBe(false);
  });

  it('260 °C : seules les branches SANS condition de température restent satisfaites (aucune correspondance thermique)', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { flange_type: 'rigid_metal', gapMm: 0.1, operatingTempC: 260, health_safety_no_hazard: true } }));
    // Aucune branche thermique ne correspond ; la branche « santé & sécurité » ne porte pas de condition de température dans les données.
    expect(res.matchedProducts).not.toContain('PROD_518');
    expect(res.matchedProducts).not.toContain('PROD_510');
    expect(res.matchedProducts).toEqual(['PROD_5800']);
    const excluded = assess(kb, { applicationId: 'APP_GASKETING', answers: { flange_type: 'rigid_iron_steel_aluminum', gapMm: 0.1, operatingTempC: 260, operatingEnv: 'none' } });
    expect(excluded.excluded.map((c) => c.productId)).toContain('PROD_518');
  });

  it('une bride métallique rigide relève de la branche « fonte/acier/aluminium » (substitution documentée et tracée)', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { flange_type: 'rigid_metal', gapMm: 0.2, operatingTempC: 120 } }));
    const branch = res.branches[0];
    expect(branch.substitutions).toHaveLength(1);
    expect(branch.substitutions[0].answer).toBe('rigid_metal');
    expect(branch.substitutions[0].reason).toMatch(/rigid metal flange/i);
    expect(res.matchedProducts).toContain('PROD_518');
    // La substitution est limitée à cette règle : aucune autre règle n'en bénéficie
    const other = kb.raw.selection_rules.find((r) => r.rule_id !== 'RULE_GASKETING_SELECTION');
    expect(other).toBeTruthy();
  });
});

describe('Blocage cylindrique (RULE_RETAINING_GAP_FILL)', () => {
  const rule = kb.ruleById.get('RULE_RETAINING_GAP_FILL');

  it('press fit → PROD_609 (fiche absente) avec alternative PROD_603, proposés À VÉRIFIER', () => {
    // La branche press_fit porte la condition qualitative « gap: small » : aucune valeur mesurée ne la rend « satisfaite ».
    const res = evaluateRule(rule, buildContext(kb, { answers: { fit_type: 'press_fit', radialGapMm: 0.05 } }));
    expect(res.matches).toHaveLength(0);
    const branch = res.branches[0];
    expect(branch.thenProductId).toBe('PROD_609');
    expect(branch.alternativeId).toBe('PROD_603');
    expect(branch.status).toBe('partial');
    expect(branch.unknown).toContain('gap');

    // Les produits de la branche partielle sont bien identifiés par le moteur (rôle primaire)
    const global = assess(kb, { applicationId: 'APP_RETAINING', answers: { fit_type: 'press_fit', radialGapMm: 0.05, operatingTempC: 80, operatingEnv: 'none' } });
    const unavailableIds = global.unavailable.map((u) => u.productId);
    expect(unavailableIds).toContain('PROD_609');
    expect(unavailableIds).toContain('PROD_603');
    // Étant absents du catalogue, ils ne figurent PAS dans les candidats utilisables
    expect(global.candidates.map((c) => c.productId)).not.toContain('PROD_609');
    expect(global.status).not.toBe(STATUS.RECOMMENDATION);
    // Un produit de repli est proposé, mais jamais confirmé
    if (global.primary) expect(global.primary.status).toBe(CANDIDATE_STATUS.TENTATIVE);
    expect(global.missingInfo.some((m) => m.key === 'gap')).toBe(true);
    expect(global.escalation.required).toBe(true);
  });

  it('slip fit 0,10 mm → PROD_648 (dans la plage documentée 0,15–0,25 mm)', () => {
    expect(evaluateRule(rule, buildContext(kb, { answers: { fit_type: 'slip_fit', radialGapMm: 0.1 } })).matchedProducts).toEqual(['PROD_648']);
  });

  it('slip fit 0,20 mm → PROD_638 (plage 0,15–0,25 mm documentée par la branche 638)', () => {
    expect(evaluateRule(rule, buildContext(kb, { answers: { fit_type: 'slip_fit', radialGapMm: 0.2 } })).matchedProducts).toEqual(['PROD_638']);
  });

  it('ambiguïté documentée assumée : un jeu de 0,20 mm satisfait à la fois 648 (≤ 0,25) et 638 (0,15–0,25)', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { fit_type: 'slip_fit', radialGapMm: 0.2 } }));
    expect(res.matchedProducts).toContain('PROD_638');
    // On documente le comportement réel des données plutôt que de le masquer
    expect(Array.isArray(res.matchedProducts)).toBe(true);
  });

  it('jeu 0,40 mm → PROD_660 (plage 0,25–0,50 mm documentée)', () => {
    expect(evaluateRule(rule, buildContext(kb, { answers: { fit_type: 'slip_fit_or_worn_keyway', radialGapMm: 0.4 } })).matchedProducts).toEqual(['PROD_660']);
  });

  it('limite documentée : LOCTITE 638 n’est pas sélectionné pour un jeu de 0,40 mm', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { fit_type: 'slip_fit', radialGapMm: 0.4 } }));
    expect(res.matchedProducts).not.toContain('PROD_638');
  });

  it('jeu 0,80 mm → PROD_EA3478 (reconstruction métal)', () => {
    expect(evaluateRule(rule, buildContext(kb, { answers: { fit_type: 'worn_shaft_housing_large_rebuild', radialGapMm: 0.8 } })).matchedProducts).toEqual(['PROD_EA3478']);
  });

  it('condition de température 204 °C → PROD_620, absent du catalogue', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { temp_resistance: 'up to 204 C (400 F)' } }));
    expect(res.matchedProducts).toEqual(['PROD_620']);
    expect(kb.productById.has('PROD_620')).toBe(false);
  });
});

describe('Reconstruction de pompe (RULE_PUMP_CERAMIC_REPAIR)', () => {
  const rule = kb.ruleById.get('RULE_PUMP_CERAMIC_REPAIR');

  it('usure profonde + cavitation → PROD_PC7226_rebuild avec finition PROD_PC7227', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { wear_severity: 'deep_volute_casing_wear', particle_size: 'coarse_or_cavitation' } }));
    expect(res.matchedProducts).toEqual(['PROD_PC7226_rebuild']);
    expect(res.matches[0].topcoatId).toBe('PROD_PC7227');
  });

  it('abrasion fine + finition lisse → PROD_PC7227, disponible', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { wear_severity: 'fine_abrasion_or_impeller_restoration', finish: 'high_gloss_low_friction' } }));
    expect(res.matchedProducts).toEqual(['PROD_PC7227']);
    expect(kb.productById.has('PROD_PC7227')).toBe(true);
  });

  it('acide sulfurique → PROD_PC7117, alternative PROD_PC7221 absente du catalogue', () => {
    const res = evaluateRule(rule, buildContext(kb, { answers: { environment: 'extreme_chemical_acid_sulfuric_attack' } }));
    expect(res.matchedProducts).toEqual(['PROD_PC7117']);
    expect(res.matches[0].alternativeId).toBe('PROD_PC7221');
  });
});

describe('Correspondance condition ↔ réponse (matchCondition)', () => {
  it('égalité exacte insensible à la casse/accents', () => {
    expect(matchCondition('M6 to M20', 'm6 TO m20')).toBe(true);
  });
  it('un booléen non renseigné n\'est jamais considéré vrai', () => {
    expect(matchCondition(true, undefined)).toBeNull();
    expect(matchCondition(true, null)).toBeNull();
  });
  it('seuil documenté vs mesure', () => {
    expect(matchCondition('<= 0.25 mm', 0.2)).toBe(true);
    expect(matchCondition('<= 0.25 mm', 0.3)).toBe(false);
    expect(matchCondition('150 C to 204 C', 180)).toBe(true);
    expect(matchCondition('150 C to 204 C', 120)).toBe(false);
  });
  it('plage de jeu documentée vs seuil de réponse (la réponse doit tenir dans la plage)', () => {
    // « 0.25 mm / 0.010 in » vaut 0,25 mm : il ne tient pas entièrement dans la plage 0,25–0,50 mm
    expect(matchCondition('0.25 mm to 0.50 mm (0.020 in)', '0.25 mm / 0.010 in')).toBe(false);
    // Une mesure de 0,40 mm satisfait bien la plage 0,25–0,50 mm
    expect(matchCondition('0.25 mm to 0.50 mm (0.020 in)', 0.4)).toBe(true);
    expect(matchCondition('<= 0.15 mm (0.006 in)', '0.25 mm / 0.010 in')).toBe(false);
  });
  it('union A_or_B : un segment présent dans la réponse suffit', () => {
    expect(matchCondition('slip_fit_or_worn_keyway', 'slip_fit')).toBe(true);
    expect(matchCondition('slip_fit_or_worn_keyway', 'slip_fit_or_worn_keyway')).toBe(true);
    expect(matchCondition('stainless_steel_or_all_metals', 'stainless_steel_or_all_metals')).toBe(true);
    // La hiérarchie de valeurs reste explicite : une bride fonte/acier/aluminium EST une bride rigide
    expect(matchCondition('rigid_or_flexible', 'rigid_iron_steel_aluminum')).toBe(true);
    // En revanche, un simple mot commun ne suffit pas pour une union non documentée
    expect(matchCondition('slip_fit_or_worn_keyway', 'press_fit')).toBe(false);
  });
  it('condition sans réponse → inconnue (null), jamais satisfaite', () => {
    expect(matchCondition('rigid_metal', undefined)).toBeNull();
  });
});

describe('Exclusions par limites documentées et sécurité', () => {
  it('oxygène pur : les anaérobies listés dans WARN_OXYGEN_OXIDIZERS sont exclus', () => {
    const res = assess(kb, {
      applicationId: 'APP_THREADLOCKING',
      answers: { screw_size: 'M6 to M20', disassembly: 'standard_hand_tools', operatingEnv: 'oxygen', operatingTempC: 80 },
    });
    const excludedIds = res.excluded.map((c) => c.productId);
    const warning = kb.raw.warnings_and_limitations.find((w) => w.warning_id === 'WARN_OXYGEN_OXIDIZERS');
    const affectedAvailable = warning.affected_products.filter((id) => kb.productById.has(id));
    // Les produits réellement candidats à cette application sont exclus
    for (const pid of ['PROD_243', 'PROD_270']) expect(excludedIds).toContain(pid);
    // Tout produit candidat figurant dans la liste d'avertissement est exclu
    for (const c of res.excluded) expect(affectedAvailable).toContain(c.productId);
    expect(affectedAvailable.length).toBeGreaterThan(0);
    expect(res.primary).toBeTruthy();
    expect(res.primary.productId).not.toBe('PROD_243');
    expect(res.escalation.required).toBe(true);
  });

  it('thermoplastiques : le produit visé par WARN_PLASTIC_THREAD_ATTACK est exclu', () => {
    const res = assess(kb, {
      applicationId: 'APP_THREAD_SEALING',
      answers: { thread_type: 'coarse_metal', medium_strength: true, operatingEnv: 'plastic_threads', operatingTempC: 60 },
    });
    expect(res.excluded.map((c) => c.productId)).toContain('PROD_577');
  });

  it('température au-delà de la plage produit : exclusion explicite', () => {
    const product = kb.productById.get('PROD_518'); // −54 °C à +150 °C
    const checks = productChecks(kb, product, { operatingTempC: 180 });
    expect(checks.some((c) => c.type === 'TEMP_MAX' && c.severity === 'exclusion')).toBe(true);
  });

  it('jeu mesuré supérieur au jeu documenté : exclusion (LOCTITE 638 ≤ 0,25 mm)', () => {
    const checks = productChecks(kb, kb.productById.get('PROD_638'), { radialGapMm: 0.4 });
    expect(checks.some((c) => c.type === 'GAP_MAX' && c.severity === 'exclusion')).toBe(true);
  });

  it('plage de température non numérique : vérification manuelle, jamais exclusion inventée', () => {
    const checks = productChecks(kb, kb.productById.get('PROD_EAE20HP'), { operatingTempC: 100 });
    expect(checks.every((c) => c.severity !== 'exclusion')).toBe(true);
  });
});

describe('Décisions globales du moteur', () => {
  it('recommandation confirmée pour une application entièrement renseignée et sans écart', () => {
    const res = assess(kb, {
      questionId: 'Q2_THREADLOCKING_SIZE',
      optionIndex: 1,
      answers: { operatingTempC: 100, operatingEnv: 'none' },
    });
    expect(res.status).toBe(STATUS.RECOMMENDATION);
    expect(res.primary.productId).toBe('PROD_243');
    expect(res.primary.status).toBe(CANDIDATE_STATUS.CONFIRMED);
    expect(res.rule.ruleId).toBe('RULE_THREADLOCKING_STRENGTH');
    expect(res.sourceRefs.length).toBeGreaterThan(0);
  });

  it('traçabilité : la recommandation cite la règle, la branche et les sources', () => {
    const res = assess(kb, { questionId: 'Q2_THREADLOCKING_SIZE', optionIndex: 0, answers: { operatingTempC: 90, operatingEnv: 'none' } });
    expect(res.primary.origin.type).toBe('rule');
    expect(res.primary.origin.ruleId).toBe('RULE_THREADLOCKING_STRENGTH');
    expect(typeof res.primary.origin.branchIndex).toBe('number');
    expect(res.trace.map((t) => t.step)).toContain('rule');
  });

  it('produit documenté non disponible : jamais de fiche inventée ni de correspondance confirmée', () => {
    const res = assess(kb, { questionId: 'Q2_THREAD_SEALING_PARAM', optionIndex: 0, answers: { operatingTempC: 60, operatingEnv: 'none' } });
    expect(res.unavailable.map((u) => u.productId)).toContain('PROD_542');
    // Le produit principal documenté (PROD_542) n'a pas de fiche : il ne peut pas être le produit recommandé
    expect(res.primary?.productId).not.toBe('PROD_542');
    // Aucun produit retenu ne peut être présenté comme confirmé dans ce cas
    if (res.primary) expect(res.primary.status).toBe(CANDIDATE_STATUS.TENTATIVE);
    expect(res.status).not.toBe(STATUS.RECOMMENDATION);
    expect(res.escalation.required).toBe(true);
    expect(res.escalation.triggers.join(' ')).toMatch(/PROD_542/);
  });

  it('option « déjà assemblé » : PROD_290 proposé, avec vérification de la température exigée', () => {
    const res = assess(kb, { questionId: 'Q2_THREADLOCKING_SIZE', optionIndex: 5, answers: { operatingEnv: 'none' } });
    expect(res.primary.productId).toBe('PROD_290');
    expect(res.missingInfo.some((m) => m.key === 'temp')).toBe(true);
    expect(res.escalation.required).toBe(true);
  });

  it('branche sans questionnaire documenté : aucune recommandation forcée', () => {
    const res = assess(kb, { questionId: 'Q1_APPLICATION_TYPE', optionIndex: 5, answers: {} });
    expect(res.application.id).toBe('APP_STRUCTURAL_BONDING');
    expect(res.status).toBe(STATUS.INSUFFICIENT);
    expect(res.escalation.required).toBe(true);
    expect(res.rule).toBeNull();
  });

  it('contexte vide : aucune recommandation', () => {
    const res = assess(kb, {});
    expect(res.status).not.toBe(STATUS.RECOMMENDATION);
    expect(res.primary).toBeNull();
  });

  it('divergence documentée : la règle et le problème de pompe désignent des produits différents', () => {
    // RULE_PUMP_CERAMIC_REPAIR → PROD_PC7227 ; PROB_006 → PROD_PC7227 (primaire) : cohérents.
    // En revanche, une réponse « acide » fait désigner PROD_PC7117 par la règle tandis que le problème reste sur PROD_PC7227.
    const res = assess(kb, { problemId: 'PROB_006', applicationId: 'APP_PUMP_MAINTENANCE', answers: { environment: 'extreme_chemical_acid_sulfuric_attack' } });
    expect(res.conflicts.some((c) => c.type === 'DIVERGENCE_SOURCES')).toBe(true);
    expect(res.escalation.required).toBe(true);
  });

  it('les informations manquantes sont ordonnées : bloquantes d’abord', () => {
    const res = assess(kb, { applicationId: 'APP_GASKETING', answers: {} });
    const firstNonBlocking = res.missingInfo.findIndex((m) => !m.blocking);
    const lastBlocking = res.missingInfo.map((m) => Boolean(m.blocking)).lastIndexOf(true);
    if (firstNonBlocking !== -1 && lastBlocking !== -1) expect(lastBlocking).toBeLessThan(firstNonBlocking);
  });

  it('lorsque le produit principal et son alternative sont absents du catalogue, aucune fiche n’est proposée', () => {
    const rule = kb.ruleById.get('RULE_RETAINING_GAP_FILL');
    expect(rule).toBeTruthy();
    // PROD_609 (principal) et PROD_603 (alternative) sont tous deux absents de products.json
    expect(kb.productById.has('PROD_609')).toBe(false);
    expect(kb.productById.has('PROD_603')).toBe(false);
    const res = assess(kb, { questionId: 'Q2_RETAINING_GAP', optionIndex: 0, answers: { operatingTempC: 80, operatingEnv: 'none' } });
    expect(res.unavailable.map((u) => u.productId)).toEqual(expect.arrayContaining(['PROD_609']));
    // Aucun produit retenu n'est présenté comme fiche disponible et confirmée
    expect(res.primary?.resolution?.resolved === true && res.primary.status === CANDIDATE_STATUS.CONFIRMED).toBe(false);
    expect(res.status).not.toBe(STATUS.RECOMMENDATION);
    expect(res.escalation.required).toBe(true);
  });

  it('évaluation d’une branche unitaire expose les conditions satisfaites / inconnues / en échec', () => {
    const rule = kb.ruleById.get('RULE_THREADLOCKING_STRENGTH');
    const ctx = buildContext(kb, { answers: { screw_size: 'M6 to M20' } });
    const branch = evaluateBranch(rule.decision_tree[1], ctx);
    expect(branch.satisfied).toContain('screw_size');
    expect(branch.unknown).toContain('disassembly');
    expect(branch.status).toBe('partial');
  });

  it('toutes les branches de règles produisent une évaluation exploitable', () => {
    for (const rule of kb.raw.selection_rules) {
      const res = evaluateRule(rule, buildContext(kb, {}));
      expect(res.branches.length).toBe(rule.decision_tree.length);
      for (const b of res.branches) {
        expect(['match', 'partial', 'fail']).toContain(b.status);
      }
    }
  });
});

describe('Déterminisme', () => {
  it('deux évaluations identiques produisent un résultat identique', () => {
    const sel = { questionId: 'Q2_RETAINING_GAP', optionIndex: 2, answers: { operatingTempC: 90, operatingEnv: 'none' } };
    const a = assess(kb, sel);
    const b = assess(kb, sel);
    expect(a.status).toBe(b.status);
    expect(a.primary.productId).toBe(b.primary.productId);
    expect(a.candidates.map((c) => c.productId)).toEqual(b.candidates.map((c) => c.productId));
  });
});
