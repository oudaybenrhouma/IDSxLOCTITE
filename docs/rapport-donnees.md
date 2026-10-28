# Dataset validation report

Generated 2026-10-28T13:37:53.381Z from `/home/user/ids-loctite-guide/data`.

## Volume

| Dataset | Records |
| --- | --- |
| `products.json` | 21 |
| `applications.json` | 7 |
| `problems.json` | 7 |
| `selection_rules.json` | 5 |
| `rule_branches.json` | 24 |
| `comparisons.json` | 4 |
| `decision_questions.json` | 6 |
| `warnings.json` | 5 |
| `source_references.json` | 4 |
| `unresolved_items.json` | 3 |
| `missing_product_references.json` | 27 |
| `resolved_product_references.json` | 61 |

## Blocking errors

- **QUESTION_NEXT_BROKEN** — `decision_questions` / `Q1_APPLICATION_TYPE.options[5].next` : Follow-up question "Q2_STRUCTURAL_SUBSTRATE" does not exist: the branch "Structural bonding of metals, magnets, or plastics" has no documented questionnaire.
- **PRODUCT_REF_MISSING** — `products` / `PROD_542` : Product "PROD_542" is referenced 6 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_565` : Product "PROD_565" is referenced 5 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_567` : Product "PROD_567" is referenced 5 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_545` : Product "PROD_545" is referenced 2 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_574` : Product "PROD_574" is referenced 3 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_510` : Product "PROD_510" is referenced 4 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_SI5699` : Product "PROD_SI5699" is referenced 9 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_SI587` : Product "PROD_SI587" is referenced 2 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_609` : Product "PROD_609" is referenced 3 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_5800` : Product "PROD_5800" is referenced 2 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_603` : Product "PROD_603" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_620` : Product "PROD_620" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_PC7226_rebuild` : Product "PROD_PC7226_rebuild" is referenced 2 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_PC7221` : Product "PROD_PC7221" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.

## Warnings

- **PRODUCT_ORPHAN** — `products` / `products[*]` : 2 product(s) are not referenced by any rule, problem, application or question.
- **PRODUCT_REF_MISSING** — `products` / `PROD_MR5923` : Product "PROD_MR5923" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_641` : Product "PROD_641" is referenced 2 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_401` : Product "PROD_401" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_LB8104` : Product "PROD_LB8104" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_AA326` : Product "PROD_AA326" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_AA330` : Product "PROD_AA330" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_AA3035` : Product "PROD_AA3035" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_H8000` : Product "PROD_H8000" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_EAE120HP` : Product "PROD_EAE120HP" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_PC7226` : Product "PROD_PC7226" is referenced 2 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_LB8150` : Product "PROD_LB8150" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_LB771` : Product "PROD_LB771" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.
- **PRODUCT_REF_MISSING** — `products` / `PROD_LB8023` : Product "PROD_LB8023" is referenced 1 time(s) but is ABSENT from the product catalogue: no datasheet available.

## Product references missing from the catalogue

