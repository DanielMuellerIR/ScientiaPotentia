import { useState, useEffect } from 'react';
import { dataUrl } from './dataUrl';

/**
 * Lädt eine oder mehrere GeoJSON-Geometriedateien aus dem /data-Verzeichnis und
 * gibt sie als Objekt (Schlüssel = logischer Name) zurück. Ersetzt die zuvor in
 * Quiz.jsx und Map.jsx nahezu identisch duplizierte fetch→json→setState→catch-Folge
 * (Code-Review R4).
 *
 * Verwendung:
 *   const geo = useGeoData(['countries', 'subdivisions']);
 *   geo.countries      // GeoJSON oder null (noch nicht geladen / Fehler)
 *
 * Ein fehlgeschlagener Einzel-Fetch loggt und liefert null für diesen Schlüssel,
 * ohne die übrigen Dateien zu blockieren.
 */

// Zuordnung logischer Name -> Pfad. Bewusst zentral, damit Quiz und Map dieselben
// Dateien meinen und Tippfehler an einer Stelle auffallen.
// Die Werte sind Klarnamen; dataUrl() setzt daraus die tatsaechliche Adresse
// zusammen und beruecksichtigt den Inhaltshash des Produktionsbaus.
const GEO_FILES = {
  countries: 'countries.json',
  subdivisions: 'subdivisions.json',
  rivers: 'rivers.json'
};

export function useGeoData(keys) {
  const [data, setData] = useState({});
  // keys zu einem stabilen String verdichten, damit der Effekt nur bei echter
  // Änderung der angeforderten Dateien neu läuft (nicht bei jedem Render, weil ein
  // Array-Literal als Dependency sonst jedes Mal als "neu" gilt).
  const keyList = Array.isArray(keys) ? keys : [keys];
  const depKey = keyList.join(',');

  useEffect(() => {
    let cancelled = false;
    const requested = depKey ? depKey.split(',').filter(Boolean) : [];

    if (requested.length === 0) {
      setData({});
      return () => { cancelled = true; };
    }

    Promise.all(
      requested.map(name => {
        const url = GEO_FILES[name];
        return Promise.resolve()
          .then(() => {
            if (!url) throw new Error(`Unbekannte Geometriedatei: ${name}`);
            return fetch(dataUrl(url));
          })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status || 'Fehler'}`);
            return res.json();
          })
          .then(json => {
            if (!json || !Array.isArray(json.features)) {
              throw new Error('Ungültige GeoJSON-FeatureCollection');
            }
            return [name, json];
          })
          .catch(err => {
            console.error(`Failed to load ${name} geometry:`, err);
            return [name, null];
          });
      })
    ).then(entries => {
      // Nach Unmount nicht mehr in den State schreiben (vermeidet React-Warnung).
      if (!cancelled) setData(Object.fromEntries(entries));
    });

    return () => { cancelled = true; };
  }, [depKey]);

  return data;
}
