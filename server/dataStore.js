/**
 * Chargement des jeux de données depuis le disque, avec validation et
 * mécanisme d'import à chaud (sans reconstruire l'application).
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildKnowledgeBase } from '../shared/kb.js';
import { DATASET_SCHEMA } from '../shared/validate.js';

export function createDataStore({ dataDir }) {
  let state = {
    kb: null,
    loadedAt: null,
    fingerprint: null,
    source: dataDir,
    loadError: null,
  };

  const fileOf = (ds) => path.join(dataDir, `${ds}.json`);

  function readRaw() {
    const raw = {};
    const readErrors = [];
    for (const [ds, schema] of Object.entries(DATASET_SCHEMA)) {
      const file = path.join(dataDir, schema.file);
      try {
        const text = fs.readFileSync(file, 'utf8');
        raw[ds] = JSON.parse(text);
      } catch (err) {
        readErrors.push({
          dataset: ds,
          file: schema.file,
          code: err instanceof SyntaxError ? 'JSON_INVALID' : 'FILE_UNREADABLE',
          message: err instanceof SyntaxError
            ? `Invalid JSON in "${schema.file}": ${err.message}`
            : `Unreadable file "${schema.file}": ${err.message}`,
        });
        raw[ds] = [];
      }
    }
    return { raw, readErrors };
  }

  function fingerprint(raw) {
    let h = 0;
    const text = JSON.stringify(raw);
    for (let i = 0; i < text.length; i += 1) {
      h = (h * 31 + text.charCodeAt(i)) | 0;
    }
    return `${text.length}-${h}`;
  }

  function load() {
    const { raw, readErrors } = readRaw();
    let kb = null;
    let loadError = null;
    if (readErrors.length && readErrors.some((e) => e.code === 'JSON_INVALID')) {
      // On conserve malgré tout une base vide valide pour que l'interface affiche l'erreur
      loadError = { type: 'DATA_INVALID', errors: readErrors };
    }
    try {
      kb = buildKnowledgeBase(raw);
    } catch (err) {
      loadError = { type: 'DATA_BUILD_FAILED', errors: [...readErrors, { message: String(err && err.stack ? err.stack : err) }] };
      kb = null;
    }
    if (kb && readErrors.length) {
      kb.validation.errors.unshift(...readErrors.map((e) => ({ code: e.code, dataset: e.dataset, path: e.file, message: e.message })));
      kb.validation.ok = false;
      kb.validation.readErrors = readErrors;
    }
    state = {
      kb,
      loadedAt: new Date().toISOString(),
      fingerprint: fingerprint(raw),
      source: dataDir,
      loadError,
      readErrors,
    };
    return state;
  }

  return {
    load,
    get state() { return state; },
    get kb() { return state.kb; },
    dataDir,
  };
}
