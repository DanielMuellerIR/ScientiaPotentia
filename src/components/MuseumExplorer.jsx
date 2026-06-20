import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Images, X, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { DOMAINS } from '../domains';
// Commons-URL-Helfer ausgelagert (geteilt mit GalleryExplorer), s. utils/commonsImage.js
import { commonsToDirectUrl } from '../utils/commonsImage';

// --- Farben pro Domain (Akzent aus domains/index.js übernehmen) -----------
const DOMAIN_ACCENT = {
  astra:   '#5B4B8A',
  cultura: '#7E4B6B',
  lingua:  '#8A6D3B',
  natura:  '#3E7D5A',
  terra:   '#1B305B',
  homo:    '#A14D5A',
};

// Kategorien-Labels (Deutsch) für die Chips in den Karten.
// Unbekannte Kategorien werden direkt (capitalized) angezeigt.
const CAT_LABELS = {
  animal:          'Tier',
  plant:           'Pflanze',
  fungus:          'Pilz',
  biome:           'Lebensraum',
  geology:         'Geologie',
  mineral:         'Mineral',
  atmosphere:      'Atmosphäre',
  phenomenon:      'Phänomen',
  artwork:         'Kunstwerk',
  sculpture:       'Skulptur',
  architecture:    'Architektur',
  art_movement:    'Kunststil',
  composer:        'Komponist',
  composition:     'Komposition',
  literature:      'Literatur',
  literary_movement:'Literaturepoche',
  language:        'Sprache',
  language_family: 'Sprachfamilie',
  writing_system:  'Schriftsystem',
  language_fact:   'Sprachfakt',
  etymology:       'Etymologie',
  loanword:        'Lehnwort',
  grammar_fact:    'Grammatik',
  phonetics:       'Phonetik',
  language_curio:  'Sprachkuriosum',
  comet:           'Komet',
  meteor_shower:   'Meteorschauer',
  nebula:          'Nebel',
  constellation:   'Sternbild',
  mission:         'Mission',
  exoplanet:       'Exoplanet',
  asteroid:        'Asteroid',
  star_cluster:    'Sternhaufen',
  object:          'Objekt',
};

function catLabel(cat) {
  if (!cat) return '';
  return CAT_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ');
}

// --- Domain-Label holen ----------------------------------------------------
const DOMAIN_LABELS = {};
DOMAINS.forEach(d => { DOMAIN_LABELS[d.id] = d.label; });

/**
 * MuseumExplorer — durchstöberbare Bildgalerie aller Konzepte mit Bild.
 *
 * Zeigt ein responsives Masonry-Grid mit Lazy-Loading. Oben kann nach Domain
 * und Kategorie gefiltert sowie nach Namen gesucht werden. Ein Klick öffnet
 * eine Lightbox mit Detailinfos, Bildnachweis und Link zur Quelle.
 *
 * Props:
 *   concepts     - Map conceptKey -> Konzept, GEFILTERT nach aktiver Domain
 *                  (wird von App.jsx übergeben, wenn Museum global über alle
 *                  Domains läuft, muss hier alle Domains zusammenführen)
 *   allDomainData - Map domainId -> Konzept-Map (alle Domains gleichzeitig)
 */
