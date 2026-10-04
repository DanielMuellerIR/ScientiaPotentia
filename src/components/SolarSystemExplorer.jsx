import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ArrowLeft, Maximize2, Orbit, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PLANET_COLORS, BODY_COLORS, STAR_COLORS, BODY_LOOK,
  CATEGORY_LABELS, ATTR_LABELS, bodyColorCss, hexCss
} from './astraBodies';
import { formatAttributeValue } from './conceptLabels';

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
const MIN_R = 1.3, MIN_SUN_R = 2.6, MIN_MOON_R = 1.1;
// Ein Radius von 12 px ergibt auch auf Touch-Geräten ein gut treffbares Ziel.
export const MIN_HIT_RADIUS = 12;

/**
 * Überlappende Mindest-Trefferkreise werden geometrisch aufgelöst. So gewinnt
 * auf Touch nicht der zuletzt gezeichnete SVG-Knoten, sondern der nächste Körper.
 */
export function resolveBodyHit(candidates, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  let best = null;
  for (const candidate of candidates) {
    const distance = Math.hypot(x - candidate.sx, y - candidate.sy);
    const hitRadius = Math.max(MIN_HIT_RADIUS, Number(candidate.r) || 0);
    if (distance > hitRadius) continue;
    if (!best || distance < best.distance
      || (distance === best.distance && candidate.id < best.id)) {
      best = { id: candidate.id, distance };
    }
  }
  return best?.id || null;
}

// Bahnkreise mit riesigem Bildschirmradius nicht zeichnen: beim Heranzoomen würde
// z.B. die Neptunbahn zu einem Kreis von Millionen px — das legt den Browser lahm
// (genau die „unbenutzbar langsam"-Ursache). Jenseits davon ist der sichtbare
// Bogen ohnehin praktisch eine Gerade weit außerhalb.
const MAX_RING_PX = 7000;

// Ab welcher Planeten-Scheibengröße (px Radius am Bildschirm) seine Monde
// automatisch erscheinen — sobald man nah genug herangezoomt ist, auch ohne Klick.
const MOON_REVEAL_PX = 7;

// Körperradius in Weltkoordinaten (= km), maßstabsgetreu aus dem Durchmesser.
const bodyWorldRadius = diameterKm => (Number(diameterKm) || 0) / 2;

/** Entfernt erklärende Zusätze, damit „Eris (Zwergplanet)“ zu „Eris“ passt. */
export function normalizeParentBodyName(value) {
  return String(value || '')
    .trim()
    .replace(/\s*\([^)]*\)\s*$/u, '')
    .trim()
    .toLocaleLowerCase('de-DE');
}

// Lineare Interpolation + sanfte Ease-Kurve für die Kamerafahrt.
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Berechnet einen einzelnen, weich beschleunigten Kameraschritt. */
export function interpolateCamera(from, target, progress) {
  const eased = easeInOut(Math.max(0, Math.min(1, progress)));
  return {
    cx: lerp(from.cx, target.cx, eased),
    cy: lerp(from.cy, target.cy, eased),
    scale: lerp(from.scale, target.scale, eased)
  };
}

/** Reduzierte Bewegung überspringt Animationen vollständig statt sie nur zu verkürzen. */
export function cameraAnimationDuration(prefersReducedMotion, duration = 560) {
  return prefersReducedMotion ? 0 : duration;
}

/**
 * Bei Außenansichten liegen die inneren Planeten wenige Pixel auseinander.
 * Das Inset bleibt sichtbar, bis ihre kleinste Bildschirmdistanz groß genug ist.
 */
export function shouldShowInnerInset(bodies, scale, minimumDistancePx = 48) {
  if (!Array.isArray(bodies) || bodies.length < 2 || !Number.isFinite(scale)) return false;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const distance = Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y) * scale;
      if (distance < minimumDistancePx) return true;
    }
  }
  return false;
}

function labelBox({ text, fontSize, x, y, anchor }) {
  // Ohne DOM-Messung bleibt der Algorithmus in Canvas/SVG und Tests deterministisch.
  const width = Math.max(fontSize * 2, text.length * fontSize * 0.58) + 6;
  const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x;
  return { left, right: left + width, top: y - fontSize, bottom: y + 4 };
}

function boxesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Ordnet Labels ohne Zufall an. Große, bereits weit hineingezoomte Körper
 * erhalten zuerst einen Platz. Kollidiert die radiale Standardposition, wird
 * kontrolliert nach oben oder unten ausgewichen und eine Leader-Line gezeichnet.
 */
export function declutterLabels(candidates, { blockedAreas = [], viewport } = {}) {
  const occupied = [];
  const placed = [];
  const sorted = [...candidates].sort((a, b) => (
    b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  ));

  for (const candidate of sorted) {
    const positions = [
      { x: candidate.x, y: candidate.y, anchor: candidate.anchor, moved: false },
      { x: candidate.sx, y: candidate.sy - candidate.r - 10, anchor: 'middle', moved: true },
      { x: candidate.sx, y: candidate.sy + candidate.r + candidate.fontSize + 6, anchor: 'middle', moved: true }
    ];
    const position = positions.find((tryPosition) => {
      const box = labelBox({ ...candidate, ...tryPosition });
      const outsideViewport = viewport && (
        box.left < viewport.left || box.right > viewport.right
        || box.top < viewport.top || box.bottom > viewport.bottom
      );
      return !outsideViewport
        && !occupied.some((other) => boxesOverlap(box, other))
        && !blockedAreas.some((area) => boxesOverlap(box, area));
    });

    // Ein niedriger priorisiertes, vollständig verdecktes Label wird ausgelassen.
    // Der Körper selbst bleibt dank seiner großzügigen Trefferfläche erreichbar.
    if (!position) continue;
    const box = labelBox({ ...candidate, ...position });
    occupied.push(box);
    placed.push({
      ...candidate,
      ...position,
      leaderFrom: position.moved ? { x: candidate.sx, y: candidate.sy } : null
    });
  }
  return placed;
}

function readReducedMotionPreference() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

