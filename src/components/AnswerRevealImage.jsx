import React, { useEffect, useState } from 'react';
import { commonsToDirectUrl } from '../utils/commonsImage';
import ImageCredit from './ImageCredit';
import { normaliseImageCredit } from '../utils/imageCredits';

/**
 * Gemeinsames, konservatives Bild-Reveal für Quizvisualisierungen.
 *
 * Das Bild lädt bereits vor der Antwort, bleibt aber vollständig unter der
 * Abdeckung. So verraten weder Motiv noch Alternativtext die Lösung. Die
 * Okular-Variante ergänzt lediglich die astronomische Fassung; die
 * Freischalt- und Lizenzlogik bleibt identisch.
 */
export default function AnswerRevealImage({
  image,
  name,
  revealed = false,
  variant = 'exhibit',
  fallback = null,
  width = 640
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = image?.url || '';

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl, name]);

  if (!imageUrl || imageFailed) return fallback;

  const isOcular = variant === 'ocular';
  const frameClass = isOcular ? 'exhibit-frame exhibit-frame--ocular' : 'exhibit-frame';
  const matClass = isOcular ? 'exhibit-mat exhibit-mat--ocular' : 'exhibit-mat';
  const imageClass = [
    'exhibit-img',
    isOcular ? 'exhibit-img--ocular' : '',
    revealed ? 'exhibit-img--revealed' : ''
  ].filter(Boolean).join(' ');
  const drapeClass = [
    'exhibit-drape',
    isOcular ? 'exhibit-drape--ocular' : '',
    revealed ? 'exhibit-drape--lifted' : ''
  ].filter(Boolean).join(' ');
  const credit = normaliseImageCredit(image);

  return (
    <div className={isOcular ? 'answer-reveal answer-reveal--ocular' : 'answer-reveal'}>
      <div className={frameClass}>
        <div className={matClass}>
          <img
            className={imageClass}
            src={commonsToDirectUrl(imageUrl, width)}
            // Vor der Antwort darf auch assistive Technik den Namen nicht erhalten.
            alt={revealed ? (name || 'Exponat') : 'Verhülltes Exponat'}
            // Wikimedia-Commons-Bild bedarfsweise laden und asynchron dekodieren.
            // Das Panel ist während einer Frage sichtbar, das Bild lädt daher
            // weiterhin rechtzeitig unter der Abdeckung — die Aufdeckung bleibt sofort.
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
          {isOcular ? <span className="ocular-reticle" aria-hidden="true" /> : null}
        </div>
        <div className={drapeClass} aria-hidden={revealed}>
          <span className="exhibit-drape-q">?</span>
        </div>
      </div>
      {revealed && credit ? (
        <div
          className="exhibit-credit"
          title={`Bild: ${credit.attribution} · ${credit.license} · ${credit.sourceLabel} · ${credit.changes}`}
        >
          <ImageCredit image={image} split={isOcular} />
        </div>
      ) : null}
    </div>
  );
}
