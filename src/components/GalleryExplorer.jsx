import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Images, ChevronLeft, ChevronRight, LayoutGrid, Landmark } from 'lucide-react';
import { commonsToDirectUrl } from '../utils/commonsImage';
// Gemeinsame Kategorie-Labels (eine Quelle für Quiz/Dashboard/Museum/Galerie, R3).
import { CATEGORY_LABELS } from './conceptLabels';
// Gemeinsames Lightbox-Gerüst (geteilt mit MuseumExplorer, Code-Review R2).
import LightboxShell from './LightboxShell';

/**
 * GalleryExplorer — „Museumssaal": begehbare Galeriewand pro Wissensbereich.
 *
 * Statt eines flachen Thumbnail-Rasters hängen die geernteten Konzeptbilder als
 * gerahmte Exponate (Passepartout, Messing-Placard, Spotlight) an einer Wand.
 * Jede Kategorie ist ein eigener „Saal"; horizontal scrollen heißt flanieren.
 * Ergänzend gibt es das „Depot": ein schlichtes Raster für schnelles Stöbern,
 * das auch die Suchergebnisse anzeigt.
 *
 * Props (Explore-Zweig in App.jsx, wie jeder Explorer):
 *   domain      – aktive Domain (Akzentfarbe, Label)
 *   concepts    – Konzept-Map des Bereichs; nur Einträge mit `concept.image.url`
 *                 werden zu Exponaten
 *   srsProgress – Lernfortschritt (hier ungenutzt, Teil der Schnittstelle)
 *
 * Performance: Die Wand ist virtualisiert — nur die im Ausschnitt sichtbaren
 * Exponate (± Puffer) stehen im DOM. Position/Breite der Slots berechnet JS,
 * die Optik (Rahmen, Wand, Boden, Snap) liegt in CSS-Klassen (index.css).
 */

// Kategorie -> deutsches Label; unbekannte Kategorien werden kapitalisiert.
const catLabel = (c) => CATEGORY_LABELS[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1) : '');

// Römische Saalnummern (nur Schmuck — nach XX einfach Dezimalzahl).
const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
const roman = (i) => ROMANS[i] || String(i + 1);

