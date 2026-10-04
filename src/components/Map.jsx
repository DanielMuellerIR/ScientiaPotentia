import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useGeoData } from '../utils/useGeoData';
// Die Geometriedateien tragen im Produktionsbau ihren Inhaltshash im Namen.
// dataUrl() loest den Klarnamen dorthin auf (siehe src/utils/dataUrl.js); ein
// fest verdrahteter Klarname zeigt im Release ins Leere.
import { dataUrl } from '../utils/dataUrl';

// Der Stil liegt lokal im Build und bleibt deshalb auch bei einem anderen Vite-Base-Pfad
// auffindbar. Kacheln, Glyphen und Sprite bleiben bewusst beim OpenFreeMap-Original;
// die Abhängigkeiten sind zusätzlich in der JSON-Metadaten beschrieben.
const PARCHMENT_STYLE_URL = `${import.meta.env.BASE_URL}map_styles/scientia_parchment.json`;
// Der Worker muss mitgebaut werden; ein relativer Bibliothekspfad funktioniert
// im Entwicklungsserver, fehlt aber neben dem Produktionsbundle.
maplibregl.setWorkerUrl(workerUrl);

/**
 * MapLibre-'match'-Ausdruecke brauchen mindestens ein (Label, Output)-Paar
 * plus einen Fallback. Wird ein match ohne Paare gebaut (z.B. frische Quiz-Frage
 * ohne markierte Laender, leere Heatmap), ist er ungueltig:
 * "Expected at least 4 arguments, but found only 2". In dem Fall geben wir nur
 * den Fallback (das zuletzt angehaengte Element) als konstanten Wert zurueck,
 * der von setPaintProperty ebenfalls akzeptiert wird.
 */
function matchOrConstant(expression) {
  // ['match', ['get','id'], fallback] -> Laenge 3 bedeutet: keine Paare vorhanden
  return expression.length > 3 ? expression : expression[expression.length - 1];
}

/**
 * Umschliessendes Rechteck einer GeoJSON-Geometrie.
 *
 * Zwei Rechnungen laufen parallel: eine mit den Laengen wie sie sind
 * (-180 bis 180) und eine mit allen negativen Laengen um +360 verschoben. Wer
 * die Datumsgrenze ueberspannt, ist in der ersten fast 360 Grad breit und in
 * der zweiten schmal — dann gewinnt die zweite, und `fitBounds` zoomt auf die
 * Region statt auf die halbe Welt. MapLibre kommt mit Laengen ueber 180 zurecht
 * und zeichnet den Ausschnitt ueber die Grenze hinweg.
 *
 * Ohne das zoomte der Autonome Kreis der Tschuktschen (RU-CHU, das einzige der
 * 252 Unterteilungs-Features mit 360 Grad Spanne) auf die ganze Weltkarte. Fuer
 * Laender gab es dafuer handverdrahtete Sonderfaelle, fuer Unterteilungen und
 * Fluesse nicht.
 *
 * Die Antarktis bleibt bewusst weltweit: Sie umfasst wirklich alle Laengen,
 * beide Rechnungen ergeben 360 Grad, und die Weltansicht ist dort richtig.
 */
