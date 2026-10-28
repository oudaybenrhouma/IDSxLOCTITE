import { describe, it, expect } from 'vitest';
import { kb, raw } from './fixtures.js';
import { validateDatasets } from '../shared/validate.js';
import { searchKnowledgeBase, expandTerms } from '../shared/kb.js';
import { parseTempRange, parseGap, parseThreshold, thresholdMatches } from '../shared/specs.js';

describe('Intégrité des jeux de données', () => {
  it('charge les 9 jeux de données attendus', () => {
    expect(Object.keys(raw).sort()).toEqual([
      'applications', 'comparisons', 'decision_questions', 'problems', 'products',
      'selection_rules', 'source_references', 'unresolved_items', 'warnings_and_limitations',
    ]);
  });

  it('products.json : identifiants et codes uniques, champs obligatoires présents', () => {
    const ids = kb.raw.products.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const codes = kb.raw.products.map((p) => p.product_code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const p of kb.raw.products) {
      expect(p.name).toBeTruthy();
      expect(p.category).toBeTruthy();
    }
  });

  it('les seuls produits non référencés sont les produits de préparation de surface', () => {
    expect(kb.validation.issues.orphanProducts.sort()).toEqual(['PROD_SF7070', 'PROD_SF7649']);
    expect(kb.validation.issues.surfacePrepProducts.sort()).toEqual(['PROD_SF7070', 'PROD_SF7649']);
  });

  it('la validation détecte les 27 références produit absentes du catalogue', () => {
    expect(kb.validation.issues.missingProducts.length).toBe(27);
    const ids = kb.validation.issues.missingProducts.map((m) => m.productId);
    expect(ids).toContain('PROD_SI5699');
    expect(ids).toContain('PROD_PC7226_rebuild');
    expect(ids).toContain('PROD_510');
  });

  it('aucune référence absente n\'est silencieusement résolue vers un autre produit', () => {
    for (const m of kb.validation.issues.missingProducts) {
      expect(kb.productById.has(m.productId)).toBe(false);
    }
  });

  it('la branche « collage structural » du questionnaire est bien signalée comme cassée', () => {
    const dangling = kb.validation.issues.danglingNext;
    expect(dangling).toHaveLength(1);
    expect(dangling[0].next).toBe('Q2_STRUCTURAL_SUBSTRATE');
    expect(dangling[0].questionId).toBe('Q1_APPLICATION_TYPE');
  });

  it('les erreurs de validation sont structurées (code, jeu, chemin, message)', () => {
    for (const e of kb.validation.errors) {
      expect(e.code).toBeTruthy();
      expect(e.dataset).toBeTruthy();
      expect(e.message).toBeTruthy();
    }
  });

  it('toutes les branches de règles portent une condition et un produit cible', () => {
    for (const rule of kb.raw.selection_rules) {
      for (const branch of rule.decision_tree) {
        expect(Object.keys(branch.if || {}).length).toBeGreaterThan(0);
        expect(branch.then_product_id).toBeTruthy();
      }
    }
  });

  it('les comparaisons ne portent que sur des produits connus ou signalés', () => {
    for (const c of kb.raw.comparisons) {
      for (const pid of c.target_products) {
        const known = kb.productById.has(pid);
        const reported = kb.validation.issues.missingProducts.some((m) => m.productId === pid);
        expect(known || reported).toBe(true);
      }
    }
  });

  it('les avertissements ne listent que des produits connus ou signalés', () => {
    for (const w of kb.raw.warnings_and_limitations) {
      for (const pid of w.affected_products) {
        expect(kb.productById.has(pid) || kb.validation.issues.missingProducts.some((m) => m.productId === pid)).toBe(true);
      }
    }
  });
});

describe('Validation sur jeux de données altérés (robustesse)', () => {
  const clone = (o) => JSON.parse(JSON.stringify(o));

  it('signale un JSON non tableau', () => {
    const broken = clone(raw);
    broken.products = { pas: 'un tableau' };
    const res = validateDatasets(broken);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.code === 'DATASET_NOT_ARRAY')).toBe(true);
  });

  it('signale un identifiant dupliqué', () => {
    const broken = clone(raw);
    broken.products.push(clone(broken.products[0]));
    const res = validateDatasets(broken);
    expect(res.errors.some((e) => e.code === 'DUPLICATE_ID')).toBe(true);
  });

  it('signale un champ obligatoire manquant', () => {
    const broken = clone(raw);
    delete broken.products[0].name;
    const res = validateDatasets(broken);
    expect(res.errors.some((e) => e.code === 'FIELD_REQUIRED' && e.path.includes('name'))).toBe(true);
  });

  it('signale une condition de règle vide', () => {
    const broken = clone(raw);
    broken.selection_rules[0].decision_tree[0].if = {};
    const res = validateDatasets(broken);
    expect(res.errors.some((e) => e.code === 'RULE_EMPTY_CONDITION')).toBe(true);
  });

  it('signale une référence produit cassée supplémentaire', () => {
    const broken = clone(raw);
    broken.selection_rules[0].decision_tree[0].then_product_id = 'PROD_INEXISTANT';
    const res = validateDatasets(broken);
    expect(res.errors.some((e) => e.code === 'PRODUCT_REF_MISSING' && e.path === 'PROD_INEXISTANT')).toBe(true);
  });

  it('ne lève pas d\'exception sur des jeux vides', () => {
    const res = validateDatasets({});
    expect(res.ok).toBe(false);
    expect(res.errors.filter((e) => e.code === 'DATASET_MISSING')).toHaveLength(9);
  });
});

