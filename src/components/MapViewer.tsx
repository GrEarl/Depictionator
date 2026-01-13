"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type MapPin = {
  id: string;
  x: number;
  y: number;
  label?: string | null;
  markerShape?: string | null;
  markerColor?: string | null;
  markerStyle?: {
    shape: string;
    color: string;
  } | null;
  truthFlag?: string;
};

type MapPath = {
  id: string;
  polyline: { x: number; y: number }[];
  arrowStyle: string;
  strokeColor?: string | null;
  strokeWidth?: number | null;
  markerStyle?: {
    color: string;
  } | null;
};

type MapPayload = {
  id: string;
  title: string;
  bounds: [[number, number], [number, number]] | null;
  imageUrl: string | null;
  pins: MapPin[];
  paths: MapPath[];
};

function createIcon(shape: string, color: string, truthFlag?: string) {
  const safeShape = shape || "circle";
  const flagClass = truthFlag ? `truth-${truthFlag}` : "";
  const html = `<span class="marker-shape marker-${safeShape} ${flagClass}" style="--marker-color:${color};"></span>`;
  return L.divIcon({
    className: "marker-icon",
    html,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

export function MapViewer({ map }: { map: MapPayload | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || !map) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const bounds = map.bounds ?? [
      [0, 0],
      [1000, 1000]
    ];
    const leafletMap = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      zoomControl: true,
      minZoom: -2
    });
    mapRef.current = leafletMap;
    if (map.imageUrl) {
      L.imageOverlay(map.imageUrl, bounds).addTo(leafletMap);
    }
    leafletMap.fitBounds(bounds);

    map.paths.forEach((path) => {
      const points = path.polyline.map((pt) => [pt.y, pt.x]) as [number, number][];
      const color = path.strokeColor ?? path.markerStyle?.color ?? "#1f4b99";
      const weight = path.strokeWidth ?? 3;
      L.polyline(points, {
        color,
        weight,
        dashArray: path.arrowStyle === "dashed" ? "6 6" : path.arrowStyle === "dotted" ? "2 6" : undefined
      }).addTo(leafletMap);
    });

    map.pins.forEach((pin) => {
      const color = pin.markerColor ?? pin.markerStyle?.color ?? "#1f4b99";
      const shape = pin.markerShape ?? pin.markerStyle?.shape ?? "circle";
      const icon = createIcon(shape, color, pin.truthFlag);
      const marker = L.marker([pin.y, pin.x], { icon });
      if (pin.label) {
        marker.bindTooltip(pin.label, { direction: "top" });
      }
      marker.addTo(leafletMap);
    });

    return () => {
      leafletMap.remove();
    };
  }, [map]);

  if (!map) {
    return <div className="map-viewer">Select a map to preview.</div>;
  }

  return (
    <div className="map-viewer">
      <div className="map-title">{map.title}</div>
      <div ref={containerRef} className="map-canvas" />
    </div>
  );
}
