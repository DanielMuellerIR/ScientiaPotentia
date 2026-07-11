import { describe, expect, it } from 'vitest';
import { createSilhouettePaths } from '../utils/silhouette';

describe('createSilhouettePaths', () => {
  it('skaliert eine Polygonkontur in den verfügbaren Rahmen', () => {
    const paths = createSilhouettePaths({
      type: 'Polygon',
      coordinates: [[[0, 0], [10, 0], [10, 5], [0, 5], [0, 0]]]
    });

    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatch(/^M10\.0,115\.0 L150\.0,115\.0/);
  });

  it('ignoriert weit entfernte Außengebiete', () => {
    const paths = createSilhouettePaths({
      type: 'MultiPolygon',
      coordinates: [
        [[[0, 0], [10, 0], [10, 5], [0, 5], [0, 0]]],
        [[[80, 0], [81, 0], [81, 1], [80, 1], [80, 0]]]
      ]
    });

    expect(paths).toHaveLength(1);
  });
});
