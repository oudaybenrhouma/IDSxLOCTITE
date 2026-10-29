# IDS · Loctite product selection guide

Professional product-selection assistant for **LOCTITE®** products, built for
**Industrial Development Solutions (IDS)**. It applies the documented selection rules
(threadlocking, thread sealing, gasketing, cylindrical retaining, pump maintenance)
**deterministically**, produces **traceable** recommendations, and states plainly when a
case needs an IDS specialist.

The interface is **English only**, in the IDS mascot brand (red `#E51E25`, charcoal,
steel, white) and ships with light/dark themes. Technical data, product names and units
are **strictly preserved** from the supplied datasets: nothing is invented, extended or
estimated.

---

## 1. Quick start

```bash
npm install
npm run build      # builds the interface into dist/
npm start          # http://localhost:4173  (API + interface on the same port)
```

Development (hot reload):

```bash
npm run dev        # API (4173) + Vite dev server (5173, /api proxied to 4173)
```

### Deploying to Vercel

Import the repository into Vercel with the project root set to this directory. The
included `vercel.json` keeps the `data/` JSON files available to the API function;
`api/[...path].js` serves the Express API alongside the Vite-built interface. No
separate API deployment or environment variables are required. After deployment,
check `/api/health` and confirm it reports `21` products.

Other commands:

| Command | Effect |
| --- | --- |
| `npm test` | Full suite (engine, data, HTTP API, interface) |
| `npm run test:engine` | Engine and validation tests |
| `npm run test:api` | HTTP integration tests (real server) |
| `npm run test:ui` | Screen rendering tests (jsdom, real API) |
| `npm run validate:data` | Validate the datasets (non-zero exit on blocking error) |
| `npm run report:data` | Writes `docs/rapport-donnees.md` |
| `npm run verify` | `validate:data` + `test` + `build` |

Requirements: **Node.js ≥ 20.11**. No database, no paid service, no external API, no CDN
dependency (the interface works offline).

---

## 2. Architecture

```
ids-loctite-guide/
├── data/                     ← DATASETS (technical source of authority)
│   ├── products.json … unresolved_items.json   (faithful copy of the supplied files)
│   └── SHA256SUMS.txt                           (checksums of the original files)
├── shared/                   ← code shared by server and interface (pure ESM, no deps)
│   ├── specs.js              parsing of values (temperatures, gaps, thresholds)
│   ├── validate.js           validation of the 9 datasets
│   ├── config.js             link taxonomy + English labels + search expansion
│   ├── kb.js                 knowledge base, reference resolution, search index
│   └── engine.js             DETERMINISTIC RECOMMENDATION ENGINE
├── server/                   ← HTTP API (Express)
│   ├── dataStore.js          disk loading, version fingerprint, hot reload
│   └── index.js              REST routes + hosting of the built interface
├── web/                      ← React 18 interface (Vite)
│   └── src/{pages,components}/, styles.css, ui-text.js, assets/mascots/
├── scripts/validate-data.mjs validation / report CLI
├── tests/                    engine, data, API, interface (Vitest)
└── docs/                     data report, deployment guide, known limits
```

### Principles

- **One source of truth**: the files in `data/` are loaded at start-up, validated,
  resolved into relations, then **deep-frozen** (`Object.freeze`). Application code holds
  **no** product, specification or recommendation hard-coded.
- **Determinism**: identical answers produce an identical result (tested).
- **Traceability**: every recommendation exposes the rule applied, the satisfied branch,
  the limits checked, the applicable warnings, the source documents and their pages, plus
  a decision log.
- **Zero invention**: a missing value stays “not documented”; a product cited without a
  datasheet is never shown as available; a non-numeric value (“Ambient”, “Putty”) is never
  compared automatically.
- **Explicit uncertainty**: no forced recommendation. Borderline cases are marked “needs
  checking” or handed to the IDS technical team.

### Engine decision chain (`shared/engine.js`)

