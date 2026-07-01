import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
// Erscheinungs-/Beschriftungsdaten zentral (geteilt mit SolarSystemExplorer).
import {
  TEX_BASE, ATTRIBUTION, TEXTURES, BODY_COLORS, STAR_COLORS,
  CATEGORY_LABELS, ATTR_LABELS, PLANET_ORDER
} from './astraBodies';

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

// TEX_BASE, ATTRIBUTION, TEXTURES, BODY_COLORS, STAR_COLORS, CATEGORY_LABELS,
// ATTR_LABELS, PLANET_ORDER -> jetzt zentral in ./astraBodies (oben importiert).

// Freitext-Chips beschreiben das Objekt oft so eindeutig, dass sie vor der
// Antwort indirekt helfen. Darum erst nach Antwort anzeigen.
const POST_ANSWER_ATTRS = new Set(['notableFor', 'definition', 'function']);

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
  const detailsUnlocked = Boolean(isQuestionAnswered);
  const hideIdentity = (answerIsName || hideConceptIdentity) && !detailsUnlocked;

  // --- Szene einmalig aufbauen ------------------------------------------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    camera.position.set(0, 0, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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

    // Glühender Halo für Sterne/Galaxien (Sprite).
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
    }));
    glow.scale.set(3.6, 3.6, 1);
    glow.visible = false;
    scene.add(glow);

    // Eine wiederverwendbare Stern-Oberflächentextur (Granulation) für alle
    // Sterne ohne echte Textur; die Spektralfarbe kommt vom Material.
    const starSurface = makeStarSurfaceTexture();

    Object.assign(ctx.current, { scene, camera, renderer, loader, body, starfield, glow, starSurface, texCache: {} });

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

    let raf;
    const animate = () => {
      body.rotation.y += 0.0025;
      glow.material.rotation += 0.001;
      starfield.rotation.y += 0.0002;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();
    setReady(true);

    // Aufräumen: Loop, Observer, GPU-Ressourcen.
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      Object.values(ctx.current.texCache || {}).forEach(t => t.dispose());
      starSurface.dispose();
      starTex.dispose();
      bodyGeo.dispose();
      body.material.dispose();
      glow.material.map?.dispose();
      glow.material.dispose();
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
    const { body, glow, loader, texCache, starSurface } = c;

    if (!activeConcept) {
      body.visible = false;
      glow.visible = false;
      return;
    }

    const id = (activeConcept.id || '').replace(/^astra:/, '');
    const cat = activeConcept.category || activeConcept.type;

    // Galaxie / Konstante: kein Körper, ggf. Glow.
    if (cat === 'galaxy') {
      body.visible = false;
      glow.material.map?.dispose();
      glow.material.map = makeGlowTexture('200,210,255');
      glow.scale.set(5.2, 3.0, 1); // abgeflachte Scheibe
      glow.visible = true;
      return;
    }
    if (cat === 'constant') {
      body.visible = false;
      glow.visible = false;
      return;
    }

    body.visible = true;

    const isStar = cat === 'star';
    const texFile = TEXTURES[id];

    // Selbstverräter-Guard für die Stern-Erscheinung: Die spektraltypische Farbe
    // (warm = K/M, weiß = A, bläulich = B) verrät den Sterntyp. Wenn die Frage
    // genau den Typ abfragt ODER der Name die Antwort ist, neutralisieren wir die
    // Farbe (dezentes Weißgrau) statt typ-spezifisch einzufärben.
    const neutralizeStar = isStar && !detailsUnlocked && (testedAttribute === 'type' || hideIdentity);
    const NEUTRAL_STAR = 0xdcdce0; // dezentes Weißgrau
    const starColor = neutralizeStar ? NEUTRAL_STAR : (STAR_COLORS[id] || 0xfff2cc);

    if (texFile && !neutralizeStar) {
      // Echte Oberflächentextur laden (gecached).
      // Hinweis: Bei neutralizeStar überspringen wir die Textur, weil aktuell nur
      // die Sonne eine Stern-Textur hat — und deren Anblick ist ohnehin eindeutig.
      let tex = texCache[id];
      if (!tex) {
        tex = loader.load(`${TEX_BASE}${texFile}`);
        tex.colorSpace = THREE.SRGBColorSpace;
        texCache[id] = tex;
      }
      body.material.dispose();
      body.material = isStar
        ? new THREE.MeshBasicMaterial({ map: tex }) // Sonne: leuchtet selbst
        : new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
    } else {
      // Prozedural: plausible Farbe je Körper/Kategorie.
      // Stern: ggf. neutralisierte Farbe (siehe oben), sonst Spektralfarbe.
      const color = isStar
        ? starColor
        : (BODY_COLORS[id] || (cat === 'dwarf_planet' ? 0xb8a98f : 0x9b9286));
      body.material.dispose();
      // Stern: Granulationstextur, vom Material in der Spektral-/Neutralfarbe getönt
      // (map * color). So wirkt die Oberfläche lebendig statt flach einfarbig. Der
      // Glow-Halo bleibt davon unberührt. Andere Körper unverändert prozedural.
      body.material = isStar
        ? new THREE.MeshBasicMaterial({ map: starSurface, color })
        : new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
    }

    // Sterne mit Glow-Halo. Farbe richtet sich nach starColor, also auch hier
    // neutralisiert, damit der Halo den Sterntyp nicht über die Hintertür verrät.
    if (isStar) {
      glow.material.map?.dispose();
      glow.material.map = makeGlowTexture(hexToRgbStr(starColor));
      glow.scale.set(3.6, 3.6, 1);
      glow.visible = true;
    } else {
      glow.visible = false;
    }
  }, [activeConcept, ready, testedAttribute, hideIdentity, detailsUnlocked]);

  // --- HTML-Overlay (Infos + Lizenz) über dem Canvas --------------------
  const accent = domain.accent || '#5B4B8A';
  const cat = activeConcept?.category || activeConcept?.type;
  const catLabel = CATEGORY_LABELS[cat] || cat || '';
  const attrs = activeConcept?.attributes || {};
  // Selbstverräter-Guard für die Attribut-Chips:
  //   - unbeantwortete Reverse-Frage: gar keine Chips (Identitaet verborgen).
  //   - unbeantwortete Vorwaertsfrage: getestetes Attribut und Freitextdetails
  //     ausblenden; nach der Antwort sind sie als Erklaerung sichtbar.
  // Verräterische Geschwister-Attribute: Wird der hellste Stern gefragt, würden
  // die sichtbaren Sternlisten (notableStars „Rigel, Beteigeuze …", mainStars)
  // die Antwort verraten -> vor der Antwort mit ausblenden (analog zum
  // LEAKY_SIBLINGS-Guard des generischen Panels). QA-Fund/Hebel 2026-07-01.
  const LEAKY_SIBLINGS = { brightestStar: ['notableStars', 'mainStars'] };
  const leakedSiblings = (!detailsUnlocked && LEAKY_SIBLINGS[testedAttribute]) || [];
  const attrEntries = hideIdentity
    ? []
    : Object.entries(attrs)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'unit')
        .filter(([k]) => detailsUnlocked || (k !== testedAttribute && !POST_ANSWER_ATTRS.has(k) && !leakedSiblings.includes(k)))
        .slice(0, 4);
  const hasTexture = activeConcept && TEXTURES[(activeConcept.id || '').replace(/^astra:/, '')];

  // Verrät die Positions-/Lage-Kontextkarte die Antwort? Das ist der Fall, wenn die
  // Frage eine Positions-/Lage-Größe abfragt (Reihenfolge/Entfernung/Lage) oder der
  // Name selbst die Antwort ist. Vor der Antwort wird die Karte dann weggelassen;
  // danach darf sie die Einordnung erklaeren.
  const POSITION_ATTRS = ['orderFromSun', 'distanceFromSunAU', 'location'];
  const hideContextMap = hideIdentity || (!detailsUnlocked && POSITION_ATTRS.includes(testedAttribute));
  const hideConstantValue = !detailsUnlocked && testedAttribute === 'value';

  return (
    <div
      className="terra-panel"
      style={{
        height: '100%', position: 'relative', overflow: 'hidden',
        border: '1px solid var(--border-light)', background: '#05060f'
      }}
    >
      {/* 3D-Canvas-Mount füllt das Panel */}
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Kontext-Schema (Phase 2d): verortet das Konzept zusätzlich zum 3D-Körper.
          Unten links, über dem Canvas, oberhalb der Fuß-Leiste. Gibt für
          Konstanten/Sonne null zurück und ist dann unsichtbar.
          Selbstverräter-Guard: Bei Positions-/Lage-Fragen oder Reverse-Fragen
          (hideContextMap) ganz weglassen, da das Schema Bahn/Position verrät. */}
      {activeConcept && !hideContextMap && (
        <div style={{
          position: 'absolute', left: '16px', bottom: '92px',
          width: '140px', height: '140px', pointerEvents: 'none', zIndex: 2
        }}>
          <AstraContextMap concept={activeConcept} accent={accent} />
        </div>
      )}

      {activeConcept && (
        <>
          {/* Kopf: Kategorie + Name */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, padding: '24px 28px',
            textAlign: 'center', color: '#EAE6DC', pointerEvents: 'none',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)'
          }}>
            {catLabel && (
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
            }}>{hideIdentity ? '?' : activeConcept.name}</h2>
          </div>

          {/* Fuß: Konstante prominent, sonst Kennwerte + Fun-Fact */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 24px 30px',
            color: '#EAE6DC', pointerEvents: 'none',
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
                        <b>{String(v)}</b>
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

          {/* Lizenzzeile (nur bei echten Texturen sichtbar) */}
          <div style={{
            position: 'absolute', bottom: 0, right: 0, padding: '4px 10px',
            fontSize: '10px', opacity: 0.55, color: '#EAE6DC', pointerEvents: 'none'
          }}>
            {hasTexture ? ATTRIBUTION : (activeConcept.source?.name ? `Quelle: ${activeConcept.source.name}` : '')}
          </div>
        </>
      )}
    </div>
  );
}