describe('Analyse des valeurs techniques', () => {
  it('analyse les plages de température réelles', () => {
    expect(parseTempRange('-55°C to +180°C')).toMatchObject({ minC: -55, maxC: 180, parseable: true });
    expect(parseTempRange('-29°C to +982°C')).toMatchObject({ minC: -29, maxC: 982 });
    expect(parseTempRange('-40°C to +175°C (-40°F to +350°F)').maxC).toBe(175);
  });

  it('marque comme non exploitables les valeurs non numériques', () => {
    expect(parseTempRange('Ambient').parseable).toBe(false);
    expect(parseGap('Small screws').parseable).toBe(false);
    expect(parseGap('N/A').parseable).toBe(false);
  });

  it('analyse les jeux en mm et en pouces', () => {
    expect(parseGap('0.020 inch (0.50 mm)')).toMatchObject({ mm: 0.5, inch: 0.02 });
    expect(parseGap('Up to 0.25 mm').mm).toBe(0.25);
  });

  it('analyse les seuils de règles', () => {
    expect(parseThreshold('<= 0.25 mm')).toMatchObject({ op: '<=', value: 0.25, unit: 'mm' });
    expect(parseThreshold('150 C to 204 C')).toMatchObject({ op: 'range', min: 150, max: 204 });
    expect(thresholdMatches(parseThreshold('<= 0.25 mm'), 0.2)).toBe(true);
    expect(thresholdMatches(parseThreshold('<= 0.25 mm'), 0.26)).toBe(false);
  });

  it('aucune valeur numérique n\'est inventée pour un produit dont la donnée est non numérique', () => {
    const p = kb.productById.get('PROD_EA3478');
    expect(kb.specs.get(p.id).temp.parseable).toBe(true);
    const cleaner = kb.productById.get('PROD_SF7070');
    expect(kb.specs.get(cleaner.id).temp.parseable).toBe(false);
    expect(kb.specs.get(cleaner.id).temp.maxC).toBeNull();
  });
});

describe('Recherche', () => {
  it('trouve un produit par code exact', () => {
    const res = searchKnowledgeBase(kb, '243');
    expect(res[0].id).toBe('PROD_243');
  });

  it('trouve par nom partiel', () => {
    const res = searchKnowledgeBase(kb, 'quick metal');
    expect(res.map((r) => r.id)).toContain('PROD_660');
  });

  it('trouve par homologation : les produits citant WRAS arrivent en tête', () => {
    const res = searchKnowledgeBase(kb, 'WRAS');
    expect(res.length).toBeGreaterThan(2);
    const withWras = res.filter((r) => r.approvals.join(' ').match(/WRAS/i));
    expect(withWras.length).toBeGreaterThan(2);
    // Les 3 premiers résultats citent réellement WRAS (score d'homologation)
    res.slice(0, 3).forEach((r) => expect(r.approvals.join(' ')).toMatch(/WRAS/i));
    // Les raisons de correspondance sont explicites
    expect(res[0].matchReasons).toContain('homologation');
  });

  it('trouve par terme français via le dictionnaire d\'interface', () => {
    const res = searchKnowledgeBase(kb, 'roulement');
    expect(res.length).toBeGreaterThan(0);
    expect(res.map((r) => r.id)).toContain('PROD_638');
  });

  it('trouve par problème industriel', () => {
    const res = searchKnowledgeBase(kb, 'desserrage');
    expect(res.length).toBeGreaterThan(0);
  });

  it('une recherche sans résultat renvoie un tableau vide (pas d\'invention)', () => {
    expect(searchKnowledgeBase(kb, 'zzzzz-inconnu')).toEqual([]);
  });

  it('les filtres par catégorie restreignent réellement', () => {
    const all = searchKnowledgeBase(kb, 'loctite');
    const filtered = searchKnowledgeBase(kb, 'loctite', { category: 'Retaining' });
    expect(filtered.length).toBeLessThan(all.length);
    filtered.forEach((r) => expect(r.category).toBe('Retaining'));
  });

  it('l\'expansion ne contient que des termes présents dans la documentation', () => {
    const terms = expandTerms(['roulement']);
    expect(terms).toContain('bearing');
  });

  it('chaque produit du catalogue est accessible par son code', () => {
    for (const p of kb.products) {
      const res = searchKnowledgeBase(kb, p.product_code);
      expect(res.map((r) => r.id)).toContain(p.id);
    }
  });
});

describe('Relations produit ↔ autres jeux', () => {
  it('chaque produit expose ses liens applicatifs résolus', () => {
    for (const app of kb.raw.applications) {
      for (const pid of app.primary_products) {
        const links = kb.links.get(pid);
        if (kb.productById.has(pid)) {
          expect(links.applications.some((a) => a.id === app.id)).toBe(true);
        }
      }
    }
  });

  it('les avertissements sont rattachés aux produits disponibles', () => {
    const w = kb.raw.warnings_and_limitations.find((x) => x.warning_id === 'WARN_GAP_LIMIT_660');
    expect(kb.links.get('PROD_660').warnings.map((x) => x.warning_id)).toContain(w.warning_id);
  });

  it('les sources rattachées proviennent de citations réelles du code produit', () => {
    const refs = kb.validation.issues.productSourceHints.PROD_55;
    expect(refs.length).toBeGreaterThan(0);
    refs.forEach((rid) => {
      const s = kb.refById.get(rid);
      expect(`${s.topic} ${s.key_claims_extracted}`).toMatch(/55/);
    });
  });
});
