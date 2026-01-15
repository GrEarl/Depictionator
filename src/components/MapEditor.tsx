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
  const [mode, setMode] = useState<"view" | "pin" | "path">("view");
  const [showImage, setShowImage] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [editPins, setEditPins] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState("");
  const defaultLocationType = locationTypes[0] ?? "other";
  const createPinDraft = useCallback((overrides: Partial<{
    x: number | null;
    y: number | null;
    label: string;
    locationType: string;
    markerStyleId: string;
    markerShape: string;
    markerColor: string;
    truthFlag: string;
    viewpointId: string;
    worldFrom: string;
    worldTo: string;
    storyFromChapterId: string;
    storyToChapterId: string;
    entityId: string;
  }> = {}) => ({
    x: null,
    y: null,
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
  const [pinDraft, setPinDraft] = useState<{
    x: number | null;
    y: number | null;
    label: string;
    locationType: string;
    markerStyleId: string;
    markerShape: string;
    markerColor: string;
    truthFlag: string;
    viewpointId: string;
    worldFrom: string;
    worldTo: string;
    storyFromChapterId: string;
    storyToChapterId: string;
    entityId: string;
  }>(() => createPinDraft());
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
  }, [map?.id, createPinDraft]);

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
      const bounds = map.bounds ?? [
        [0, 0],
        [1000, 1000]
      ];
      const mapInstance = L.map(containerRef.current, {
        crs: L.CRS.Simple,
        zoomControl: true,
        minZoom: -2
      }) as LeafletMap;
      mapRef.current = mapInstance;
      if (map.imageUrl && showImage) {
        L.imageOverlay(map.imageUrl, bounds).addTo(mapInstance);
      }
      mapInstance.fitBounds(bounds);

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

      if (showPins) {
        map.pins.forEach((pin) => {
          const color = pin.markerColor ?? pin.markerStyle?.color ?? "#1f4b99";
          const shape = pin.markerShape ?? pin.markerStyle?.shape ?? "circle";
          const icon = createIcon(L, shape, color);
          const marker = L.marker([pin.y, pin.x], { icon, draggable: editPins });
          if (pin.label) {
            marker.bindTooltip(pin.label, { direction: "top" });
          }
          marker.on("click", () => {
            setSelectedPinId(pin.id);
            setPinDraft(
              createPinDraft({
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
              })
            );
          });
          if (editPins) {
            marker.on("dragend", (event: { target: LeafletMarker }) => {
              const latlng = event.target.getLatLng();
              void updatePinPosition(pin.id, latlng.lng, latlng.lat);
            });
          }
          marker.addTo(mapInstance);
        });
      }

      if (pathPoints.length > 0) {
        const points = pathPoints.map((pt) => [pt.y, pt.x]) as [number, number][];
        L.polyline(points, { color: "#c44536", weight: 2 }).addTo(mapInstance);
        pathPoints.forEach((pt) => {
          L.circleMarker([pt.y, pt.x], { radius: 4, color: "#c44536" }).addTo(mapInstance);
        });
      }

      mapInstance.on("click", (event: { latlng: { lng: number; lat: number } }) => {
        if (mode === "pin") {
          setPinDraft((prev) => ({
            ...prev,
            x: Number(event.latlng.lng.toFixed(1)),
            y: Number(event.latlng.lat.toFixed(1))
          }));
        }
        if (mode === "path") {
          setPathPoints((prev) => [
            ...prev,
            { x: Number(event.latlng.lng.toFixed(1)), y: Number(event.latlng.lat.toFixed(1)) }
          ]);
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
  }, [map, mode, pathPoints, showImage, showPins, showPaths, editPins, defaultLocationType, createPinDraft]);

  if (!map) {
    return <div className="map-viewer">Select a map to edit.</div>;
  }

  async function submitPin() {
    if (!map) return;
    if (pinDraft.x === null || pinDraft.y === null) return;
    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("mapId", map.id);
    form.append("x", String(pinDraft.x));
    form.append("y", String(pinDraft.y));
    form.append("label", pinDraft.label);
    form.append("locationType", pinDraft.locationType);
    form.append("markerStyleId", pinDraft.markerStyleId);
    form.append("markerShape", pinDraft.markerShape);
    form.append("markerColor", pinDraft.markerColor);
    form.append("truthFlag", pinDraft.truthFlag);
    form.append("viewpointId", pinDraft.viewpointId);
    form.append("worldFrom", pinDraft.worldFrom);
    form.append("worldTo", pinDraft.worldTo);
    form.append("storyFromChapterId", pinDraft.storyFromChapterId);
    form.append("storyToChapterId", pinDraft.storyToChapterId);
    form.append("entityId", pinDraft.entityId);
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
    if (pinDraft.x !== null) form.append("x", String(pinDraft.x));
    if (pinDraft.y !== null) form.append("y", String(pinDraft.y));
    form.append("label", pinDraft.label);
    form.append("locationType", pinDraft.locationType);
    form.append("markerStyleId", pinDraft.markerStyleId);
    form.append("markerShape", pinDraft.markerShape);
    form.append("markerColor", pinDraft.markerColor);
    form.append("truthFlag", pinDraft.truthFlag);
    form.append("viewpointId", pinDraft.viewpointId);
    form.append("worldFrom", pinDraft.worldFrom);
    form.append("worldTo", pinDraft.worldTo);
    form.append("storyFromChapterId", pinDraft.storyFromChapterId);
    form.append("storyToChapterId", pinDraft.storyToChapterId);
    form.append("entityId", pinDraft.entityId);
    await fetch("/api/pins/update", { method: "POST", body: form });
    window.location.reload();
  }

  async function submitPath() {
    if (!map) return;
    if (pathPoints.length < 2) return;
    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("mapId", map.id);
    form.append("polyline", JSON.stringify(pathPoints));
    form.append("arrowStyle", pathDraft.arrowStyle);
    form.append("strokeColor", pathDraft.strokeColor);
    form.append("strokeWidth", pathDraft.strokeWidth);
    form.append("markerStyleId", pathDraft.markerStyleId);
    form.append("truthFlag", pathDraft.truthFlag);
    form.append("viewpointId", pathDraft.viewpointId);
    form.append("worldFrom", pathDraft.worldFrom);
    form.append("worldTo", pathDraft.worldTo);
    form.append("storyFromChapterId", pathDraft.storyFromChapterId);
    form.append("storyToChapterId", pathDraft.storyToChapterId);
    form.append("relatedEventId", pathDraft.relatedEventId);
    form.append("relatedEntityIds", pathDraft.relatedEntityIds);
    await fetch("/api/paths/create", { method: "POST", body: form });
    window.location.reload();
  }

  const pinFields = (
    <>
      <label>
        Label
        <input
          value={pinDraft.label}
          onChange={(event) => setPinDraft({ ...pinDraft, label: event.target.value })}
        />
      </label>
      <label>
        Entity ID
        <input
          value={pinDraft.entityId}
          onChange={(event) => setPinDraft({ ...pinDraft, entityId: event.target.value })}
        />
      </label>
      <label>
        Location type
        <select
          value={pinDraft.locationType}
          onChange={(event) => setPinDraft({ ...pinDraft, locationType: event.target.value })}
        >
          {locationTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label>
        Marker style
        <select
          value={pinDraft.markerStyleId}
          onChange={(event) => setPinDraft({ ...pinDraft, markerStyleId: event.target.value })}
        >
          <option value="">--</option>
          {markerStyles
            .filter((style) => style.target === "location" || style.target === "event")
            .map((style) => (
              <option key={style.id} value={style.id}>
                {style.name} ({style.target})
              </option>
            ))}
        </select>
      </label>
      <label>
        Override shape
        <input
          value={pinDraft.markerShape}
          onChange={(event) => setPinDraft({ ...pinDraft, markerShape: event.target.value })}
          placeholder="circle/square/diamond/triangle/hex/star"
        />
      </label>
      <label>
        Override color
        <input
          value={pinDraft.markerColor}
          onChange={(event) => setPinDraft({ ...pinDraft, markerColor: event.target.value })}
        />
      </label>
      <label>
        Truth flag
        <select
          value={pinDraft.truthFlag}
          onChange={(event) => setPinDraft({ ...pinDraft, truthFlag: event.target.value })}
        >
          <option value="canonical">canonical</option>
          <option value="rumor">rumor</option>
          <option value="mistaken">mistaken</option>
          <option value="propaganda">propaganda</option>
          <option value="unknown">unknown</option>
        </select>
      </label>
      <label>
        Viewpoint ID
        <input
          value={pinDraft.viewpointId}
          onChange={(event) => setPinDraft({ ...pinDraft, viewpointId: event.target.value })}
        />
      </label>
      <label>
        World from
        <input
          value={pinDraft.worldFrom}
          onChange={(event) => setPinDraft({ ...pinDraft, worldFrom: event.target.value })}
        />
      </label>
      <label>
        World to
        <input
          value={pinDraft.worldTo}
          onChange={(event) => setPinDraft({ ...pinDraft, worldTo: event.target.value })}
        />
      </label>
      <label>
        Story from chapter ID
        <input
          value={pinDraft.storyFromChapterId}
          onChange={(event) => setPinDraft({ ...pinDraft, storyFromChapterId: event.target.value })}
        />
      </label>
      <label>
        Story to chapter ID
        <input
          value={pinDraft.storyToChapterId}
          onChange={(event) => setPinDraft({ ...pinDraft, storyToChapterId: event.target.value })}
        />
      </label>
    </>
  );

  return (
    <div className="map-viewer">
      <div className="map-title">{map.title}</div>
      <div className="map-editor-controls form-grid">
        <label>
          Mode
          <select value={mode} onChange={(event) => setMode(event.target.value as "view" | "pin" | "path")}>
            <option value="view">View</option>
            <option value="pin">Add pin</option>
            <option value="path">Draw path</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showImage}
            onChange={(event) => setShowImage(event.target.checked)}
          />
          Show map image
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showPins}
            onChange={(event) => setShowPins(event.target.checked)}
          />
          Show pins
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showPaths}
            onChange={(event) => setShowPaths(event.target.checked)}
          />
          Show paths
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={editPins}
            onChange={(event) => setEditPins(event.target.checked)}
          />
          Edit pins (drag/update)
        </label>
        {mode === "pin" && (
          <>
            <label>
              X/Y (click map)
              <input value={pinDraft.x !== null ? `${pinDraft.x}, ${pinDraft.y}` : ""} readOnly />
            </label>
            {pinFields}
            <button type="button" onClick={submitPin}>
              Save pin
            </button>
          </>
        )}
        {editPins && mode === "view" && (
          <>
            <div className="muted">Tip: click a pin to load it, then drag or update fields.</div>
            <label>
              Selected pin
              <input value={selectedPinId} readOnly />
            </label>
            <label>
              X
              <input
                value={pinDraft.x ?? ""}
                onChange={(event) =>
                  setPinDraft({ ...pinDraft, x: event.target.value ? Number(event.target.value) : null })
                }
              />
            </label>
            <label>
              Y
              <input
                value={pinDraft.y ?? ""}
                onChange={(event) =>
                  setPinDraft({ ...pinDraft, y: event.target.value ? Number(event.target.value) : null })
                }
              />
            </label>
            {pinFields}
            <div className="list-row">
              <button type="button" onClick={submitPinUpdate} disabled={!selectedPinId}>
                Update selected pin
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setSelectedPinId("");
                  setPinDraft(createPinDraft());
                }}
              >
                Clear selection
              </button>
            </div>
          </>
        )}
        {mode === "path" && (
          <>
            <label>
              Points
              <textarea value={JSON.stringify(pathPoints)} readOnly rows={3} />
            </label>
            <label>
              Arrow style
              <select value={pathDraft.arrowStyle} onChange={(event) => setPathDraft({ ...pathDraft, arrowStyle: event.target.value })}>
                <option value="arrow">Arrow</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </label>
            <label>
              Stroke color
              <input value={pathDraft.strokeColor} onChange={(event) => setPathDraft({ ...pathDraft, strokeColor: event.target.value })} />
            </label>
            <label>
              Marker style
              <select value={pathDraft.markerStyleId} onChange={(event) => setPathDraft({ ...pathDraft, markerStyleId: event.target.value })}>
                <option value="">--</option>
                {markerStyles
                  .filter((style) => style.target === "path")
                  .map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="list-row">
              <button type="button" className="link-button" onClick={() => setPathPoints([])}>
                Clear points
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => setPathPoints((prev) => prev.slice(0, -1))}
                disabled={pathPoints.length === 0}
              >
                Undo last point
              </button>
              <button type="button" onClick={submitPath}>
                Save path
              </button>
            </div>
          </>
        )}
      </div>
      <div className="map-legend">
        <strong>Legend</strong>
        {markerStyles.length === 0 && (
          <div className="muted">No marker styles yet.</div>
        )}
        {markerStyles
          .filter((style) => style.target === "location")
          .map((style) => (
            <div key={style.id} className="legend-row">
              <span
                className={`marker-shape marker-${style.shape}`}
                style={{ "--marker-color": style.color } as CSSProperties}
              />
              <span>{style.name}{style.locationType ? ` (${style.locationType})` : ""}</span>
            </div>
          ))}
        {markerStyles
          .filter((style) => style.target === "event")
          .map((style) => (
            <div key={style.id} className="legend-row">
              <span
                className={`marker-shape marker-${style.shape}`}
                style={{ "--marker-color": style.color } as CSSProperties}
              />
              <span>{style.name}{style.eventType ? ` (${style.eventType})` : ""}</span>
            </div>
          ))}
        {markerStyles
          .filter((style) => style.target === "path")
          .map((style) => (
            <div key={style.id} className="legend-row">
              <span className="legend-line" style={{ background: style.color }} />
              <span>{style.name}</span>
            </div>
          ))}
      </div>
      <div ref={containerRef} className="map-canvas" />
    </div>
  );
}
