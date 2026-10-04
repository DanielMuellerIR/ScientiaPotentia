import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { blacklistReason } from '../../scripts/lib/merge_blacklist.js';
import { refreshImageFields } from '../../scripts/lib/merge_images.js';

const require = createRequire(import.meta.url);
const { isBlacklistedFile, isRejectedImageMapping, isSuitableImageMotif } = require(
  '../../scripts/data_sources/harvest/image_resolution_policy.cjs');
const { validateMapping, applyMapping } = require('../../scripts/data_sources/harvest/apply_images.cjs');
const { validateCorrection } = require('../../scripts/data_sources/harvest/apply_corrections.cjs');
const policy = require('../../scripts/data_sources/harvest/IMAGE_BLACKLIST.json');

const webb = 'https://commons.wikimedia.org/wiki/File%3AJames_Webb_Space_Telescope_Mirror37.jpg';
const mapping = id => ({ id, imageFile: webb, imageLicense: 'Public domain', imageAttribution: 'NASA' });

describe('Fachlich verworfene Bildzuordnungen', () => {
  it('erkennt Roh- und Katalog-IDs sowie Commons-Titel und kodierte URLs', () => {
    for (const id of ['mission-hubble', 'astra:mission-hubble']) {
      for (const file of [webb, 'File:James_Webb_Space_Telescope_Mirror37.jpg',
        'Datei:James Webb Space Telescope Mirror37.jpg']) {
        expect(isRejectedImageMapping(id, file)).toBe(true);
      }
    }
    for (const entry of policy.rejectedMappings) {
      expect(isRejectedImageMapping(entry.conceptId, entry.commonsFileTitle)).toBe(true);
    }
  });

  it('lässt dieselbe Datei bei einem anderen passenden Konzept zu', () => {
    expect(isBlacklistedFile(webb)).toBe(false);
    expect(isRejectedImageMapping('astra:mission-jwst', webb)).toBe(false);
    expect(isRejectedImageMapping('historia:mission-hubble', webb)).toBe(false);
    expect(isSuitableImageMotif(webb, {}, { id: 'mission-jwst', category: 'mission' }, 'astra')).toBe(true);
    expect(isSuitableImageMotif(webb, {}, { id: 'mission-hubble', category: 'mission' }, 'astra')).toBe(false);
    expect(() => validateMapping([mapping('mission-jwst')])).not.toThrow();
  });

  it('blockiert Apply und Korrekturen, bevor Bildfelder geschrieben werden', () => {
    expect(() => validateMapping([mapping('mission-hubble')])).toThrow('fachlich falsches Motiv');
    const valid = { id: 'mission-jwst' };
    const hubble = { id: 'mission-hubble' };
    expect(() => applyMapping(new Map([[valid.id, valid], [hubble.id, hubble]]),
      [mapping(valid.id), mapping(hubble.id)])).toThrow('fachlich falsches Motiv');
    expect(valid.imageFile).toBeUndefined();
    expect(hubble.imageFile).toBeUndefined();
    expect(validateCorrection({ id: 'mission-hubble', set: { 'concept.imageFile': webb } }))
      .toContain('fachlich falsches Bildmotiv');
  });

  it('lässt eine alte Ernte keine geprüfte Zuordnung überschreiben', () => {
    const existing = { id: 'mission-hubble', imageFile: 'Hubble.jpg', imageLicense: 'Public domain',
      imageAttribution: 'NASA' };
    expect(blacklistReason(mapping(existing.id))).toContain('Fachlich falsches Bildmotiv');
    expect(refreshImageFields(existing, mapping(existing.id))).toEqual([]);
    expect(existing.imageFile).toBe('Hubble.jpg');
  });
});
