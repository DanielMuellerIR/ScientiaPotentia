import React, { useRef, useEffect, useState } from 'react';
import ConceptVisual from './ConceptVisual';
import * as THREE from 'three';
// Erscheinungs-/Beschriftungsdaten zentral (geteilt mit SolarSystemExplorer).
import {
  TEX_BASE, TEXTURE_CREDIT, TEXTURES, BODY_COLORS,
  CATEGORY_LABELS, ATTR_LABELS, PLANET_ORDER
} from './astraBodies';
import { formatAttributeValue, isAttrLeakedBeforeAnswer, sourceRevealsValue } from './conceptLabels';
import AnswerRevealImage from './AnswerRevealImage';

/**
 * Astra-Visualisierung: 3D-Himmelskörper auf Sternenfeld (three.js).
 *
 * Pro Quizfrage wird das gefragte Konzept links dargestellt:
 *   - Planet / Zwergplanet / Mond -> rotierende, beleuchtete Kugel. Mit echter
 *     Oberflächentextur (Solar System Scope, CC BY 4.0), sofern vorhanden;
 *     sonst prozedural eingefärbt (keine erfundene Textur).
 *   - Stern (inkl. Sonne) -> selbstleuchtende Kugel in spektraltypischer Farbe.
 *   - Galaxie -> prozedurale, additiv leuchtende Scheibe.
 *   - Konstante -> kein Körper, der Wert wird groß eingeblendet.
 *
 * three.js wird imperativ in einem useEffect betrieben (Renderer/Scene/Loop),
 * React steuert nur das aktive Konzept. Die Komponente wird in der Registry
 * lazy geladen, damit three.js nur für Astra ins Bundle kommt.
 *
 * Props (von VisualPanel):
 *   - domain, concepts, srsProgress
 *   - activeConcept:    aktuell gefragtes Konzept (oder null außerhalb des Quiz)
 */

// TEX_BASE, TEXTURE_CREDIT, TEXTURES, BODY_COLORS, CATEGORY_LABELS,
// ATTR_LABELS, PLANET_ORDER -> jetzt zentral in ./astraBodies (oben importiert).

export const NEUTRAL_STAR_COLOR = 0xffdfbd;
export const SATURN_RING_TEXTURE = `${TEX_BASE}saturn_rings_pia06175.jpg`;
export const SATURN_RING_CREDIT = Object.freeze({
  author: 'NASA/JPL/Space Science Institute',
  sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA06175',
  license: 'NASA Media Usage Guidelines',
  licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
  changes: 'auf 1600 Pixel Breite verkleinert'
});

const SPECTRAL_COLORS = Object.freeze({
  O: 0x9bb0ff,
  B: 0xaabfff,
  A: 0xcad7ff,
  F: 0xf8f7ff,
  G: 0xfff4ea,
  K: 0xffd2a1,
  M: 0xffb56c
});
const DEEP_SKY_CATEGORIES = new Set(['galaxy', 'nebula', 'star_cluster']);
const EXHIBIT_REVEAL_CATEGORIES = new Set([
  'comet',
  'constellation',
  'meteor_shower',
  'mission',
  'object',
  'phenomenon'
]);
const CONTEXT_ATTRS = ['orderFromSun', 'distanceFromSunAU', 'distanceLy', 'parentPlanet', 'location'];
export function isAstraAttrLeakedBeforeAnswer(key, testedAttribute) {
  return isAttrLeakedBeforeAnswer(key, testedAttribute);
}

/** Spektralfarbe ausschließlich aus einem expliziten O/B/A/F/G/K/M-Wert. */
export function spectralColorFromAttributes(attributes = {}, neutralize = false) {
  if (neutralize) return NEUTRAL_STAR_COLOR;
  const spectralClass = typeof attributes.spectralClass === 'string'
    ? attributes.spectralClass.trim().toUpperCase().replace(/\s+/g, '')
    : '';
  // Ein freies Wort wie "orange" oder "mysterious" darf nicht zufällig als
  // O- bzw. M-Klasse gelten. Belastbar sind nur der einzelne Klassenbuchstabe
  // oder eine übliche, mit einer Temperaturziffer fortgesetzte Schreibweise.
  const match = spectralClass.match(/^([OBAFGKM])(?:$|[0-9])/);
  return match ? SPECTRAL_COLORS[match[1]] : NEUTRAL_STAR_COLOR;
}

