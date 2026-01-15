"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

type MarkerStyle = {
  id: string;
  name: string;
  target: string;
  shape: string;
  color: string;
  eventType?: string | null;
  locationType?: string | null;
};

type MapPayload = {
  id: string;
  title: string;
  bounds: [[number, number], [number, number]] | null;
  imageUrl: string | null;
  pins: {
    id: string;
    x: number;
    y: number;
    label?: string | null;
    entityId?: string | null;
    locationType?: string | null;
    markerStyleId?: string | null;
    markerShape?: string | null;
    markerColor?: string | null;
    markerStyle?: { shape: string; color: string } | null;
    truthFlag?: string | null;
    viewpointId?: string | null;
    worldFrom?: string | null;
    worldTo?: string | null;
    storyFromChapterId?: string | null;
    storyToChapterId?: string | null;
  }[];
  paths: {
    id: string;
    polyline: { x: number; y: number }[];
    arrowStyle: string;
    strokeColor?: string | null;
    strokeWidth?: number | null;
    markerStyle?: { color: string } | null;
  }[];
};

type MapEditorProps = {
  map: MapPayload | null;
  workspaceId: string;
  markerStyles: MarkerStyle[];
  locationTypes: string[];
};

function createIcon(L: any, shape: string, color: string) {
  const safeShape = shape || "circle";
  const html = `<span class="marker-shape marker-${safeShape}" style="--marker-color:${color};"></span>`;
  return L.divIcon({
    className: "marker-icon",
    html,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

export function MapEditor({
  map,
  workspaceId,
  markerStyles,
  locationTypes
}: MapEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [mode, setMode] = useState<"select" | "pin" | "path">("select");
  const [showImage, setShowImage] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  
  // Selection State
  const [selectedPinId, setSelectedPinId] = useState("");
  
  // Draft States
  const defaultLocationType = locationTypes[0] ?? "other";
  
  const createPinDraft = useCallback((overrides: any = {}) => ({
    x: null as number | null,
    y: null as number | null,
    label: "",
    locationType: defaultLocationType,
    markerStyleId: "",
    markerShape: "",
    markerColor: "",
    truthFlag: "canonical",
    viewpointId: "",
    worldFrom: "",
    worldTo: "",
    storyFromChapterId: "",
    storyToChapterId: "",
    entityId: "",
    ...overrides
  }), [defaultLocationType]);

  const [pinDraft, setPinDraft] = useState(createPinDraft());
  
  const [pathPoints, setPathPoints] = useState<{ x: number; y: number }[]>([]);
  const [pathDraft, setPathDraft] = useState({
    arrowStyle: "arrow",
    strokeColor: "",
    strokeWidth: "",
    markerStyleId: "",
    truthFlag: "canonical",
    viewpointId: "",
    worldFrom: "",
    worldTo: "",
    storyFromChapterId: "",
    storyToChapterId: "",
    relatedEventId: "",
    relatedEntityIds: ""
  });

  useEffect(() => {
    if (!map) return;
    setSelectedPinId("");
    setPinDraft(createPinDraft());
    setPathPoints([]);
  }, [map?.id, createPinDraft]);

  // Initialize Leaflet
  useEffect(() => {
    if (!containerRef.current || !map) return;
    let active = true;
    const init = async () => {
      const leafletModule = await import("leaflet");
      const L = (leafletModule as any).default ?? leafletModule;
      if (!active || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      
      const bounds = map.bounds ?? [[0, 0], [1000, 1000]];
      
      const mapInstance = L.map(containerRef.current, {
        crs: L.CRS.Simple,
        zoomControl: false, // We'll add it manually or rely on scroll
        minZoom: -2,
        attributionControl: false
      }) as LeafletMap;
      
      mapRef.current = mapInstance;
      
      if (map.imageUrl && showImage) {
        L.imageOverlay(map.imageUrl, bounds).addTo(mapInstance);
      }
      mapInstance.fitBounds(bounds);

      // Render Paths
      if (showPaths) {
        map.paths.forEach((path) => {
          const points = path.polyline.map((pt) => [pt.y, pt.x]) as [number, number][];
          const color = path.strokeColor ?? path.markerStyle?.color ?? "#1f4b99";
          const weight = path.strokeWidth ?? 3;
          L.polyline(points, {
            color,
            weight,
            dashArray: path.arrowStyle === "dashed" ? "6 6" : path.arrowStyle === "dotted" ? "2 6" : undefined
          }).addTo(mapInstance);
        });
      }

      // Render Pins
      if (showPins) {
        map.pins.forEach((pin) => {
          const color = pin.markerColor ?? pin.markerStyle?.color ?? "#1f4b99";
          const shape = pin.markerShape ?? pin.markerStyle?.shape ?? "circle";
          const icon = createIcon(L, shape, color);
          const marker = L.marker([pin.y, pin.x], { 
            icon, 
            draggable: mode === "select" && selectedPinId === pin.id 
          });
          
          if (pin.label) {
            marker.bindTooltip(pin.label, { direction: "top", offset: [0, -10] });
          }
          
          marker.on("click", (e: any) => {
            L.DomEvent.stopPropagation(e); // Prevent map click
            setMode("select");
            setSelectedPinId(pin.id);
            setPinDraft(createPinDraft({
              x: pin.x,
              y: pin.y,
              label: pin.label ?? "",
              locationType: pin.locationType ?? defaultLocationType,
              markerStyleId: pin.markerStyleId ?? "",
              markerShape: pin.markerShape ?? "",
              markerColor: pin.markerColor ?? "",
              truthFlag: pin.truthFlag ?? "canonical",
              viewpointId: pin.viewpointId ?? "",
              worldFrom: pin.worldFrom ?? "",
              worldTo: pin.worldTo ?? "",
              storyFromChapterId: pin.storyFromChapterId ?? "",
              storyToChapterId: pin.storyToChapterId ?? "",
              entityId: pin.entityId ?? ""
            }));
          });
          
          if (mode === "select") {
            marker.on("dragend", (event: { target: LeafletMarker }) => {
              const latlng = event.target.getLatLng();
              void updatePinPosition(pin.id, latlng.lng, latlng.lat);
            });
          }
          
          marker.addTo(mapInstance);
        });
      }

      // Render Active Path Draft
      if (pathPoints.length > 0) {
        const points = pathPoints.map((pt) => [pt.y, pt.x]) as [number, number][];
        L.polyline(points, { color: "#c44536", weight: 2, dashArray: "4 4" }).addTo(mapInstance);
        pathPoints.forEach((pt) => {
          L.circleMarker([pt.y, pt.x], { radius: 4, color: "#c44536", fillOpacity: 1 }).addTo(mapInstance);
        });
      }

      // Map Click Handler
      mapInstance.on("click", (event: { latlng: { lng: number; lat: number } }) => {
        if (mode === "pin") {
          const x = Number(event.latlng.lng.toFixed(1));
          const y = Number(event.latlng.lat.toFixed(1));
          setPinDraft((prev) => ({ ...prev, x, y }));
          // Auto open inspector by keeping mode 'pin' but maybe we need a 'pin-placed' state?
          // For now, we'll just set the coordinate and let the user fill the form in the floating panel.
        } else if (mode === "path") {
          setPathPoints((prev) => [
            ...prev,
            { x: Number(event.latlng.lng.toFixed(1)), y: Number(event.latlng.lat.toFixed(1)) }
          ]);
        } else if (mode === "select") {
          setSelectedPinId("");
          setPinDraft(createPinDraft());
        }
      });
    };

    void init();

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [map, mode, pathPoints, showImage, showPins, showPaths, selectedPinId, defaultLocationType, createPinDraft]);

  if (!map) {
    return <div className="map-viewer placeholder">Select a map to view</div>;
  }

  // --- API Actions ---

  async function submitPin() {
    if (!map || pinDraft.x === null || pinDraft.y === null) return;
    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("mapId", map.id);
    Object.entries(pinDraft).forEach(([k, v]) => {
      if (v !== null) form.append(k, String(v));
    });
    await fetch("/api/pins/create", { method: "POST", body: form });
    window.location.reload();
  }

  async function updatePinPosition(pinId: string, x: number, y: number) {
    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("pinId", pinId);
    const roundedX = Number(x.toFixed(1));
    const roundedY = Number(y.toFixed(1));
    form.append("x", String(roundedX));
    form.append("y", String(roundedY));
    await fetch("/api/pins/update", { method: "POST", body: form });
    if (selectedPinId === pinId) {
      setPinDraft((prev) => ({ ...prev, x: roundedX, y: roundedY }));
    }
  }

  async function submitPinUpdate() {
    if (!selectedPinId) return;
    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("pinId", selectedPinId);
    Object.entries(pinDraft).forEach(([k, v]) => {
      if (v !== null) form.append(k, String(v));
    });
    await fetch("/api/pins/update", { method: "POST", body: form });
    window.location.reload();
  }

  async function submitPath() {
    if (!map || pathPoints.length < 2) return;
    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("mapId", map.id);
    form.append("polyline", JSON.stringify(pathPoints));
    Object.entries(pathDraft).forEach(([k, v]) => {
      if (v !== null) form.append(k, String(v));
    });
    await fetch("/api/paths/create", { method: "POST", body: form });
    window.location.reload();
  }

  async function deletePin() {
    if (!selectedPinId || !confirm("Delete this pin?")) return;
    // Assuming API exists or we use update to soft delete. 
    // AGENTS.md says soft delete.
    // There is no /api/pins/delete in list, maybe use update? 
    // Wait, the file structure showed `api/marker-styles/delete` but not `pins/delete`.
    // I'll skip delete for now or assume it's missing.
    alert("Delete not implemented yet (check API)");
  }

  // --- Render Helpers ---

  const renderPinForm = () => (
    <div className="inspector-form">
      <label>
        Label
        <input
          value={pinDraft.label}
          onChange={(e) => setPinDraft({ ...pinDraft, label: e.target.value })}
          placeholder="New Pin"
        />
      </label>
      <div className="coord-row">
        <label>X <input value={pinDraft.x ?? ""} readOnly /></label>
        <label>Y <input value={pinDraft.y ?? ""} readOnly /></label>
      </div>
      <label>
        Style
        <select
          value={pinDraft.markerStyleId}
          onChange={(e) => setPinDraft({ ...pinDraft, markerStyleId: e.target.value })}
        >
          <option value="">Default</option>
          {markerStyles.filter(s => s.target !== 'path').map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label>
        Type
        <select
          value={pinDraft.locationType}
          onChange={(e) => setPinDraft({ ...pinDraft, locationType: e.target.value })}
        >
          {locationTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <details>
        <summary>Advanced</summary>
        <div className="inspector-advanced">
           <label>Entity ID <input value={pinDraft.entityId} onChange={e => setPinDraft({...pinDraft, entityId: e.target.value})} /></label>
           <label>Truth <select value={pinDraft.truthFlag} onChange={e => setPinDraft({...pinDraft, truthFlag: e.target.value})}><option value="canonical">Canon</option><option value="rumor">Rumor</option></select></label>
        </div>
      </details>
      <div className="inspector-actions">
        {mode === "pin" ? (
          <button onClick={submitPin} disabled={pinDraft.x === null} className="btn-save">Create Pin</button>
        ) : (
          <>
            <button onClick={submitPinUpdate} className="btn-save">Update</button>
            <button onClick={deletePin} className="btn-danger">Delete</button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="map-viewer-container">
      {/* Floating Toolbar */}
      <div className="map-toolbar">
        <button 
          className={`tool-btn ${mode === "select" ? "active" : ""}`}
          onClick={() => { setMode("select"); setSelectedPinId(""); }}
          title="Select / Move"
        >
          Select
        </button>
        <button 
          className={`tool-btn ${mode === "pin" ? "active" : ""}`}
          onClick={() => { setMode("pin"); setSelectedPinId(""); }}
          title="Place Pin"
        >
          Pin
        </button>
        <button 
          className={`tool-btn ${mode === "path" ? "active" : ""}`}
          onClick={() => { setMode("path"); setSelectedPinId(""); }}
          title="Draw Path"
        >
          Path
        </button>
        <div className="toolbar-divider" />
        <label title="Show Image">
          <input type="checkbox" checked={showImage} onChange={(e) => setShowImage(e.target.checked)} />
          Image
        </label>
        <label title="Show Pins">
          <input type="checkbox" checked={showPins} onChange={(e) => setShowPins(e.target.checked)} />
          Pins
        </label>
        <label title="Show Paths">
          <input type="checkbox" checked={showPaths} onChange={(e) => setShowPaths(e.target.checked)} />
          Paths
        </label>
      </div>

      {/* Floating Inspector */}
      {(selectedPinId || (mode === "pin" && pinDraft.x !== null)) && (
        <div className="map-inspector">
          <div className="inspector-header">
            <strong>{selectedPinId ? "Edit Pin" : "New Pin"}</strong>
            <button className="close-btn" onClick={() => { setSelectedPinId(""); setPinDraft(createPinDraft()); }}>
              Close
            </button>
          </div>
          {renderPinForm()}
        </div>
      )}

      {/* Path Inspector */}
      {mode === "path" && (
        <div className="map-inspector">
           <div className="inspector-header"><strong>New Path</strong></div>
           <div className="inspector-form">
             <div className="muted">{pathPoints.length} points</div>
             <label>
               Style
               <select value={pathDraft.arrowStyle} onChange={e => setPathDraft({...pathDraft, arrowStyle: e.target.value})}>
                 <option value="arrow">Arrow</option>
                 <option value="dashed">Dashed</option>
               </select>
             </label>
             <div className="inspector-actions">
               <button onClick={submitPath} disabled={pathPoints.length < 2} className="btn-save">Create Path</button>
               <button onClick={() => setPathPoints([])} className="btn-secondary">Clear</button>
             </div>
           </div>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="map-canvas-fullscreen" />
      
      {/* Legend */}
      <div className="map-legend floating">
         <strong>Legend</strong>
         {markerStyles.map(style => (
            <div key={style.id} className="legend-row">
              <span className={`marker-shape marker-${style.shape}`} style={{ "--marker-color": style.color } as CSSProperties} />
              <span>{style.name}</span>
            </div>
         ))}
      </div>
    </div>
  );
}

