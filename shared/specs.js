/**
 * Analyse déterministe des valeurs techniques documentées.
 * Aucune valeur n'est inventée : tout ce qui n'est pas lisible tel quel est
 * marqué `parseable: false` et affiché comme texte brut dans l'interface.
 */

const NBSP = /[\u00a0\u202f\u2009]/g;

export function cleanText(s) {
  return typeof s === 'string' ? s.replace(NBSP, ' ') : s;
}

/** "0.020 inch (0.50 mm)" -> { mm: 0.5, inch: 0.02, raw } */
export function parseGap(raw) {
  if (typeof raw !== 'string') return { raw, mm: null, inch: null, parseable: false };
  const s = cleanText(raw);
  const mmMatch = s.match(/(\d+(?:[.,]\d+)?)\s*mm/i);
  const inMatch = s.match(/(\d+(?:[.,]\d+)?)\s*(?:inch|in\b|")/i);
  const toNum = (m) => (m ? Number(m[1].replace(',', '.')) : null);
  return { raw: s, mm: toNum(mmMatch), inch: toNum(inMatch), parseable: !!mmMatch || !!inMatch };
}

/** "Coarse threads up to M80 / 3 inches" -> { M: 80, inch: 3 } */
export function parseSizeLimit(raw) {
  if (typeof raw !== 'string') return { raw, M: null, inch: null, parseable: false };
  const s = cleanText(raw);
  const mMatch = s.match(/M\s?(\d+)/i);
  const inMatch = s.match(/(\d+(?:[.,]\d+)?)\s*(?:inch|in\b|")/i);
  const toNum = (m) => (m ? Number(m[1].replace(',', '.')) : null);
  return { raw: s, M: toNum(mMatch), inch: toNum(inMatch), parseable: !!mMatch || !!inMatch };
}

/**
 * "−55 °C to +180 °C" -> { minC, maxC, parseable: true }
 * "Ambient" ou valeurs composites -> parseable: false (jamais d'invention).
 */
export function parseTempRange(raw) {
  if (typeof raw !== 'string') return { raw, minC: null, maxC: null, parseable: false };
  const s = cleanText(raw);
  const isFahrenheit = /°\s?F/i.test(s) && !/°\s?C/i.test(s);
  const nums = [...s.matchAll(/(-|−|\+)?\s?(\d+(?:[.,]\d+)?)\s*°/g)].map((m) => {
    const sign = m[1] === '-' || m[1] === '−' ? -1 : 1;
    return sign * Number(m[2].replace(',', '.'));
  });
  const ambient = /ambient/i.test(s);
  if (nums.length < 2) {
    return { raw: s, minC: null, maxC: null, parseable: false, ambient };
  }
  let min = Math.min(nums[0], nums[1]);
  let max = Math.max(nums[0], nums[1]);
  if (isFahrenheit) {
    min = Math.round(((min - 32) * 5) / 9);
    max = Math.round(((max - 32) * 5) / 9);
  }
  return { raw: s, minC: min, maxC: max, parseable: true, ambient };
}

/** Parse un critère de règle du type "<= 0.25 mm", "150 C to 204 C", "up to 3 mm", "< M6". */
export function parseThreshold(raw) {
  if (typeof raw === 'number') return { op: '<=', value: raw, unit: 'number', raw };
  if (typeof raw !== 'string') return null;
  const s = cleanText(raw).trim();
  const opMap = [
    [/^<=?\s*/, '<='],
    [/^≥\s*/, '>='],
    [/^>\s*/, '>'],
  ];
  let op = '<=';
  for (const [re, o] of opMap) {
    if (re.test(s)) { op = o; break; }
  }
  const num = s.match(/(\d+(?:[.,]\d+)?)/);
  let value = num ? Number(num[1].replace(',', '.')) : null;
  let unit = null;
  if (/°?C\b|°C/i.test(s)) unit = 'C';
  else if (/mm/i.test(s)) unit = 'mm';
  else if (/inch|in\b|"/i.test(s)) unit = 'inch';
  else if (/^\s*<\s*M\d+/i.test(s)) unit = 'metric';
  else unit = 'number';
  // "150 C to 204 C" / "0.25 mm to 0.50 mm" -> plage
  const range = s.match(/(\d+(?:[.,]\d+)?)\s*(?:[a-zA-Zµ°]+\s*)?(?:to(?!p)|-|–|—)\s*(\d+(?:[.,]\d+)?)/i);
  if (range) {
    const min = Number(range[1].replace(',', '.'));
    const max = Number(range[2].replace(',', '.'));
    // La plage ne doit pas être une simple mention d'équivalence (ex. « 0.020 inch (0.50 mm) »)
    if (max > min) return { op: 'range', min, max, unit, raw: s };
  }
  return { op, value, unit, raw: s };
}

/** Évalue un seuil parsé contre une valeur numérique utilisateur. */
export function thresholdMatches(threshold, value) {
  if (!threshold || value === null || value === undefined || Number.isNaN(value)) return null;
  if (threshold.op === 'range') return value >= threshold.min && value <= threshold.max;
  if (threshold.value === null) return null;
  switch (threshold.op) {
    case '<=': return value <= threshold.value;
    case '>=': return value >= threshold.value;
    case '>': return value > threshold.value;
    case '<': return value < threshold.value;
    default: return null;
  }
}

export const REVIEW_STATUS = {
  CONFIRMED: 'confirme',
  TENTATIVE: 'a_verifier',
  UNKNOWN: 'non_documente',
};

export const REVIEW_LABELS = {
  confirme: 'Confirmed match',
  a_verifier: 'Candidate to verify',
  non_documente: 'Not documented',
};
