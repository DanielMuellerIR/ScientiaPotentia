import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ArrowLeft, Maximize2, Orbit, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PLANET_COLORS, BODY_COLORS, STAR_COLORS, BODY_LOOK,
  CATEGORY_LABELS, ATTR_LABELS, bodyColorCss, hexCss
} from './astraBodies';

/**
 * Astra-Erkundung: das Sonnensystem als interaktive 2D-Karte — analog zur
 * Terra-Weltkarte, nur fürs All. Anders als die 3D-Quizkörper (AstraVisual)
 * ist das hier eine Aufsicht zum freien Stöbern, gefüttert aus denselben
 * Konzeptdaten (concepts_astra.json).
 *
 * Maßstab: EINE gemeinsame, maßstabsgetreue Skala in Kilometern — Körpergrößen
 * UND Bahnabstände stehen im echten Verhältnis zueinander. Folge davon (so
 * gewollt): die meisten Körper werden bei der Gesamtansicht sub-pixel klein.
 * Darum bekommt jeder Körper eine Mindestgröße (~2 px) und sein Label daneben;
 * über Anklicken/Mausrad zoomt man heran und sieht die wahre Größe.
 *
 * Bedienung:
 *   - Planeten/Sonne als Scheibe ODER Label anklickbar -> zoomt heran.
 *   - Beim Planeten erscheinen seine Monde (Filter über attributes.parentPlanet).
 *     Mehr Monde als MOON_LABEL_LIMIT -> klickbare Liste am rechten Rand statt
 *     Label-Flut. Monde sind ebenfalls anklickbar/heranzoombar.
 *   - Mausrad zoomt frei, Ziehen verschiebt; "Zurück" geht eine Ebene hoch.
 *
 * Für Monde fehlen echte Bahnradien in den Daten — sie werden schematisch um
 * ihren Planeten gestaffelt (Größen bleiben echt). Planeten-/Sonnenabstände und
 * alle Durchmesser sind maßstabsgetreu.
 */

const AU_KM = 149_597_871;          // 1 Astronomische Einheit in km
const SUN_RADIUS_KM = 695_700;      // Sonne hat kein diameterKm-Attribut -> fest
const MOON_LABEL_LIMIT = 8;         // ab so vielen Monden Liste statt Label im Bild

// Mindest-Bildschirmradien (px), damit auch sub-pixel-kleine Körper sicht- und
// klickbar bleiben. ~2x2 px Durchmesser für normale Körper.
const MIN_R = 1.3, MIN_SUN_R = 2.6, MIN_MOON_R = 1.1, HIT_R = 12;

// Bahnkreise mit riesigem Bildschirmradius nicht zeichnen: beim Heranzoomen würde
// z.B. die Neptunbahn zu einem Kreis von Millionen px — das legt den Browser lahm
// (genau die „unbenutzbar langsam"-Ursache). Jenseits davon ist der sichtbare
// Bogen ohnehin praktisch eine Gerade weit außerhalb.
const MAX_RING_PX = 7000;

// Körperradius in Weltkoordinaten (= km), maßstabsgetreu aus dem Durchmesser.
const bodyWorldRadius = diameterKm => (Number(diameterKm) || 0) / 2;

// Lineare Interpolation + sanfte Ease-Kurve für die Kamerafahrt.
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Statisches Sternenfeld (einmal erzeugt, nicht pro Render neu — sonst flackert es).
function makeStars(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + 0.2, o: Math.random() * 0.5 + 0.2 });
  }
  return out;
}