1. **Context**: documented problem → application → selection rule; entry question (Q1) →
   documented application.
2. **Candidates** from: satisfied rule branches, the documented question option, the
   problem's recommended solution, and the application's featured products. When no branch
   is fully satisfied, the **partial** branches (conditions simply unanswered) feed
   candidates that are **to be verified**.
3. **Per-product checks**: documented temperature range, documented maximum gap, the
   oxygen/oxidiser warning, thermoplastic stress cracking, the 204 °C requirement, and
   mandatory surface preparation (SA 2.5).
4. **Candidate status**: `confirme`, `a_verifier`, `exclu` — a candidate coming from a
   partial branch, a featured product or a fallback is **never** confirmed.
5. **Conflicts**: no satisfied branch, several branches satisfied at once pointing to
   different products, divergence between sources (rule / question / problem).
6. **Overall decision**: `recommendation`, `informations_insuffisantes`,
   `conflit_documentaire`, `aucune_correspondance`, `produit_non_documente`.
   A documented primary product that is missing from the catalogue forces the
   “not enough information” status and forbids any confirmed match.
7. **Escalation**: the list of reasons (missing data, conflict, missing reference, product
   excluded by its own limits) handed to the IDS technical team.

---

## 3. Interface

**Simple by default, deep on demand.** A client sees one question, one answer and one
next action; every table, rule trace, source page and engine log is one tap away inside
a disclosure (`web/src/components/UI.jsx` → `Reveal`).

- **Answer first.** The recommendation screen leads with the product, a single line of
  reasoning and three actions (datasheet, compare, change an answer). Warnings stay
  visible — brevity never wins over a safety note.
- **Cartoon brand, single light theme.** Chunky rounded cards, ink outlines, offset
  “sticker” shadows, pill buttons, and the IDS mascot in every state. All colours come
  from the tokens in `web/src/styles.css` (`--brand-red`, `--brand-red-dark`,
  `--brand-red-light`, `--ink`, `--charcoal`, `--steel`, `--steel-light`, `--grey-mid`,
  `--white`, `--info-blue`); no component hard-codes a hex value. There is no dark mode
  and no theme switch: `color-scheme: light` keeps native controls light too.
- **Logo.** The header uses the transparent IDS wordmark. The supplied file is
  `ids_logo_light.png`, whose lettering is *white* (a light mark for a dark background),
  so `web/ids_logo_dark.png` is derived from exactly that artwork — neutral pixels
  re-inked to `--ink`, brand red untouched, alpha preserved — and displayed directly on
  the light header with no plate, box or tint.
- **Tablet first.** Body text 17 px, minimum touch target 48 px, two-column grids at
  iPad portrait, a fixed bottom tab bar with the five main destinations below 900 px,
  safe-area padding for rounded corners, and a drawer for the secondary sections.
- **Mascot states.** `01-neutral` (home, headers, help), `02-success` (confirmed, saved),
  `03-error` (errors, validation, 404, offline), `04-loading` (loading and processing),
  `05-empty` (no results, nothing selected, no data). Decorative by default
  (`aria-hidden`), meaningful English alt text when the image carries information, and
  the loading pose respects `prefers-reduced-motion`.
- **Accessibility.** Skip link, keyboard-operable everything, visible focus rings, WCAG AA
  contrast, semantic tables with `th scope`, `aria-pressed` on choices and `aria-live` on
  loading and toasts.
- **Responsive.** 1100 / 900 / 640 px breakpoints: grids collapse, the hero mascot shrinks
  and the optional poses hide, never overlapping text.

## 4. API