/** Prüft nur strukturierte Daten; Freitext wie funFact ist bewusst keine Evidenz. */
export function hasAtmosphereEvidence(attributes = {}) {
  const atmosphere = attributes.atmosphere;
  const hasPositiveText = value => {
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toLocaleLowerCase('de-DE');
    return Boolean(normalized) &&
      !/^(?:false|nein|keine|kein|ohne|unbekannt|unknown|none|n\/a|—|-)$/.test(normalized);
  };

  // Bei widersprüchlichen Daten gewinnt die explizite Negation: lieber kein
  // Effekt als aus inkonsistenter Evidenz eine Atmosphäre abzuleiten.
  if (atmosphere && !Array.isArray(atmosphere) && typeof atmosphere === 'object') {
    if (Object.hasOwn(atmosphere, 'present') && atmosphere.present !== true) return false;
    if (Object.hasOwn(atmosphere, 'hasAtmosphere') && atmosphere.hasAtmosphere !== true) return false;
  }
  if (attributes.hasAtmosphere === true) return true;

  if (Array.isArray(atmosphere)) return atmosphere.some(hasPositiveText);
  if (atmosphere && typeof atmosphere === 'object') {
    // Explizite Negation gewinnt. Ansonsten akzeptieren wir nur bekannte
    // strukturierte Evidenzfelder, nicht beliebige Objektwerte wie false.
    if (Object.hasOwn(atmosphere, 'present')) return atmosphere.present === true;
    if (Object.hasOwn(atmosphere, 'hasAtmosphere')) return atmosphere.hasAtmosphere === true;
    return ['composition', 'components', 'gases'].some(key => {
      const value = atmosphere[key];
      return Array.isArray(value) ? value.some(hasPositiveText) : hasPositiveText(value);
    });
  }
  return hasPositiveText(atmosphere);
}

export function hasTransitEvidence(concept) {
  return (concept?.category || concept?.type) === 'exoplanet' &&
    /transit/i.test(String(concept?.attributes?.discoveryMethod || ''));
}

/**
 * Eine zentrale Offenlegungspolitik hält Canvas, Overlays und Quellenzeile
 * synchron. Alle vor der Antwort sichtbaren Attribute laufen durch denselben
 * Guard wie ConceptVisual und die semantische QA.
 */
export function getAstraDisclosurePolicy({
  concept,
  testedAttribute = null,
  answerIsName = false,
  hideConceptIdentity = false,
  isQuestionAnswered = false
}) {
  const detailsUnlocked = Boolean(isQuestionAnswered);
  const hideIdentity = (answerIsName || hideConceptIdentity) && !detailsUnlocked;
  const attrs = concept?.attributes || {};
  const category = concept?.category || concept?.type || '';
  const isDeepSky = DEEP_SKY_CATEGORIES.has(category);
  const usesExhibitReveal = EXHIBIT_REVEAL_CATEGORIES.has(category);
  const beforeAnswer = !detailsUnlocked;
  const attrHidden = key => beforeAnswer && isAstraAttrLeakedBeforeAnswer(key, testedAttribute);
  const atmosphereHidden = attrHidden('hasAtmosphere') || attrHidden('atmosphere');
  const testedValue = testedAttribute != null ? attrs[testedAttribute] : null;
  const sourceName = concept?.source?.name || '';
  const sourceUrl = concept?.source?.url || '';
  // Bei Typ-/Kategoriefragen kann schon die charakteristische Oberfläche,
  // ein Ringsystem oder die Bahn die Antwort nahelegen. Dann bleibt die Szene
  // bis zur Antwort ebenso neutral wie bei einer Identitätsfrage.
  const neutralizeSceneIdentity = hideIdentity || attrHidden('type') || attrHidden('category');

  return {
    detailsUnlocked,
    hideIdentity,
    neutralizeSceneIdentity,
    neutralizeStar: neutralizeSceneIdentity || attrHidden('spectralClass'),
    showRings: attrs.hasRings === true && !neutralizeSceneIdentity && !attrHidden('hasRings'),
    showAtmosphere: hasAtmosphereEvidence(attrs) && !neutralizeSceneIdentity && !atmosphereHidden,
    showContextMap: !neutralizeSceneIdentity && !CONTEXT_ATTRS.some(attrHidden),
    isDeepSky,
    usesExhibitReveal,
    showDeepSkyImage: isDeepSky && Boolean(concept?.image?.url),
    revealDeepSkyImage: detailsUnlocked,
    showTransitDiagram: detailsUnlocked && !hideIdentity && hasTransitEvidence(concept),
    // Eine URL kann die Antwort auch dann verraten, wenn der sichtbare Name
    // neutral ist (z. B. eine Missionskennung mit Startjahr). Links werden
    // deshalb grundsätzlich erst nach der Antwort freigeschaltet.
    sourceLinkUrl: detailsUnlocked ? sourceUrl : '',
    showSource: Boolean(sourceName) && !(beforeAnswer && (
      hideIdentity || sourceRevealsValue(sourceName, testedValue)
    ))
  };
}

function NeutralAstraExhibit() {
  return (
    <div className="answer-reveal">
      <div className="exhibit-frame" role="img" aria-label="Neutrale schematische Astra-Ansicht">
        <div className="exhibit-mat">
          <span className="exhibit-drape-q" aria-hidden="true">?</span>
        </div>
      </div>
      <div className="deep-sky-fallback-label">Schematische Ansicht</div>
    </div>
  );
}

/** Bildtafel für nicht kugelförmige Astra-Kategorien wie Missionen und Kometen. */
export function AstraExhibitReveal({ concept, revealed }) {
  if (!EXHIBIT_REVEAL_CATEGORIES.has(concept?.category || concept?.type)) return null;
  return (
    <div style={{ position: 'absolute', inset: '12px 0', zIndex: 2, display: 'grid', placeItems: 'center' }}>
      <AnswerRevealImage
        image={concept?.image}
        name={concept?.name}
        revealed={revealed}
        width={960}
        fallback={<NeutralAstraExhibit />}
      />
    </div>
  );
}