export default function SolarSystemExplorer({ domain, concepts = {} }) {
  const accent = domain?.accent || '#5B4B8A';
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const stars = useMemo(() => makeStars(180), []);

  // --- Weltmodell aus den Konzepten aufbauen (Koordinaten in km) -------------
  const model = useMemo(() => {
    const values = Object.values(concepts || {});
    const idOf = c => (c.id || '').replace(/^astra:/, '');

    const sunC = values.find(c => idOf(c) === 'sun' || c.name === 'Sonne');
    const planetCs = values.filter(c => (c.category || c.type) === 'planet')
      .sort((a, b) => (a.attributes?.orderFromSun || 0) - (b.attributes?.orderFromSun || 0));
    const dwarfCs = values.filter(c => (c.category || c.type) === 'dwarf_planet');
    const moonCs = values.filter(c => (c.category || c.type) === 'moon');

    // Monde nach Zentralkörper (deutscher Name in attributes.parentPlanet) gruppieren.
    const moonsByParent = {};
    for (const m of moonCs) {
      const p = String(m.attributes?.parentPlanet || '').trim();
      (moonsByParent[p] = moonsByParent[p] || []).push(m);
    }

    const sun = { id: 'sun', name: sunC?.name || 'Sonne', cat: 'star', x: 0, y: 0,
      worldR: SUN_RADIUS_KM, color: hexCss(STAR_COLORS.sun), concept: sunC };

    // Monde schematisch um ihren Planeten staffeln (echte Bahnradien fehlen in
    // den Daten). Abstand in km, relativ zum Planetenradius -> wirkt stimmig.
    const layoutMoons = (parentName, px, py, parentR) => {
      const list = moonsByParent[parentName] || [];
      let fit = parentR * 2.4;
      const moons = list.map((m, j) => {
        const orbit = parentR * (2.2 + j * 1.15);
        const ang = (-90 + j * (360 / Math.max(1, list.length))) * Math.PI / 180;
        const wr = bodyWorldRadius(m.attributes?.diameterKm);
        fit = Math.max(fit, orbit + wr);
        return {
          id: (m.id || '').replace(/^astra:/, ''), name: m.name, cat: 'moon',
          x: px + orbit * Math.cos(ang), y: py + orbit * Math.sin(ang),
          worldR: wr, color: bodyColorCss((m.id || '').replace(/^astra:/, ''), 'moon'), concept: m
        };
      });
      return { moons, moonFitR: fit * 1.15 };
    };

    let maxPlanetOrbit = 0;
    const planets = planetCs.map((c, i) => {
      const id = idOf(c);
      const orbit = (Number(c.attributes?.distanceFromSunAU) || 0) * AU_KM;
      maxPlanetOrbit = Math.max(maxPlanetOrbit, orbit);
      const order = c.attributes?.orderFromSun || (i + 1);
      const ang = (-90 + (order - 1) * 45) * Math.PI / 180; // gleichmäßig verteilt
      const x = orbit * Math.cos(ang), y = orbit * Math.sin(ang);
      const wr = bodyWorldRadius(c.attributes?.diameterKm);
      const { moons, moonFitR } = layoutMoons(c.name, x, y, wr);
      return {
        id, name: c.name, cat: 'planet', orbit, x, y, worldR: wr,
        color: PLANET_COLORS[id] != null ? hexCss(PLANET_COLORS[id]) : bodyColorCss(id, 'planet'),
        moons, moonFitR, concept: c
      };
    });

    // Zwergplaneten haben keine Distanz in den Daten -> gestrichelter Gürtel
    // knapp jenseits der äußersten Planetenbahn (schematisch, klar als solcher).
    const beltR = maxPlanetOrbit * 1.12;
    const dwarfs = dwarfCs.map((c, i) => {
      const id = idOf(c);
      const ang = (i * (360 / Math.max(1, dwarfCs.length)) + 15) * Math.PI / 180;
      const x = beltR * Math.cos(ang), y = beltR * Math.sin(ang);
      const wr = bodyWorldRadius(c.attributes?.diameterKm);
      const { moons, moonFitR } = layoutMoons(c.name, x, y, wr);
      return { id, name: c.name, cat: 'dwarf_planet', orbit: beltR, x, y, worldR: wr,
        color: bodyColorCss(id, 'dwarf_planet'), moons, moonFitR, concept: c };
    });

    const maxOrbit = Math.max(maxPlanetOrbit, beltR);
    const byId = { sun };
    [...planets, ...dwarfs].forEach(p => { byId[p.id] = p; p.moons.forEach(m => (byId[m.id] = m)); });
    return { sun, planets, dwarfs, maxOrbit, beltR, byId };
  }, [concepts]);

  // --- Kamera (Weltzentrum + Maßstab) mit weicher Fahrt ----------------------
  const [cam, setCam] = useState({ cx: 0, cy: 0, scale: 1e-7 });
  const camRef = useRef(cam); camRef.current = cam;
  const animRef = useRef(0);
  const interacted = useRef(false);

  const fitSystem = useCallback((w, h) => {
    const R = (model.maxOrbit || AU_KM) * 1.08;
    return { cx: 0, cy: 0, scale: (Math.min(w, h) / 2 - 34) / R };
  }, [model.maxOrbit]);

  const tweenTo = useCallback((target, dur = 560) => {
    cancelAnimationFrame(animRef.current);
    const from = { ...camRef.current };
    const t0 = performance.now();
    const step = now => {
      const k = easeInOut(Math.min(1, (now - t0) / dur));
      setCam({ cx: lerp(from.cx, target.cx, k), cy: lerp(from.cy, target.cy, k), scale: lerp(from.scale, target.scale, k) });
      if (k < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  // Navigationszustand: was ist gerade fokussiert?
  const [focusId, setFocusId] = useState(null);     // null = ganzes System
  const focused = focusId ? model.byId[focusId] : null;
  const focusedPlanet = focused && (focused.cat === 'planet' || focused.cat === 'dwarf_planet') ? focused : null;
  const parentOfFocusedMoon = focused && focused.cat === 'moon'
    ? [...model.planets, ...model.dwarfs].find(p => p.moons.some(m => m.id === focused.id)) : null;
  const expandedPlanet = focusedPlanet || parentOfFocusedMoon || null;

  const focusBody = useCallback((id) => {
    interacted.current = true;
    const b = model.byId[id];
    if (!b) return;
    setFocusId(id);
    const half = Math.min(dims.w, dims.h) / 2;
    if (b.cat === 'planet' || b.cat === 'dwarf_planet') {
      tweenTo({ cx: b.x, cy: b.y, scale: (half - 56) / Math.max(b.moonFitR, b.worldR * 4) });
    } else {
      tweenTo({ cx: b.x, cy: b.y, scale: (half - 64) / (b.worldR * 4) });
    }
  }, [model, dims, tweenTo]);

  const goSystem = useCallback(() => {
    interacted.current = true;
    setFocusId(null);
    tweenTo(fitSystem(dims.w, dims.h));
  }, [dims, fitSystem, tweenTo]);

  const goBack = useCallback(() => {
    if (focused?.cat === 'moon' && expandedPlanet) focusBody(expandedPlanet.id);
    else goSystem();
  }, [focused, expandedPlanet, focusBody, goSystem]);

  // --- Containergröße beobachten + Initialansicht setzen ---------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      setDims({ w, h });
      if (!interacted.current) setCam(fitSystem(w, h));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(animRef.current); };
  }, [fitSystem]);

  // --- Mausrad-Zoom + Ziehen (freies Stöbern) --------------------------------
  const drag = useRef(null);
  const onWheel = e => {
    e.preventDefault();
    cancelAnimationFrame(animRef.current);
    interacted.current = true;
    const c = camRef.current;
    const ns = Math.max(1e-9, Math.min(2e-2, c.scale * Math.exp(-e.deltaY * 0.0012)));
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const wx = (mx - rect.width / 2) / c.scale + c.cx;
    const wy = (my - rect.height / 2) / c.scale + c.cy;
    setCam({ scale: ns, cx: wx - (mx - rect.width / 2) / ns, cy: wy - (my - rect.height / 2) / ns });
  };
  const onPointerDown = e => { drag.current = { x: e.clientX, y: e.clientY, cam: { ...camRef.current } }; };
  const onPointerMove = e => {
    if (!drag.current) return;
    cancelAnimationFrame(animRef.current);
    interacted.current = true;
    const c = drag.current.cam;
    setCam({ scale: c.scale, cx: c.cx - (e.clientX - drag.current.x) / c.scale, cy: c.cy - (e.clientY - drag.current.y) / c.scale });
  };
  const onPointerUp = () => { drag.current = null; };

  // Welt -> Bildschirm.
  const { w: W, h: H } = dims;
  const px = wx => (wx - cam.cx) * cam.scale + W / 2;
  const py = wy => (wy - cam.cy) * cam.scale + H / 2;

  const shownMoons = expandedPlanet ? expandedPlanet.moons : [];
  const moonsAsList = shownMoons.length > MOON_LABEL_LIMIT;
  const allBodies = [model.sun, ...model.planets, ...model.dwarfs];

  // Sprung-Navigation (oben links/rechts): Geschwister des fokussierten Körpers.
  // Mond -> die Monde seines Planeten; sonst Hauptfolge Sonne -> Planeten ->
  // Zwergplaneten. Index -1 (Gesamtansicht) -> nächster = Sonne, vorheriger = letzter.
  const navSeq = focused?.cat === 'moon' && expandedPlanet ? expandedPlanet.moons : allBodies;
  const navIdx = navSeq.findIndex(b => b.id === focusId);
  const prevBody = navSeq.length > 1 ? navSeq[(navIdx <= 0 ? navSeq.length : navIdx) - 1] : null;
  const nextBody = navSeq.length > 1 ? navSeq[(navIdx + 1) % navSeq.length] : null;
  const onScreen = (sx, sy, r) => sx > -r - 60 && sx < W + r + 60 && sy > -r - 60 && sy < H + r + 60;

  // Label radial nach außen vom Bezugspunkt (Sonne bzw. Planet) -> entzerrt den
  // dichten inneren Knoten, weil die Planeten in verschiedene Richtungen zeigen.
  const labelFor = (sx, sy, cx, cy, r) => {
    let dx = sx - cx, dy = sy - cy;
    const len = Math.hypot(dx, dy);
    if (len < 1) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
    return {
      x: sx + dx * (r + 6), y: sy + dy * (r + 6) + 3,
      anchor: dx > 0.25 ? 'start' : dx < -0.25 ? 'end' : 'middle'
    };
  };

  const sunSx = px(0), sunSy = py(0);

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      className="terra-panel"
      style={{
        height: '100%', width: '100%', position: 'relative', overflow: 'hidden',
        border: '1px solid var(--border-light)', cursor: drag.current ? 'grabbing' : 'grab',
        background: 'radial-gradient(ellipse at 50% 42%, #0d1430 0%, #05060f 70%)', touchAction: 'none'
      }}
    >
      <svg width={W} height={H} style={{ display: 'block', position: 'absolute', inset: 0 }}>
        <defs>
          {allBodies.concat(shownMoons).map(b => (
            <radialGradient key={`g-${b.id}`} id={`g-${b.id}`} cx="35%" cy="33%" r="75%">
              <stop offset="0%" stopColor={lightenCss(b.color, 0.55)} />
              <stop offset="55%" stopColor={b.color} />
              <stop offset="100%" stopColor={darkenCss(b.color, 0.5)} />
            </radialGradient>
          ))}
          <radialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff4cc" stopOpacity="0.9" />
            <stop offset="35%" stopColor="#ffcf6b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffcf6b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sternenhintergrund */}
        {stars.map((s, i) => (
          <circle key={`st-${i}`} cx={s.x * W} cy={s.y * H} r={s.r} fill="#ffffff" opacity={s.o} />
        ))}

        {/* Planetenbahnen (zu große Ringe übersprungen -> Perf, s. MAX_RING_PX) */}
        {model.planets.map(p => {
          const rpx = p.orbit * cam.scale;
          if (rpx < 0.5 || rpx > MAX_RING_PX) return null;
          return <circle key={`o-${p.id}`} cx={sunSx} cy={sunSy} r={rpx} fill="none"
            stroke={focusId === p.id ? accent : 'rgba(255,255,255,0.13)'}
            strokeWidth={focusId === p.id ? 1.6 : 1} />;
        })}
        {/* Zwergplaneten-Gürtel (gestrichelt) */}
        {model.dwarfs.length > 0 && model.beltR * cam.scale <= MAX_RING_PX && (
          <circle cx={sunSx} cy={sunSy} r={model.beltR * cam.scale} fill="none"
            stroke="rgba(255,255,255,0.10)" strokeWidth={1} strokeDasharray="3 4" />
        )}

        {/* Mondbahnen des aufgeklappten Planeten (große Ringe übersprungen) */}
        {expandedPlanet && shownMoons.map(m => {
          const orbit = Math.hypot(m.x - expandedPlanet.x, m.y - expandedPlanet.y) * cam.scale;
          if (orbit > MAX_RING_PX) return null;
          return <circle key={`mo-${m.id}`} cx={px(expandedPlanet.x)} cy={py(expandedPlanet.y)} r={orbit}
            fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={0.8} />;
        })}

        {/* Zwergplaneten */}
        {model.dwarfs.map(d => {
          const sx = px(d.x), sy = py(d.y), r = Math.max(MIN_R, d.worldR * cam.scale);
          if (!onScreen(sx, sy, r)) return null;
          return <BodyDisc key={d.id} b={d} sx={sx} sy={sy} r={r} accent={accent}
            selected={focusId === d.id} onClick={() => focusBody(d.id)} />;
        })}

        {/* Sonne mit Glühschein */}
        {(() => {
          const r = Math.max(MIN_SUN_R, SUN_RADIUS_KM * cam.scale);
          return (
            <g key="sun" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); focusBody('sun'); }}>
              <circle cx={sunSx} cy={sunSy} r={Math.max(8, r * 2.4)} fill="url(#sun-glow)" />
              <circle cx={sunSx} cy={sunSy} r={r} fill="url(#g-sun)" stroke="#fff3c4" strokeWidth={focusId === 'sun' ? 2 : 0.5} />
            </g>
          );
        })()}

        {/* Planeten */}
        {model.planets.map(p => {
          const sx = px(p.x), sy = py(p.y), r = Math.max(MIN_R, p.worldR * cam.scale);
          if (!onScreen(sx, sy, r)) return null;
          return <BodyDisc key={p.id} b={p} sx={sx} sy={sy} r={r} accent={accent}
            selected={focusId === p.id} onClick={() => focusBody(p.id)} />;
        })}

        {/* Monde des aufgeklappten Planeten */}
        {expandedPlanet && shownMoons.map(m => {
          const sx = px(m.x), sy = py(m.y), r = Math.max(MIN_MOON_R, m.worldR * cam.scale);
          return <BodyDisc key={m.id} b={m} sx={sx} sy={sy} r={r} accent={accent}
            selected={focusId === m.id} onClick={() => focusBody(m.id)} />;
        })}

        {/* Beschriftungen: Sonne + Planeten + Zwergplaneten (radial nach außen) */}
        {allBodies.map(b => {
          const sx = px(b.x), sy = py(b.y);
          const r = Math.max(b.id === 'sun' ? MIN_SUN_R : MIN_R, b.worldR * cam.scale);
          if (!onScreen(sx, sy, r)) return null;
          const L = labelFor(sx, sy, sunSx, sunSy, r);
          return <BodyLabel key={`l-${b.id}`} text={b.name} x={L.x} y={L.y} anchor={L.anchor}
            highlight={focusId === b.id} onClick={() => focusBody(b.id)} />;
        })}
        {/* Mondlabel nur wenn nicht als Liste */}
        {expandedPlanet && !moonsAsList && shownMoons.map(m => {
          const sx = px(m.x), sy = py(m.y), r = Math.max(MIN_MOON_R, m.worldR * cam.scale);
          const L = labelFor(sx, sy, px(expandedPlanet.x), py(expandedPlanet.y), r);
          return <BodyLabel key={`lm-${m.id}`} text={m.name} x={L.x} y={L.y} anchor={L.anchor} small
            highlight={focusId === m.id} onClick={() => focusBody(m.id)} />;
        })}
      </svg>

      {/* Kopfzeile: links Sprung zum vorherigen, Mitte Zurück+Brotkrumen,
          rechts Sprung zum nächsten + Gesamtansicht. */}
      <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex',
        alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, pointerEvents: 'none' }}>
        {/* links: vorheriger Körper */}
        <div style={{ pointerEvents: 'auto', minWidth: 0 }}>
          {prevBody && (
            <button onClick={() => focusBody(prevBody.id)} className="btn-terra"
              style={{ ...miniBtn, maxWidth: 190 }} title={`Vorheriger: ${prevBody.name}`}>
              <ChevronLeft size={15} /> <span style={ellipsis}>{prevBody.name}</span>
            </button>
          )}
        </div>
        {/* Mitte: Zurück + Brotkrumen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto', flexShrink: 0 }}>
          {focusId && (
            <button onClick={goBack} className="btn-terra" style={miniBtn}>
              <ArrowLeft size={15} /> Zurück
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#EAE6DC',
            fontSize: 13, fontWeight: 600, background: 'rgba(0,0,0,0.35)', padding: '5px 11px',
            borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)' }}>
            <Orbit size={15} style={{ color: accent }} />
            <span style={{ cursor: 'pointer' }} onClick={goSystem}>Sonnensystem</span>
            {focused && <span style={{ opacity: 0.5 }}>›</span>}
            {focused && <span>{focused.name}</span>}
          </div>
        </div>
        {/* rechts: nächster Körper + Gesamtansicht */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto', minWidth: 0, justifyContent: 'flex-end' }}>
          {nextBody && (
            <button onClick={() => focusBody(nextBody.id)} className="btn-terra"
              style={{ ...miniBtn, maxWidth: 190 }} title={`Nächster: ${nextBody.name}`}>
              <span style={ellipsis}>{nextBody.name}</span> <ChevronRight size={15} />
            </button>
          )}
          <button onClick={goSystem} className="btn-terra" style={miniBtn} title="Ganzes System zeigen">
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {/* Mondliste rechts, wenn zu viele Monde für Label im Bild */}
      {expandedPlanet && moonsAsList && (
        <div style={{ position: 'absolute', top: 60, right: 14, bottom: 120, width: 188,
          background: 'rgba(7,9,20,0.82)', border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 10, padding: '10px 8px', overflowY: 'auto', backdropFilter: 'blur(3px)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
            color: accent, marginBottom: 8, paddingLeft: 4 }}>
            Monde ({shownMoons.length})
          </div>
          {shownMoons.map(m => (
            <button key={m.id} onClick={() => focusBody(m.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                background: focusId === m.id ? `${accent}44` : 'transparent', border: 'none',
                color: '#EAE6DC', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0,
                background: m.color, boxShadow: 'inset -2px -2px 3px rgba(0,0,0,0.5)' }} />
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Info-Karte zum fokussierten Körper */}
      {focused && <InfoCard body={focused} parent={expandedPlanet} accent={accent} />}

      {/* Startansicht-Hinweis */}
      {!focused && (
        <div style={{ position: 'absolute', bottom: 16, left: 16, color: 'rgba(234,230,220,0.55)',
          fontSize: 12, pointerEvents: 'none', maxWidth: 360 }}>
          Maßstabsgetreu: Größen und Abstände im echten Verhältnis — die meisten Körper sind
          darum winzig. Anklicken oder Mausrad zoomt heran.
        </div>
      )}
    </div>
  );
}

const miniBtn = {
  display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, padding: '6px 11px',
  background: 'rgba(0,0,0,0.4)', color: '#EAE6DC', border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 999, cursor: 'pointer'
};
const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

/** Prozedurale Körperscheibe: Verlauf + optional Wolkenbänder/Ring (Gasriesen). */
function BodyDisc({ b, sx, sy, r, selected, accent, onClick }) {
  const look = BODY_LOOK[b.id];
  const clip = `clip-${b.id}`;
  return (
    <g style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onClick(); }}>
      {/* unsichtbarer, großzügiger Klickbereich für kleine Körper */}
      <circle cx={sx} cy={sy} r={Math.max(r, HIT_R)} fill="transparent" />
      {look?.ring && r > 3 && (
        <ellipse cx={sx} cy={sy} rx={r * 2.05} ry={r * 0.62} fill="none"
          stroke={look.ring} strokeWidth={Math.max(1, r * 0.18)} opacity={0.7}
          transform={`rotate(-18 ${sx} ${sy})`} />
      )}
      <circle cx={sx} cy={sy} r={r} fill={`url(#g-${b.id})`}
        stroke={selected ? accent : 'rgba(0,0,0,0.35)'} strokeWidth={selected ? 2 : 0.6} />
      {look?.bands && r > 5 && (
        <g clipPath={`url(#${clip})`}>
          <clipPath id={clip}><circle cx={sx} cy={sy} r={r} /></clipPath>
          {look.bands.map((col, i) => {
            const n = look.bands.length;
            const yy = sy - r + ((i + 0.5) / n) * 2 * r;
            return <ellipse key={i} cx={sx} cy={yy} rx={r} ry={(r * 1.4) / n} fill={col} opacity={0.5} />;
          })}
        </g>
      )}
    </g>
  );
}

/** Beschriftung neben einem Körper, konstante Größe (skaliert nicht mit). */
function BodyLabel({ text, x, y, anchor, small, highlight, onClick }) {
  return (
    <text x={x} y={y} textAnchor={anchor} onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      fontSize={small ? 11 : 12.5} fontWeight={highlight ? 700 : 500}
      fill={highlight ? '#fff' : '#EAE6DC'} paintOrder="stroke"
      stroke="rgba(0,0,0,0.85)" strokeWidth={3} strokeLinejoin="round">
      {text}
    </text>
  );
}

/** Info-Karte unten links: Kategorie, Name, Kennwerte, Fun-Fact. */
function InfoCard({ body, parent, accent }) {
  const c = body.concept || {};
  const attrs = c.attributes || {};
  const catLabel = CATEGORY_LABELS[body.cat] || body.cat;
  const entries = Object.entries(attrs)
    .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'unit' && k !== 'notableFor' && k !== 'parentPlanet')
    .slice(0, 5);
  const totalMoons = Number(attrs.numMoons);
  const shown = parent && parent.id === body.id ? body.moons?.length : null;
  return (
    <div style={{ position: 'absolute', left: 16, bottom: 16, maxWidth: 340,
      background: 'rgba(7,9,20,0.86)', border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: 12, padding: '14px 16px', color: '#EAE6DC', backdropFilter: 'blur(4px)' }}>
      <div style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, letterSpacing: 1,
        textTransform: 'uppercase', padding: '2px 9px', borderRadius: 999,
        border: `1px solid ${accent}aa`, background: `${accent}33`, marginBottom: 7 }}>
        {catLabel}{body.cat === 'moon' && parent ? ` · ${parent.name}` : ''}
      </div>
      <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-title)', fontSize: 21 }}>{body.name}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: entries.length ? 8 : 0 }}>
        {entries.map(([k, v]) => (
          <span key={k} style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.13)' }}>
            <span style={{ opacity: 0.6 }}>{ATTR_LABELS[k] || k}: </span>
            <b>{typeof v === 'boolean' ? (v ? 'ja' : 'nein') : String(v)}</b>
          </span>
        ))}
      </div>
      {isFinite(totalMoons) && totalMoons > 0 && shown != null && (
        <div style={{ fontSize: 11.5, opacity: 0.7, marginBottom: 6 }}>
          {totalMoons} Monde{shown < totalMoons ? ` (${shown} im Detail)` : ''}
        </div>
      )}
      {c.funFact && (
        <p style={{ fontSize: 12.5, lineHeight: 1.5, opacity: 0.85, fontStyle: 'italic', margin: 0 }}>
          {c.funFact}
        </p>
      )}
    </div>
  );
}

// --- Farb-Helfer (CSS #rrggbb aufhellen/abdunkeln) ---------------------------
function shade(css, amt) {
  const m = /^#?([0-9a-f]{6})$/i.exec(css);
  if (!m) return css;
  const n = parseInt(m[1], 16);
  const f = sh => {
    const ch = (n >> sh) & 255;
    const v = amt >= 0 ? ch + (255 - ch) * amt : ch * (1 + amt);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  return `#${((f(16) << 16) | (f(8) << 8) | f(0)).toString(16).padStart(6, '0')}`;
}
const lightenCss = (css, a) => shade(css, Math.abs(a));
const darkenCss = (css, a) => shade(css, -Math.abs(a));