All responses are JSON. `HOST`/`PORT` are configurable through environment variables.

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/health` | Status, data version, product count |
| GET | `/api/datasets/status` | Statistics, errors, warnings, unresolved items |
| POST | `/api/datasets/reload` | Reloads the files from disk (no restart) |
| GET | `/api/products` | Catalogue (`?category=`, `?application=`, `?q=`) |
| GET | `/api/products/:id` | Full datasheet; **409** when the reference is cited but absent |
| GET | `/api/search` | Search (`?q=`, `?category=`, `?application=`) + match reasons |
| GET | `/api/applications`, `/api/applications/:id` | Applications, linked rule and problem |
| GET | `/api/problems`, `/api/problems/:id` | Documented problems and solutions |
| GET | `/api/questions` | Documented questionnaire + criteria specifications |
| POST | `/api/assistant/next` | Next documented question (flags broken branches) |
| POST | `/api/recommend` | **Recommendation evaluation** (see below) |
| GET | `/api/compare?ids=A,B` | Comparison of 2 to 6 products (states `documente` / `non_documente` / `non_applicable`) |
| GET | `/api/comparisons` | Documented comparison matrices |
| GET | `/api/warnings`, `/api/sources`, `/api/rules` | Warnings, sources, rules |
| POST | `/api/rules/evaluate` | Evaluation of a single rule (diagnostic) |

### `POST /api/recommend`

```jsonc
{
  "problemId": "PROB_001",              // optional
  "applicationId": "APP_THREADLOCKING", // optional (otherwise derived from the entry question)
  "entryQuestionId": "Q1_APPLICATION_TYPE",
  "entryOptionIndex": 0,
  "questionId": "Q2_THREADLOCKING_SIZE", // current documented question (optional)
  "optionIndex": 1,
  "answers": {
    "operatingTempC": 120,
    "operatingEnv": "none",              // none | oxygen | plastic_threads | unknown
    "screw_size": "M6 to M20",           // documented criteria (optional)
    "disassembly": "standard_hand_tools",
    "radialGapMm": 0.2,
    "temp_resistance": "standard"
  }
}
```

Response (extract): `status`, `confidence`, `primary` (retained product, role, status,
`reasons`, `checks`, `warnings`, `sources`), `candidates`, `excluded`, `unavailable`,
`missingInfo` (blocking / verification / safety), `conflicts`, `escalation`, `rule`
(evaluated branches), `trace`, `sourceRefs`.

Error responses: `422 REPONSES_INVALIDES` (values outside the enumeration, non-numeric
temperature or gap), `404` (unknown question/application/problem), `503` (unreadable data).

---

## 5. Updating the datasets

**No rebuild is required**: the data is separate from the code.

1. Replace one or more files in `data/` (same names, same schema).
2. Validate:
   ```bash
   npm run validate:data        # non-zero exit code on a blocking error
   npm test                     # the tests catch relation regressions
   ```
3. Apply in production, either:
   - `POST /api/datasets/reload` (no downtime), or
   - restart the service (`npm start`).
4. Check the **Data quality** page in the interface (status, errors, missing references,
   unresolved items) and the `dataVersion` shown in the footer.

Alternative data folder: `IDS_DATA_DIR=/path/to/data npm start`.

### Expected schema (summary)

| File | Fields used |
| --- | --- |
| `products.json` | `id`, `name`, `product_code`, `category`, `strength`, `color`, `chemistry`, `viscosity`, `max_gap`, `temp_range`, `cure_time`, `approvals[]`, `compatible_materials[]`, `applications[]`, `limitations`, `usage_instructions` |
| `applications.json` | `id`, `title`, `description`, `sub_applications[]`, `primary_products[]` |
| `problems.json` | `id`, `title`, `symptoms`, `root_cause`, `recommended_solution.{primary_product_id, alternative_product_ids[], procedure}`, `selection_criteria` |
| `selection_rules.json` | `rule_id`, `category`, `condition`, `decision_tree[].{if, then_product_id, alternative_id, then_topcoat_id}` |
| `decision_questions.json` | `question_id`, `text`, `options[].{label, next, recommended_product_id}` |
| `comparisons.json` | `comparison_id`, `title`, `target_products[]`, `comparison_matrix.{attribute}.{product_id}` |
| `warnings_and_limitations.json` | `warning_id`, `title`, `affected_products[]`, `description`, `severity` |
| `source_references.json` | `ref_id`, `source_pdf`, `pages_referenced`, `topic`, `key_claims_extracted` |
| `unresolved_items.json` | `item_id`, `field`, `documents_involved[]`, `issue_description`, `action_required` |

Additional fields supported if added later: `products[].source_ref_ids[]` (explicit
product ↔ document link, taking precedence over automatic detection).

---

## 6. Deployment

See **[`docs/deploiement.md`](docs/deploiement.md)**: Docker, systemd, Nginx reverse proxy,
post-deployment checks and the data update procedure.

---

## 7. Tests and validation

```
Test Files  4 passed (4)
Tests       128 passed (128)
```

- `tests/engine.test.js` — 48 tests: every branch of the 5 documented rules, thresholds,
  exclusions, safety (oxygen, thermoplastics), determinism, traceability, uncertainty cases.
- `tests/data.test.js` — 33 tests: integrity, expected broken references, robustness to
  altered datasets (invalid JSON, duplicates, missing fields), search, unit parsing.
- `tests/api.test.js` — 27 tests: real HTTP server, error cases (404/409/422), comparison,
  data reload.
- `tests/ui.test.jsx` — 20 tests: rendering of the 9 screens against the real API,
  empty/error states, and the full guided flow through to the recommendation.

> **Verification limit in this environment**: headless browsers (Chromium/Playwright)
> could not be executed (system library `libnss3` unavailable, no root access). The
> screens were therefore validated by real React rendering in **jsdom** against the real
> API, and the stylesheet was checked by static review (mobile/tablet media queries,
> contrast, focus, `prefers-reduced-motion`). A visual check in a browser is still
> recommended before client acceptance.

Detailed data-validation results: **[`docs/rapport-donnees.md`](docs/rapport-donnees.md)**.

---

## 8. Limits and unresolved technical points

See **[`docs/limites-connues.md`](docs/limites-connues.md)**. In short, **no data was
modified** to work around these points:

1. **27 product references cited by the datasets are absent from `products.json`**
   (including `PROD_542`, `PROD_510`, `PROD_567`, `PROD_574`, `PROD_609`, `PROD_5800`,
   `PROD_SI5699`, `PROD_PC7226_rebuild`, `PROD_AA326`…). These products can be neither
   detailed, nor compared, nor recommended with confirmation. The application flags them
   everywhere (recommendation, catalogue, data quality).
2. **Questionnaire branch with no follow-up**: the “Structural bonding” option of
   `Q1_APPLICATION_TYPE` points to `Q2_STRUCTURAL_SUBSTRATE`, which does not exist. No
   rule in `selection_rules.json` covers structural bonding or food-industry maintenance.
3. **Qualitative condition `gap: "small"`** (press-fit branch) cannot be compared
   automatically: the branch stays “partial” and its products are proposed for
   verification, never confirmed.
4. **Documented range boundaries**: at 0.25 mm both branch 638 (“≤ 0.25 mm”) and branch
   660 (“0.25 to 0.50 mm”) are satisfied → the application reports the ambiguity instead
   of deciding arbitrarily.
5. **Unresolved conflicts in the supplied data**: colour of LOCTITE 222, lower
   temperature bound of LOCTITE 518, viscosity values of the ceramic coatings
   (`unresolved_items.json`). Shown as they are, with a referral to the technical team.
6. **Product ↔ source-document link**: not supplied explicitly by the data. Inferred from
   the product code quoted in `key_claims_extracted` and presented as indicative; two
   surface-preparation products (`SF 7070`, `SF 7649`) are not cited by any document.
7. **Two explicitly documented matching substitutions** (traceable in the interface) were
   needed to make some rules applicable: user answer `rigid_metal` → branch
   `rigid_iron_steel_aluminum` (gasketing rule), and condition `gap: "small"` → answer
   `< M6` proven only by a numeric measurement. No other substitution is allowed.
