/**
 * Taxonomie dérivée des jeux de données.
 * Ces tables sont des CORRESPONDANCES STRUCTURELLES entre identifiants existants
 * (questions, applications, règles, catégories). Elles n'ajoutent AUCUNE donnée
 * technique : elles indiquent seulement quel identifiant pointe vers quel autre.
 */

/**
 * Correspondance structurelle option de Q1 → application documentée.
 * Basée sur le libellé de l'option ; vérifiée au chargement (voir kb.js).
 */
export const Q1_OPTION_APPLICATION_RULES = [
  { pattern: /lock(ing)? threaded fasteners|threadlock/i, applicationId: 'APP_THREADLOCKING' },
  { pattern: /sealing threaded pipe|thread seal/i, applicationId: 'APP_THREAD_SEALING' },
  { pattern: /mating flanges|gasketing|gasket/i, applicationId: 'APP_GASKETING' },
  { pattern: /retaining cylindrical/i, applicationId: 'APP_RETAINING' },
  { pattern: /pump rebuilding|wear protection|chemical coating/i, applicationId: 'APP_PUMP_MAINTENANCE' },
  { pattern: /structural bonding/i, applicationId: 'APP_STRUCTURAL_BONDING' },
  { pattern: /food|beverage|agro/i, applicationId: 'APP_FOOD_BEVERAGE' },
];

export const QUESTION_TO_APPLICATION = {
  Q1_APPLICATION_TYPE: null,
  Q2_THREADLOCKING_SIZE: 'APP_THREADLOCKING',
  Q2_THREAD_SEALING_PARAM: 'APP_THREAD_SEALING',
  Q2_GASKETING_TYPE: 'APP_GASKETING',
  Q2_RETAINING_GAP: 'APP_RETAINING',
  Q2_PUMP_WEAR_TYPE: 'APP_PUMP_MAINTENANCE',
};

export const APPLICATION_TO_RULE = {
  APP_THREADLOCKING: 'RULE_THREADLOCKING_STRENGTH',
  APP_THREAD_SEALING: 'RULE_THREAD_SEALING_TYPE',
  APP_GASKETING: 'RULE_GASKETING_SELECTION',
  APP_RETAINING: 'RULE_RETAINING_GAP_FILL',
  APP_PUMP_MAINTENANCE: 'RULE_PUMP_CERAMIC_REPAIR',
  APP_STRUCTURAL_BONDING: null,
  APP_FOOD_BEVERAGE: null,
};

export const APPLICATION_TO_PROBLEM = {
  APP_THREADLOCKING: 'PROB_001',
  APP_THREAD_SEALING: 'PROB_002',
  APP_GASKETING: 'PROB_003',
  APP_RETAINING: 'PROB_004',
  APP_PUMP_MAINTENANCE: 'PROB_006',
  APP_STRUCTURAL_BONDING: null,
  APP_FOOD_BEVERAGE: null,
};

/** Libellés français des catégories produits telles que fournies (aucune fusion de données). */
/**
 * Short display labels for product categories.
 * The documented `category` value is always displayed as-is next to this label;
 * these entries are UI short forms only (no technical meaning is altered).
 */
export const CATEGORY_LABELS = {
  Threadlocking: 'Threadlocking',
  'Threadlocking / Wicking': 'Threadlocking / Wicking',
  'Thread Sealing': 'Thread sealing',
  Gasketing: 'Gasketing',
  Retaining: 'Retaining',
  'Retaining / Repair': 'Retaining / Repair',
  'Metal Rebuilding / Epoxy Putty': 'Metal rebuilding / Epoxy putty',
  'Protective Coating': 'Protective coating',
  'Structural Bonding': 'Structural bonding',
  'Anti-Seize Lubricant': 'Anti-seize lubricant',
  'Cleaner / Surface Prep': 'Cleaner / Surface prep',
  'Primer / Activator': 'Primer / Activator',
};

/**
 * Comportements spécifiques à une règle, explicitement documentés.
 *
 * `genericSubstitutes` : paires { condition: <valeur de la branche>, quandReponse: <valeur utilisateur>,
 * raison: <justification> }. Le document ne liste pas la valeur « rigid_metal » comme type de bride ;
 * un utilisateur qui répond « bride métallique rigide » relève bien de la branche « bride rigide
 * fonte/acier/aluminium ». Sans cette table, cette branche unique serait inaccessible.
 * Cette substitution est VOLONTAIREMENT limitée aux paires ci-dessous : aucune autre règle n'en bénéficie.
 *
 * `note` : texte affiché dans l'interface et dans la trace pour rester transparent.
 */
export const RULE_BEHAVIOUR = {
  RULE_GASKETING_SELECTION: {
    genericSubstitutes: [
      {
        key: 'flange_type',
        branchValue: 'rigid_iron_steel_aluminum',
        acceptedAnswer: 'rigid_metal',
        reason: 'A rigid metal flange (user answer) falls under the "rigid cast iron/steel/aluminium flange" branch; the service temperature remains the discriminating criterion.',
      },
    ],
  },
};

/**
 * Hiérarchie de valeurs documentées (relation « est un cas particulier de »).
 * Utilisée UNIQUEMENT pour comparer une condition de règle à une réponse utilisateur.
 * Exemple : condition « rigid_metal » est également satisfaite par un plan de joint
 * rigide en fonte/acier/aluminium, qui en est un cas particulier.
 */
export const VALUE_SUBTYPES = {
  rigid_metal: ['rigid_iron_steel_aluminum'],
  rigid_or_flexible: ['rigid_metal', 'rigid_iron_steel_aluminum', 'stamped_sheet_metal_flexible'],
  flexible: ['stamped_sheet_metal_flexible'],
  small: [],
};

