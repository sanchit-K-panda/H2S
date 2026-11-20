declare module "d3-geo" {
  export interface GeoProjection {
    (point: [number, number]): [number, number] | null;
    fitExtent(extent: [[number, number], [number, number]], object: unknown): this;
    scale(scale: number): this;
    center(point: [number, number]): this;
    translate(point: [number, number]): this;
  }

  export function geoMercator(): GeoProjection;

  export interface GeoPath {
    (object: unknown): string | null;
    projection(projection: GeoProjection): this;
  }

  export function geoPath(): GeoPath;
}

declare module "geojson" {
  export interface Geometry {
    type: string;
    coordinates: unknown;
  }

  export interface Feature<G = Geometry, P = Record<string, unknown>> {
    type: "Feature";
    geometry: G;
    id?: string | number;
    properties: P;
  }

  export interface FeatureCollection<G = Geometry, P = Record<string, unknown>> {
    type: "FeatureCollection";
    features: Feature<G, P>[];
  }
}
