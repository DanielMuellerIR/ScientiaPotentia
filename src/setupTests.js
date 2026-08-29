import { vi } from 'vitest';
// Vitest-spezifischer Import: ruft intern expect.extend() auf,
// sodass jest-dom-Matcher (toBeInTheDocument, toBeDisabled, …) verfügbar sind.
import '@testing-library/jest-dom/vitest';

// Mock maplibre-gl
vi.mock('maplibre-gl', () => {
  // Der Konstruktor bleibt ein Spy, damit Karten-Tests Stil und Controls prüfen
  // können, ohne in JSDOM eine WebGL-Karte starten zu müssen.
  const MapMock = vi.fn().mockImplementation(function MapMock(options) {
    this.options = options;
    this.on = vi.fn((event, callbackOrLayer, callback) => {
      // If event is 'load', call the callback immediately so mapLoaded is set to true
      if (event === 'load') {
        const cb = typeof callbackOrLayer === 'function' ? callbackOrLayer : callback;
        if (cb) setTimeout(cb, 0);
      }
    });
    this.remove = vi.fn();
    this.addControl = vi.fn();
    this.getLayer = vi.fn().mockImplementation(() => ({}));
    this.getStyle = vi.fn(() => ({
      layers: [
        { id: 'label', type: 'symbol' },
        { id: 'countries-fill', type: 'fill' }
      ]
    }));
    this.addSource = vi.fn();
    this.addLayer = vi.fn();
    this.setPaintProperty = vi.fn();
    this.setLayoutProperty = vi.fn();
    this.setFeatureState = vi.fn();
    this.getZoom = vi.fn(() => 2);
    this.fitBounds = vi.fn();
    this.getCanvas = vi.fn(() => ({
      style: {}
    }));
    this.queryRenderedFeatures = vi.fn(() => []);
  });
  const NavigationControlMock = vi.fn().mockImplementation(function NavigationControlMock(options) {
    this.options = options;
  });
  const ScaleControlMock = vi.fn().mockImplementation(function ScaleControlMock(options) {
    this.options = options;
  });

  return {
    default: {
      Map: MapMock,
      NavigationControl: NavigationControlMock,
      ScaleControl: ScaleControlMock,
      addProtocol: vi.fn()
    }
  };
});

// Mock global fetch
global.fetch = vi.fn().mockImplementation((url) => {
  let data = { features: [] };
  if (url.includes('countries.json')) {
    data = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'FR',
          properties: { id: 'FR', name: 'Frankreich' },
          geometry: { type: 'Polygon', coordinates: [[[0, 40], [0, 50], [10, 50], [10, 40], [0, 40]]] }
        },
        {
          type: 'Feature',
          id: 'IQ',
          properties: { id: 'IQ', name: 'Irak' },
          geometry: { type: 'Polygon', coordinates: [[[40, 30], [40, 40], [50, 40], [50, 30], [40, 30]]] }
        }
      ]
    };
  } else if (url.includes('subdivisions.json')) {
    data = {
      type: 'FeatureCollection',
      features: []
    };
  } else if (url.includes('rivers.json')) {
    data = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'river_seine',
          properties: { id: 'river_seine', name: 'Seine' },
          geometry: { type: 'LineString', coordinates: [[2, 48], [3, 49]] }
        }
      ]
    };
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data)
  });
});

// Mock audio utilities
vi.mock('./utils/audio', () => ({
  playClick: vi.fn(),
  playCorrectChime: vi.fn(),
  playErrorBuzzer: vi.fn(),
  isAudioMuted: vi.fn(() => false),
  setAudioMuted: vi.fn()
}));

// Mock IndexedDB wrapper utilities
vi.mock('./utils/db', () => ({
  initDB: vi.fn(),
  getProgress: vi.fn(() => Promise.resolve(null)),
  getAllProgress: vi.fn(() => Promise.resolve([])),
  saveProgress: vi.fn(() => Promise.resolve()),
  addHistoryLog: vi.fn(() => Promise.resolve()),
  saveProgressAndLog: vi.fn(() => Promise.resolve()),
  getHistoryLogs: vi.fn(() => Promise.resolve([])),
  saveSetting: vi.fn(() => Promise.resolve()),
  getSetting: vi.fn((key, defaultValue) => Promise.resolve(defaultValue)),
  clearAllData: vi.fn(() => Promise.resolve())
}));

// Global fallback mock for indexedDB to prevent JSDOM hang
global.indexedDB = {
  open: vi.fn().mockImplementation(() => {
    const request = {};
    setTimeout(() => {
      if (request.onsuccess) {
        request.onsuccess({
          target: {
            result: {
              transaction: vi.fn().mockImplementation(() => ({
                objectStore: vi.fn().mockImplementation(() => ({
                  get: vi.fn().mockImplementation(() => {
                    const req = {};
                    setTimeout(() => {
                      if (req.onsuccess) req.onsuccess({ target: { result: null } });
                    }, 0);
                    return req;
                  }),
                  put: vi.fn().mockImplementation(() => {
                    const req = {};
                    setTimeout(() => {
                      if (req.onsuccess) req.onsuccess({});
                    }, 0);
                    return req;
                  }),
                  add: vi.fn().mockImplementation(() => {
                    const req = {};
                    setTimeout(() => {
                      if (req.onsuccess) req.onsuccess({});
                    }, 0);
                    return req;
                  }),
                  getAll: vi.fn().mockImplementation(() => {
                    const req = {};
                    setTimeout(() => {
                      if (req.onsuccess) req.onsuccess({ target: { result: [] } });
                    }, 0);
                    return req;
                  })
                }))
              }))
            }
          }
        });
      }
    }, 0);
    return request;
  })
};
