/**
 * Tests d'intégration HTTP — serveur réel + jeux de données réels.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4599;
const BASE = `http://127.0.0.1:${PORT}/api`;
let proc;

const get = async (p) => {
  const res = await fetch(`${BASE}${p}`);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const post = async (p, body) => {
  const res = await fetch(`${BASE}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  return { status: res.status, body: await res.json().catch(() => null) };
};

beforeAll(async () => {
  proc = spawn('node', ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: 'pipe',
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The test server did not start in time.')), 20000);
    proc.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('API ready')) { clearTimeout(timer); resolve(); }
    });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Serveur arrêté (code ${code})`)); });
  });
});

afterAll(() => {
  if (proc) proc.kill('SIGTERM');
});

describe('API santé & données', () => {
  it('GET /health expose la version des données', async () => {
    const { status, body } = await get('/health');
    expect(status).toBe(200);
    expect(body.products).toBe(21);
    expect(body.dataVersion).toBeTruthy();
    expect(body.status).toBe('ok');
  });

  it('GET /datasets/status expose les anomalies sans modifier les fichiers', async () => {
    const { status, body } = await get('/datasets/status');
    expect(status).toBe(200);
    expect(body.stats.products).toBe(21);
    expect(body.issues.missingProducts.length).toBe(27);
    expect(body.issues.danglingNext.length).toBe(1);
    expect(body.unresolvedItems.length).toBe(3);
  });

  it('POST /datasets/reload recharge depuis le disque', async () => {
    const { status, body } = await post('/datasets/reload');
    expect(status).toBe(200);
    expect(body.reloadedAt).toBeTruthy();
  });
});

describe('API catalogue', () => {
  it('GET /products renvoie les 21 produits', async () => {
    const { body } = await get('/products');
    expect(body.count).toBe(21);
    body.products.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.links).toBeTruthy();
    });
  });

  it('GET /products/:id renvoie une fiche complète avec sources et liens', async () => {
    const { status, body } = await get('/products/PROD_243');
    expect(status).toBe(200);
    expect(body.product_code).toBe('243');
    expect(body.temp_range).toBe('-55°C to +180°C');
    expect(body.links.warnings.length).toBeGreaterThan(0);
    expect(body.sources.length).toBeGreaterThan(0);
  });

  it('GET /products/PROD_SI5699 → 409 explicite (référence documentaire sans fiche)', async () => {
    const { status, body } = await get('/products/PROD_SI5699');
    expect(status).toBe(409);
    expect(body.error).toBe('PRODUIT_REFERENCE_MAIS_NON_DOCUMENTE');
    expect(body.references.length).toBeGreaterThan(0);
  });

  it('GET /products/INCONNU → 404', async () => {
    const { status, body } = await get('/products/NOPE');
    expect(status).toBe(404);
    expect(body.error).toBe('PRODUIT_INCONNU');
  });

  it('GET /search trouve par code et par terme français', async () => {
    expect((await get('/search?q=660')).body.results[0].id).toBe('PROD_660');
    const fr = await get('/search?q=roulement');
    expect(fr.body.count).toBeGreaterThan(0);
  });
});

describe('API parcours guidé', () => {
  it('GET /questions expose les 6 questions documentées et leurs options', async () => {
    const { body } = await get('/questions');
    expect(body.questions).toHaveLength(6);
    const q1 = body.questions.find((q) => q.question_id === 'Q1_APPLICATION_TYPE');
    expect(q1.options).toHaveLength(6);
    expect(q1.options.find((o) => o.next === 'Q2_STRUCTURAL_SUBSTRATE').nextExists).toBe(false);
  });

  it('POST /assistant/next signale la branche cassée', async () => {
    const { body } = await post('/assistant/next', { questionId: 'Q1_APPLICATION_TYPE', optionIndex: 5 });
    expect(body.hasNext).toBe(false);
    expect(body.brokenBranch.next).toBe('Q2_STRUCTURAL_SUBSTRATE');
  });

  it('POST /assistant/next renvoie la question suivante documentée', async () => {
    const { body } = await post('/assistant/next', { questionId: 'Q1_APPLICATION_TYPE', optionIndex: 1 });
    expect(body.next.question_id).toBe('Q2_THREAD_SEALING_PARAM');
  });

  it('POST /recommend produit une recommandation traçable', async () => {
    const { status, body } = await post('/recommend', {
      questionId: 'Q2_RETAINING_GAP',
      optionIndex: 3,
      answers: { operatingTempC: 100, operatingEnv: 'none' },
    });
    expect(status).toBe(200);
    expect(body.status).toBe('recommendation');
    expect(body.primary.productId).toBe('PROD_660'); // jeu 0,25–0,50 mm documenté
    expect(body.rule.ruleId).toBe('RULE_RETAINING_GAP_FILL');
    expect(body.primary.reasons.length).toBeGreaterThan(0);
    expect(body.sourceRefs.length).toBeGreaterThan(0);
  });

  it('POST /recommend signale l’ambiguïté de frontière documentée (0,25 mm ∈ 638 et 660)', async () => {
    const { body } = await post('/recommend', {
      questionId: 'Q2_RETAINING_GAP',
      optionIndex: 2,
      answers: { operatingTempC: 100, operatingEnv: 'none' },
    });
    expect(['conflit_documentaire', 'informations_insuffisantes']).toContain(body.status);
    expect(body.conflicts.some((c) => c.type === 'AMBIGUITE_BRANCHES')).toBe(true);
    expect(body.candidates.length).toBeGreaterThan(1);
    expect(body.escalation.required).toBe(true);
  });

  it('POST /recommend refuse des réponses invalides en 422 avec message explicite', async () => {
    const { status, body } = await post('/recommend', { answers: { operatingTempC: 'chaud' } });
    expect(status).toBe(422);
    expect(body.error).toBe('REPONSES_INVALIDES');
    expect(body.problems[0].field).toBe('operatingTempC');
  });

  it('POST /recommend refuse une valeur d’énumération inconnue', async () => {
    const { status, body } = await post('/recommend', { answers: { flange_type: 'carton' } });
    expect(status).toBe(422);
    expect(body.problems[0].field).toBe('flange_type');
  });

  it('POST /recommend sur une branche non documentée ne force aucune recommandation', async () => {
    const { body } = await post('/recommend', { questionId: 'Q1_APPLICATION_TYPE', optionIndex: 5 });
    expect(body.status).toBe('informations_insuffisantes');
    expect(body.escalation.required).toBe(true);
  });

  it('POST /recommend sur application inconnue → 404', async () => {
    const { status } = await post('/recommend', { applicationId: 'APP_NOPE' });
    expect(status).toBe(404);
  });

  it('POST /rules/evaluate refuse les réponses invalides', async () => {
    const { status } = await post('/rules/evaluate', { ruleId: 'RULE_THREADLOCKING_STRENGTH', answers: { radialGapMm: -5 } });
    expect(status).toBe(422);
  });
});

describe('API comparaison', () => {
  it('GET /compare préserve les unités et distingue non documenté', async () => {
    const { status, body } = await get('/compare?ids=PROD_638,PROD_648,PROD_660');
    expect(status).toBe(200);
    const gapRow = body.rows.find((r) => r.key === 'max_gap');
    expect(gapRow.values.map((v) => v.value)).toEqual([
      '0.010 inch (0.25 mm) radial',
      '0.006 inch (0.15 mm) radial',
      '0.020 inch (0.50 mm) radial',
    ]);
    expect(gapRow.differs).toBe(true);
    const strengthRow = body.rows.find((r) => r.key === 'strength');
    expect(strengthRow.differs).toBe(false);
  });

  it('GET /compare marque N/A comme non applicable, pas comme absence de capacité', async () => {
    const { body } = await get('/compare?ids=PROD_LB8008,PROD_243');
    const row = body.rows.find((r) => r.key === 'strength');
    expect(row.values[0].state).toBe('non_applicable');
    expect(row.values[1].state).toBe('documente');
  });

  it('GET /compare exige au moins deux produits', async () => {
    expect((await get('/compare?ids=PROD_243')).status).toBe(400);
  });

  it('GET /compare refuse plus de six produits', async () => {
    const ids = ['PROD_243', 'PROD_270', 'PROD_263', 'PROD_277', 'PROD_290', 'PROD_2400', 'PROD_2700'];
    expect((await get(`/compare?ids=${ids.join(',')}`)).status).toBe(400);
  });

  it('GET /compare avec identifiant inconnu → 404', async () => {
    const { status, body } = await get('/compare?ids=PROD_243,PROD_FAKE');
    expect(status).toBe(404);
    expect(body.ids).toEqual(['PROD_FAKE']);
  });

  it('GET /comparisons expose les comparaisons documentées', async () => {
    const { body } = await get('/comparisons');
    expect(body.comparisons).toHaveLength(4);
  });
});

describe('API documentation', () => {
  it('GET /warnings expose les 5 avertissements avec produits résolus', async () => {
    const { body } = await get('/warnings');
    expect(body.warnings).toHaveLength(5);
    const oxy = body.warnings.find((w) => w.warning_id === 'WARN_OXYGEN_OXIDIZERS');
    expect(oxy.affected.some((a) => a.available === false)).toBe(true);
  });

  it('GET /sources expose les 4 documents avec produits rattachés', async () => {
    const { body } = await get('/sources');
    expect(body.sources).toHaveLength(4);
    expect(body.sources[0].linkedProducts.length).toBeGreaterThan(0);
  });

  it('GET /rules renvoie les 5 règles et leurs branches', async () => {
    const { body } = await get('/rules');
    expect(body.rules).toHaveLength(5);
    body.rules.forEach((r) => expect(r.evaluatedWithoutAnswers.branches.length).toBe(r.decision_tree.length));
  });

  it('GET /route-inexistante → 404 JSON', async () => {
    const { status, body } = await get('/inexistant');
    expect(status).toBe(404);
    expect(body.error).toBe('ROUTE_INCONNUE');
  });
});