export default function MuseumExplorer({ allDomainData = {} }) {
  // --- Filter-State ---------------------------------------------------------
  const [domainFilter, setDomainFilter] = useState('all'); // 'all' | domain-id
  const [catFilter,    setCatFilter]    = useState('all');
  const [search,       setSearch]       = useState('');
  const [lightbox,     setLightbox]     = useState(null); // { item, list, idx }

  // --- Alle Konzepte mit Bild aus allen Domains zusammenführen --------------
  // Das Ergebnis ist ein flaches Array von Einträgen, die alle das Bild-URL-Feld haben.
  const allItems = useMemo(() => {
    const items = [];
    for (const [domainId, conceptMap] of Object.entries(allDomainData)) {
      if (!conceptMap) continue;
      for (const concept of Object.values(conceptMap)) {
        if (!concept?.image?.url) continue;
        items.push({
          key:      concept.id || concept.name,
          name:     concept.name || '–',
          category: concept.category || concept.type || '',
          domainId,
          imageUrl: concept.image.url,
          license:  concept.image.license || '',
          attribution: concept.image.attribution || '',
          funFact:  concept.funFact || '',
          source:   concept.source || null,
          attributes: concept.attributes || {},
        });
      }
    }
    // Stabile Reihenfolge: alphabetisch nach Domain, dann Name.
    items.sort((a, b) => {
      if (a.domainId !== b.domainId) return a.domainId.localeCompare(b.domainId);
      return a.name.localeCompare(b.name, 'de');
    });
    return items;
  }, [allDomainData]);

  // --- Alle vorhandenen Kategorien (für Filter-Chips) -----------------------
  const availableCats = useMemo(() => {
    const pool = domainFilter === 'all'
      ? allItems
      : allItems.filter(it => it.domainId === domainFilter);
    const cats = [...new Set(pool.map(it => it.category))].filter(Boolean);
    cats.sort((a, b) => catLabel(a).localeCompare(catLabel(b), 'de'));
    return cats;
  }, [allItems, domainFilter]);

  // Beim Domain-Wechsel Kategoriefilter zurücksetzen, falls er dort nicht existiert.
  useEffect(() => {
    if (catFilter !== 'all' && !availableCats.includes(catFilter)) {
      setCatFilter('all');
    }
  }, [availableCats, catFilter]);

  // --- Gefilterte + durchsuchte Liste ---------------------------------------
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter(it => {
      if (domainFilter !== 'all' && it.domainId !== domainFilter) return false;
      if (catFilter    !== 'all' && it.category  !== catFilter)    return false;
      if (q && !it.name.toLowerCase().includes(q))                 return false;
      return true;
    });
  }, [allItems, domainFilter, catFilter, search]);

  // --- Domains mit Bildern (für Tabs) ----------------------------------------
  const domainsWithImages = useMemo(() => {
    const ids = [...new Set(allItems.map(it => it.domainId))];
    return DOMAINS.filter(d => ids.includes(d.id));
  }, [allItems]);

  // --- Lightbox Navigation --------------------------------------------------
  const openLightbox = useCallback((item) => {
    const idx = filteredItems.findIndex(it => it.key === item.key);
    setLightbox({ item, list: filteredItems, idx });
  }, [filteredItems]);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  const lightboxNav = useCallback((dir) => {
    setLightbox(prev => {
      if (!prev) return null;
      const next = (prev.idx + dir + prev.list.length) % prev.list.length;
      return { item: prev.list[next], list: prev.list, idx: next };
    });
  }, []);

  // Tastatur-Shortcut für Lightbox (← → Esc)
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e) => {
      if (e.key === 'ArrowLeft')  lightboxNav(-1);
      if (e.key === 'ArrowRight') lightboxNav(+1);
      if (e.key === 'Escape')     closeLightbox();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, lightboxNav, closeLightbox]);

  // --- Ladestand anzeigen, während Daten noch fehlen -----------------------
  const isLoading = Object.keys(allDomainData).length === 0;

  return (
    <div className="terra-panel" style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', border: '1px solid var(--border-light)'
    }}>
      {/* ----------------------------------------------------------------- */}
      {/* Kopfleiste: Titel + Suchfeld                                       */}
      {/* ----------------------------------------------------------------- */}
      <div style={{
        padding: '14px 18px 0', borderBottom: '1px solid var(--border-light)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Images size={20} style={{ color: 'var(--color-secondary)', flexShrink: 0 }} />
          <h2 style={{
            fontFamily: 'var(--font-title)', fontSize: 18, fontWeight: 700,
            color: 'var(--text-bright)', margin: 0, flex: 1
          }}>
            Museum
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            {filteredItems.length} Bilder
          </span>
          {/* Suchfeld */}
          <input
            type="search"
            placeholder="Suchen …"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-light)', background: 'var(--bg-sidebar)',
              color: 'var(--text-main)', fontFamily: 'var(--font-sans)', fontSize: 13,
              outline: 'none', width: 160
            }}
          />
        </div>

        {/* Domain-Filter-Tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <FilterChip
            label="Alle Bereiche"
            active={domainFilter === 'all'}
            count={allItems.length}
            onClick={() => setDomainFilter('all')}
          />
          {domainsWithImages.map(d => {
            const cnt = allItems.filter(it => it.domainId === d.id).length;
            return (
              <FilterChip
                key={d.id}
                label={d.label}
                active={domainFilter === d.id}
                count={cnt}
                accent={DOMAIN_ACCENT[d.id]}
                onClick={() => setDomainFilter(d.id)}
              />
            );
          })}
        </div>

        {/* Kategorie-Filter (nur wenn eine Domain ausgewählt ist oder < 10 Kategorien vorhanden) */}
        {availableCats.length > 0 && availableCats.length <= 20 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            <FilterChip
              label="Alle Kategorien"
              active={catFilter === 'all'}
              onClick={() => setCatFilter('all')}
              small
            />
            {availableCats.map(cat => (
              <FilterChip
                key={cat}
                label={catLabel(cat)}
                active={catFilter === cat}
                onClick={() => setCatFilter(cat)}
                small
              />
            ))}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Galerie-Grid                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {isLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60, fontSize: 14 }}>
            Bilder werden geladen …
          </div>
        )}
        {!isLoading && filteredItems.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60, fontSize: 14 }}>
            Keine Bilder für diesen Filter gefunden.
          </div>
        )}
        {/* CSS-Grid: 3 Spalten ab 900px, 2 ab 500px, 1 unter 400px */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '14px',
        }}>
          {filteredItems.map(item => (
            <GalleryCard
              key={item.key}
              item={item}
              onClick={() => openLightbox(item)}
            />
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Lightbox                                                            */}
      {/* ----------------------------------------------------------------- */}
      {lightbox && (
        <Lightbox
          item={lightbox.item}
          total={lightbox.list.length}
          idx={lightbox.idx}
          onClose={closeLightbox}
          onPrev={() => lightboxNav(-1)}
          onNext={() => lightboxNav(+1)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GalleryCard — eine Kachel im Grid
// ---------------------------------------------------------------------------
/**
 * Zeigt Thumbnail (lazy-loaded), Konzeptname, Domain-Badge und Kategorie-Chip.
 * Beim Klick öffnet die Lightbox.
 */
function GalleryCard({ item, onClick }) {
  const [loaded, setLoaded]   = useState(false);
  const [errored, setErrored] = useState(false);
  // imgRef wird nicht mehr gebraucht — natives loading="lazy" reicht aus.
  const accent = DOMAIN_ACCENT[item.domainId] || 'var(--color-primary)';

  // Thumbnail-Breite: 300px liefert Commons skalierte, bandbreitenschonende Version.
  const thumbSrc = commonsToDirectUrl(item.imageUrl, 300);

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-sidebar)', border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden', cursor: 'pointer',
        transition: 'border-color .15s ease, box-shadow .15s ease',
        display: 'flex', flexDirection: 'column',
      }}
      className="museum-card"
    >
      {/* Bild-Container mit festem Seitenverhältnis (4:3) */}
      <div style={{
        position: 'relative', paddingBottom: '75%', background: 'var(--bg-card)',
        overflow: 'hidden', flexShrink: 0,
      }}>
        {!errored && (
          <img
            src={thumbSrc}
            alt={item.name}
            loading="lazy"        /* natives Lazy-Loading */
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              opacity: loaded ? 1 : 0,
              transition: 'opacity .3s ease',
            }}
          />
        )}
        {/* Lade-Platzhalter / Fehler-Platzhalter */}
        {(!loaded || errored) && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 22, userSelect: 'none',
          }}>
            {errored ? '?' : '...'}
          </div>
        )}
        {/* Domain-Badge oben rechts */}
        <div style={{
          position: 'absolute', top: 6, right: 7,
          background: `${accent}cc`, color: '#fff',
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
          letterSpacing: 0.4, pointerEvents: 'none', backdropFilter: 'blur(2px)'
        }}>
          {DOMAIN_LABELS[item.domainId] || item.domainId}
        </div>
      </div>

      {/* Textbereich */}
      <div style={{ padding: '9px 10px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          fontFamily: 'var(--font-title)', fontWeight: 600, fontSize: 13,
          color: 'var(--text-bright)', lineHeight: 1.3,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {item.name}
        </div>
        {item.category && (
          <div style={{
            fontSize: 10.5, color: accent, fontWeight: 600,
            opacity: 0.9, marginTop: 2,
          }}>
            {catLabel(item.category)}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightbox — Vollbild-Detailansicht mit Navigation
// ---------------------------------------------------------------------------
/**
 * Overlay mit großem Bild, Konzeptname, Domain, Kategorie, FunFact,
 * Bildnachweis und Quell-Link. Tastatur: ← → Esc.
 */
function Lightbox({ item, total, idx, onClose, onPrev, onNext }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const accent = DOMAIN_ACCENT[item.domainId] || 'var(--color-primary)';

  // Große Version (800px) für die Lightbox.
  const largeSrc = commonsToDirectUrl(item.imageUrl, 800);

  // Bild neu laden, wenn sich das Item ändert (Navigation in Lightbox).
  useEffect(() => { setImgLoaded(false); }, [item.key]);

  return (
    /* Overlay */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(10, 10, 15, 0.88)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      {/* Inhalt — Klick hier schließt NICHT (stopPropagation) */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)', maxWidth: 820, width: '100%',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          position: 'relative',
        }}
      >
        {/* Kopfzeile */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderBottom: '1px solid var(--border-light)',
          flexShrink: 0,
        }}>
          {/* Domain-Badge */}
          <span style={{
            background: `${accent}22`, color: accent,
            fontSize: 10.5, fontWeight: 700, padding: '3px 9px',
            borderRadius: 999, border: `1px solid ${accent}55`, letterSpacing: 0.4,
          }}>
            {DOMAIN_LABELS[item.domainId] || item.domainId}
            {item.category ? ` · ${catLabel(item.category)}` : ''}
          </span>
          <span style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)' }}>
            {idx + 1} / {total}
          </span>
          <button
            onClick={onClose}
            className="btn-terra"
            style={{ padding: '5px 9px', fontSize: 13 }}
            title="Schließen (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Haupt-Content: Bild + Infos */}
        <div style={{
          flex: 1, overflow: 'auto',
          display: 'flex', flexDirection: 'column', gap: 0
        }}>
          {/* Bild */}
          <div style={{
            position: 'relative', background: '#0a0a0f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 200, maxHeight: 420, overflow: 'hidden', flexShrink: 0,
          }}>
            <img
              src={largeSrc}
              alt={item.name}
              onLoad={() => setImgLoaded(true)}
              style={{
                maxWidth: '100%', maxHeight: 420,
                objectFit: 'contain',
                opacity: imgLoaded ? 1 : 0,
                transition: 'opacity .35s ease',
                display: 'block',
              }}
            />
            {!imgLoaded && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.3)', fontSize: 14,
              }}>
                Bild wird geladen …
              </div>
            )}

            {/* Links/Rechts-Buttons über dem Bild */}
            <button
              onClick={onPrev}
              className="btn-terra"
              style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                padding: '7px 10px', background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
              }}
              title="Vorheriges Bild (←)"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={onNext}
              className="btn-terra"
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                padding: '7px 10px', background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
              }}
              title="Nächstes Bild (→)"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Textinfos */}
          <div style={{ padding: '16px 20px 20px' }}>
            <h3 style={{
              fontFamily: 'var(--font-title)', fontSize: 22, fontWeight: 700,
              color: 'var(--text-bright)', margin: '0 0 10px',
            }}>
              {item.name}
            </h3>

            {/* Attribute als Chips (nur wenn vorhanden) */}
            {Object.keys(item.attributes).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {Object.entries(item.attributes).slice(0, 6).map(([k, v]) => (
                  <span
                    key={k}
                    style={{
                      fontSize: 11.5, padding: '3px 9px', borderRadius: 6,
                      background: 'var(--bg-sidebar)', border: '1px solid var(--border-light)',
                      color: 'var(--text-main)',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{k}: </span>
                    <b>{typeof v === 'boolean' ? (v ? 'ja' : 'nein') : String(v)}</b>
                  </span>
                ))}
              </div>
            )}

            {/* Fun-Fact */}
            {item.funFact && (
              <div style={{
                display: 'flex', gap: 8, padding: '10px 12px',
                background: `${accent}11`, border: `1px solid ${accent}33`,
                borderRadius: 'var(--radius-md)', marginBottom: 12,
              }}>
                <Info size={15} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
                <p style={{
                  fontSize: 13, lineHeight: 1.55, color: 'var(--text-main)',
                  fontStyle: 'italic', margin: 0,
                }}>
                  {item.funFact}
                </p>
              </div>
            )}

            {/* Bildnachweis */}
            {(item.license || item.attribution) && (
              <div style={{
                fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5,
                borderTop: '1px solid var(--border-light)', paddingTop: 10, marginTop: 4,
              }}>
                {item.license && <span>Lizenz: {item.license} · </span>}
                {item.attribution && <span>{item.attribution}</span>}
              </div>
            )}

            {/* Quell-Link */}
            {item.source?.url && (
              <a
                href={item.source.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', marginTop: 8, fontSize: 11.5,
                  color: 'var(--color-primary)', textDecoration: 'underline',
                }}
              >
                Quelle: {item.source.name || item.source.url}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterChip — Knopf für Domain- und Kategorie-Filter
// ---------------------------------------------------------------------------
function FilterChip({ label, active, count, accent, onClick, small }) {
  const col = accent || 'var(--color-primary)';
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '3px 10px' : '5px 12px',
        fontSize: small ? 11 : 12,
        fontFamily: 'var(--font-title)',
        fontWeight: active ? 700 : 500,
        borderRadius: 999,
        border: active ? `1.5px solid ${col}` : '1.5px solid var(--border-light)',
        background: active ? `${col}18` : 'var(--bg-sidebar)',
        color: active ? col : 'var(--text-muted)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 5,
        transition: 'all .12s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {count != null && (
        <span style={{
          fontSize: small ? 10 : 10.5, opacity: 0.7,
          background: active ? `${col}22` : 'var(--border-light)',
          padding: '0 5px', borderRadius: 999,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}