function useReducedMotionPreference() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readReducedMotionPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(query.matches);
    if (query.addEventListener) {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    query.addListener?.(update);
    return () => query.removeListener?.(update);
  }, []);

  return prefersReducedMotion;
}

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
      const p = normalizeParentBodyName(m.attributes?.parentPlanet);
      (moonsByParent[p] = moonsByParent[p] || []).push(m);
    }

    const sun = { id: 'sun', name: sunC?.name || 'Sonne', cat: 'star', x: 0, y: 0,
      worldR: SUN_RADIUS_KM, color: hexCss(STAR_COLORS.sun), concept: sunC };

    // Monde schematisch um ihren Planeten staffeln (echte Bahnradien fehlen in
    // den Daten). Abstand in km, relativ zum Planetenradius -> wirkt stimmig.
    const layoutMoons = (parentName, px, py, parentR) => {
      const list = moonsByParent[normalizeParentBodyName(parentName)] || [];
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
  const prefersReducedMotion = useReducedMotionPreference();

  const fitSystem = useCallback((w, h) => {
    const R = Math.max(1, (model.maxOrbit || AU_KM) * 1.08);
    const usableHalf = Math.max(1, Math.min(w, h) / 2 - 34);
    return { cx: 0, cy: 0, scale: Math.max(1e-9, usableHalf / R) };
  }, [model.maxOrbit]);

  const tweenTo = useCallback((target, dur = 560) => {
    cancelAnimationFrame(animRef.current);
    const from = { ...camRef.current };
    const duration = cameraAnimationDuration(prefersReducedMotion, dur);
    if (duration === 0) {
      setCam(target);
      return;
    }
    const t0 = performance.now();
    const step = now => {
      const progress = Math.min(1, (now - t0) / duration);
      setCam(interpolateCamera(from, target, progress));
      if (progress < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, [prefersReducedMotion]);

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
    const half = Math.max(1, Math.min(dims.w, dims.h) / 2);
    const targetScale = (padding, fitRadius) => Math.max(1e-9, Math.min(2e-2,
      Math.max(1, half - padding) / Math.max(1, fitRadius)
    ));
    if (b.cat === 'planet' || b.cat === 'dwarf_planet') {
      tweenTo({ cx: b.x, cy: b.y, scale: targetScale(56, Math.max(b.moonFitR, b.worldR * 4)) });
    } else {
      tweenTo({ cx: b.x, cy: b.y, scale: targetScale(64, b.worldR * 4) });
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

  // Mausrad-Zoom nativ + NICHT-passiv registrieren. React haengt onWheel
  // standardmaessig als passiven Listener an, in dem e.preventDefault() wirkungslos
  // ist (Konsolen-Warnung; die Seite scrollt beim Zoomen mit). Mit
  // { passive: false } darf der Handler den Seiten-Scroll unterdruecken.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // onWheel nutzt nur Refs/stabile Setter -> First-Render-Closure bleibt gueltig.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Welt -> Bildschirm.
  const { w: W, h: H } = dims;
  const px = wx => (wx - cam.cx) * cam.scale + W / 2;
  const py = wy => (wy - cam.cy) * cam.scale + H / 2;

  // Auto-Aufklappen: in welchen Planeten ist gerade nah genug hineingezoomt?
  // Sobald sein Scheibchen groß genug ist (MOON_REVEAL_PX) und er im Bild liegt,
  // zeigen wir seine Monde — auch ohne Klick. Bei mehreren der am stärksten
  // herangezoomte. Ein expliziter Fokus (Klick) gewinnt sonst.
  let zoomReveal = null, bestR = MOON_REVEAL_PX;
  for (const p of [...model.planets, ...model.dwarfs]) {
    if (!p.moons.length) continue;
    const r = p.worldR * cam.scale;
    if (r < bestR) continue;
    const sx = px(p.x), sy = py(p.y);
    if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) continue;
    bestR = r; zoomReveal = p;
  }
  // Welcher Planet zeigt gerade seine Monde: der herangezoomte, sonst der fokussierte.
  const displayPlanet = zoomReveal || expandedPlanet;

  const shownMoons = displayPlanet ? displayPlanet.moons : [];
  const moonsAsList = shownMoons.length > MOON_LABEL_LIMIT;
  const allBodies = [model.sun, ...model.planets, ...model.dwarfs];
  const innerPlanets = model.planets.slice(0, 4);
  // Ausschließlich die projizierte Trennung steuert das Inset. Während eines
  // Zoomflugs bleibt es also sichtbar, bis die Planeten wirklich getrennt sind.
  const showInnerInset = shouldShowInnerInset(innerPlanets, cam.scale);

  // Sprung-Navigation (oben links/rechts): Geschwister des fokussierten Körpers.
  // Mond -> die Monde seines Planeten; sonst Hauptfolge Sonne -> Planeten ->
  // Zwergplaneten. Index -1 (Gesamtansicht) -> nächster = Sonne, vorheriger = letzter.
  // codereview-ok: Sonne bewusst in navSeq für Vor/Zurück-Navigation (2026-07-08)
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
  const compactNavigation = W < 560;
  const makeLabelCandidate = (b, sx, sy, r, referenceX, referenceY, small = false) => {
    const preferred = labelFor(sx, sy, referenceX, referenceY, r);
    const fontSize = small ? 11 : 12.5;
    // Erst der explizit fokussierte Körper, dann seine projizierte Größe
    // (inklusive Zoomtiefe), danach die reale Größe; ID macht Gleichstände stabil.
    const priority = (b.id === focusId ? 1e12 : 0)
      + Math.max(0, r) * 1000
      + Math.log10(1 + Math.max(0, b.worldR));
    return { id: b.id, text: b.name, sx, sy, r, fontSize, small, priority, ...preferred };
  };
  const labelCandidates = [
    ...allBodies.flatMap((b) => {
      const sx = px(b.x), sy = py(b.y);
      const r = Math.max(b.id === 'sun' ? MIN_SUN_R : MIN_R, b.worldR * cam.scale);
      return onScreen(sx, sy, r) ? [makeLabelCandidate(b, sx, sy, r, sunSx, sunSy)] : [];
    }),
    ...(!moonsAsList ? shownMoons.flatMap((m) => {
      const sx = px(m.x), sy = py(m.y);
      const r = Math.max(MIN_MOON_R, m.worldR * cam.scale);
      return onScreen(sx, sy, r)
        ? [makeLabelCandidate(m, sx, sy, r, px(displayPlanet.x), py(displayPlanet.y), true)]
        : [];
    }) : [])
  ];
  const blockedLabelAreas = [
    // Kopfzeile: Labels sollen weder Buttons noch die Brotkrume überdecken.
    { left: 0, top: 0, right: W, bottom: 54 },
    ...(showInnerInset ? [{
      left: Math.max(0, W - (displayPlanet && moonsAsList ? 210 : 14) - 170), top: 54,
      right: W - (displayPlanet && moonsAsList ? 210 : 14) + 4, bottom: 204
    }] : []),
    ...(focused ? [{ left: 0, top: Math.max(0, H - 230), right: 370, bottom: H }] : []),
    ...(displayPlanet && moonsAsList ? [{ left: Math.max(0, W - 202), top: 52, right: W, bottom: Math.max(52, H - 110) }] : [])
  ];
  const visibleLabels = declutterLabels(labelCandidates, {
    blockedAreas: blockedLabelAreas,
    viewport: { left: 0, top: 0, right: W, bottom: H }
  });
  const bodyHitCandidates = [
    ...allBodies.flatMap((body) => {
      const sx = px(body.x), sy = py(body.y);
      const r = Math.max(body.id === 'sun' ? MIN_SUN_R : MIN_R, body.worldR * cam.scale);
      return onScreen(sx, sy, r) ? [{ id: body.id, sx, sy, r }] : [];
    }),
    ...shownMoons.flatMap((moon) => {
      const sx = px(moon.x), sy = py(moon.y);
      const r = Math.max(MIN_MOON_R, moon.worldR * cam.scale);
      return onScreen(sx, sy, r) ? [{ id: moon.id, sx, sy, r }] : [];
    })
  ];

  const onBodyHitCapture = (event) => {
    // Nur die unsichtbaren Mindest-Trefferkreise brauchen die geometrische
    // Auflösung. Labels, Buttons und große sichtbare Scheiben behalten ihren Handler.
    if (!event.target?.closest?.('[data-solar-hit="true"]')) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const id = resolveBodyHit(bodyHitCandidates, event.clientX - rect.left, event.clientY - rect.top);
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    focusBody(id);
  };

  return (
    <div
      ref={containerRef}
      onClickCapture={onBodyHitCapture}
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
        {displayPlanet && shownMoons.map(m => {
          const orbit = Math.hypot(m.x - displayPlanet.x, m.y - displayPlanet.y) * cam.scale;
          if (orbit > MAX_RING_PX) return null;
          return <circle key={`mo-${m.id}`} cx={px(displayPlanet.x)} cy={py(displayPlanet.y)} r={orbit}
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
              <circle data-testid="solar-hit-sun" data-solar-hit="true"
                cx={sunSx} cy={sunSy} r={MIN_HIT_RADIUS} fill="transparent" />
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
        {displayPlanet && shownMoons.map(m => {
          const sx = px(m.x), sy = py(m.y), r = Math.max(MIN_MOON_R, m.worldR * cam.scale);
          return <BodyDisc key={m.id} b={m} sx={sx} sy={sy} r={r} accent={accent}
            selected={focusId === m.id} onClick={() => focusBody(m.id)} />;
        })}

        {/* Sortierte, kollisionsfreie Labels. Ausweichpositionen bekommen Leader-Lines. */}
        {visibleLabels.map(label => (
          <BodyLabel key={`l-${label.id}`} text={label.text} x={label.x} y={label.y}
            anchor={label.anchor} small={label.small} leaderFrom={label.leaderFrom}
            highlight={focusId === label.id} onClick={() => focusBody(label.id)} />
        ))}
      </svg>

      {showInnerInset && <InnerSystemInset planets={innerPlanets} accent={accent}
        avoidMoonList={Boolean(displayPlanet && moonsAsList)} />}

      {/* Kopfzeile: links Sprung zum vorherigen, Mitte Zurück+Brotkrumen,
          rechts Sprung zum nächsten + Gesamtansicht. */}
      <div style={{ position: 'absolute', top: 14, left: compactNavigation ? 8 : 16,
        right: compactNavigation ? 8 : 16, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: compactNavigation ? 4 : 8, pointerEvents: 'none' }}>
        {/* links: vorheriger Körper */}
        <div style={{ pointerEvents: 'auto', minWidth: 0 }}>
          {prevBody && (
            <button onClick={() => focusBody(prevBody.id)} className="btn-terra"
              style={{ ...miniBtn, maxWidth: compactNavigation ? 34 : 190,
                padding: compactNavigation ? '6px 8px' : miniBtn.padding }}
              aria-label={`Vorheriger: ${prevBody.name}`} title={`Vorheriger: ${prevBody.name}`}>
              <ChevronLeft size={15} />
              {!compactNavigation && <span style={ellipsis}>{prevBody.name}</span>}
            </button>
          )}
        </div>
        {/* Mitte: Zurück + Brotkrumen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: compactNavigation ? 4 : 8,
          pointerEvents: 'auto', flexShrink: 0, minWidth: 0 }}>
          {focusId && (
            <button onClick={goBack} className="btn-terra" aria-label="Zurück" title="Zurück"
              style={{ ...miniBtn, padding: compactNavigation ? '6px 8px' : miniBtn.padding }}>
              <ArrowLeft size={15} /> {!compactNavigation && 'Zurück'}
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#EAE6DC',
            fontSize: compactNavigation ? 12 : 13, fontWeight: 600,
            background: 'rgba(0,0,0,0.35)', padding: compactNavigation ? '5px 8px' : '5px 11px',
            borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)',
            maxWidth: compactNavigation ? 112 : 'none' }}>
            <Orbit size={15} style={{ color: accent }} />
            <span style={{ ...ellipsis, cursor: 'pointer' }} onClick={goSystem}
              title={focused?.name || 'Sonnensystem'}>
              {compactNavigation ? (focused?.name || 'System') : 'Sonnensystem'}
            </span>
            {!compactNavigation && focused && <span style={{ opacity: 0.5 }}>›</span>}
            {!compactNavigation && focused && <span>{focused.name}</span>}
          </div>
        </div>
        {/* rechts: nächster Körper + Gesamtansicht */}
        <div style={{ display: 'flex', alignItems: 'center', gap: compactNavigation ? 4 : 8,
          pointerEvents: 'auto', minWidth: 0, justifyContent: 'flex-end' }}>
          {nextBody && (
            <button onClick={() => focusBody(nextBody.id)} className="btn-terra"
              style={{ ...miniBtn, maxWidth: compactNavigation ? 34 : 190,
                padding: compactNavigation ? '6px 8px' : miniBtn.padding }}
              aria-label={`Nächster: ${nextBody.name}`} title={`Nächster: ${nextBody.name}`}>
              {!compactNavigation && <span style={ellipsis}>{nextBody.name}</span>}
              <ChevronRight size={15} />
            </button>
          )}
          <button onClick={goSystem} className="btn-terra" aria-label="Ganzes System zeigen"
            style={{ ...miniBtn, padding: compactNavigation ? '6px 8px' : miniBtn.padding }}
            title="Ganzes System zeigen">
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {/* Mondliste rechts, wenn zu viele Monde für Label im Bild */}
      {displayPlanet && moonsAsList && (
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

/** Kleine, von der Hauptkamera unabhängige Übersicht der vier inneren Planeten. */
function InnerSystemInset({ planets, accent, avoidMoonList }) {
  const width = 156, height = 134, centerX = 78, centerY = 76;
  const maxOrbit = Math.max(...planets.map((planet) => planet.orbit || 0), 1);
  // Eigener Maßstab: Mars passt mit Rand hinein, unabhängig von der Außenansicht.
  const insetScale = 43 / maxOrbit;

  return (
    <aside data-testid="solar-inner-inset" aria-label="Inneres System" style={{
      // Wenn eine Mondliste offen ist, rückt die Übersicht links daneben. So
      // bleiben beide Informationsflächen auch bei 375 px Breite getrennt.
      position: 'absolute', top: 60, right: avoidMoonList ? 210 : 14, width, padding: '7px 7px 5px',
      background: 'rgba(7,9,20,0.84)', border: '1px solid rgba(255,255,255,0.16)',
      borderRadius: 8, color: '#EAE6DC', pointerEvents: 'none', backdropFilter: 'blur(3px)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0 2px 3px',
        color: accent, fontSize: 10, fontWeight: 700, letterSpacing: 0.45, textTransform: 'uppercase' }}>
        <span>Inneres System</span><span style={{ color: 'rgba(234,230,220,0.58)', fontWeight: 500 }}>Maßstab</span>
      </div>
      <svg width={width - 14} height={height - 24} aria-hidden="true">
        {planets.map((planet) => (
          <circle key={`inset-orbit-${planet.id}`} cx={centerX - 7} cy={centerY - 18}
            r={planet.orbit * insetScale} fill="none" stroke="rgba(255,255,255,0.17)" strokeWidth={0.6} />
        ))}
        <circle cx={centerX - 7} cy={centerY - 18} r={3.5} fill="#ffcf6b" />
        {planets.map((planet) => {
          const sx = (planet.x * insetScale) + centerX - 7;
          const sy = (planet.y * insetScale) + centerY - 18;
          const radius = Math.max(2, planet.worldR * insetScale);
          // Die vier festen Anker entzerren besonders Merkur und Venus, deren
          // Bahnpunkte selbst im eigenen Maßstab noch nah beieinander liegen.
          const label = {
            mercury: { x: sx - 6, y: sy + 3, anchor: 'end' },
            venus: { x: sx, y: sy - 10, anchor: 'middle' },
            earth: { x: sx + 7, y: sy + 3, anchor: 'start' },
            mars: { x: sx + 7, y: sy + 4, anchor: 'start' }
          }[planet.id] || { x: sx, y: sy - radius - 3, anchor: 'middle' };
          return (
            <g key={`inset-${planet.id}`}>
              <circle cx={sx} cy={sy} r={radius} fill={planet.color} stroke="rgba(255,255,255,0.65)" strokeWidth={0.45} />
              <line x1={sx} y1={sy} x2={label.x} y2={label.y - 2}
                stroke="rgba(234,230,220,0.48)" strokeWidth={0.5} />
              <text data-testid={`solar-inner-label-${planet.id}`} x={label.x} y={label.y}
                textAnchor={label.anchor} fill="#EAE6DC" fontSize={8.5}
                paintOrder="stroke" stroke="rgba(0,0,0,0.82)" strokeWidth={2}>{planet.name}</text>
            </g>
          );
        })}
      </svg>
    </aside>
  );
}

/** Prozedurale Körperscheibe: Verlauf + optional Wolkenbänder/Ring (Gasriesen). */
function BodyDisc({ b, sx, sy, r, selected, accent, onClick }) {
  const look = BODY_LOOK[b.id];
  const clip = `clip-${b.id}`;
  return (
    <g role="button" tabIndex={0} aria-label={b.name} aria-pressed={selected}
      className="solar-body-control" style={{ cursor: 'pointer' }}
      onClick={e => { e.stopPropagation(); onClick(); }}
      onKeyDown={e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); e.stopPropagation(); onClick();
      }}>
      {/* unsichtbarer, großzügiger Klickbereich für kleine Körper */}
      <circle data-testid={`solar-hit-${b.id}`} data-solar-hit="true"
        cx={sx} cy={sy} r={Math.max(r, MIN_HIT_RADIUS)} fill="transparent" />
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
function BodyLabel({ text, x, y, anchor, small, leaderFrom, highlight, onClick }) {
  const fontSize = small ? 11 : 12.5;
  return (
    <g style={{ cursor: 'pointer', userSelect: 'none' }} onClick={e => { e.stopPropagation(); onClick(); }}>
      {leaderFrom && (
        <line x1={leaderFrom.x} y1={leaderFrom.y} x2={x} y2={y - fontSize * 0.35}
          stroke="rgba(234,230,220,0.58)" strokeWidth={0.8} pointerEvents="none" />
      )}
      <text x={x} y={y} textAnchor={anchor} fontSize={fontSize} fontWeight={highlight ? 700 : 500}
        fill={highlight ? '#fff' : '#EAE6DC'} paintOrder="stroke"
        stroke="rgba(0,0,0,0.85)" strokeWidth={3} strokeLinejoin="round">
        {text}
      </text>
    </g>
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
            <b>{formatAttributeValue(v)}</b>
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
