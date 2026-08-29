/** Gemeinsame, verlustarme JSON-Ein-/Ausgabe für schreibende Harvest-Werkzeuge. */
const fs = require('node:fs');
const path = require('node:path');

function assertSafeDomain(domain) {
  if (typeof domain !== 'string' || !/^[a-z][a-z0-9_]*$/.test(domain)) {
    throw new Error('Domain muss aus Kleinbuchstaben, Ziffern und Unterstrichen bestehen');
  }
  return domain;
}

function readJson(file, label = path.basename(file)) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label}: nicht parsebar (${error.message})`);
  }
}

function readJsonArray(file, label = path.basename(file)) {
  const value = readJson(file, label);
  if (!Array.isArray(value)) throw new Error(`${label}: JSON-Array erwartet`);
  return value;
}

function writeJsonAtomic(file, value) {
  const directory = path.dirname(file);
  const temporary = path.join(
    directory,
    `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`,
  );
  let mode;
  try {
    mode = fs.statSync(file).mode & 0o777;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    fs.writeFileSync(
      temporary,
      `${JSON.stringify(value, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx', ...(mode === undefined ? {} : { mode }) },
    );
    fs.renameSync(temporary, file);
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

module.exports = {
  assertSafeDomain,
  readJson,
  readJsonArray,
  writeJsonAtomic,
};
