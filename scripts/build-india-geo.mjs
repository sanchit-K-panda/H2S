/**
 * scripts/build-india-geo.mjs
 * Extracts and optimizes GeoJSON for India (including J&K and Ladakh per official map)
 * and neighbouring countries for Domino Sky offline rendering (<150 KB).
 */

import fs from "fs";
import path from "path";

// Function to simplify coordinates by distance threshold
function simplifyRing(ring, tolerance = 0.08) {
  if (ring.length <= 4) return ring;
  const result = [ring[0]];
  let prev = ring[0];

  for (let i = 1; i < ring.length - 1; i++) {
    const pt = ring[i];
    const dx = pt[0] - prev[0];
    const dy = pt[1] - prev[1];
    const distSq = dx * dx + dy * dy;
    if (distSq >= tolerance * tolerance) {
      // round to 3 decimal places (~100m precision, plenty for 600x620 SVG)
      result.push([
        Math.round(pt[0] * 1000) / 1000,
        Math.round(pt[1] * 1000) / 1000,
      ]);
      prev = pt;
    }
  }

  result.push(ring[ring.length - 1]);
  return result;
}

function simplifyGeometry(geom) {
  if (geom.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geom.coordinates.map((ring) => simplifyRing(ring)),
    };
  } else if (geom.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geom.coordinates.map((poly) =>
        poly.map((ring) => simplifyRing(ring))
      ),
    };
  }
  return geom;
}

async function build() {
  console.log("Fetching official DataMeet India composite GeoJSON...");
  const res = await fetch(
    "https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson"
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch DataMeet India: HTTP ${res.status}`);
  }

  const data = await res.json();
  const indiaFeatures = [];

  for (const feature of data.features) {
    indiaFeatures.push({
      type: "Feature",
      id: "IND",
      properties: { name: "India", type: "country" },
      geometry: simplifyGeometry(feature.geometry),
    });
  }

  const outputGeoJson = {
    type: "FeatureCollection",
    features: indiaFeatures,
  };

  const outStr = JSON.stringify(outputGeoJson);
  const outPath = path.resolve("data/india.geo.json");
  fs.writeFileSync(outPath, outStr, "utf8");

  const stat = fs.statSync(outPath);
  console.log(`Successfully generated ${outPath}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB (Spec limit: <150 KB)`);
}

build().catch((err) => {
  console.error("Error building India GeoJSON:", err);
  process.exit(1);
});
