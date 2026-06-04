import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

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

const TEX_BASE = 'assets/astra/textures/';
const ATTRIBUTION = 'Textur: Solar System Scope · CC BY 4.0';

// Konzept-Id (ohne "astra:"-Präfix) -> echte Oberflächentextur.
const TEXTURES = {
  sun: '2k_sun.jpg',
  mercury: '2k_mercury.jpg',
  venus: '2k_venus_surface.jpg',
  earth: '2k_earth_daymap.jpg',
  mars: '2k_mars.jpg',
  jupiter: '2k_jupiter.jpg',
  saturn: '2k_saturn.jpg',
  uranus: '2k_uranus.jpg',
  neptune: '2k_neptune.jpg',
  luna: '2k_moon.jpg'
};

// Prozedurale Farben für Körper ohne echte Textur (grob nach bekannter Erscheinung).
const BODY_COLORS = {
  pluto: 0xc9a98a, ceres: 0x8c8378, eris: 0xd8d2c4, makemake: 0xb06a4a, haumea: 0xd9d2c8,
  phobos: 0x7a6f63, deimos: 0x8a7d6e, io: 0xe3d26b, europa: 0xd8cdb4, ganymede: 0x9a8e7e,
  callisto: 0x6f6457, titan: 0xd9923f, enceladus: 0xf2f4f6, rhea: 0xb9b4ab, mimas: 0xc8c4bc,
  triton: 0xc7b9c9, titania: 0x9c8d83, charon: 0xa8a097
};

// Sternfarben grob nach Spektraltyp (warm = K/M, weiß = A, bläulich = B).
const STAR_COLORS = {
  sun: 0xfff2cc, sirius: 0xcdd7ff, betelgeuse: 0xff7b4d, rigel: 0xa8c4ff,
  proxima_centauri: 0xff8a5c, alpha_centauri_a: 0xfff0c4, polaris: 0xfff7e6,
  vega: 0xdfe6ff, aldebaran: 0xffb277, antares: 0xff6a45, capella: 0xfff0cc, arcturus: 0xffc27a
};

const CATEGORY_LABELS = {
  planet: 'Planet', dwarf_planet: 'Zwergplanet', moon: 'Mond',
  star: 'Stern', galaxy: 'Galaxie', constant: 'Konstante'
};

const ATTR_LABELS = {
  orderFromSun: 'Position v. Sonne', type: 'Typ', numMoons: 'Monde',
  diameterKm: 'Durchmesser (km)', dayLengthHours: 'Tageslänge (h)',
  yearLengthEarthDays: 'Jahr (Erdtage)', distanceLy: 'Entfernung (Lj)',
  constellation: 'Sternbild', hostStar: 'Zentralstern', value: 'Wert'
};

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

export default function AstraVisual({ domain, activeConcept }) {
  const mountRef = useRef(null);
  // three-Objekte über Renders hinweg halten, ohne Re-Render auszulösen.
  const ctx = useRef({});
  const [ready, setReady] = useState(false);

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

    Object.assign(ctx.current, { scene, camera, renderer, loader, body, starfield, glow, texCache: {} });

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
    const { body, glow, loader, texCache } = c;

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

    if (texFile) {
      // Echte Oberflächentextur laden (gecached).
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
      const color = isStar
        ? (STAR_COLORS[id] || 0xfff2cc)
        : (BODY_COLORS[id] || (cat === 'dwarf_planet' ? 0xb8a98f : 0x9b9286));
      body.material.dispose();
      body.material = isStar
        ? new THREE.MeshBasicMaterial({ color })
        : new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
    }

    // Sterne mit Glow-Halo in Spektralfarbe.
    if (isStar) {
      glow.material.map?.dispose();
      glow.material.map = makeGlowTexture(hexToRgbStr(STAR_COLORS[id] || 0xfff2cc));
      glow.scale.set(3.6, 3.6, 1);
      glow.visible = true;
    } else {
      glow.visible = false;
    }
  }, [activeConcept, ready]);

  // --- HTML-Overlay (Infos + Lizenz) über dem Canvas --------------------
  const accent = domain.accent || '#5B4B8A';
  const cat = activeConcept?.category || activeConcept?.type;
  const catLabel = CATEGORY_LABELS[cat] || cat || '';
  const attrs = activeConcept?.attributes || {};
  const attrEntries = Object.entries(attrs)
    .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'unit')
    .slice(0, 4);
  const hasTexture = activeConcept && TEXTURES[(activeConcept.id || '').replace(/^astra:/, '')];

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
            <h2 style={{
              fontFamily: 'var(--font-title)', fontSize: '30px', fontWeight: 700,
              margin: 0, letterSpacing: '0.5px', textShadow: '0 2px 12px rgba(0,0,0,0.8)'
            }}>{activeConcept.name}</h2>
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
                  {String(attrs.value ?? '')}{attrs.unit ? ` ${attrs.unit}` : ''}
                </div>
                {activeConcept.funFact && (
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
                {activeConcept.funFact && (
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
