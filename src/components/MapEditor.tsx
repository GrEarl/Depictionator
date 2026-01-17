"use client";

import { useCallback, useEffect, useRef, useState, useMemo, type CSSProperties } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { useGlobalFilters } from "@/components/GlobalFilterProvider";

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
    viewpointId?: string | null;
    truthFlag?: string | null;
  }[];
  events?: {
    id: string;
    title: string;
    worldStart?: string | null;
    worldEnd?: string | null;
    storyOrder?: number | null;
  }[];
};

type MapEditorProps = {
  map: MapPayload | null;
  workspaceId: string;
  markerStyles: MarkerStyle[];
  locationTypes: string[];
  eras: { id: string; name: string; worldStart?: string | null; worldEnd?: string | null; sortKey: number }[];
  chapters: { id: string; name: string; orderIndex: number }[];
  viewpoints: { id: string; name: string }[];
};

type PinDraft = {
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
};

type PathDraft = {
  arrowStyle: string;
  strokeColor: string;
  strokeWidth: string;
  markerStyleId: string;
  truthFlag: string;
  viewpointId: string;
  worldFrom: string;
  worldTo: string;
  storyFromChapterId: string;
  storyToChapterId: string;
  relatedEventId: string;
  relatedEntityIds: string;
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
  locationTypes,
  eras,
  chapters,
  viewpoints
}: MapEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const { eraId, chapterId, viewpointId, mode: globalMode } = useGlobalFilters();
  
  const [mode, setMode] = useState<"select" | "pin" | "path" | "card">("select");
  const [showImage, setShowImage] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  
  // Layer visibility state
  const [hiddenLocationTypes, setHiddenLocationTypes] = useState<Set<string>>(new Set());
  const toggleLocationType = (type: string) => {
    const next = new Set(hiddenLocationTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setHiddenLocationTypes(next);
  };

  // Filter Logic
  const chapterOrderMap = useMemo(() => {
    const m = new Map<string, number>();
    chapters.forEach(c => m.set(c.id, c.orderIndex));
    return m;
  }, [chapters]);

  const visiblePins = useMemo(() => {
    if (!map) return [];
    return map.pins.filter(pin => {
      // 0. Location Type Visibility
      if (pin.locationType && hiddenLocationTypes.has(pin.locationType)) return false;

      // 1. Viewpoint Filter
      if (viewpointId === "canon") {
        if (pin.truthFlag !== "canonical") return false;
      } else {
        const isCanon = pin.truthFlag === "canonical";
        const isMyView = pin.viewpointId === viewpointId;
        if (!isCanon && !isMyView) return false;
      }

      // 2. Chapter Filter
      if (chapterId !== "all") {
        const currentOrder = chapterOrderMap.get(chapterId);
        if (currentOrder !== undefined) {
          // If pin has specific chapter range
          if (pin.storyFromChapterId) {
            const from = chapterOrderMap.get(pin.storyFromChapterId) ?? -1;
            if (from > currentOrder) return false; // Starts later
          }
          if (pin.storyToChapterId) {
            const to = chapterOrderMap.get(pin.storyToChapterId) ?? 999999;
            if (to < currentOrder) return false; // Ends earlier
          }
        }
      }
      
      return true;
    });
  }, [map, viewpointId, chapterId, chapterOrderMap, hiddenLocationTypes]);
  
  const visiblePaths = useMemo(() => {
    if (!map) return [];
    return map.paths.filter(path => {
       // Similar Viewpoint logic for paths
      if (viewpointId === "canon") {
        if (path.truthFlag !== "canonical") return false;
      } else {
         const isCanon = path.truthFlag === "canonical";
         const isMyView = path.viewpointId === viewpointId;
         if (!isCanon && !isMyView) return false;
      }
      return true;
    });
  }, [map, viewpointId]);

  // Card state - cards on map (evidence/article cards)
  const [mapCards, setMapCards] = useState<Array<{
    id: string;
    x: number;
    y: number;
    type: 'entity' | 'article' | 'event' | 'note';
    title: string;
    content?: string;
    entityId?: string;
    articleId?: string;
    eventId?: string;
  }>>([]);

  // Card connections (lines between cards)
  const [cardConnections, setCardConnections] = useState<Array<{
    id: string;
    fromCardId: string;
    toCardId: string;
    type: 'timeline' | 'causal' | 'reference';
    label?: string;
  }>>([]);

  // Connection mode state
  const [connectingFromCardId, setConnectingFromCardId] = useState<string | null>(null);

  // Card dragging state
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [cardDragOffset, setCardDragOffset] = useState({ x: 0, y: 0 });

  // Load cards from DB on mount
  useEffect(() => {
    if (!map || !map.id) return;

    const mapId = map.id; // Capture mapId to avoid null reference inside async function

    async function loadCardsFromDB() {
      try {
        const res = await fetch(`/api/map-cards/load?mapId=${mapId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.cards && data.cards.length > 0) {
            setMapCards(data.cards);
          }
          if (data.connections && data.connections.length > 0) {
            setCardConnections(data.connections);
          }
        }
      } catch (error) {
        console.error('Failed to load cards:', error);
      }
    }

    loadCardsFromDB();
  }, [map?.id]);

  // Save cards to DB
  const saveCardsToDatabase = useCallback(async () => {
    if (!map?.id) return;

    try {
      const res = await fetch('/api/map-cards/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          mapId: map.id,
          cards: mapCards,
          connections: cardConnections
        })
      });

      if (res.ok) {
        alert('Cards saved successfully! ✅');
      } else {
        alert('Failed to save cards');
      }
    } catch (error) {
      console.error('Failed to save cards:', error);
      alert('Error saving cards');
    }
  }, [map?.id, workspaceId, mapCards, cardConnections]);

  // Handle card drag
  const handleCardMouseDown = useCallback((e: React.MouseEvent, card: typeof mapCards[0]) => {
    if (connectingFromCardId) return; // Don't drag while connecting
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.target as HTMLElement).closest('.evidence-card-on-map')?.getBoundingClientRect();
    if (!rect) return;
    setDraggingCardId(card.id);
    setCardDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [connectingFromCardId]);

  const handleCardMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingCardId || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = e.clientX - containerRect.left;
    const newY = e.clientY - containerRect.top;

    setMapCards((prev) =>
      prev.map((card) =>
        card.id === draggingCardId
          ? { ...card, x: newX, y: newY }
          : card
      )
    );
  }, [draggingCardId]);

  const handleCardMouseUp = useCallback(() => {
    setDraggingCardId(null);
  }, []);

  // Add global mouse event listeners for card dragging
  useEffect(() => {
    if (draggingCardId) {
      document.addEventListener('mousemove', handleCardMouseMove);
      document.addEventListener('mouseup', handleCardMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleCardMouseMove);
        document.removeEventListener('mouseup', handleCardMouseUp);
      };
    }
  }, [draggingCardId, handleCardMouseMove, handleCardMouseUp]);

  // Auto-arrange events in timeline order
  const autoArrangeEvents = useCallback(() => {
    if (!map?.events || map.events.length === 0) {
      alert('No events found on this map');
      return;
    }

    // Sort events by worldStart or storyOrder
    const sortedEvents = [...map.events].sort((a, b) => {
      if (a.storyOrder != null && b.storyOrder != null) {
        return a.storyOrder - b.storyOrder;
      }
      if (a.worldStart && b.worldStart) {
        return a.worldStart.localeCompare(b.worldStart);
      }
      return 0;
    });

    // Arrange in a timeline layout (left to right, top to bottom)
    const startX = 150;
    const startY = 100;
    const horizontalGap = 300;
    const verticalGap = 200;
    const maxPerRow = 4;

    const newCards = sortedEvents.map((event, index) => {
      const row = Math.floor(index / maxPerRow);
      const col = index % maxPerRow;

      return {
        id: `event-card-${event.id}`,
        x: startX + col * horizontalGap,
        y: startY + row * verticalGap,
        type: 'event' as const,
        title: event.title,
        content: event.worldStart || event.storyOrder?.toString(),
        eventId: event.id
      };
    });

    // Create timeline connections
    const newConnections = sortedEvents.slice(0, -1).map((event, index) => ({
      id: `timeline-conn-${index}`,
      fromCardId: `event-card-${event.id}`,
      toCardId: `event-card-${sortedEvents[index + 1].id}`,
      type: 'timeline' as const,
      label: '→'
    }));

    setMapCards(newCards);
    setCardConnections(newConnections);
  }, [map]);
  
  // Selection State
  const [selectedPinId, setSelectedPinId] = useState("");
  
  // Draft States
  const defaultLocationType = locationTypes[0] ?? "other";
  
  const createPinDraft = useCallback((overrides: Partial<PinDraft> = {}) => ({
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

  const [pinDraft, setPinDraft] = useState<PinDraft>(createPinDraft());
  
  const [pathPoints, setPathPoints] = useState<{ x: number; y: number }[]>([]);
  const [pathDraft, setPathDraft] = useState<PathDraft>({
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
        visiblePaths.forEach((path) => {
          // Validate polyline exists and has at least 2 points
          if (!path.polyline || !Array.isArray(path.polyline) || path.polyline.length < 2) {
            console.warn(`Skipping invalid path ${path.id}: polyline has insufficient points`);
            return;
          }

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
        visiblePins.forEach((pin) => {
          const color = pin.markerColor ?? pin.markerStyle?.color ?? "#1f4b99";
          const shape = pin.markerShape ?? pin.markerStyle?.shape ?? "circle";
          const icon = createIcon(L, shape, color);
          const marker = L.marker([pin.y, pin.x], { 
            icon, 
            draggable: true // Always allow dragging
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

      // Handle entity drag and drop onto map
      const mapContainer = containerRef.current;
      const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = "copy";
      };

      const handleDrop = async (e: DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer?.getData("type");
        const entityId = e.dataTransfer?.getData("id");
        const title = e.dataTransfer?.getData("title");

        if (type === "entity" && entityId && map) {
          // Get map coordinates from mouse position
          const containerRect = mapContainer.getBoundingClientRect();
          const mouseX = e.clientX - containerRect.left;
          const mouseY = e.clientY - containerRect.top;

          // Convert to Leaflet coordinates
          const point = mapInstance.containerPointToLatLng([mouseX, mouseY]);
          const x = Number(point.lng.toFixed(1));
          const y = Number(point.lat.toFixed(1));

          // If in card mode, create a card instead of pin
          if (mode === "card") {
            // Create evidence card on map (visual only for now)
            const newCard = {
              id: `card-${Date.now()}`,
              x: mouseX,
              y: mouseY,
              type: 'entity' as const,
              title: title || "",
              entityId: entityId
            };
            setMapCards((prev) => [...prev, newCard]);
            return;
          }

          // Default: Create pin automatically
          const form = new FormData();
          form.append("workspaceId", workspaceId);
          form.append("mapId", map.id);
          form.append("entityId", entityId);
          form.append("label", title || "");
          form.append("x", String(x));
          form.append("y", String(y));
          form.append("locationType", defaultLocationType);
          form.append("truthFlag", "canonical");

          try {
            const response = await fetch("/api/pins/create", { method: "POST", body: form });
            if (response.ok) {
              // Trigger re-render
              const url = new URL(window.location.href);
              url.searchParams.set('_refresh', Date.now().toString());
              window.history.replaceState({}, '', url);
              window.location.reload();
            } else {
              const errorData = await response.text();
              console.error("Failed to create pin:", errorData);
              alert(`Failed to create pin: ${response.statusText}`);
            }
          } catch (error) {
            console.error("Error creating pin from entity drop:", error);
            alert("Failed to create pin. Please try again.");
          }
        }
      };

      mapContainer.addEventListener("dragover", handleDragOver);
      mapContainer.addEventListener("drop", handleDrop);
    };

    void init();

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [map, mode, pathPoints, showImage, showPins, showPaths, selectedPinId, defaultLocationType, createPinDraft, visiblePins, visiblePaths]);

  if (!map) {
    return <div className="map-viewer placeholder">Select a map to view</div>;
  }

  // --- API Actions ---

  async function submitPin() {
    if (!map || pinDraft.x === null || pinDraft.y === null) return;
    try {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("mapId", map.id);
      Object.entries(pinDraft).forEach(([k, v]) => {
        if (v !== null) form.append(k, String(v));
      });
      const response = await fetch("/api/pins/create", { method: "POST", body: form });
      if (!response.ok) {
        throw new Error(`Failed to create pin: ${response.statusText}`);
      }
      
      // Trigger map re-render by changing a key dependency
      setSelectedPinId("");
      setPinDraft(createPinDraft());
      setMode("select");
      
      // Force re-fetch by updating URL search params
      const url = new URL(window.location.href);
      url.searchParams.set('_refresh', Date.now().toString());
      window.history.replaceState({}, '', url);
      window.location.reload(); // Keep for now, will optimize later
    } catch (error) {
      console.error("Error creating pin:", error);
      alert("Failed to create pin. Please try again.");
    }
  }

  async function updatePinPosition(pinId: string, x: number, y: number) {
    try {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("pinId", pinId);
      const roundedX = Number(x.toFixed(1));
      const roundedY = Number(y.toFixed(1));
      form.append("x", String(roundedX));
      form.append("y", String(roundedY));
      const response = await fetch("/api/pins/update", { method: "POST", body: form });
      if (!response.ok) {
        throw new Error(`Failed to update pin position: ${response.statusText}`);
      }
      if (selectedPinId === pinId) {
        setPinDraft((prev) => ({ ...prev, x: roundedX, y: roundedY }));
      }
    } catch (error) {
      console.error("Error updating pin position:", error);
      alert("Failed to update pin position. Please try again.");
    }
  }

  async function submitPinUpdate() {
    if (!selectedPinId) return;
    try {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("pinId", selectedPinId);
      Object.entries(pinDraft).forEach(([k, v]) => {
        if (v !== null) form.append(k, String(v));
      });
      const response = await fetch("/api/pins/update", { method: "POST", body: form });
      if (!response.ok) {
        throw new Error(`Failed to update pin: ${response.statusText}`);
      }
      
      // Trigger map re-render
      const url = new URL(window.location.href);
      url.searchParams.set('_refresh', Date.now().toString());
      window.history.replaceState({}, '', url);
      window.location.reload(); // Keep for now
    } catch (error) {
      console.error("Error updating pin:", error);
      alert("Failed to update pin. Please try again.");
    }
  }

  async function submitPath() {
    if (!map || pathPoints.length < 2) return;
    try {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("mapId", map.id);
      form.append("polyline", JSON.stringify(pathPoints));
      Object.entries(pathDraft).forEach(([k, v]) => {
        if (v !== null) form.append(k, String(v));
      });
      const response = await fetch("/api/paths/create", { method: "POST", body: form });
      if (!response.ok) {
        throw new Error(`Failed to create path: ${response.statusText}`);
      }
      
      // Clear path points and trigger re-render
      setPathPoints([]);
      setMode("select");
      
      const url = new URL(window.location.href);
      url.searchParams.set('_refresh', Date.now().toString());
      window.history.replaceState({}, '', url);
      window.location.reload(); // Keep for now
    } catch (error) {
      console.error("Error creating path:", error);
      alert("Failed to create path. Please try again.");
    }
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
      
      <div className="inspector-advanced" style={{ display: 'grid', gap: 12, borderTop: '1px solid #eee', paddingTop: 12, marginTop: 8 }}>
         <label>
           Truth
           <select value={pinDraft.truthFlag} onChange={e => setPinDraft({...pinDraft, truthFlag: e.target.value})}>
             <option value="canonical">Canon</option>
             <option value="rumor">Rumor</option>
             <option value="belief">Belief</option>
           </select>
         </label>

         <label>
           Viewpoint
           <select value={pinDraft.viewpointId} onChange={e => setPinDraft({...pinDraft, viewpointId: e.target.value})}>
             <option value="">(None - Global)</option>
             {viewpoints.map(vp => (
               <option key={vp.id} value={vp.id}>{vp.name}</option>
             ))}
           </select>
         </label>

         <div className="coord-row">
            <label>Start (World) <input placeholder="e.g. 1000" value={pinDraft.worldFrom} onChange={e => setPinDraft({...pinDraft, worldFrom: e.target.value})} /></label>
            <label>End <input placeholder="e.g. 1200" value={pinDraft.worldTo} onChange={e => setPinDraft({...pinDraft, worldTo: e.target.value})} /></label>
         </div>

         <div className="coord-row">
            <label>
              From Chapter
              <select value={pinDraft.storyFromChapterId} onChange={e => setPinDraft({...pinDraft, storyFromChapterId: e.target.value})}>
                <option value="">(Start)</option>
                {chapters.map(c => <option key={c.id} value={c.id}>{c.orderIndex}. {c.name}</option>)}
              </select>
            </label>
            <label>
              To Chapter
              <select value={pinDraft.storyToChapterId} onChange={e => setPinDraft({...pinDraft, storyToChapterId: e.target.value})}>
                <option value="">(End)</option>
                {chapters.map(c => <option key={c.id} value={c.id}>{c.orderIndex}. {c.name}</option>)}
              </select>
            </label>
         </div>
         
         <label>Entity ID <input value={pinDraft.entityId} onChange={e => setPinDraft({...pinDraft, entityId: e.target.value})} placeholder="Linked Entity ID" /></label>
      </div>

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
          <span>↖️</span>
        </button>
        <button 
          className={`tool-btn ${mode === "pin" ? "active" : ""}`}
          onClick={() => { setMode("pin"); setSelectedPinId(""); }}
          title="Place Pin"
        >
          <span>📍</span>
        </button>
        <button
          className={`tool-btn ${mode === "path" ? "active" : ""}`}
          onClick={() => { setMode("path"); setSelectedPinId(""); }}
          title="Draw Path"
        >
          <span>〰️</span>
        </button>
        <button
          className={`tool-btn ${mode === "card" ? "active" : ""}`}
          onClick={() => { setMode("card"); setSelectedPinId(""); }}
          title="Place Evidence Card"
        >
          <span>📋</span>
        </button>
        <div className="toolbar-divider" />
        <button
          className={`tool-btn ${showLayerPanel ? "active" : ""}`}
          onClick={() => setShowLayerPanel(!showLayerPanel)}
          title="Layers & Filters"
        >
          <span>📚</span>
        </button>
        <button
          className="tool-btn"
          onClick={autoArrangeEvents}
          title="Auto-arrange events"
        >
          <span>⏱️</span>
        </button>
        <button
          className="tool-btn"
          onClick={saveCardsToDatabase}
          title="Save cards"
        >
          <span>💾</span>
        </button>
      </div>

      {/* Layers Panel */}
      {showLayerPanel && (
        <div className="map-inspector" style={{ left: 16, right: 'auto', top: 80, width: 220 }}>
          <div className="inspector-header">
             <strong>Layers & Filters</strong>
             <button className="close-btn" onClick={() => setShowLayerPanel(false)}>×</button>
          </div>
          <div className="inspector-form">
            <label className="checkbox-label">
              <input type="checkbox" checked={showImage} onChange={(e) => setShowImage(e.target.checked)} />
              Show Image
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={showPins} onChange={(e) => setShowPins(e.target.checked)} />
              Show Pins
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={showPaths} onChange={(e) => setShowPaths(e.target.checked)} />
              Show Paths
            </label>
            
            <div className="toolbar-divider" style={{ width: '100%', height: 1, margin: '8px 0' }} />
            
            <details open>
              <summary className="text-xs font-bold uppercase text-muted mb-2 cursor-pointer">Location Types</summary>
              <div className="list-sm" style={{ maxHeight: 300, overflowY: 'auto' }}>
                {locationTypes.map(type => (
                  <label key={type} className="list-row-sm cursor-pointer">
                    <span style={{ textTransform: 'capitalize' }}>{type}</span>
                    <input 
                      type="checkbox" 
                      checked={!hiddenLocationTypes.has(type)} 
                      onChange={() => toggleLocationType(type)} 
                    />
                  </label>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}

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

      {/* Evidence Cards Layer - overlay on map */}
      <div className="map-cards-layer">
        {/* Connection lines */}
        <svg className="card-connections-svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <marker id="arrowhead-timeline" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#f39c12" />
            </marker>
            <marker id="arrowhead-causal" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#e74c3c" />
            </marker>
          </defs>
          {cardConnections.map((conn) => {
            const fromCard = mapCards.find(c => c.id === conn.fromCardId);
            const toCard = mapCards.find(c => c.id === conn.toCardId);
            if (!fromCard || !toCard) return null;

            return (
              <line
                key={conn.id}
                x1={fromCard.x}
                y1={fromCard.y}
                x2={toCard.x}
                y2={toCard.y}
                className={`connection-line ${conn.type}`}
                stroke={conn.type === 'timeline' ? '#f39c12' : conn.type === 'causal' ? '#e74c3c' : '#95a5a6'}
                strokeWidth={conn.type === 'timeline' ? 3 : 2}
                strokeDasharray={conn.type === 'reference' ? '5,5' : 'none'}
                markerEnd={conn.type === 'causal' ? 'url(#arrowhead-causal)' : conn.type === 'timeline' ? 'url(#arrowhead-timeline)' : 'none'}
              />
            );
          })}
        </svg>

        {/* Cards */}
        {mapCards.map((card) => (
          <div
            key={card.id}
            className={`evidence-card-on-map ${connectingFromCardId === card.id ? 'connecting-from' : ''} ${connectingFromCardId && connectingFromCardId !== card.id ? 'connectable' : ''} ${draggingCardId === card.id ? 'dragging' : ''}`}
            style={{
              position: 'absolute',
              left: `${card.x}px`,
              top: `${card.y}px`,
              transform: 'translate(-50%, -50%)'
            }}
            onMouseDown={(e) => handleCardMouseDown(e, card)}
            onClick={(e) => {
              e.stopPropagation();
              if (connectingFromCardId) {
                // Complete connection
                if (connectingFromCardId !== card.id) {
                  const newConnection = {
                    id: `conn-${Date.now()}`,
                    fromCardId: connectingFromCardId,
                    toCardId: card.id,
                    type: 'timeline' as const
                  };
                  setCardConnections((prev) => [...prev, newConnection]);
                }
                setConnectingFromCardId(null);
              }
            }}
          >
            <div className={`card-header type-${card.type}`}>
              <span className="card-icon">
                {card.type === 'entity' && '👤'}
                {card.type === 'article' && '📄'}
                {card.type === 'event' && '⚡'}
                {card.type === 'note' && '📝'}
              </span>
              <span className="card-title-text">{card.title}</span>
              <button
                className="card-connect-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setConnectingFromCardId(card.id);
                }}
                title="Connect to another card"
              >
                🔗
              </button>
            </div>
            {card.content && (
              <div className="card-content-preview">
                {card.content.slice(0, 100)}...
              </div>
            )}
            <div className="card-tape"></div>
          </div>
        ))}

        {/* Connection mode hint */}
        {connectingFromCardId && (
          <div className="connection-hint-overlay">
            Click another card to connect (timeline)
            <button onClick={() => setConnectingFromCardId(null)} className="cancel-connection-btn">
              Cancel
            </button>
          </div>
        )}
      </div>

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