export function getBoundingBox(geometry) {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  // Dieselbe Rechnung mit auf [0, 360) verschobenen Laengen.
  let minShifted = Infinity, maxShifted = -Infinity;

  const processCoordinates = (coords) => {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      const shifted = lng < 0 ? lng + 360 : lng;
      if (shifted < minShifted) minShifted = shifted;
      if (shifted > maxShifted) maxShifted = shifted;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else {
      coords.forEach(processCoordinates);
    }
  };

  processCoordinates(geometry.coordinates);
  if (maxShifted - minShifted < maxLng - minLng) {
    return [[minShifted, minLat], [maxShifted, maxLat]];
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

/** Reserviert auch in niedrigen Mobilpanels genug Fläche für den Kartenausschnitt. */
export function boundedMapPadding(container, preferred) {
  const width = container?.clientWidth || 0;
  const height = container?.clientHeight || 0;
  return Math.max(0, Math.min(preferred, Math.floor(Math.min(width, height) * 0.22)));
}

export default function Map({
  selectedId,
  onSelectEntity,
  highlightedIds = [],
  wrongIds = [],
  correctIds = [],
  progressHeatmap = {},
  mode = 'atlas', // 'atlas' | 'quiz' | 'dashboard'
  showSubdivisions = false,
  zoomToEntityId = null,
  onAvailabilityChange,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [initializationFailed, setInitializationFailed] = useState(false);
  const [viewZoom, setViewZoom] = useState(1.5);
  // Beide echten MapLibre-Werkzeuge teilen einen gut erreichbaren Schalter.
  // Die Attribution bleibt davon unberührt und damit immer sichtbar.
  const [areMapControlsVisible, setAreMapControlsVisible] = useState(true);
  // Länder-, Unterteilungs- und Fluss-Geometrien für Bounding-Box-Berechnungen
  // (Code-Review R4: gemeinsamer Hook statt duplizierter fetch-Folge).
  const geo = useGeoData(['countries', 'subdivisions', 'rivers']);
  const countriesGeoJSON = geo.countries || null;
  const subdivisionsGeoJSON = geo.subdivisions || null;
  const riversGeoJSON = geo.rivers || null;

  const stateRef = useRef();
  stateRef.current = { mode, highlightedIds, correctIds, wrongIds, showSubdivisions, onSelectEntity };

  // Helper to toggle place/label layers
  const toggleMapLabels = (map, visible) => {
    try {
      const style = map.getStyle();
      if (!style || !style.layers) return;
      
      const visibilityValue = visible ? 'visible' : 'none';
      style.layers.forEach(layer => {
        // Find text label layers
        if (layer.type === 'symbol' || 
            layer.id.includes('label') || 
            layer.id.includes('place') || 
            layer.id.includes('poi') || 
            layer.id.includes('town') || 
            layer.id.includes('city') || 
            layer.id.includes('country')) {
          map.setLayoutProperty(layer.id, 'visibility', visibilityValue);
        }
      });
    } catch (e) {
      console.warn('Could not toggle map labels:', e);
    }
  };

  // Initialize Map
  useEffect(() => {
    if (mapRef.current) return;

    console.log('Initializing MapLibre GL JS...');
    let map;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: PARCHMENT_STYLE_URL,
        center: [10, 30],
        zoom: 1.5,
        maxZoom: 9,
        minZoom: 1,
        // Nicht abschalten: Der Style übernimmt die Anbieterattribution aus seinen Quellen.
        attributionControl: true
      });
    } catch (error) {
      console.warn('Karte konnte nicht gestartet werden:', error);
      setInitializationFailed(true);
      onAvailabilityChange?.(false);
      return;
    }
    onAvailabilityChange?.(true);

    mapRef.current = map;
    // Subdivisionen werden im Atlas ab Zoomstufe 3 eingeblendet. Der React-State
    // sorgt dafür, dass ein reines Mausrad-/Pinch-Zoomen die Paint-Regeln neu setzt.
    map.on('zoomend', () => setViewZoom(map.getZoom()));

    // NavigationControl liefert hier nur die drehbare, echte Kompassrose.
    // Zoomtasten würden auf kleinen Karten unnötig Platz für Labels verdecken.
    // Die Maßstabsleiste berechnet ihren Wert aus Zoom und Projektion selbst.
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 76, unit: 'metric' }), 'bottom-right');

    map.on('load', () => {
      // Find the first symbol layer in the style so we can insert custom layers beneath labels
      const style = map.getStyle();
      let firstLabelLayerId = undefined;
      if (style && style.layers) {
        for (const layer of style.layers) {
          if (layer.type === 'symbol') {
            firstLabelLayerId = layer.id;
            break;
          }
        }
      }

      // 1. Add Countries source and layers
      map.addSource('countries', {
        type: 'geojson',
        data: dataUrl('countries.json'),
        promoteId: 'id'
      });

      // Default transparent fill layer for country interaction
      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': '#E3DFD5',
          'fill-opacity': 0.0 // Start transparent
        }
      }, firstLabelLayerId);

      // Country borderlines
      map.addLayer({
        id: 'countries-borders',
        type: 'line',
        source: 'countries',
        paint: {
          'line-color': '#8B6F3B',
          'line-width': 1,
          'line-opacity': 0.0 // Hide initially
        }
      }, firstLabelLayerId);

      // 2. Add Subdivisions source and layers (DE, US, GB)
      map.addSource('subdivisions', {
        type: 'geojson',
        data: dataUrl('subdivisions.json'),
        promoteId: 'id'
      });

      // Subdivision fills (invisible by default, visible on zoom or quiz selection)
      map.addLayer({
        id: 'subdivisions-fill',
        type: 'fill',
        source: 'subdivisions',
        paint: {
          'fill-color': '#E8E1D2',
          'fill-opacity': 0.0
        }
      }, firstLabelLayerId);

      // Subdivision borderlines (finer dashed lines)
      map.addLayer({
        id: 'subdivisions-borders',
        type: 'line',
        source: 'subdivisions',
        paint: {
          'line-color': '#8B6F3B',
          'line-width': 0.8,
          'line-dasharray': [2, 2],
          'line-opacity': 0.0
        }
      }, firstLabelLayerId);

      // Selected outlines glow
      map.addLayer({
        id: 'countries-hover-outline',
        type: 'line',
        source: 'countries',
        paint: {
          'line-color': '#1B305B',
          'line-width': 2.5,
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            1,
            0
          ]
        }
      }, firstLabelLayerId);

      // 3. Add Rivers source and layer
      map.addSource('rivers', {
        type: 'geojson',
        data: dataUrl('rivers.json'),
        promoteId: 'id'
      });

      // Rivers line layer (rendered beneath text labels)
      map.addLayer({
        id: 'rivers-line',
        type: 'line',
        source: 'rivers',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': '#71969A',
          'line-width': 1.5,
          'line-opacity': 0.0
        }
      }, firstLabelLayerId);

      // Die Beschriftung nutzt dieselben geprüften Namen wie die Flussgeometrie.
      // Ohne beforeId kommt sie über die Basislabels und bleibt beim Hereinzoomen lesbar.
      map.addLayer({
        id: 'rivers-label',
        type: 'symbol',
        source: 'rivers',
        minzoom: 2,
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Italic'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 1, 11, 5, 14],
          'text-letter-spacing': 0.06,
          // Lokale Lernziele dürfen nicht von den vielen Basiskartenlabels verdrängt werden.
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-offset': [0, -0.8],
          'text-keep-upright': true,
          // Lange oder stark gebogene Flüsse bleiben am Mittelpunkt trotzdem beschriftet.
          'text-max-angle': 180,
          'text-padding': 6
        },
        paint: {
          'text-color': '#1B305B',
          'text-halo-color': '#E3DFD5',
          'text-halo-width': 1.5
        }
      });

      setMapLoaded(true);

      // Mouse Move Hover effect on countries
      let hoveredFeatureId = null;
      map.on('mousemove', 'countries-fill', (e) => {
        if (e.features.length > 0) {
          map.getCanvas().style.cursor = 'pointer';
          
          if (hoveredFeatureId !== null) {
            map.setFeatureState(
              { source: 'countries', id: hoveredFeatureId },
              { hover: false }
            );
          }
          
          hoveredFeatureId = e.features[0].id;
          map.setFeatureState(
            { source: 'countries', id: hoveredFeatureId },
            { hover: true }
          );
        }
      });

      map.on('mouseleave', 'countries-fill', () => {
        map.getCanvas().style.cursor = '';
        if (hoveredFeatureId !== null) {
          map.setFeatureState(
            { source: 'countries', id: hoveredFeatureId },
            { hover: false }
          );
          hoveredFeatureId = null;
        }
      });

      // Click Event - Handles clicks on countries or subdivisions. Query features to prevent double click triggers.
      map.on('click', (e) => {
        const { mode, highlightedIds, correctIds, wrongIds, showSubdivisions, onSelectEntity } = stateRef.current;
        const currentZoom = map.getZoom();
        
        const isSubdivisionActive = showSubdivisions ||
                                    highlightedIds.some(id => id && typeof id === 'string' && id.includes('-')) || 
                                    correctIds.some(id => id && typeof id === 'string' && id.includes('-')) || 
                                    wrongIds.some(id => id && typeof id === 'string' && id.includes('-'));
                                    
        const areSubdivisionsVisible = (mode === 'quiz' && isSubdivisionActive) || (mode !== 'quiz' && currentZoom > 3);

        const features = map.queryRenderedFeatures(e.point);
        if (!features || features.length === 0) return;

        if (areSubdivisionsVisible) {
          const subFeat = features.find(f => f.layer.id === 'subdivisions-fill');
          if (subFeat) {
            const clickedId = subFeat.properties?.id || subFeat.id;
            if (onSelectEntity) onSelectEntity(clickedId);
            return;
          }
        }

        const countryFeat = features.find(f => f.layer.id === 'countries-fill');
        if (countryFeat) {
          const clickedId = countryFeat.properties?.id || countryFeat.id;
          if (onSelectEntity) onSelectEntity(clickedId);
          return;
        }
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update styles based on tab mode and active entities
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    // Toggle text labels: Hide during Quiz mode, Show in Atlas/Dashboard
    toggleMapLabels(map, mode !== 'quiz');

    if (mode === 'dashboard') {
      // 1. Dashboard Mode: "Keine Länder einzeichnen" (Keep start screen clean)
      map.setPaintProperty('countries-fill', 'fill-opacity', 0.0);
      map.setPaintProperty('countries-borders', 'line-opacity', 0.0);
      map.setPaintProperty('countries-borders', 'line-color', '#8B6F3B');
      map.setPaintProperty('countries-borders', 'line-width', 1);
      map.setPaintProperty('subdivisions-fill', 'fill-opacity', 0.0);
      map.setPaintProperty('subdivisions-borders', 'line-opacity', 0.0);

    } else if (mode === 'quiz') {
      // 2. Quiz Mode: Show unlabelled borders, color-code correct/wrong selections
      map.setPaintProperty('countries-borders', 'line-opacity', 0.8);
      map.setPaintProperty('countries-borders', 'line-color', '#8B6F3B');
      map.setPaintProperty('countries-borders', 'line-width', 1);
      
      const isSubdivisionActive = showSubdivisions ||
                                  highlightedIds.some(id => id && typeof id === 'string' && id.includes('-')) || 
                                  correctIds.some(id => id && typeof id === 'string' && id.includes('-')) || 
                                  wrongIds.some(id => id && typeof id === 'string' && id.includes('-'));
      
      // Eine vorherige Provinzfrage darf ihre Flächen nicht in die nächste
      // Länderfrage mitnehmen. Darum beide Werte in jedem Quizdurchlauf setzen.
      map.setPaintProperty('subdivisions-borders', 'line-opacity', isSubdivisionActive ? 0.8 : 0.0);
      map.setPaintProperty('subdivisions-fill', 'fill-opacity', isSubdivisionActive ? 0.8 : 0.0);

      // Quiz dynamic colors expression
      const buildColorExpression = () => {
        const colorExpression = ['match', ['get', 'id']];
        correctIds.forEach(id => {
          if (id && typeof id === 'string') {
            colorExpression.push(id, '#2C5E43'); // Success Forest Green
          }
        });
        wrongIds.forEach(id => {
          if (id && typeof id === 'string') {
            colorExpression.push(id, '#842029'); // Error Crimson
          }
        });
        highlightedIds.forEach(id => {
          if (id && typeof id === 'string') {
            colorExpression.push(id, '#B58900'); // Outline / Hint Gold
          }
        });
        colorExpression.push('#E3DFD5'); // Standard-Pergament
        return matchOrConstant(colorExpression);
      };

      map.setPaintProperty('countries-fill', 'fill-color', buildColorExpression());
      map.setPaintProperty('countries-fill', 'fill-opacity', 0.7);

      if (isSubdivisionActive) {
        map.setPaintProperty('subdivisions-fill', 'fill-color', buildColorExpression());
      }

    } else {
      // 3. Atlas / Exploration Mode: Highlight selected item, color-code by mastery heatmaps
      map.setPaintProperty('countries-borders', 'line-opacity', 0.6);
      
      // Make subnational boundaries visible when zoomed in or when a subdivision is selected
      const isSubdivisionSelected = selectedId && typeof selectedId === 'string' && selectedId.includes('-');
      const areSubdivisionsVisible = viewZoom > 3 || isSubdivisionSelected;
      
      map.setPaintProperty('subdivisions-borders', 'line-opacity', areSubdivisionsVisible ? 0.6 : 0.0);
      map.setPaintProperty('subdivisions-fill', 'fill-opacity', areSubdivisionsVisible ? 0.35 : 0.0);

      // Style subdivision fill color: highlight selected subdivision, default for others
      const subColorExpression = ['match', ['get', 'id']];
      if (isSubdivisionSelected) {
        subColorExpression.push(selectedId, '#D4B15C'); // Gold für die aktive Auswahl
      }
      subColorExpression.push('#E8E1D2'); // warmer Grundton für Unterteilungen
      map.setPaintProperty('subdivisions-fill', 'fill-color', matchOrConstant(subColorExpression));

      // Border outline for active subdivision
      const subBorderExpression = ['match', ['get', 'id']];
      if (isSubdivisionSelected) {
        subBorderExpression.push(selectedId, '#1B305B'); // deep slate blue border
      }
      subBorderExpression.push('#8B6F3B'); // sepiafarbene Unterteilungsgrenze
      map.setPaintProperty('subdivisions-borders', 'line-color', matchOrConstant(subBorderExpression));

      const subBorderWidthExpression = ['match', ['get', 'id']];
      if (isSubdivisionSelected) {
        subBorderWidthExpression.push(selectedId, 2);
      }
      subBorderWidthExpression.push(0.8);
      map.setPaintProperty('subdivisions-borders', 'line-width', matchOrConstant(subBorderWidthExpression));

      // Style fill color based on SRS progress (Heatmap)
      const colorExpression = ['match', ['get', 'id']];
      
      Object.keys(progressHeatmap).forEach(entityId => {
        const stats = progressHeatmap[entityId];
        let color = '#E3DFD5';
        
        if (stats.repetitions > 0) {
          if (stats.interval >= 30) {
            color = '#B89550'; // Gemeistert: antikes Gold
          } else if (stats.interval >= 7) {
            color = '#91A8B8'; // Vertraut: entsättigtes Blaugrün
          } else {
            color = '#C8D1B8'; // Angespielt: zurückhaltendes Salbeigrün
          }
        }
        
        // Highlight active country selection differently (only if it's a country)
        if (entityId === selectedId && !isSubdivisionSelected) {
          color = '#D4B15C'; // Aktive Auswahl: Gold statt grauer Überdeckung
        }
        
        colorExpression.push(entityId, color);
      });
      
      if (selectedId && !isSubdivisionSelected && !progressHeatmap[selectedId]) {
        colorExpression.push(selectedId, '#D4B15C');
      }

      colorExpression.push('#E3DFD5'); // Grundfläche der Pergamentkarte
      map.setPaintProperty('countries-fill', 'fill-color', matchOrConstant(colorExpression));
      map.setPaintProperty('countries-fill', 'fill-opacity', 0.85);

      // Border outline for active country
      const borderExpression = ['match', ['get', 'id']];
      if (selectedId && !isSubdivisionSelected) {
        borderExpression.push(selectedId, '#1B305B'); // Deep Slate Blue border for selected country
      }
      borderExpression.push('#8B6F3B');
      map.setPaintProperty('countries-borders', 'line-color', matchOrConstant(borderExpression));
      
      const borderWidthExpression = ['match', ['get', 'id']];
      if (selectedId && !isSubdivisionSelected) {
        borderWidthExpression.push(selectedId, 2);
      }
      borderWidthExpression.push(1);
      map.setPaintProperty('countries-borders', 'line-width', matchOrConstant(borderWidthExpression));
    }

    // Update rivers layer styling dynamically
    if (map.getLayer('rivers-line')) {
      const activeRiverId = (selectedId && typeof selectedId === 'string' && selectedId.startsWith('river_')) ? selectedId :
                            (zoomToEntityId && typeof zoomToEntityId === 'string' && zoomToEntityId.startsWith('river_')) ? zoomToEntityId :
                            highlightedIds.find(id => id && typeof id === 'string' && id.startsWith('river_')) ||
                            correctIds.find(id => id && typeof id === 'string' && id.startsWith('river_')) ||
                            wrongIds.find(id => id && typeof id === 'string' && id.startsWith('river_'));

      if (mode === 'dashboard') {
        map.setPaintProperty('rivers-line', 'line-opacity', 0.0);
      } else if (mode === 'quiz') {
        if (activeRiverId) {
          const activeRiverColor = correctIds.includes(activeRiverId)
            ? '#2C5E43'
            : wrongIds.includes(activeRiverId)
              ? '#842029'
              : '#B58900';
          // Highlight the active river prominently, hide others during quiz
          map.setPaintProperty('rivers-line', 'line-opacity', [
            'case',
            ['==', ['get', 'id'], activeRiverId],
            0.9,
            0.0
          ]);
          map.setPaintProperty('rivers-line', 'line-width', [
            'case',
            ['==', ['get', 'id'], activeRiverId],
            4.0, // Thicker visible stroke
            0.0
          ]);
          map.setPaintProperty('rivers-line', 'line-color', [
            'case',
            ['==', ['get', 'id'], activeRiverId],
            activeRiverColor,
            'transparent'
          ]);
        } else {
          map.setPaintProperty('rivers-line', 'line-opacity', 0.0);
        }
      } else {
        // Atlas Mode
        if (activeRiverId) {
          map.setPaintProperty('rivers-line', 'line-opacity', [
            'case',
            ['==', ['get', 'id'], activeRiverId],
            0.9,
            0.3
          ]);
          map.setPaintProperty('rivers-line', 'line-width', [
            'case',
            ['==', ['get', 'id'], activeRiverId],
            4.5, // Thicker active river
            1.5  // Subtler other rivers
          ]);
          map.setPaintProperty('rivers-line', 'line-color', [
            'case',
            ['==', ['get', 'id'], activeRiverId],
            '#1B305B', // Navy: ausgewählter Fluss
            '#71969A'  // Entsättigtes Blaugrün für weitere Flüsse
          ]);
        } else {
          map.setPaintProperty('rivers-line', 'line-opacity', 0.35);
          map.setPaintProperty('rivers-line', 'line-width', 1.5);
          map.setPaintProperty('rivers-line', 'line-color', '#71969A');
        }
      }
    }
  }, [mapLoaded, selectedId, highlightedIds, wrongIds, correctIds, progressHeatmap, mode, showSubdivisions, zoomToEntityId, viewZoom]);

  // Handle map center panning/zooming to country or subdivision context
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !countriesGeoJSON) return;
    
    let targetEntityId = null;
    if (mode === 'quiz') {
      if (zoomToEntityId) {
        targetEntityId = zoomToEntityId;
      }
    } else {
      if (selectedId) {
        targetEntityId = selectedId;
      }
    }

    if (!targetEntityId) return;

    const map = mapRef.current;
    const isSubdivision = typeof targetEntityId === 'string' && targetEntityId.includes('-');
    const isRiver = typeof targetEntityId === 'string' && targetEntityId.startsWith('river_');

    if (isSubdivision) {
      if (!subdivisionsGeoJSON) return;
      const subFeature = subdivisionsGeoJSON.features.find(
        f => f.id === targetEntityId || (f.properties && f.properties.id === targetEntityId)
      );
      if (subFeature && subFeature.geometry) {
        const bbox = getBoundingBox(subFeature.geometry);
        if (
          bbox &&
          isFinite(bbox[0][0]) && isFinite(bbox[0][1]) &&
          isFinite(bbox[1][0]) && isFinite(bbox[1][1])
        ) {
          // Calculate bounding box dimensions to determine dynamic maxZoom
          const lngSpan = Math.abs(bbox[1][0] - bbox[0][0]);
          const latSpan = Math.abs(bbox[1][1] - bbox[0][1]);
          const maxSpan = Math.max(lngSpan, latSpan);
          
          let dynamicMaxZoom = 5.5;
          if (maxSpan < 1.0) {
            dynamicMaxZoom = 7.5;
          } else if (maxSpan < 3.0) {
            dynamicMaxZoom = 6.2;
          }

          map.fitBounds(bbox, {
            padding: boundedMapPadding(mapContainerRef.current, mode === 'quiz' ? 150 : 80),
            maxZoom: dynamicMaxZoom,
            duration: 1200,
            essential: true
          });
        }
      }
    } else if (isRiver) {
      if (!riversGeoJSON) return;
      const riverFeature = riversGeoJSON.features.find(
        f => f.id === targetEntityId || (f.properties && f.properties.id === targetEntityId)
      );
      if (riverFeature && riverFeature.geometry) {
        const bbox = getBoundingBox(riverFeature.geometry);
        if (
          bbox &&
          isFinite(bbox[0][0]) && isFinite(bbox[0][1]) &&
          isFinite(bbox[1][0]) && isFinite(bbox[1][1])
        ) {
          const lngSpan = Math.abs(bbox[1][0] - bbox[0][0]);
          const latSpan = Math.abs(bbox[1][1] - bbox[0][1]);
          const maxSpan = Math.max(lngSpan, latSpan);
          
          let dynamicMaxZoom = 5.0;
          if (maxSpan < 4.0) {
            dynamicMaxZoom = 6.5;
          } else if (maxSpan < 10.0) {
            dynamicMaxZoom = 5.2;
          }

          map.fitBounds(bbox, {
            padding: boundedMapPadding(mapContainerRef.current, mode === 'quiz' ? 180 : 100),
            maxZoom: dynamicMaxZoom,
            duration: 1200,
            essential: true
          });
        }
      }
    } else {
      const countryId = targetEntityId;
      const countryFeature = countriesGeoJSON.features.find(
        f => f.id === countryId || (f.properties && f.properties.id === countryId)
      );

      if (countryFeature && countryFeature.geometry) {
        let bbox;
        if (countryId === 'US') {
          // Special override for USA contiguous coordinates to avoid Alaska/Hawaii mapping sprawl
          bbox = [[-125, 24], [-66, 50]];
        } else if (countryId === 'FJ') {
          // Fidschi: Ausschnitt auf die Hauptinseln. Die Datumsgrenze allein
          // behandelt getBoundingBox() inzwischen selbst; dieser Wert beschneidet
          // zusaetzlich die weit verstreuten Aussenriffe.
          bbox = [[177, -19.5], [180.5, -15.5]];
        } else if (countryId === 'RU') {
          // Russland: Ausschnitt bis zur Datumsgrenze, ohne Tschukotka jenseits
          // davon — sonst waere der Zoom fuer das Kernland zu weit draussen.
          bbox = [[20, 41], [180, 82]];
        } else {
          bbox = getBoundingBox(countryFeature.geometry);
        }

        if (
          bbox &&
          isFinite(bbox[0][0]) && isFinite(bbox[0][1]) &&
          isFinite(bbox[1][0]) && isFinite(bbox[1][1])
        ) {
          const isQuiz = mode === 'quiz';
          
          // Calculate bounding box dimensions to determine dynamic maxZoom
          const lngSpan = Math.abs(bbox[1][0] - bbox[0][0]);
          const latSpan = Math.abs(bbox[1][1] - bbox[0][1]);
          const maxSpan = Math.max(lngSpan, latSpan);
          
          let dynamicMaxZoom = 5;
          if (isQuiz) {
            if (maxSpan < 2.0) {
              dynamicMaxZoom = 7.0; // Tiny countries/islands (Lubembourg, Montenegro)
            } else if (maxSpan < 6.0) {
              dynamicMaxZoom = 5.2; // Small countries (Switzerland, Fiji, Belgium)
            } else if (maxSpan < 15.0) {
              dynamicMaxZoom = 4.0; // Medium countries (Germany, France, UK, Poland)
            } else {
              dynamicMaxZoom = 3.2; // Huge countries (USA, Russia, Canada, Brazil)
            }
          } else {
            // Atlas mode: allow deeper zoom for detailed exploration
            dynamicMaxZoom = maxSpan < 6.0 ? 6.5 : 5.0;
          }

          map.fitBounds(bbox, {
            padding: boundedMapPadding(mapContainerRef.current, isQuiz ? 150 : 80),
            maxZoom: dynamicMaxZoom,
            duration: 1200,
            essential: true
          });
        }
      }
    }
  }, [selectedId, zoomToEntityId, countriesGeoJSON, subdivisionsGeoJSON, riversGeoJSON, mapLoaded, mode]);

  if (initializationFailed) {
    return <div role="status" style={{ padding: '24px', height: '100%', display: 'grid', placeContent: 'center', textAlign: 'center' }}>
      <h2>Karte nicht verfügbar</h2>
      <p>Der Weltatlas benötigt WebGL 2. Das Quiz bleibt ohne Kartenklicks spielbar.</p>
    </div>;
  }

  return (
    <div className={`terra-map ${areMapControlsVisible ? '' : 'terra-map-controls-hidden'}`}>
      <div ref={mapContainerRef} className="terra-map-canvas" />

      <button
        type="button"
        className="terra-map-control-toggle"
        aria-pressed={areMapControlsVisible}
        aria-label={areMapControlsVisible ? 'Kartenwerkzeuge ausblenden' : 'Kartenwerkzeuge einblenden'}
        title={areMapControlsVisible ? 'Kartenwerkzeuge ausblenden' : 'Kartenwerkzeuge einblenden'}
        onClick={() => setAreMapControlsVisible((visible) => !visible)}
      >
        <SlidersHorizontal aria-hidden="true" size={16} strokeWidth={2.3} />
      </button>

      {/* Die Legende bleibt bewusst außerhalb der klickbaren Karte und blockiert keine Ziele. */}
      <div className="terra-map-legend">
        <div className="terra-panel terra-map-legend-content">
          {mode === 'dashboard' ? (
            <div>Willkommen. Wähle eine Übersicht oder starte ein Quiz.</div>
          ) : mode === 'quiz' ? (
            <div className="terra-map-legend-items">
              <div className="terra-map-legend-item">
                <span className="terra-map-legend-swatch terra-map-legend-swatch--correct" /> Richtig
              </div>
              <div className="terra-map-legend-item">
                <span className="terra-map-legend-swatch terra-map-legend-swatch--wrong" /> Falsch
              </div>
              <div className="terra-map-legend-item">
                <span className="terra-map-legend-swatch terra-map-legend-swatch--hint" /> Hinweis
              </div>
            </div>
          ) : (
            <div className="terra-map-legend-items">
              <div className="terra-map-legend-item">
                <span className="terra-map-legend-swatch terra-map-legend-swatch--mastered" /> Gemeistert
              </div>
              <div className="terra-map-legend-item">
                <span className="terra-map-legend-swatch terra-map-legend-swatch--familiar" /> Vertraut
              </div>
              <div className="terra-map-legend-item">
                <span className="terra-map-legend-swatch terra-map-legend-swatch--learning" /> Angespielt
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
