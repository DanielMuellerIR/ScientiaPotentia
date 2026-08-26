import React from 'react';
import { normaliseImageCredit } from '../utils/imageCredits';

/** Sichtbarer, verlinkter Nachweis für freie Konzeptbilder. */
export default function ImageCredit({ image, split = false }) {
  const credit = normaliseImageCredit(image);
  if (!credit) return null;

  const source = (
    <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">
      Wikimedia Commons
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