export default function GalleryExplorer({ domain, concepts = {} }) {
  const accent = domain?.accent || '#1B305B';

  // Nur Konzepte mit Bild, alphabetisch sortiert (de-Locale wegen Umlauten).
  const items = useMemo(() => Object.values(concepts || {})
    .filter(c => c?.image?.url)
    .map(c => ({
      id: c.id,
      name: c.name,
      category: c.category || c.type,
      url: c.image.url,
      license: c.image.license || '',
      attribution: c.image.attribution || ''
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de')), [concepts]);

  // Säle: eine Kategorie = ein Saal, alphabetisch nach deutschem Label.
  const saele = useMemo(() => {
    const byCat = new Map();
    for (const it of items) {
      const key = it.category || 'sonstiges';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(it);
    }
    return [...byCat.entries()]
      .sort((a, b) => catLabel(a[0]).localeCompare(catLabel(b[0]), 'de'))
      .map(([cat, list]) => ({ cat, label: catLabel(cat), items: list }));
  }, [items]);

  const [saalIdx, setSaalIdx] = useState(0);
  const [view, setView] = useState('rundgang'); // 'rundgang' | 'depot'
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState(null); // { item, list, idx }

  // Saal-Index sichern, falls sich die Saalliste ändert (z.B. Domainwechsel).
  useEffect(() => {
    if (saalIdx >= saele.length) setSaalIdx(0);
  }, [saele, saalIdx]);

  // Aktive Suche zeigt immer das Depot-Raster (Flur + Filter passt nicht zusammen).
  const query = search.trim().toLowerCase();
  const searchActive = query.length > 0;
  const depotItems = useMemo(
    () => (searchActive ? items.filter(i => i.name.toLowerCase().includes(query)) : items),
    [items, searchActive, query]
  );

  const saal = saele[saalIdx] || saele[0];
  const saalItems = saal ? saal.items : [];

  // ---- Virtualisierte Wand -------------------------------------------------
  // Slotbreite und sichtbarer Bereich werden aus Containerbreite + scrollLeft
  // berechnet; nur first..last (± Puffer) landen im DOM.
  const wallEl = useRef(null);
  const [wallW, setWallW] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = wallEl.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWallW(el.clientWidth));
    ro.observe(el);
    setWallW(el.clientWidth);
    return () => ro.disconnect();
    // view/searchActive: die Wand wird beim Umschalten neu gemountet.
  }, [view, searchActive]);

  // Schmaler Container (Mobil ODER schmal gezogenes Desktop-Panel): ein Exponat
  // füllt fast den ganzen Ausschnitt; sonst feste Slotbreite fürs Flanieren.
  const slotW = wallW > 0 && wallW < 640 ? Math.max(240, Math.round(wallW * 0.8)) : 300;

  const onWallScroll = (e) => {
    const x = e.currentTarget.scrollLeft;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setScrollX(x));
  };

  // Saalwechsel: an den Saalanfang „gehen".
  useEffect(() => {
    wallEl.current?.scrollTo({ left: 0 });
    setScrollX(0);
  }, [saalIdx, view]);

  const first = Math.max(0, Math.floor(scrollX / slotW) - 2);
  const last = Math.min(saalItems.length - 1, Math.ceil((scrollX + wallW) / slotW) + 2);
  const visible = [];
  for (let i = first; i <= last; i++) visible.push(i);

  // Pfeiltasten schreiten ein Exponat weiter (Desktop; Touch wischt nativ).
  const onWallKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); wallEl.current?.scrollBy({ left: slotW, behavior: 'smooth' }); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); wallEl.current?.scrollBy({ left: -slotW, behavior: 'smooth' }); }
  };

  // ---- Lightbox (mit Blättern innerhalb der aktuellen Liste) ---------------
  const openLightbox = useCallback((item, list) => {
    setLightbox({ item, list, idx: list.indexOf(item) });
  }, []);
  const lightboxNav = useCallback((dir) => {
    setLightbox(prev => {
      if (!prev) return null;
      const next = (prev.idx + dir + prev.list.length) % prev.list.length;
      return { item: prev.list[next], list: prev.list, idx: next };
    });
  }, []);
  useEffect(() => {
    if (!lightbox) return undefined;
    const handler = (e) => {
      if (e.key === 'ArrowLeft') lightboxNav(-1);
      if (e.key === 'ArrowRight') lightboxNav(+1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, lightboxNav]);

  // Leerzustand: Bereich hat (noch) keine Bilder — freundlicher Hinweis.
  if (items.length === 0) {
    return (
      <div className="terra-panel slide-in" style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        gap: '12px', padding: '24px', color: 'var(--text-muted)'
      }}>
        <Images size={40} style={{ color: accent, opacity: 0.7 }} />
        <div style={{ fontFamily: 'var(--font-title)', fontSize: '18px', color: 'var(--color-primary)' }}>
          Noch keine Bilder in {domain?.latinName || 'diesem Bereich'}
        </div>
        <div style={{ fontSize: '13px', maxWidth: '320px' }}>
          Sobald für die Konzepte dieses Bereichs freie Bilder vorliegen, erscheinen sie hier
          automatisch. Bis dahin: Quiz starten oder die Statistik rechts ansehen.
        </div>
      </div>
    );
  }

  const showDepot = view === 'depot' || searchActive;
  const shownCount = showDepot ? depotItems.length : saalItems.length;

  return (
    <div className="terra-panel slide-in" style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
      <div className="hall">
        {/* Kopfleiste: Titel, Saalnavigation, Suche, Depot-Umschalter */}
        <div className="hall-topbar">
          <Landmark size={18} style={{ color: accent, flexShrink: 0 }} />
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '17px', fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>
            Galerie — {domain?.label || domain?.latinName}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            {shownCount} {shownCount === 1 ? 'Exponat' : 'Exponate'}
          </span>

          {/* Saalnavigation nur im Rundgang (bei Suche/Depot ausgeblendet) */}
          {!showDepot && saele.length > 1 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
              <button
                className="btn-terra" style={{ padding: '4px 7px' }}
                onClick={() => setSaalIdx((saalIdx - 1 + saele.length) % saele.length)}
                title="Voriger Saal"
              ><ChevronLeft size={15} /></button>
              <select
                className="hall-saal-select"
                value={saalIdx}
                onChange={e => setSaalIdx(Number(e.target.value))}
                title="Saal wählen"
              >
                {saele.map((s, i) => (
                  <option key={s.cat} value={i}>Saal {roman(i)} — {s.label} ({s.items.length})</option>
                ))}
              </select>
              <button
                className="btn-terra" style={{ padding: '4px 7px' }}
                onClick={() => setSaalIdx((saalIdx + 1) % saele.length)}
                title="Nächster Saal"
              ><ChevronRight size={15} /></button>
            </span>
          )}

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: showDepot || saele.length <= 1 ? 'auto' : 0 }}>
            <input
              type="search"
              className="hall-search"
              placeholder="Suchen …"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button
              className="btn-terra"
              style={{ fontSize: '12.5px', padding: '5px 10px' }}
              onClick={() => setView(view === 'depot' ? 'rundgang' : 'depot')}
              title={view === 'depot' ? 'Zurück in den Rundgang' : 'Depot: alle Exponate als Raster'}
            >
              {view === 'depot'
                ? (<><Landmark size={14} /> Rundgang</>)
                : (<><LayoutGrid size={14} /> Depot</>)}
            </button>
          </span>
        </div>

        {/* Rundgang: virtualisierte Galeriewand */}
        {!showDepot && (
          <div
            ref={wallEl}
            className="hall-wall"
            onScroll={onWallScroll}
            onKeyDown={onWallKeyDown}
            tabIndex={0}
            aria-label={`Saal ${roman(saalIdx)} — ${saal?.label}: ${saalItems.length} Exponate, mit Pfeiltasten oder Wischen durchgehen`}
          >
            <div className="hall-strip" style={{ width: `${saalItems.length * slotW}px` }}>
              {visible.map(i => (
                <HallExhibit
                  key={saalItems[i].id}
                  item={saalItems[i]}
                  num={i + 1}
                  left={i * slotW}
                  width={slotW}
                  onClick={() => openLightbox(saalItems[i], saalItems)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Depot bzw. Suchergebnisse: schlichtes Passepartout-Raster */}
        {showDepot && (
          <div className="hall-depot">
            {depotItems.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', marginTop: 40, fontSize: 14 }}>
                Kein Exponat zu „{search.trim()}" gefunden.
              </div>
            )}
            {depotItems.map(item => (
              <DepotCard key={item.id} item={item} onClick={() => openLightbox(item, depotItems)} />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox: großes Bild + Provenienz, Blättern mit ← → */}
      {lightbox && (
        <LightboxShell
          onClose={() => setLightbox(null)}
          closeTitle="Schließen"
          header={(
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>{lightbox.item.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{catLabel(lightbox.item.category)}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {lightbox.idx + 1} / {lightbox.list.length}
              </span>
            </div>
          )}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', maxHeight: '70vh', overflow: 'hidden', flexShrink: 0 }}>
            <img
              src={commonsToDirectUrl(lightbox.item.url, 800)}
              alt={lightbox.item.name}
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
            />
            <button
              onClick={() => lightboxNav(-1)}
              className="btn-terra"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', padding: '7px 10px', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
              title="Vorheriges Exponat (←)"
            ><ChevronLeft size={18} /></button>
            <button
              onClick={() => lightboxNav(+1)}
              className="btn-terra"
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', padding: '7px 10px', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
              title="Nächstes Exponat (→)"
            ><ChevronRight size={18} /></button>
          </div>
          {(lightbox.item.license || lightbox.item.attribution) && (
            <div style={{ padding: '8px 14px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', flexShrink: 0 }}>
              {[lightbox.item.attribution, lightbox.item.license].filter(Boolean).join(' · ')} · Wikimedia Commons
            </div>
          )}
        </LightboxShell>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HallExhibit — ein gerahmtes Exponat an der Wand (Rundgang)
// ---------------------------------------------------------------------------
/**
 * Position/Breite kommen als px vom virtualisierenden Elternteil; Optik
 * (Rahmen, Mat, Spotlight, Placard) liegt in den .hall-*-Klassen.
 * 480px-Thumb, weil die Rahmen deutlich größer sind als die alten Kacheln.
 */
function HallExhibit({ item, num, left, width, onClick }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  return (
    <div
      className="hall-exhibit"
      style={{ left: `${left}px`, width: `${width}px` }}
      onClick={onClick}
      role="button"
      tabIndex={-1}
      title={item.name}
    >
      <div className="hall-frame">
        <div className="hall-mat">
          {!loaded && !errored && <div className="hall-loading" />}
          {!errored ? (
            <img
              className="hall-img"
              src={commonsToDirectUrl(item.url, 480)}
              alt={item.name}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
              style={{ opacity: loaded ? 1 : 0 }}
            />
          ) : (
            <Images size={26} style={{ opacity: 0.3 }} />
          )}
        </div>
      </div>
      <div className="hall-placard">
        <div className="hall-placard-name">{item.name}</div>
        <div className="hall-placard-sub">Nr. {num}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DepotCard — kleine Passepartout-Kachel im Depot-/Suchraster
// ---------------------------------------------------------------------------
function DepotCard({ item, onClick }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  return (
    <div className="hall-depot-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      title={item.name}
    >
      <div className="hall-depot-matte">
        {!loaded && !errored && <div className="hall-loading" />}
        {!errored ? (
          <img
            src={commonsToDirectUrl(item.url, 300)}
            alt={item.name}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', opacity: loaded ? 1 : 0 }}
          />
        ) : (
          <Images size={22} style={{ opacity: 0.3 }} />
        )}
      </div>
      <div className="hall-depot-name">{item.name}</div>
      <div className="hall-depot-sub">{catLabel(item.category)}</div>
    </div>
  );
}