function NeutralDeepSkyOcular() {
  return (
    <div className="answer-reveal answer-reveal--ocular">
      <div className="exhibit-frame exhibit-frame--ocular">
        <div
          className="exhibit-mat exhibit-mat--ocular"
          role="img"
          aria-label="Neutrale schematische Deep-Sky-Ansicht"
        >
          <span className="deep-sky-neutral" aria-hidden="true" />
          <span className="ocular-reticle" aria-hidden="true" />
        </div>
      </div>
      <div className="deep-sky-fallback-label">Schematische Ansicht</div>
    </div>
  );
}

/** Geteilte Okularfassung für Galaxien, Nebel und Sternhaufen. */
export function DeepSkyOcular({ concept, revealed }) {
  if (!DEEP_SKY_CATEGORIES.has(concept?.category || concept?.type)) return null;
  return (
    <AnswerRevealImage
      image={concept?.image}
      name={concept?.name}
      revealed={revealed}
      variant="ocular"
      width={960}
      fallback={<NeutralDeepSkyOcular />}
    />
  );
}

/** Rein schematische Lichtkurve; sie erscheint nur nach einer beantworteten Frage. */
export function ExoplanetTransitDiagram() {
  return (
    <div className="astra-transit" aria-label="Schematische Exoplaneten-Transitlichtkurve">
      <svg viewBox="0 0 180 66" role="img" aria-hidden="true">
        <path className="astra-transit-axis" d="M8 10 V54 H172" />
        <path className="astra-transit-curve" d="M10 18 H62 C72 18 72 46 84 46 H108 C120 46 120 18 130 18 H170" />
        <circle className="astra-transit-marker" cx="0" cy="0" r="3" />
      </svg>
      <span>Schema / nicht maßstabsgetreu</span>
    </div>
  );
}

