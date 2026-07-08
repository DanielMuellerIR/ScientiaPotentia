import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Gemeinsame Hülle für die Bild-Lightboxen von Museum und Galerie (Code-Review R2):
 * verdunkelter Vollbild-Hintergrund (Klick daneben schließt), zentrierte Karte mit
 * Kopfzeile (frei befüllbar) + Schließen-Knopf, darunter beliebiger Inhalt. Esc
 * schließt ebenfalls. Über createPortal an document.body gehängt, damit die Karte
 * das ganze Fenster überdeckt und nicht vom Panel-Layout beschnitten wird.
 *
 * Bewusst NUR das geteilte Gerüst — die inhaltlichen Unterschiede (Navigation,
 * Attribut-Chips, FunFact, Fußzeile) bleiben in den jeweiligen Aufrufern, damit
 * die Hülle nicht zur überladenen Alles-Komponente wird.
 *
 * Props:
 *   onClose    - schließt die Lightbox (Backdrop-Klick, Schließen-Knopf, Esc)
 *   header     - frei befüllbarer Kopfzeilen-Inhalt links vom Schließen-Knopf
 *   children   - Karten-Inhalt unterhalb der Kopfzeile
 *   maxWidth   - maximale Kartenbreite in px (Default 820)
 *   closeTitle - Tooltip des Schließen-Knopfs
 */
export default function LightboxShell({ onClose, header, children, maxWidth = 820, closeTitle = 'Schließen (Esc)' }) {
  // Esc schließt. Bewusst hier zentral, damit jede Lightbox dieses Verhalten erbt
  // (die Galerie hatte vorher kein Esc — das ist jetzt einheitlich vorhanden).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal((
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10, 10, 15, 0.84)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      {/* Klick auf die Karte selbst schließt NICHT (stopPropagation). */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)', maxWidth, width: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', position: 'relative',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderBottom: '1px solid var(--border-light)', flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>{header}</div>
          <button
            onClick={onClose}
            className="btn-terra"
            style={{ padding: '5px 9px', fontSize: 13, flexShrink: 0 }}
            title={closeTitle}
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  ), document.body);
}
