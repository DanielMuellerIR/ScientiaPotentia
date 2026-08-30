import { existsSync, readFileSync } from 'node:fs';

/**
 * Verhindert, dass ein vollständiger Merge bereits veröffentlichte Konzepte
 * still durch andere Einträge ersetzt. Eine höhere Gesamtzahl ist kein Beleg
 * dafür, dass die bisherigen IDs erhalten blieben.
 */
export function assertPreservesExistingConceptIds(path, nextConcepts, allowedRemovedIds = []) {
  if (!existsSync(path)) return;
  if (!Array.isArray(nextConcepts)) {
    throw new Error(`${path}: neue Quellwahrheit ist kein JSON-Array`);
  }

  const current = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(current)) {
    throw new Error(`${path}: bestehende Quellwahrheit ist kein JSON-Array`);
  }

  const idSet = (concepts, label) => new Set(concepts.map((concept, index) => {
    const id = concept?.id;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error(`${path}: ${label} Konzept ${index + 1} besitzt keine gültige id`);
    }
    return id;
  }));
  const currentIds = idSet(current, 'bestehendes');
  const nextIds = idSet(nextConcepts, 'neues');
  const allowed = new Set(allowedRemovedIds);
  const missing = [...currentIds].filter(id => !nextIds.has(id) && !allowed.has(id));

  if (missing.length) {
    const preview = missing.slice(0, 8).join(', ');
    const suffix = missing.length > 8 ? ` … (+${missing.length - 8})` : '';
    throw new Error(
      `${path}: Merge würde ${missing.length} bestehende Konzept-IDs löschen: ` +
      `${preview}${suffix}; Erntedateien zuerst vollständig ergänzen`,
    );
  }
}
