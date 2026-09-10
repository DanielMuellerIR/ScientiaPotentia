import React from 'react';
import { normaliseImageCredit } from '../utils/imageCredits';
import { mirrorEntry, useImageMirror } from '../utils/imageMirror';

/** Sichtbarer, verlinkter Nachweis für freie Konzeptbilder. */
export default function ImageCredit({ image, split = false }) {
  // Der Änderungshinweis richtet sich danach, was mit der ausgelieferten Datei
  // wirklich geschehen ist: Original unverändert oder für die Anzeige verkleinert.
  const mirror = useImageMirror();
  const credit = normaliseImageCredit(image, mirrorEntry(mirror, image?.url)?.mode);
  if (!credit) return null;

  const source = (
    <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">
      {credit.sourceLabel}
    </a>
  );
  const license = credit.licenseUrl ? (
    <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">
      {credit.license || 'Lizenzhinweis'}
    </a>
  ) : (credit.license || 'Lizenzhinweis auf der Dateiseite');

  if (split) {
    return (
      <>
        <span>Bild: {credit.attribution} · {source}</span>
        <span className="ocular-credit-license">{license} · {credit.changes}</span>
      </>
    );
  }

  return (
    <span>
      Bild: {credit.attribution} · {source} · {license} · {credit.changes}
    </span>
  );
}
