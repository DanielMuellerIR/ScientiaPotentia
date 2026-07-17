import React, { useEffect, useState } from 'react';
import { commonsToDirectUrl } from '../utils/commonsImage';

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
  width = 640,
  creditSuffix = 'Wikimedia Commons'
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
  const creditParts = [image.attribution, image.license, creditSuffix].filter(Boolean);

  return (
    <div className={isOcular ? 'answer-reveal answer-reveal--ocular' : 'answer-reveal'}>
      <div className={frameClass}>
        <div className={matClass}>
          <img
            className={imageClass}
            src={commonsToDirectUrl(imageUrl, width)}
            // Vor der Antwort darf auch assistive Technik den Namen nicht erhalten.
            alt={revealed ? (name || 'Exponat') : 'Verhülltes Exponat'}
            onError={() => setImageFailed(true)}
          />
          {isOcular ? <span className="ocular-reticle" aria-hidden="true" /> : null}
        </div>
        <div className={drapeClass} aria-hidden={revealed}>
          <span className="exhibit-drape-q">?</span>
        </div>
      </div>
      {revealed && creditParts.length > 0 ? (
        <div className="exhibit-credit" title={`Bild: ${creditParts.join(' · ')}`}>
          {isOcular ? (
            <>
              <span>Bild: {image.attribution || 'Urheberangabe fehlt'}</span>
              <span className="ocular-credit-license">
                {[image.license, creditSuffix].filter(Boolean).join(' · ')}
              </span>
            </>
          ) : (
            <>Bild: {creditParts.join(' · ')}</>
          )}
        </div>
      ) : null}
    </div>
  );
}
