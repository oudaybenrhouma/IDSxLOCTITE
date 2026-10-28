/** Chargement des JEUX DE DONNÉES RÉELS (aucune donnée fictive dans les tests). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKnowledgeBase } from '../shared/kb.js';
import { DATASET_SCHEMA } from '../shared/validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '..', 'data');

export function loadRawData(dir = DATA_DIR) {
  const raw = {};
  for (const [ds, schema] of Object.entries(DATASET_SCHEMA)) {
    raw[ds] = JSON.parse(fs.readFileSync(path.join(dir, schema.file), 'utf8'));
  }
  return raw;
}

export const raw = loadRawData();
export const kb = buildKnowledgeBase(raw);