/** Valeurs composées « A_or_B » des règles : chaque segment est une alternative recevable. */
export const VALUE_UNIONS = {
  slip_fit_or_worn_keyway: ['slip_fit', 'worn_keyway', 'slip_fit_or_worn_keyway'],
  stainless_steel_or_all_metals: ['stainless_steel', 'all_metals', 'stainless_steel_or_all_metals'],
  general_metal_except_stainless: ['general_metal', 'general_metal_except_stainless'],
  rigid_or_flexible: ['rigid_metal', 'rigid_iron_steel_aluminum', 'stamped_sheet_metal_flexible', 'rigid_or_flexible'],
  fine_hydraulic_pneumatic: ['fine_hydraulic', 'pneumatic'],
  coarse_metal: ['coarse_metal'],
};

export const STRENGTH_LABELS = {
  Low: 'Low',
  Medium: 'Medium',
  High: 'High',
  'Medium / High': 'Medium / High',
  'Low (Adjustable)': 'Low (adjustable)',
};

export const SEVERITY_LABELS = {
  'CRITICAL / SAFETY HAZARD': 'Critical — safety hazard',
  'HIGH / PROPERTY DAMAGE': 'High — property damage',
  'MEDIUM / TECHNICAL LIMITATION': 'Medium — technical limitation',
  'MEDIUM / PROCEDURE PRECAUTION': 'Medium — procedure precaution',
  'HIGH / ADHESION FAILURE': 'High — adhesion failure',
};

/**
 * Search recall aid → termes réellement présents dans les jeux de données.
 * Il s'agit uniquement d'un dictionnaire d'INTERFACE (langue de recherche), et non
 * d'une donnée technique : aucun contenu produit n'est ajouté ni modifié.
 * Les termes cibles sont ceux employés par la documentation (anglais technique).
 */
export const SEARCH_SYNONYMS = {
  freinage: ['threadlock', 'threadlocking', 'locking'],
  freiner: ['threadlock', 'locking'],
  filet: ['thread', 'threads', 'threadlocking', 'thread sealing'],
  filetage: ['thread', 'thread sealing', 'pipe'],
  etancheite: ['seal', 'sealing', 'sealant', 'gasket'],
  etancher: ['seal', 'sealing'],
  joint: ['gasket', 'flange', 'sealing'],
  bride: ['flange'],
  carter: ['cover', 'casing', 'flange'],
  pompe: ['pump'],
  volute: ['volute', 'casing'],
  impulseur: ['impeller'],
  roulement: ['bearing', 'bearings'],
  arbre: ['shaft'],
  clavette: ['keyway'],
  bagues: ['bushing', 'sleeve'],
  blocage: ['retaining', 'locking'],
  retention: ['retaining'],
  inoxydable: ['stainless'],
  inox: ['stainless'],
  acier: ['steel'],
  fonte: ['cast iron'],
  cuivre: ['copper'],
  aluminium: ['aluminum'],
  plastique: ['plastic', 'thermoplast', 'polyamide'],
  caoutchouc: ['elastomer', 'rubber'],
  usure: ['wear', 'abrasion', 'erosion'],
  abrasion: ['abrasion'],
  corrosion: ['corrosion', 'chemical'],
  chimique: ['chemical', 'solvent'],
  acide: ['acid', 'sulfuric'],
  temperature: ['temp', '°c', 'temperature'],
  chaud: ['temp', '°c', 'high temperature'],
  froid: ['low temperature', 'frost'],
  pression: ['pressure'],
  gaz: ['gas'],
  eau: ['water', 'potable'],
  potable: ['potable', 'nsf/ansi 61', 'wras', 'dvgw'],
  alimentaire: ['food', 'nsf'],
  agrement: ['nsf', 'wras', 'dvgw', 'isega', 'fraunhofer'],
  homologation: ['nsf', 'wras', 'dvgw', 'isega', 'fraunhofer', 'ktw'],
  demontage: ['disassembl', 'removable', 'hand tools'],
  permanent: ['permanent', 'high strength'],
  haute: ['high'],
  resistance: ['strength'],
  forte: ['high strength'],
  faible: ['low'],
  moyenne: ['medium'],
  antigrippant: ['anti-seize', 'anti seize'],
  grippage: ['anti-seize', 'galling'],
  grippe: ['anti-seize', 'galling'],
  nettoyant: ['cleaner', 'degreaser'],
  primaire: ['primer', 'activator'],
  colle: ['adhesive', 'bonding'],
  collage: ['bonding', 'structural'],
  structurel: ['structural'],
  epoxy: ['epoxy'],
  ceramique: ['ceramic'],
  revetement: ['coating'],
  reconstruction: ['rebuild', 'rebuilding', 'metal'],
  vibration: ['vibration'],
  desserrage: ['loosening', 'backing out'],
  fuite: ['leak', 'leakage', 'weeping'],
  jeu: ['gap', 'clearance'],
  serrage: ['torque', 'tighten'],
  goujon: ['stud', 'studs'],
  vis: ['screw', 'screws'],
  ecrou: ['nut', 'nuts'],
  boulon: ['bolt', 'bolts'],
  raccord: ['fitting', 'connector'],
  tuyauterie: ['pipe', 'piping'],
  hydraulique: ['hydraulic'],
  pneumatique: ['pneumatic'],
};

/** Rôles produits (préparation de surface) déduits de la catégorie documentée. */
export const isSurfacePrep = (product) =>
  !!product && /^(Cleaner|Primer)/i.test(product.category || '');
