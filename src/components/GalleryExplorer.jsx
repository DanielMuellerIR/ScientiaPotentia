import React, { useState, useMemo } from 'react';
import { Images, X } from 'lucide-react';
import { commonsToDirectUrl } from '../utils/commonsImage';

/**
 * GalleryExplorer — per-Bereich-Bildgalerie als Startansicht (analog zum
 * Astra-Sonnensystem). Zeigt die mühsam geernteten Konzeptbilder eines
 * Hauptbereichs als Raster mit Lightbox, statt nur Statistiken.
 *
 * Bekommt vom Explore-Zweig in App.jsx dieselben Props wie jeder Explorer:
 *   domain      – aktive Domain (Akzentfarbe, Label)
 *   concepts    – Konzept-Map des Bereichs (key -> Konzept), nur die mit
 *                 `concept.image.url` landen in der Galerie
 *   srsProgress – Lernfortschritt (hier nicht genutzt, aber Teil der Schnittstelle)
 *
 * Bilder kommen aus Wikimedia Commons; `commonsToDirectUrl` macht aus der
 * gespeicherten Dateiseite einen direkten, skalierten <img>-Link.
 */

// Kategorie -> deutsches Label für die Karten-Chips. Unbekannte Kategorien
// werden kapitalisiert durchgereicht (Fallback unten).
const CAT_LABELS = {
  animal: 'Tier', plant: 'Pflanze', fungus: 'Pilz', biome: 'Lebensraum',
  geology: 'Geologie', mineral: 'Mineral', atmosphere: 'Atmosphäre', phenomenon: 'Phänomen',
  artwork: 'Kunstwerk', sculpture: 'Skulptur', architecture: 'Architektur',
  music: 'Musik', literature: 'Literatur', quote: 'Zitat',
  language: 'Sprache', language_family: 'Sprachfamilie', script: 'Schrift',
  bone: 'Knochen', muscle: 'Muskel', organ: 'Organ', body_fact: 'Körperwert', species: 'Menschenart',
  planet: 'Planet', dwarf_planet: 'Zwergplanet', moon: 'Mond', star: 'Stern',
  galaxy: 'Galaxie', nebula: 'Nebel', exoplanet: 'Exoplanet', constant: 'Konstante'
};
const catLabel = (c) => CAT_LABELS[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1) : '');

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

  // Kategorien im Bereich für die Filterleiste.
  const cats = useMemo(
    () => [...new Set(items.map(i => i.category).filter(Boolean))]
      .sort((a, b) => catLabel(a).localeCompare(catLabel(b), 'de')),
    [items]
  );

  const [catFilter, setCatFilter] = useState('all');
  const [lightbox, setLightbox] = useState(null);

  const shown = catFilter === 'all' ? items : items.filter(i => i.category === catFilter);

  // Leerzustand: Bereich hat (noch) keine Bilder — freundlicher Hinweis statt leerem Raster.
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

  return (
    <div className="terra-panel slide-in" style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '18px 20px', overflow: 'hidden' }}>
        {/* Kopf: Titel + Anzahl */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexShrink: 0 }}>
          <Images size={20} style={{ color: accent }} />
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>
            Galerie — {domain?.label || domain?.latinName}
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
            {shown.length} {shown.length === 1 ? 'Bild' : 'Bilder'}
          </span>
        </div>

        {/* Kategorie-Filter (nur wenn es mehr als eine Kategorie gibt) */}
        {cats.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px', flexShrink: 0 }}>
            {['all', ...cats].map(c => {
              const active = catFilter === c;
              return (
                <button
                  key={c}
                  onClick={() => setCatFilter(c)}
                  className="btn-terra"
                  style={{
                    fontSize: '12.5px', padding: '4px 11px',
                    background: active ? accent : undefined,
                    color: active ? '#fff' : undefined,
                    borderColor: active ? accent : undefined
                  }}
                >
                  {c === 'all' ? 'Alle' : catLabel(c)}
                </button>
              );
            })}
          </div>
        )}

        {/* Bild-Raster (scrollt) */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '12px', alignContent: 'start', paddingRight: '4px'
        }}>
          {shown.map(item => (
            <div
              key={item.id}
              onClick={() => setLightbox(item)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightbox(item); } }}
              className="terra-panel-inset"
              style={{
                // Block-Layout + KEIN overflow:hidden auf der Karte: overflow:hidden würde
                // sie zum Scroll-Container machen (min-size 0) und im Grid auf 2px stauchen.
                // Das Bild wird bereits vom inneren Wrapper geklippt.
                display: 'block', textAlign: 'left',
                padding: 0, cursor: 'pointer', border: '1px solid var(--border-light)'
              }}
              title={item.name}
            >
              {/* Feste Thumbnail-Höhe (kein aspect-ratio): im Flex-Column-Grid zählt
                  aspect-ratio nicht für die Hauptachsengröße -> Höhe bliebe 0. */}
              <div style={{ position: 'relative', width: '100%', height: '128px', flexShrink: 0, background: '#EDE9DF', overflow: 'hidden' }}>
                <img
                  src={commonsToDirectUrl(item.url, 300)}
                  alt={item.name}
                  loading="lazy"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <span style={{
                  position: 'absolute', top: '6px', right: '6px', fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.5px', textTransform: 'uppercase', padding: '2px 8px',
                  borderRadius: '999px', color: '#fff', background: accent, opacity: 0.92
                }}>{catLabel(item.category)}</span>
              </div>
              <div style={{ padding: '7px 9px', fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)', lineHeight: 1.25 }}>
                {item.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox: großes Bild + Provenienz */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(20,18,15,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="terra-panel"
            style={{
              maxWidth: '90%', maxHeight: '92%', display: 'flex', flexDirection: 'column',
              overflow: 'hidden', background: 'var(--bg-card)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', gap: '12px', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>{lightbox.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{catLabel(lightbox.category)}</div>
              </div>
              <button onClick={() => setLightbox(null)} className="btn-terra" style={{ padding: '6px', minWidth: '34px', height: '34px', justifyContent: 'center' }} title="Schließen">
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1b1916', padding: '8px' }}>
              <img
                src={commonsToDirectUrl(lightbox.url, 800)}
                alt={lightbox.name}
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
              />
            </div>
            {(lightbox.license || lightbox.attribution) && (
              <div style={{ padding: '8px 14px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)' }}>
                {[lightbox.attribution, lightbox.license].filter(Boolean).join(' · ')} · Wikimedia Commons
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
