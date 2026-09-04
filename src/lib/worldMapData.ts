import type { Feature, Geometry, Position } from "geojson";

const ANTARCTICA_ID = "010";
const RUSSIA_ID = "643";
const FIJI_ID = "242";

/**
 * Splits Russia's rings that cross the 180° antimeridian (ring 9: mainland Chukotka,
 * ring 10: Wrangel Island) into Eastern (lon >= 0) and Western (lon < 0) sub-polygons.
 */
function splitRussiaPolygons(polys: Position[][][]): Position[][][] {
  return polys.flatMap((poly, idx) => {
    if (idx === 9) {
      const ring = poly[0];
      const eastRing: Position[] = [
        ...ring.slice(0, 366),
        [180, ring[366][1]],
        [180, ring[388][1]],
        ...ring.slice(389),
      ];
      const westRing: Position[] = [...ring.slice(366, 389), [-180, ring[366][1]]];
      return [[eastRing], [westRing]];
    }
    if (idx === 10) {
      const ring = poly[0];
      const westRing: Position[] = [...ring.slice(0, 7), ring[0]];
      const eastRing: Position[] = [
        [180, ring[6][1]],
        ring[7],
        ring[8],
        [180, ring[9][1]],
        [180, ring[6][1]],
      ];
      return [[eastRing], [westRing]];
    }
    return [poly];
  });
}

/**
 * Splits Fiji's polygon (ring 1) which straddles the 180° meridian into
 * Eastern (lon >= 0) and Western (lon < 0) sub-polygons.
 */
function splitFijiPolygons(polys: Position[][][]): Position[][][] {
  return polys.flatMap((poly, idx) => {
    if (idx === 1) {
      const ring = poly[0];
      const westRing: Position[] = [...ring.slice(0, 4), ring[0]];
      const eastRing: Position[] = [[180, ring[3][1]], ...ring.slice(4, 10), [180, ring[3][1]]];
      return [[eastRing], [westRing]];
    }
    return [poly];
  });
}

/**
 * Normalizes TopoJSON country features for ECharts planar geo map rendering.
 *
 * In planar equirectangular projection, coordinate vertices that jump from +180°
 * to -180° are rendered as horizontal straight lines spanning across the entire globe.
 * This function:
 * 1. Cuts antimeridian-crossing polygons (Russia and Fiji) along 180° / -180°.
 * 2. Filters out Antarctica (010): uninhabited with no app store, which in planar
 *    projection severely stretches the map vertically and produces horizontal seam artifacts.
 */
export function normalizeWorldFeatures(features: Feature<Geometry>[]): Feature<Geometry>[] {
  return features
    .filter((f) => String(f.id) !== ANTARCTICA_ID)
    .map((f) => {
      const id = String(f.id);
      if (id === RUSSIA_ID && f.geometry.type === "MultiPolygon") {
        return {
          ...f,
          geometry: {
            ...f.geometry,
            coordinates: splitRussiaPolygons(f.geometry.coordinates),
          },
        };
      }
      if (id === FIJI_ID && f.geometry.type === "MultiPolygon") {
        return {
          ...f,
          geometry: {
            ...f.geometry,
            coordinates: splitFijiPolygons(f.geometry.coordinates),
          },
        };
      }
      return f;
    });
}
