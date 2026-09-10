import React, { useEffect, useState } from 'react';
import ImageCredit from './ImageCredit';
import { normaliseImageCredit } from '../utils/imageCredits';
import { mirrorEntry, mirroredImageSrc, useImageMirror } from '../utils/imageMirror';

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
  const mirror = useImageMirror();
  const localSrc = mirroredImageSrc(mirror, imageUrl, width);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl, name]);

  // Solange das Manifest lädt, bleibt der Rahmen stehen — erst wenn feststeht,
  // dass es keine eigene Kopie gibt, weicht er dem Ersatz. Ein Rückfall auf
  // commons.wikimedia.org kommt nicht in Frage: Er wäre wieder eine Anfrage an
  // einen Dritten mit der IP-Adresse des Besuchers.
  if (!imageUrl || imageFailed || (mirror && !localSrc)) return fallback;

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
  const credit = normaliseImageCredit(image, mirrorEntry(mirror, imageUrl)?.mode);

  return (
    <div className={isOcular ? 'answer-reveal answer-reveal--ocular' : 'answer-reveal'}>
      <div className={frameClass}>
        <div className={matClass}>
          {localSrc ? (
            <img
              className={imageClass}
              src={localSrc}
              // Vor der Antwort darf auch assistive Technik den Namen nicht erhalten.
              alt={revealed ? (name || 'Exponat') : 'Verhülltes Exponat'}
              // Bedarfsweise laden und asynchron dekodieren. Das Panel ist
              // während einer Frage sichtbar, das Bild lädt daher rechtzeitig
              // unter der Abdeckung — die Aufdeckung bleibt sofort.
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          ) : null}
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