/** Weiches radiales Glow-Sprite (für Sterne/Galaxien) als Canvas-Textur. */
function makeGlowTexture(rgb = '255,240,200') {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.4, `rgba(${rgb},0.6)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Dunkelt ausschließlich den Sternrand ab und lässt die Mitte transparent. */
function makeLimbDarkeningTexture() {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const radius = size / 2;
  const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  gradient.addColorStop(0, 'rgba(20,8,2,0)');
  gradient.addColorStop(0.68, 'rgba(20,8,2,0)');
  gradient.addColorStop(0.88, 'rgba(18,7,2,.22)');
  gradient.addColorStop(1, 'rgba(8,3,1,.72)');
  ctx.save();
  ctx.beginPath();
  ctx.arc(radius, radius, radius - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
  const texture = new THREE.CanvasTexture(cv);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function hexToRgbStr(hex) {
  return `${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255}`;
}

/**
 * Prozedurale Stern-Oberfläche als Graustufen-Canvas-Textur: feine Granulation
 * (Konvektionszellen) + ein paar dunklere Sternflecken. Wird per
 * MeshBasicMaterial mit `color: starColor` multipliziert -> getönte, lebendige
 * Oberfläche statt flacher Einzelfarbe (Antares & Co. wirkten sonst wie eine
 * Scheibe). EINE Textur genügt für alle Sterne — die Spektralfarbe liefert das
 * Material, nicht die Textur. Grundton ist absichtlich hell (~0.9), damit die
 * Multiplikation den Stern kaum abdunkelt.
 */
function makeStarSurfaceTexture() {
  const w = 1024, h = 512;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgb(232,232,232)';
  ctx.fillRect(0, 0, w, h);

  // Weicher Helligkeitsfleck (Granule). lum 0..255, a = Deckkraft.
  const blob = (cx, cy, r, lum, a) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${lum},${lum},${lum},${a})`);
    g.addColorStop(1, `rgba(${lum},${lum},${lum},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  };

  // Granulation: viele kleine Flecken, abwechselnd heller/dunkler als der Grund.
  for (let i = 0; i < 1400; i++) {
    const r = 6 + Math.random() * 22;
    const lighter = Math.random() < 0.5;
    const lum = lighter ? 255 : 170 + Math.random() * 40;
    blob(Math.random() * w, Math.random() * h, r, lum, 0.06 + Math.random() * 0.10);
  }
  // Wenige größere, dunklere Sternflecken für grobe Struktur.
  for (let i = 0; i < 6; i++) {
    blob(Math.random() * w, Math.random() * h, 30 + Math.random() * 50, 120 + Math.random() * 40, 0.18);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// PLANET_ORDER (deutscher Planetenname -> Position 1..8) kommt aus ./astraBodies.

/**
 * Phase 2d — konzeptgenaue Hervorhebung als kleines Kontext-Schema (Inset).
 * Der 3D-Körper zeigt das Objekt selbst; dieses Schema zeigt zusätzlich, WO es
 * im Größeren sitzt:
 *   - Planet/Zwergplanet/Mond -> schematisches Sonnensystem (Bahnen), die zum
 *     Konzept gehörende Bahn leuchtet auf (Mond an der Bahn seines Planeten).
 *   - Stern/Galaxie           -> logarithmische Entfernungsskala (Erde -> Objekt).
 *   - Konstante / Sonne       -> kein Schema.
 * Reines SVG, keine zusätzliche Abhängigkeit.
 */
function AstraContextMap({ concept, accent }) {
  if (!concept) return null;
  const cat = concept.category || concept.type;
  const a = concept.attributes || {};

  // --- Sonnensystem-Schema (Aufsicht) ----------------------------------
  if (cat === 'planet' || cat === 'dwarf_planet' || cat === 'moon') {
    const cx = 50, cy = 50;
    const ringR = o => 8 + o * 4.6; // schematischer Bahnradius je Position
    const dwarfR = 49;              // gestrichelte Bahn jenseits Neptun

    let hiOrder = null;   // hervorgehobene Planetenbahn (1..8)
    let onDwarf = false;  // Objekt sitzt auf der Zwergplaneten-Bahn
    let moon = false;     // zusätzlicher Mond-Punkt außerhalb der Planetenbahn
    if (cat === 'planet') {
      hiOrder = Number(a.orderFromSun) || null;
    } else if (cat === 'moon') {
      const p = String(a.parentPlanet || '').toLowerCase();
      const key = Object.keys(PLANET_ORDER).find(k => p.includes(k));
      hiOrder = key ? PLANET_ORDER[key] : null;
      onDwarf = !hiOrder; // z.B. Charon (Mond eines Zwergplaneten) -> äußere Bahn
      moon = true;
    } else {
      onDwarf = true; // Zwergplanet
    }

    // Punkt auf der betonten Bahn (fester Winkel, gut sichtbar unten-links).
    const ang = (220 * Math.PI) / 180;
    const r = onDwarf ? dwarfR : (hiOrder ? ringR(hiOrder) : null);
    const dot = r != null ? { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) } : null;
    const moonDot = moon && dot ? { x: cx + (r + 3.5) * Math.cos(ang), y: cy + (r + 3.5) * Math.sin(ang) } : null;

    return (
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        {/* acht Planetenbahnen */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map(o => (
          <circle key={o} cx={cx} cy={cy} r={ringR(o)} fill="none"
            stroke={o === hiOrder ? accent : 'rgba(255,255,255,0.18)'}
            strokeWidth={o === hiOrder ? 1.4 : 0.5} />
        ))}
        {/* Zwergplaneten-Bahn (gestrichelt) */}
        <circle cx={cx} cy={cy} r={dwarfR} fill="none"
          stroke={onDwarf ? accent : 'rgba(255,255,255,0.14)'}
          strokeWidth={onDwarf ? 1.2 : 0.5} strokeDasharray="2 2.5" />
        {/* Sonne */}
        <circle cx={cx} cy={cy} r={3.4} fill="#ffcf6b" />
        <circle cx={cx} cy={cy} r={5.5} fill="none" stroke="#ffcf6b55" strokeWidth={2} />
        {/* hervorgehobenes Objekt */}
        {dot && (
          <>
            <circle cx={dot.x} cy={dot.y} r={4.6} fill="none" stroke={accent} strokeWidth={0.8} opacity={0.5} />
            <circle cx={dot.x} cy={dot.y} r={2.4} fill={accent}
              stroke="#fff" strokeWidth={0.7} style={{ filter: `drop-shadow(0 0 3px ${accent})` }} />
          </>
        )}
        {moonDot && <circle cx={moonDot.x} cy={moonDot.y} r={1.2} fill="#fff" />}
      </svg>
    );
  }

  // --- Entfernungsskala für Sterne/Galaxien ----------------------------
  if (cat === 'star' || cat === 'galaxy') {
    const d = Number(a.distanceLy);
    if (!isFinite(d) || d <= 0.1) return null; // Sonne (≈0) braucht keine Skala
    const lmax = Math.log10(5e7); // Skala bis ~50 Mio. Lichtjahre
    const t = Math.max(0.02, Math.min(1, Math.log10(Math.max(d, 1)) / lmax));
    const x0 = 8, x1 = 116, y = 22;
    const px = x0 + (x1 - x0) * t;
    const distLabel = d >= 1000 ? `${(d / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Tsd. Lj` : `${d.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Lj`;
    return (
      <svg viewBox="0 0 124 30" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <line x1={x0} y1={y} x2={x1} y2={y} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
        {/* Erde links */}
        <circle cx={x0} cy={y} r={2.2} fill="#6fb6ff" />
        <text x={x0} y={y + 7} fill="#cdd7ff" fontSize="5" textAnchor="middle">Erde</text>
        {/* Objekt auf der Log-Skala */}
        <circle cx={px} cy={y} r={2.8} fill={accent} stroke="#fff" strokeWidth={0.7}
          style={{ filter: `drop-shadow(0 0 3px ${accent})` }} />
        <text x={Math.min(px, 108)} y={y - 4} fill="#EAE6DC" fontSize="5.5" textAnchor="middle">{distLabel}</text>
      </svg>
    );
  }

  return null; // Konstante -> kein Schema
}

/*
 * Selbstverräter-Guard (Phase 6):
 *   - testedAttribute (string|null): Attribut-Key, den die aktuelle Frage abfragt
 *     (z.B. 'type', 'orderFromSun'). null bei Reverse-Fragen / keinem Attribut.
 *   - answerIsName (boolean): true, wenn die Antwort der Konzeptname selbst ist
 *     ("Welcher Planet ist der 3.?"). Dann verrät schon der Name-Header die Antwort.
 *   - isQuestionAnswered (boolean): Nach der Antwort darf das Visual erklärende
 *     Details, Kontextkarten und FunFacts wieder zeigen.
 *
 * Die Guards greifen nur vor der Antwort; danach wird das Panel zur Erklärung.
 */
export default function AstraVisual({
  domain,
  activeConcept,
  testedAttribute = null,
  answerIsName = false,
  hideConceptIdentity = false,
  isQuestionAnswered = false
}) {
  const mountRef = useRef(null);
  // three-Objekte über Renders hinweg halten, ohne Re-Render auszulösen.
  const ctx = useRef({});
  const [ready, setReady] = useState(false);
  const [rendererUnavailable, setRendererUnavailable] = useState(false);
  const detailsUnlocked = Boolean(isQuestionAnswered);
  const hideIdentity = (answerIsName || hideConceptIdentity) && !detailsUnlocked;
  const disclosure = getAstraDisclosurePolicy({
    concept: activeConcept,
    testedAttribute,
    answerIsName,
    hideConceptIdentity,
    isQuestionAnswered
  });

  // --- Szene einmalig aufbauen ------------------------------------------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    camera.position.set(0, 0, 3.2);

    let renderer;
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2', { antialias: true, alpha: true });
      if (!context) {
        setRendererUnavailable(true);
        return;
      }
      renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
    } catch {
      setRendererUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const loader = new THREE.TextureLoader();

    // Sternenfeld: Milchstraßen-Textur auf großer, innen sichtbarer Kugel.
    const starTex = loader.load(`${TEX_BASE}2k_stars_milky_way.jpg`);
    starTex.colorSpace = THREE.SRGBColorSpace;
    const starfield = new THREE.Mesh(
      new THREE.SphereGeometry(600, 48, 48),
      new THREE.MeshBasicMaterial({ map: starTex, side: THREE.BackSide })
    );
    scene.add(starfield);

    // Beleuchtung für texturierte Körper.
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
    sunLight.position.set(5, 2, 4);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    // Wiederverwendbare Körper-Kugel.
    const bodyGeo = new THREE.SphereGeometry(1, 64, 64);
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x888888 }));
    scene.add(body);

    // Jupiter, Uranus und Neptun haben schwache Ringsysteme (NASA). Eine breite,
    // helle Scheibe suggerierte Saturnringe; hier nur ein dezenter schematischer Ring.
    const ringGeo = new THREE.RingGeometry(1.35, 1.41, 160);
    const rings = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xc8c2ae,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    rings.rotation.x = 1.15;
    rings.rotation.z = -0.18;
    rings.visible = false;
    scene.add(rings);

    // Die NASA-Aufnahme zeigt Saturns Ringe bereits perspektivisch. Eine
    // separate Ebene bewahrt diese Geometrie; Schwarz bleibt durch additives
    // Blending transparent, die Planetenkugel verdeckt den mittleren Bereich.
    const saturnRingGeo = new THREE.PlaneGeometry(2.05, 0.35);
    const saturnRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const saturnRingRight = new THREE.Mesh(saturnRingGeo, saturnRingMaterial);
    saturnRingRight.position.x = 1.025;
    const saturnRingLeft = new THREE.Mesh(saturnRingGeo, saturnRingMaterial);
    saturnRingLeft.position.x = -1.025;
    saturnRingLeft.scale.x = -1;
    const saturnRings = new THREE.Group();
    saturnRings.add(saturnRingLeft, saturnRingRight);
    saturnRings.position.z = -0.16;
    saturnRings.visible = false;
    scene.add(saturnRings);

    // Dünner Fresnel-Saum: keine angenommene Atmosphäre, sondern nur dann
    // sichtbar, wenn strukturierte Attribute die Atmosphäre belegen.
    const atmosphereGeo = new THREE.SphereGeometry(1.07, 64, 64);
    const atmosphereRim = new THREE.Mesh(
      atmosphereGeo,
      new THREE.ShaderMaterial({
        uniforms: { glowColor: { value: new THREE.Color(0x8fc8ff) } },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 glowColor;
          varying vec3 vNormal;
          void main() {
            float rim = pow(1.0 - max(0.0, vNormal.z), 3.4);
            gl_FragColor = vec4(glowColor, rim * 0.55);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    );
    atmosphereRim.visible = false;
    scene.add(atmosphereRim);

    // Glühender Halo für Sterne/Galaxien (Sprite).
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
    }));
    glow.scale.set(3.6, 3.6, 1);
    glow.visible = false;
    scene.add(glow);

    // Separate Randabdunklung über der Sternkugel. Das Sprite ist neutral und
    // wird zusammen mit dem Stern-Halo an-/abgeschaltet.
    const limbDarkening = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeLimbDarkeningTexture(),
      transparent: true,
      depthTest: false,
      depthWrite: false
    }));
    limbDarkening.position.z = 1.02;
    limbDarkening.scale.set(2.03, 2.03, 1);
    limbDarkening.visible = false;
    limbDarkening.renderOrder = 4;
    scene.add(limbDarkening);

    // Eine wiederverwendbare Stern-Oberflächentextur (Granulation) für alle
    // Sterne ohne echte Textur; die Spektralfarbe kommt vom Material.
    const starSurface = makeStarSurfaceTexture();

    Object.assign(ctx.current, {
      scene,
      camera,
      renderer,
      loader,
      body,
      rings,
      saturnRings,
      saturnRingMaterial,
      atmosphereRim,
      starfield,
      glow,
      limbDarkening,
      starSurface,
      texCache: {},
      isStarActive: false,
      glowBaseScale: 3.6
    });

    // Größe an Container koppeln.
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const startedAt = performance.now();
    let raf;
    const animate = now => {
      if (!reducedMotion) {
        body.rotation.y += 0.0025;
        rings.rotation.z += 0.00025;
        glow.material.rotation += 0.001;
        starfield.rotation.y += 0.0002;
        if (ctx.current.isStarActive) {
          // Sehr kleine, periodische Änderung: sichtbar lebendig, aber kein
          // hektisches Flackern und keinerlei DOM-Messung im Render-Loop.
          const pulse = 1 + Math.sin((now - startedAt) / 720) * 0.012;
          const scale = (ctx.current.glowBaseScale || 3.6) * pulse;
          glow.scale.set(scale, scale, 1);
          glow.material.opacity = 0.92 + Math.sin((now - startedAt) / 510) * 0.04;
        }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    setReady(true);

    // Aufräumen: Loop, Observer, GPU-Ressourcen.
    // codereview-ok: Reihenfolge korrekt — dispose/cancelAnimationFrame vor ctx.current={} (2026-07-08)
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      // codereview-ok: texCache auf ~10 feste TEXTURES begrenzt, kein Leck/Doppel-Dispose (2026-07-08)
      Object.values(ctx.current.texCache || {}).forEach(t => t.dispose());
      starSurface.dispose();
      starTex.dispose();
      bodyGeo.dispose();
      body.material.dispose();
      ringGeo.dispose();
      rings.material.dispose();
      saturnRingGeo.dispose();
      saturnRingMaterial.dispose();
      atmosphereGeo.dispose();
      atmosphereRim.material.dispose();
      glow.material.map?.dispose();
      glow.material.dispose();
      limbDarkening.material.map?.dispose();
      limbDarkening.material.dispose();
      starfield.material.dispose();
      starfield.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      ctx.current = {};
    };
  }, []);

  // --- Aktives Konzept auf die Szene anwenden ---------------------------
  useEffect(() => {
    const c = ctx.current;
    if (!ready || !c.body) return;
    const {
      body,
      rings,
      saturnRings,
      saturnRingMaterial,
      atmosphereRim,
      glow,
      limbDarkening,
      loader,
      texCache,
      starSurface
    } = c;

    c.isStarActive = false;
    body.visible = false;
    rings.visible = false;
    saturnRings.visible = false;
    atmosphereRim.visible = false;
    glow.visible = false;
    limbDarkening.visible = false;
    glow.material.opacity = 1;

    if (!activeConcept) return;

    const id = (activeConcept.id || '').replace(/^astra:/, '');
    const cat = activeConcept.category || activeConcept.type;

    // Deep-Sky-Objekte liegen vollständig im DOM-Okular. Dort gibt es für
    // Galaxie, Nebel und Sternhaufen dasselbe neutrale Ladefehler-/Ohne-Bild-
    // Fallback; dadurch fällt keine Kategorie auf eine irreführende Kugel zurück.
    if (disclosure.isDeepSky || disclosure.usesExhibitReveal) return;
    if (cat === 'constant') return;

    body.visible = true;

    const isStar = cat === 'star';
    const texFile = TEXTURES[id];
    const starColor = spectralColorFromAttributes(
      activeConcept.attributes,
      disclosure.neutralizeStar
    );

    if (texFile && !isStar && !disclosure.neutralizeSceneIdentity) {
      // Echte Oberflächentextur laden (gecached).
      let tex = texCache[id];
      if (!tex) {
        tex = loader.load(`${TEX_BASE}${texFile}`);
        tex.colorSpace = THREE.SRGBColorSpace;
        texCache[id] = tex;
      }
      body.material.dispose();
      body.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
    } else {
      // Ohne belastbare Evidenz bleiben Sterne neutral warm. Bei versteckter
      // Identität werden auch Körperfarbe und echte Textur neutralisiert.
      const color = isStar
        ? starColor
        : disclosure.neutralizeSceneIdentity
          ? 0x9b9286
          : (BODY_COLORS[id] || (cat === 'dwarf_planet' ? 0xb8a98f : 0x9b9286));
      body.material.dispose();
      body.material = isStar
        ? new THREE.MeshBasicMaterial({ map: starSurface, color })
        : new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
    }

    // Corona und Randabdunklung gehören zur neutralen Standarddarstellung jedes
    // Sterns; nur die Farbe kann bei belegter Spektralklasse variieren.
    if (isStar) {
      glow.material.map?.dispose();
      glow.material.map = makeGlowTexture(hexToRgbStr(starColor));
      glow.scale.set(3.6, 3.6, 1);
      glow.visible = true;
      limbDarkening.visible = true;
      c.isStarActive = true;
      c.glowBaseScale = 3.6;
    }

    if (disclosure.showRings) {
      if (id === 'saturn') {
        let ringTexture = texCache.saturnRingsPia06175;
        if (!ringTexture) {
          ringTexture = loader.load(SATURN_RING_TEXTURE);
          ringTexture.colorSpace = THREE.SRGBColorSpace;
          texCache.saturnRingsPia06175 = ringTexture;
        }
        saturnRingMaterial.map = ringTexture;
        saturnRingMaterial.needsUpdate = true;
        saturnRings.visible = true;
      } else {
        rings.visible = true;
      }
    }

    atmosphereRim.visible = disclosure.showAtmosphere;
  }, [
    activeConcept,
    ready,
    disclosure.neutralizeSceneIdentity,
    disclosure.neutralizeStar,
    disclosure.isDeepSky,
    disclosure.usesExhibitReveal,
    disclosure.showAtmosphere,
    disclosure.showRings
  ]);

  // --- HTML-Overlay (Infos + Lizenz) über dem Canvas --------------------
  const accent = domain.accent || '#5B4B8A';
  const cat = activeConcept?.category || activeConcept?.type;
  const catLabel = CATEGORY_LABELS[cat] || cat || '';
  const attrs = activeConcept?.attributes || {};
  const attrEntries = disclosure.hideIdentity
    ? []
    : Object.entries(attrs)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'unit')
        .filter(([k]) => detailsUnlocked || !isAstraAttrLeakedBeforeAnswer(k, testedAttribute))
        .slice(0, 4);
  const activeId = (activeConcept?.id || '').replace(/^astra:/, '');
  const hasSurfaceTexture = Boolean(
    activeConcept &&
    cat !== 'star' &&
    TEXTURES[activeId] &&
    !disclosure.neutralizeSceneIdentity
  );
  const showCategory = detailsUnlocked ||
    (!isAstraAttrLeakedBeforeAnswer('type', testedAttribute) &&
      !isAstraAttrLeakedBeforeAnswer('category', testedAttribute));
  const hideConstantValue = disclosure.hideIdentity ||
    (!detailsUnlocked && isAstraAttrLeakedBeforeAnswer('value', testedAttribute));
  const showSaturnRingCredit = disclosure.showRings && activeId === 'saturn';
  const showConceptSource = !hasSurfaceTexture && disclosure.showSource;

  if (rendererUnavailable) {
    return <ConceptVisual domain={domain} concept={activeConcept} testedAttribute={testedAttribute}
      answerIsName={answerIsName} hideConceptIdentity={hideConceptIdentity} isQuestionAnswered={isQuestionAnswered} />;
  }

  return (
    <div
      className="terra-panel quiz-scene quiz-scene--astra" tabIndex={0} aria-label="Illustration und Erklärung"
      style={{
        height: '100%', position: 'relative',
        border: '1px solid var(--border-light)', background: '#05060f'
      }}
    >
      <div className="quiz-scene-stage">
      {/* Der Canvas und die Bildtafel teilen einen eigenen Illustrationsrahmen. */}
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {activeConcept && disclosure.isDeepSky ? (
        <DeepSkyOcular concept={activeConcept} revealed={disclosure.revealDeepSkyImage} />
      ) : null}

      {activeConcept && disclosure.usesExhibitReveal ? (
        <AstraExhibitReveal concept={activeConcept} revealed={disclosure.detailsUnlocked} />
      ) : null}

      {activeConcept && disclosure.showTransitDiagram ? <ExoplanetTransitDiagram /> : null}

      {disclosure.showRings && activeId !== 'saturn' && (
        <span style={{ position: 'absolute', top: '8px', right: '12px', color: '#aaa', fontSize: '10px' }}>
          Ringe schematisch
        </span>
      )}

      {/* Kontext-Schema (Phase 2d): verortet das Konzept zusätzlich zum 3D-Körper.
          Unten links, über dem Canvas, oberhalb der Fuß-Leiste. Gibt für
          Konstanten/Sonne null zurück und ist dann unsichtbar.
          Selbstverräter-Guard: Bei Fragen nach Entfernung, Bahn, Zentralplanet
          oder Lage ganz weglassen, da das Schema die Antwort verraten würde. */}
      {activeConcept && disclosure.showContextMap && (
        <div style={{
          position: 'absolute', left: '16px', bottom: '12px',
          width: '140px', height: '140px', pointerEvents: 'none', zIndex: 2
        }}>
          <AstraContextMap concept={activeConcept} accent={accent} />
        </div>
      )}

      </div>

      {activeConcept && (
        <>
          {/* Kopf: Kategorie + Name */}
          <div className="quiz-scene-header" style={{
            padding: '14px 20px',
            textAlign: 'center', color: '#EAE6DC', pointerEvents: 'none', zIndex: 4,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)'
          }}>
            {catLabel && showCategory && (
              <div style={{
                display: 'inline-block', fontSize: '11px', fontWeight: 700,
                letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.8,
                padding: '3px 12px', borderRadius: '999px',
                border: `1px solid ${accent}aa`, background: `${accent}33`, marginBottom: '8px'
              }}>{catLabel}</div>
            )}
            {/* Selbstverräter-Guard: Bei unbeantworteten Reverse-Fragen ist der
                Name selbst die gesuchte Antwort -> neutraler Platzhalter. */}
            <h2 style={{
              fontFamily: 'var(--font-title)', fontSize: '30px', fontWeight: 700,
              margin: 0, letterSpacing: '0.5px', textShadow: '0 2px 12px rgba(0,0,0,0.8)'
            }}>{disclosure.hideIdentity ? '?' : activeConcept.name}</h2>
          </div>

          {/* Fuß: Konstante prominent, sonst Kennwerte + Fun-Fact */}
          <div className="quiz-scene-details" style={{
            padding: '14px 20px',
            color: '#EAE6DC', zIndex: 4,
            background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)'
          }}>
            {cat === 'constant' ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '34px', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
                  {hideConstantValue ? '?' : String(attrs.value ?? '')}{!hideConstantValue && attrs.unit ? ` ${attrs.unit}` : ''}
                </div>
                {/* Freitext erst nach der Antwort zeigen: FunFacts enthalten oft
                    indirekte Hinweise auf Position, Typ oder Namen. */}
                {detailsUnlocked && activeConcept.funFact && (
                  <p style={{ fontSize: '13px', opacity: 0.85, maxWidth: '440px', margin: '8px auto 0', fontStyle: 'italic' }}>
                    {activeConcept.funFact}
                  </p>
                )}
              </div>
            ) : (
              <>
                {attrEntries.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '10px' }}>
                    {attrEntries.map(([k, v]) => (
                      <span key={k} style={{
                        fontSize: '12px', padding: '4px 10px', borderRadius: '6px',
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)'
                      }}>
                        <span style={{ opacity: 0.6 }}>{ATTR_LABELS[k] || k}: </span>
                        <b>{formatAttributeValue(v)}</b>
                      </span>
                    ))}
                  </div>
                )}
                {/* Freitext erst nach der Antwort zeigen: FunFacts enthalten oft
                    indirekte Hinweise auf Position, Typ oder Namen. */}
                {detailsUnlocked && activeConcept.funFact && (
                  <p style={{ fontSize: '12.5px', opacity: 0.82, maxWidth: '460px', margin: '0 auto', textAlign: 'center', fontStyle: 'italic' }}>
                    {activeConcept.funFact}
                  </p>
                )}
              </>
            )}
          </div>

        </>
      )}

      {/* Das CC-BY-Sternenfeld liegt bei jedem Zustand hinter dem Canvas. Sein
          Nachweis bleibt deshalb auch ohne aktive Frage und ohne Körpertextur sichtbar. */}
      <div className="quiz-scene-credit" data-testid="astra-asset-credit" style={{
        padding: '6px 10px',
        fontSize: '10px', opacity: 0.7, color: '#EAE6DC', pointerEvents: 'auto', zIndex: 5
      }}>
        Sternenfeld: <a href={TEXTURE_CREDIT.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{TEXTURE_CREDIT.author}</a>
        {' · '}<a href={TEXTURE_CREDIT.licenseUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{TEXTURE_CREDIT.license}</a>
        {' · '}{TEXTURE_CREDIT.changes}
        {hasSurfaceTexture && (
          <>
            {' · '}Körpertextur: <a href={TEXTURE_CREDIT.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{TEXTURE_CREDIT.author}</a>
            {' · '}<a href={TEXTURE_CREDIT.licenseUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{TEXTURE_CREDIT.license}</a>
          </>
        )}
        {showSaturnRingCredit && (
          <>
            {' · '}Ringe: <a href={SATURN_RING_CREDIT.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{SATURN_RING_CREDIT.author}</a>
            {' · '}<a href={SATURN_RING_CREDIT.licenseUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{SATURN_RING_CREDIT.license}</a>
            {' · '}{SATURN_RING_CREDIT.changes}
          </>
        )}
        {showConceptSource && (
          <>
            {' · '}Quelle:{' '}
            {disclosure.sourceLinkUrl ? (
              <a href={disclosure.sourceLinkUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                {activeConcept.source.name}
              </a>
            ) : activeConcept?.source?.name}
          </>
        )}
      </div>
    </div>
  );
}
