# Known limits and unresolved technical points

This document lists **everything the application cannot do reliably** with the supplied
datasets. None of these limits has been worked around by modifying the data: they are
reported to the user in the interface and in the API.

Produced from `npm run validate:data` (see `docs/rapport-donnees.md` for the row-by-row
detail).

---

## A. Product references missing from the catalogue (high impact)

`products.json` contains **21 products**. The other datasets cite **61 product references**,
of which **27 distinct identifiers do not exist** in the catalogue:

| Reference | Cited by | Functional impact |
| --- | --- | --- |
| `PROD_542` | thread-sealing rule, Q2 question, problem 002, warnings | The “fine hydraulic threads” branch cannot end in a datasheet |
| `PROD_510` | gasketing rule, question, problem 003 | No solution for rigid flanges above 150 °C |
| `PROD_567`, `PROD_565`, `PROD_545` | thread-sealing rule | Stainless / general-metal branches unusable |
| `PROD_574` | gasketing rule (alternative), problem 003 | Alternative cannot be opened |
| `PROD_5800` | gasketing rule, question | Health & safety formulation cannot be opened |
| `PROD_609`, `PROD_603`, `PROD_620` | retaining rule | Press fit without a product datasheet |
| `PROD_PC7221`, `PROD_PC7226_rebuild` | pump rule, question | Volute rebuild without a datasheet |
| `PROD_SI5699`, `PROD_SI587` | gasketing rule, comparison, problem | Flexible sealing without a datasheet |
| `PROD_641`, `PROD_277`, `PROD_401`, `PROD_AA326`, `PROD_AA330`, `PROD_AA3035`, `PROD_H8000`, `PROD_EAE120HP`, `PROD_LB771`, `PROD_LB8023`, `PROD_LB8104`, `PROD_LB8150`, `PROD_MR5923` | applications, problems, rules | Featured products or alternatives that cannot be opened |

Consequences applied by the application:

- no datasheet, specification or comparison is ever invented;
- status `produit_non_documente` or `informations_insuffisantes`, with escalation;
- the “product references cited without a catalogue record” list on every result;
- an explicit 409 screen for `/produits/PROD_SI5699`, for example.

**To lift this limit**: complete `products.json` with the matching Henkel datasheets (using
the same identifiers as those cited), run `npm test`, then reload.

### Specific identifier cases

- `PROD_SI5699`: the identifier is probably derived from “LOCTITE SI 5699”. The spelling is
  kept as supplied; **no merge** with another identifier is performed.
- `PROD_PC7226_rebuild`: an internal working identifier for `LOCTITE PC 7226` (rebuild
  putty, mentioned in `problems.json` and the warnings). No `PC 7226` record exists in
  `products.json`.

## B. Questionnaire branch without a follow-up

`Q1_APPLICATION_TYPE` option 6 (“Structural bonding of metals, magnets, or plastics”)
points to `Q2_STRUCTURAL_SUBSTRATE`, which is **absent** from `decision_questions.json`.

- No follow-up question can be asked.
- No rule in `selection_rules.json` covers structural bonding: the application shows the
  featured products of `applications.json` (e.g. `PROD_EAE20HP`) as **candidates to
  verify**, never as a confirmed recommendation, and requires an IDS specialist's review.
- `APP_FOOD_BEVERAGE` has the same defect (no rule, no dedicated question).

## C. Rule conditions that cannot be evaluated automatically

- `gap: "small"` (press-fit branch of `RULE_RETAINING_GAP_FILL`) is a qualitative
  judgement: no measured value can satisfy it. The branch stays “partial”, the products
  (`PROD_609`, `PROD_603`) are proposed for verification and are in any case not documented
  in the catalogue.
- Any non-numeric textual condition is reported in the “Rules & questions” tab of the Data
  quality page.

## D. Documented ambiguities and conflicts (not arbitrated)

1. **The 0.25 mm boundary**: `PROD_648` (≤ 0.25 mm) and `PROD_638` (0.15–0.25 mm) are both
   satisfied by a 0.20–0.25 mm gap, as is `PROD_660` at exactly 0.25 mm. The application
   reports `AMBIGUITE_BRANCHES` and presents both candidates with their differences instead
   of choosing arbitrarily.
2. **Colour of LOCTITE 222** (`UNRES_001`): purple (guide) versus red label (food-industry
   brochure). The value is shown as supplied: “Purple / Red (Food Brochure)”.
3. **Lower bound of LOCTITE 518** (`UNRES_002`): −54 °C versus −50 °C depending on the
   document.
4. **Viscosities of PC 7117 / PC 7227 / PC 7221 / PC 7226 / PC 7255** (`UNRES_003`):
   described qualitatively (“brushable”, “putty”), without a mPa·s value. No numeric value is
   proposed.
5. **Rule ↔ problem divergence**: for pump maintenance, for example, the rule designates
   `PROD_PC7227` (fine abrasion) while `problems.json` (PROB_006) also recommends
   `PROD_PC7227` as primary — consistent — but a “sulphuric acid” answer leads to
   `PROD_PC7117` on one side and `PROD_PC7227` on the other: the conflict is displayed
   (`DIVERGENCE_SOURCES`), with no automatic arbitration.

## E. Source traceability

- The product ↔ document link is **not** supplied by the data. It is inferred from the
  product code quoted in `key_claims_extracted` / `topic` and shown as **indicative**
  (“explicit quotation of the product code”).
- No document in `source_references.json` cites `SF 7070` or `SF 7649` (surface-preparation
  products): their datasheet pages carry an explicit warning.
- The referenced pages are those of the extracts supplied; the application does not claim to
  have read the PDFs.

## F. Structural mappings added by the application (transparent)

These tables live in `shared/config.js` and **add no technical data**. They are needed
because the datasets contain no explicit question ↔ application ↔ rule link:

| Mapping | Justification |
| --- | --- |
| `Q2_*` → application → rule | Derived from the option labels of `Q1_APPLICATION_TYPE` and the categories of `selection_rules.json` |
| `Q1` option → application | Detected from the option label, verified at load time (`kb.structuralNotes`) |
| application → documented problem | 5 of the 7 applications have an equivalent problem in `problems.json` |
| answer `rigid_metal` → branch `rigid_iron_steel_aluminum` | A rigid metal flange is a special case of that branch; only the temperature discriminates. Traceable in the interface (“Documented substitution”) |
| `gap: "small"` → `< M6` only | No other value is accepted; otherwise the branch stays undecided |
| Search recall dictionary → documented terms | Interface-only aid, never used for a technical decision |

## G. What the application deliberately does not do

- No price, stock, lead time, packaging or product image.
- No added certification: only the values of the `approvals` field are displayed.
- No “best product” ranking: alternatives are presented with their differences and the
  conditions under which to prefer them.
- No recommendation based only on a keyword in the name or the description.
- No call to an AI model: the engine is fully deterministic and auditable.
- No language switcher and no translation layer: the interface is English only.

## H. Limits of the environmental verification

- Headless browsers are unavailable in the build environment (`libnss3` missing, no root
  access): the screens were validated by React rendering in jsdom against the real API
  (16 tests), not by screenshots.
- Accessibility: semantic structure (headings, `nav`, `table` with `th scope`,
  `aria-pressed`, `aria-live` on loaders, skip link, visible focus,
  `prefers-reduced-motion`) checked by code review; an automated audit (axe/Lighthouse)
  remains to be run at acceptance.
