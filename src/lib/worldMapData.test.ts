import { describe, expect, it } from "bun:test";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import worldTopology from "world-atlas/countries-110m.json";
import { normalizeWorldFeatures } from "./worldMapData";

describe("normalizeWorldFeatures", () => {
  const topology = worldTopology as unknown as Topology;
  const rawFeatures = (
    feature(topology, topology.objects.countries as GeometryCollection) as unknown as {
      features: Feature<Geometry>[];
    }
  ).features;

  it("omits Antarctica (010)", () => {
    const rawHasAntarctica = rawFeatures.some((f) => String(f.id) === "010");
    expect(rawHasAntarctica).toBe(true);

    const normalized = normalizeWorldFeatures(rawFeatures);
    const normalizedHasAntarctica = normalized.some((f) => String(f.id) === "010");
    expect(normalizedHasAntarctica).toBe(false);
  });

  it("removes all cross-antimeridian coordinate jumps (> 180 degrees)", () => {
    const normalized = normalizeWorldFeatures(rawFeatures);

    let jumpCount = 0;
    for (const f of normalized) {
      if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") continue;
      const polys =
        f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) {
        for (const ring of poly) {
          for (let i = 0; i < ring.length - 1; i++) {
            const [lon1] = ring[i];
            const [lon2] = ring[i + 1];
            if (Math.abs(lon1 - lon2) > 180) {
              jumpCount++;
            }
          }
        }
      }
    }

    expect(jumpCount).toBe(0);
  });

  it("produces valid closed rings with at least 4 coordinates for Russia and Fiji", () => {
    const normalized = normalizeWorldFeatures(rawFeatures);

    const russia = normalized.find((f) => String(f.id) === "643");
    expect(russia).toBeDefined();
    expect(russia?.geometry.type).toBe("MultiPolygon");

    const fiji = normalized.find((f) => String(f.id) === "242");
    expect(fiji).toBeDefined();
    expect(fiji?.geometry.type).toBe("MultiPolygon");

    for (const country of [russia!, fiji!]) {
      if (country.geometry.type !== "MultiPolygon") continue;
      const polys = country.geometry.coordinates;
      for (const poly of polys) {
        for (const ring of poly) {
          expect(ring.length).toBeGreaterThanOrEqual(4);
          const first = ring[0];
          const last = ring[ring.length - 1];
          expect(first[0]).toBe(last[0]);
          expect(first[1]).toBe(last[1]);
        }
      }
    }
  });

  it("preserves total country count minus Antarctica", () => {
    const normalized = normalizeWorldFeatures(rawFeatures);
    expect(normalized.length).toBe(rawFeatures.length - 1);
  });
});
