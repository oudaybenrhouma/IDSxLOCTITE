/**
 * Interface copy layer (English only).
 *
 * Documented technical strings — product names, codes, question and option labels,
 * rule conditions, measured values — are rendered exactly as supplied by the datasets
 * and are never rewritten here. This module only holds UI wording, status vocabulary
 * and attribute labels for the comparison matrices.
 */

export const APP = {
  productName: 'Loctite Product Selection Guide',
  company: 'Industrial Development Solutions',
  tagline: 'Find the right Loctite product — with the reasoning behind it',
};

/** Selection status vocabulary. */
export const STATUS_TEXT = {
  recommendation: 'Recommendation ready',
  informations_insuffisantes: 'Not enough information yet',
  conflit_documentaire: 'Documented sources need a check',
  aucune_correspondance: 'No documented match',
  produit_non_documente: 'Selected product is not in the catalogue',
};

export const STATUS_TONE = {
  recommendation: 'green',
  informations_insuffisantes: 'amber',
  conflit_documentaire: 'amber',
  aucune_correspondance: 'red',
  produit_non_documente: 'red',
};

export const STATUS_EXPLAIN = {
  recommendation: 'Every documented condition for this application is covered by your answers.',
  informations_insuffisantes: 'Some documented criteria are still open, so the match cannot be confirmed yet.',
  conflit_documentaire: 'Two documented sources point to different products for these answers. A specialist should confirm.',
  aucune_correspondance: 'No product in the catalogue satisfies all the documented criteria you entered.',
  produit_non_documente: 'The rules point to a product that has no datasheet in the catalogue, so it cannot be recommended.',
};

/** Candidate confidence vocabulary. */
export const CANDIDATE_TEXT = {
  confirme: 'Confirmed match',
  a_verifier: 'Needs verification',
  exclu: 'Excluded by a documented limit',
};

export const CANDIDATE_TONE = { confirme: 'green', a_verifier: 'amber', exclu: 'red' };

export const ROLE_TEXT = {
  primaire: 'Documented primary product',
  alternative: 'Documented alternative',
  application: 'Featured product for this application',
};

export const SEVERITY_TONE = {
  'CRITICAL / SAFETY HAZARD': 'critical',
  'HIGH / PROPERTY DAMAGE': 'red',
  'MEDIUM / TECHNICAL LIMITATION': 'amber',
  'MEDIUM / PROCEDURE PRECAUTION': 'amber',
  'HIGH / ADHESION FAILURE': 'red',
};

export const SEVERITY_TEXT = {
  'CRITICAL / SAFETY HAZARD': 'Critical — safety hazard',
  'HIGH / PROPERTY DAMAGE': 'High — property damage',
  'MEDIUM / TECHNICAL LIMITATION': 'Medium — technical limitation',
  'MEDIUM / PROCEDURE PRECAUTION': 'Medium — procedure precaution',
  'HIGH / ADHESION FAILURE': 'High — adhesion failure',
};

export const CHECK_TONE = { ok: 'green', exclusion: 'red', verifier: 'amber', info: 'neutral', precaution: 'amber' };

export const CHECK_TEXT = {
  exclusion: 'Excluded',
  verifier: 'Check',
  precaution: 'Precaution',
  info: 'Note',
  ok: 'OK',
};

/** Comparison matrix attribute labels (keys come from comparisons.json). */
export const ATTRIBUTE_LABELS = {
  disassembly_method: 'Disassembly method',
  typical_fastener_size: 'Typical fastener size',
  oil_tolerance: 'Oil tolerance',
  primary_use_case: 'Primary use case',
  form_factor: 'Form factor',
  cure_time: 'Cure time',
  re_alignment: 'Re-alignment after assembly',
  substrate_compatibility: 'Substrate compatibility',
  approvals: 'Approvals',
  viscosity: 'Viscosity',
  max_radial_gap: 'Maximum radial gap',
  shear_strength: 'Shear strength',
  primary_application: 'Primary application',
  flange_rigidity: 'Flange rigidity',
  max_gap_fill: 'Maximum gap fill',
  fuel_chemical_resistance: 'Fuel / chemical resistance',
  blowout_resistance: 'Blowout resistance',
};

/** Short labels for the technical criteria rendered by the guide. */
export const CRITERIA_TEXT = {
  temp: {
    label: 'Continuous service temperature',
    question: 'What is the continuous service temperature of the application?',
  },
  operatingEnv: {
    label: 'Fluid and safety environment',
    question: 'Does the application involve a fluid with a specific safety requirement?',
  },
};

export const inputLabels = {
  screw_size: 'Fastener size',
  disassembly: 'Disassembly requirement',
  assembly_status: 'Assembly status',
  thread_type: 'Thread type',
  zero_contamination: 'No-contamination requirement',
  medium_strength: 'Medium-strength hold',
  high_temp: 'High circuit temperature',
  requirement: 'Immediate pressure / potable water / gas / adjustable',
  flange_type: 'Flange type',
  gap: 'Gap to fill',
  high_adhesion: 'High adhesion on sheet metal',
  health_safety_no_hazard: 'No hazard label required',
  fit_type: 'Fit type',
  radial_gap: 'Measured radial gap',
  temp_resistance: 'Temperature resistance required',
  temp: 'Continuous service temperature',
  material: 'Thread material',
  wear_severity: 'Wear severity',
  particle_size: 'Dominant wear mechanism',
  finish: 'Finish required',
  environment: 'Chemical environment',
};

/** Notation helper: documented rule conditions use snake_case keys. */
export const humaniseKey = (key) => inputLabels[key] || key.replace(/_/g, ' ');

/** Number and unit formatting stays in the documented form; only dates are localised. */
export const formatDate = (value) =>
  value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
