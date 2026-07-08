import { useState, useEffect } from 'react';

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
const GEO_FILES = {
  countries: 'data/countries.json',
  subdivisions: 'data/subdivisions.json',
  rivers: 'data/rivers.json'
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
    const requested = depKey.split(',');

    Promise.all(
      requested.map(name =>
        fetch(GEO_FILES[name])
          .then(res => res.json())
          .then(json => [name, json])
          .catch(err => {
            console.error(`Failed to load ${name} geometry:`, err);
            return [name, null];
          })
      )
    ).then(entries => {
      // Nach Unmount nicht mehr in den State schreiben (vermeidet React-Warnung).
      if (!cancelled) setData(Object.fromEntries(entries));
    });

    return () => { cancelled = true; };
  }, [depKey]);

  return data;
}