| Reference | Cited by |
| --- | --- |
| `PROD_542` | applications/APP_THREAD_SEALING<br>problems/PROB_002<br>selection_rules/RULE_THREAD_SEALING_TYPE<br>decision_questions/Q2_THREAD_SEALING_PARAM<br>warnings_and_limitations/WARN_OXYGEN_OXIDIZERS<br>warnings_and_limitations/WARN_PLASTIC_THREAD_ATTACK |
| `PROD_565` | applications/APP_THREAD_SEALING<br>problems/PROB_002<br>selection_rules/RULE_THREAD_SEALING_TYPE<br>warnings_and_limitations/WARN_OXYGEN_OXIDIZERS<br>warnings_and_limitations/WARN_PLASTIC_THREAD_ATTACK |
| `PROD_567` | applications/APP_THREAD_SEALING<br>selection_rules/RULE_THREAD_SEALING_TYPE<br>decision_questions/Q2_THREAD_SEALING_PARAM<br>warnings_and_limitations/WARN_OXYGEN_OXIDIZERS<br>warnings_and_limitations/WARN_PLASTIC_THREAD_ATTACK |
| `PROD_545` | applications/APP_THREAD_SEALING<br>selection_rules/RULE_THREAD_SEALING_TYPE |
| `PROD_574` | applications/APP_GASKETING<br>problems/PROB_003<br>selection_rules/RULE_GASKETING_SELECTION |
| `PROD_510` | applications/APP_GASKETING<br>problems/PROB_003<br>selection_rules/RULE_GASKETING_SELECTION<br>decision_questions/Q2_GASKETING_TYPE |
| `PROD_SI5699` | applications/APP_GASKETING<br>problems/PROB_003<br>selection_rules/RULE_GASKETING_SELECTION<br>decision_questions/Q2_GASKETING_TYPE<br>comparisons/COMP_GASKETING_ANAEROBIC_VS_SILICONE<br>comparisons/COMP_GASKETING_ANAEROBIC_VS_SILICONE<br>comparisons/COMP_GASKETING_ANAEROBIC_VS_SILICONE<br>comparisons/COMP_GASKETING_ANAEROBIC_VS_SILICONE<br>comparisons/COMP_GASKETING_ANAEROBIC_VS_SILICONE |
| `PROD_SI587` | applications/APP_GASKETING<br>selection_rules/RULE_GASKETING_SELECTION |
| `PROD_MR5923` | applications/APP_GASKETING |
| `PROD_609` | applications/APP_RETAINING<br>selection_rules/RULE_RETAINING_GAP_FILL<br>decision_questions/Q2_RETAINING_GAP |
| `PROD_641` | applications/APP_RETAINING<br>problems/PROB_004 |
| `PROD_401` | applications/APP_FOOD_BEVERAGE |
| `PROD_LB8104` | applications/APP_FOOD_BEVERAGE |
| `PROD_AA326` | applications/APP_STRUCTURAL_BONDING |
| `PROD_AA330` | applications/APP_STRUCTURAL_BONDING |
| `PROD_AA3035` | applications/APP_STRUCTURAL_BONDING |
| `PROD_H8000` | applications/APP_STRUCTURAL_BONDING |
| `PROD_EAE120HP` | applications/APP_STRUCTURAL_BONDING |
| `PROD_PC7226` | problems/PROB_006<br>warnings_and_limitations/WARN_SURFACE_PREP_SA25 |
| `PROD_LB8150` | problems/PROB_007 |
| `PROD_LB771` | problems/PROB_007 |
| `PROD_LB8023` | problems/PROB_007 |
| `PROD_5800` | selection_rules/RULE_GASKETING_SELECTION<br>decision_questions/Q2_GASKETING_TYPE |
| `PROD_603` | selection_rules/RULE_RETAINING_GAP_FILL |
| `PROD_620` | selection_rules/RULE_RETAINING_GAP_FILL |
| `PROD_PC7226_rebuild` | selection_rules/RULE_PUMP_CERAMIC_REPAIR<br>decision_questions/Q2_PUMP_WEAR_TYPE |
| `PROD_PC7221` | selection_rules/RULE_PUMP_CERAMIC_REPAIR |

## Unresolved points supplied by the sources

- **UNRES_001** (Color specification for LOCTITE 222) : Do-It-Right Guide lists LOCTITE 222 as Purple color in selector table. Food Brochure 2025 displays LOCTITE 222 bottle with Red label text. Standard industry specification is Purple liquid product. — *Verify bottle visual branding vs internal liquid color code.*
- **UNRES_002** (Operating Temperature Max for LOCTITE 518) : Do-It-Right Guide specifies LOCTITE 518 temp range as -54°C to +150°C. French Food Brochure specifies -50°C to +150°C. — *Flag 4°C lower bound variance for automated rule checking.*
- **UNRES_003** (Specific viscosity values for PC ceramic coatings) : LOCTITE PC 7117, PC 7227, PC 7221, PC 7226, PC 7255 descriptions state brushable or putty paste, but numerical mPa.s viscosity values are omitted in the pump guide text. — *Obtain exact mPa.s values from Henkel Technical Data Sheets (TDS) for precise viscosity filtering.*

## Structural notes

- Application APP_FOOD_BEVERAGE: no documented selection rule in selection_rules.json.
- Application APP_FOOD_BEVERAGE: not reachable from the documented questionnaire (decision_questions.json).
- Application APP_STRUCTURAL_BONDING: no documented selection rule in selection_rules.json.
