/** Gemeinsame Strukturprüfung für Browser und Release-Audit. */
export function isMirrorFileName(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(value);
}

export function isMirrorEntry(value) {
  return Array.isArray(value) && value.length === 5
    && isMirrorFileName(value[0])
    && Number.isSafeInteger(value[1]) && value[1] > 0
    && Number.isSafeInteger(value[2]) && value[2] > 0
    && (value[3] === 0 || isMirrorFileName(value[3]))
    && (value[4] === 'o' || value[4] === 'r');
}
