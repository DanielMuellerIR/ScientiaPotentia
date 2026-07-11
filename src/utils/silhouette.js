/**
 * Bereitet GeoJSON-Polygonkoordinaten als proportional skalierte SVG-Pfade auf.
 *
 * Bei Inselstaaten bleibt nur der Hauptteil sowie räumlich nahe Inseln erhalten.
 * Sehr weit entfernte Außengebiete würden die eigentliche Kontur sonst bis zur
 * Unkenntlichkeit verkleinern.
 */
export function createSilhouettePaths(geometry, { width = 160, height = 160, padding = 10 } = {}) {
  if (!geometry) return [];

  const allPolygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : [];
  if (allPolygons.length === 0) return [];

  const getRingArea = (ring) => {
    let sum = 0;
    for (let index = 0; index < ring.length; index += 1) {
      const [x1, y1] = ring[index];
      const [x2, y2] = ring[(index + 1) % ring.length];
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) * 0.5;
  };

  const polygonsWithMeta = allPolygons.map((polygon) => {
    if (polygon.length === 0 || polygon[0].length === 0) {
      return { polygon, area: 0, center: [0, 0], minLng: 0, maxLng: 0, minLat: 0, maxLat: 0 };
    }

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    polygon[0].forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });
    return {
      polygon,
      area: getRingArea(polygon[0]),
      center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
      minLng,
      maxLng,
      minLat,
      maxLat
    };
  });

  const master = polygonsWithMeta.reduce((largest, polygon) =>
    polygon.area > largest.area ? polygon : largest
  );
  if (master.area === 0) return [];

  const aspectCorrection = Math.cos(master.center[1] * Math.PI / 180);
  const maxDistance = 15;
  const selectedPolygons = polygonsWithMeta.filter((polygon) => {
    if (polygon.area === 0) return false;
    const dx = polygon.center[0] < master.minLng
      ? (master.minLng - polygon.center[0]) * aspectCorrection
      : polygon.center[0] > master.maxLng
        ? (polygon.center[0] - master.maxLng) * aspectCorrection
        : 0;
    const dy = polygon.center[1] < master.minLat
      ? master.minLat - polygon.center[1]
      : polygon.center[1] > master.maxLat
        ? polygon.center[1] - master.maxLat
        : 0;
    return Math.hypot(dx, dy) <= maxDistance;
  }).map(({ polygon }) => polygon);
  if (selectedPolygons.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  selectedPolygons.forEach((polygon) => polygon.forEach((ring) => ring.forEach(([lng, lat]) => {
    const x = (lng - master.center[0]) * aspectCorrection;
    const y = lat - master.center[1];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  })));

  const scale = Math.min(
    (width - 2 * padding) / (maxX - minX || 0.1),
    (height - 2 * padding) / (maxY - minY || 0.1)
  );
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const project = ([lng, lat]) => {
    const x = width / 2 + ((lng - master.center[0]) * aspectCorrection - centerX) * scale;
    const y = height / 2 - (lat - master.center[1] - centerY) * scale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  return selectedPolygons.flatMap((polygon) => polygon
    .filter((ring) => ring.length > 0)
    .map((ring) => `M${ring.map(project).join(' L')} Z`));
}
