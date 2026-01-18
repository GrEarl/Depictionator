"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

import { Button } from "@/components/ui/Button";

import { useToast, ToastContainer } from "@/components/ui/Toast";

import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

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
    entityTitle?: string | null;
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
    layerId?: string | null;
  }[];
  paths: {
    id: string;
    polyline: { x: number; y: number }[];
    arrowStyle: string;
    strokeColor?: string | null;
    strokeWidth?: number | null;
    markerStyleId?: string | null;
    markerStyle?: { color: string } | null;
    truthFlag?: string | null;
    viewpointId?: string | null;
    worldFrom?: string | null;
    worldTo?: string | null;
    storyFromChapterId?: string | null;
    storyToChapterId?: string | null;
    relatedEventId?: string | null;
    relatedEntityIds?: string | null;
    layerId?: string | null;
  }[];
  events?: {
    id: string;
    title: string;
    worldStart?: string | null;
    worldEnd?: string | null;
    storyOrder?: number | null;
  }[];
};

type EraOption = {
  id: string;
  name: string;
  sortKey?: number | string | null;
};

type ChapterOption = {
  id: string;
  name: string;
  orderIndex: number;
};

type ViewpointOption = {
  id: string;
  name: string;
};

type MapEditorProps = {
  map: MapPayload | null;
  workspaceId: string;
  markerStyles: MarkerStyle[];
  locationTypes: string[];
  entities?: { id: string; title: string; type: string }[];
  eras: EraOption[];
  chapters: ChapterOption[];
  viewpoints: ViewpointOption[];
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
  entityQuery: string;
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

  entities = [],

  eras,

  chapters,

  viewpoints

}: MapEditorProps) {

  const router = useRouter();

  const containerRef = useRef<HTMLDivElement | null>(null);

  const mapRef = useRef<LeafletMap | null>(null);

  const { eraId, chapterId, viewpointId, mode: globalMode } = useGlobalFilters();

  const { toasts, addToast, removeToast } = useToast();

  

  const [mode, setMode] = useState<"select" | "pin" | "path" | "card">("select");

  const [isSaving, setIsSaving] = useState(false); // Loading state



  // Keyboard Navigation (Pan)

  useEffect(() => {

    const handleKeyDown = (e: KeyboardEvent) => {

      if (!mapRef.current) return;

      const panAmount = 50;

      // Only handle if not in input

      const target = e.target as HTMLElement;

      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;



      switch (e.key) {

        case "ArrowUp": mapRef.current.panBy([0, -panAmount]); break;

        case "ArrowDown": mapRef.current.panBy([0, panAmount]); break;

        case "ArrowLeft": mapRef.current.panBy([-panAmount, 0]); break;

        case "ArrowRight": mapRef.current.panBy([panAmount, 0]); break;

      }

    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);

  }, []);



  // ... (rest of state and effects)



  // ... (rest of functions)


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

  // Save cards to DB
  const saveCardsToDatabase = useCallback(async () => {
    if (!map?.id) return;
    setIsSaving(true);

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
        addToast('Cards saved successfully.', 'success');
      } else {
        addToast('Failed to save cards.', 'error');
      }
    } catch (error) {
      console.error('Failed to save cards:', error);
      addToast('Error saving cards.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [map?.id, workspaceId, mapCards, cardConnections, addToast]);

  // Keyboard Shortcuts
  useKeyboardShortcut("v", () => setMode("select"));
  useKeyboardShortcut("p", () => setMode("pin"));
  useKeyboardShortcut("l", () => setMode("path")); // 'l' for Line/Path
  useKeyboardShortcut("c", () => setMode("card"));
  useKeyboardShortcut("s", () => saveCardsToDatabase(), { ctrl: true });

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
      addToast('No events found on this map.', 'info');
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
    entityQuery: "",
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
              entityId: pin.entityId ?? "",
              entityQuery: pin.entityTitle ?? ""
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
              addToast(`Failed to create pin: ${response.statusText}`, "error");
            }
          } catch (error) {
            console.error("Error creating pin from entity drop:", error);
            addToast("Failed to create pin. Please try again.", "error");
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

  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const validatePinForm = () => {
    const newErrors: Record<string, boolean> = {};
    if (!pinDraft.label.trim()) newErrors.label = true;
    if (pinDraft.x === null) newErrors.x = true;
    if (pinDraft.y === null) newErrors.y = true;
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const safeEntities = Array.isArray(entities) ? entities : [];

  const handleEntityQueryChange = (value: string) => {
    const normalized = value.trim().toLowerCase();
    const match = safeEntities.find((entity) => entity.title.toLowerCase() === normalized);
    setPinDraft((prev) => ({
      ...prev,
      entityQuery: value,
      entityId: match ? match.id : ""
    }));
  };

  async function submitPin() {
    if (!validatePinForm()) {
      addToast("Please fill in all required fields.", "error");
      return;
    }
    if (pinDraft.entityQuery.trim() && !pinDraft.entityId) {
      addToast("Select a matching entity from the list or clear the field.", "error");
      return;
    }
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
      
      // Trigger map refresh without full reload
      setSelectedPinId("");
      setPinDraft(createPinDraft());
      setMode("select");
      router.refresh();
    } catch (error) {
      console.error("Error creating pin:", error);
      addToast("Failed to create pin. Please try again.", "error");
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
      addToast("Failed to update pin position. Please try again.", "error");
    }
  }

  async function submitPinUpdate() {
    if (!selectedPinId) return;
    if (pinDraft.entityQuery.trim() && !pinDraft.entityId) {
      addToast("Select a matching entity from the list or clear the field.", "error");
      return;
    }
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
      router.refresh();
    } catch (error) {
      console.error("Error updating pin:", error);
      addToast("Failed to update pin. Please try again.", "error");
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
      router.refresh();
    } catch (error) {
      console.error("Error creating path:", error);
      addToast("Failed to create path. Please try again.", "error");
    }
  }

  async function deletePin() {
    if (!selectedPinId || !confirm("Delete this pin?")) return;
    // Assuming API exists or we use update to soft delete. 
    // AGENTS.md says soft delete.
    // There is no /api/pins/delete in list, maybe use update? 
    // Wait, the file structure showed `api/marker-styles/delete` but not `pins/delete`.
    // I'll skip delete for now or assume it's missing.
    addToast("Delete not implemented yet (check API)", "info");
  }

  // --- Render Helpers ---

  const renderPinForm = () => (
    <div className="inspector-form space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase text-muted tracking-wider">Label</label>
        <input
          className={`w-full bg-bg border rounded-lg px-3 py-2 text-sm outline-none transition-all ${
            errors.label ? "border-red-500 ring-1 ring-red-500" : "border-border focus:ring-2 focus:ring-accent"
          }`}
          value={pinDraft.label}
          onChange={(e) => {
            setPinDraft({ ...pinDraft, label: e.target.value });
            if (errors.label) setErrors({ ...errors, label: false });
          }}
          placeholder="Enter location name..."
        />
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-muted tracking-wider">Coordinate X</label>
          <input className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm opacity-60 cursor-not-allowed" value={pinDraft.x ?? ""} readOnly />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-muted tracking-wider">Coordinate Y</label>
          <input className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm opacity-60 cursor-not-allowed" value={pinDraft.y ?? ""} readOnly />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-muted tracking-wider">Style</label>
          <select
            className="w-full bg-bg border border-border rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            value={pinDraft.markerStyleId}
            onChange={(e) => setPinDraft({ ...pinDraft, markerStyleId: e.target.value })}
          >
            <option value="">Default</option>
            {markerStyles.filter(s => s.target !== 'path').map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-muted tracking-wider">Type</label>
          <select
            className="w-full bg-bg border border-border rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-accent capitalize"
            value={pinDraft.locationType}
            onChange={(e) => setPinDraft({ ...pinDraft, locationType: e.target.value })}
          >
            {locationTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      
      <div className="border-t border-border pt-4 mt-2">
        <details className="group">
          <summary className="text-[10px] font-bold uppercase text-muted mb-3 cursor-pointer flex items-center gap-2">
            Advanced Settings
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5 transition-transform group-open:rotate-180">
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          
          <div className="space-y-4 pb-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted tracking-wider">Truth Status</label>
                <select 
                  className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent"
                  value={pinDraft.truthFlag} 
                  onChange={e => setPinDraft({...pinDraft, truthFlag: e.target.value})}
                >
                  <option value="canonical">Canonical</option>
                  <option value="rumor">Rumor</option>
                  <option value="belief">Belief</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted tracking-wider">Viewpoint</label>
                <select 
                  className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent"
                  value={pinDraft.viewpointId} 
                  onChange={e => setPinDraft({...pinDraft, viewpointId: e.target.value})}
                >
                  <option value="">Global / Canon</option>
                  {viewpoints.map(vp => (
                    <option key={vp.id} value={vp.id}>{vp.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted tracking-wider">Start (World Time)</label>
                <input 
                  className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent"
                  placeholder="e.g. 1000" 
                  value={pinDraft.worldFrom} 
                  onChange={e => setPinDraft({...pinDraft, worldFrom: e.target.value})} 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted tracking-wider">End (World Time)</label>
                <input 
                  className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent"
                  placeholder="e.g. 1200" 
                  value={pinDraft.worldTo} 
                  onChange={e => setPinDraft({...pinDraft, worldTo: e.target.value})} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted tracking-wider">From Chapter</label>
                <select 
                  className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent"
                  value={pinDraft.storyFromChapterId} 
                  onChange={e => setPinDraft({...pinDraft, storyFromChapterId: e.target.value})}
                >
                  <option value="">Start</option>
                  {chapters.map(c => <option key={c.id} value={c.id}>{c.orderIndex}. {c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted tracking-wider">To Chapter</label>
                <select 
                  className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent"
                  value={pinDraft.storyToChapterId} 
                  onChange={e => setPinDraft({...pinDraft, storyToChapterId: e.target.value})}
                >
                  <option value="">End</option>
                  {chapters.map(c => <option key={c.id} value={c.id}>{c.orderIndex}. {c.name}</option>)}
                </select>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted tracking-wider">Linked Entity (search)</label>
              <input
                className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent"
                value={pinDraft.entityQuery}
                onChange={(e) => handleEntityQueryChange(e.target.value)}
                placeholder="Type a name..."
                list="map-entity-search"
              />
              <datalist id="map-entity-search">
                {safeEntities.map((entity) => (
                  <option key={entity.id} value={entity.title} />
                ))}
              </datalist>
              <span className="text-xs text-muted">Pick from suggestions to link.</span>
            </div>
          </div>
        </details>
      </div>

      <div className="flex gap-2 pt-2 border-t border-border mt-4">
        {mode === "pin" ? (
          <Button onClick={submitPin} disabled={pinDraft.x === null} className="flex-1">Create Pin</Button>
        ) : (
          <>
            <Button onClick={submitPinUpdate} className="flex-1">Save Changes</Button>
            <Button variant="danger" size="icon" onClick={deletePin} title="Delete Pin">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="map-viewer-container bg-bg">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* Floating Toolbar */}
      <div className="map-toolbar bg-panel border border-border shadow-lg">
        <Button 
          variant={mode === "select" ? "primary" : "ghost"}
          size="icon"
          onClick={() => { setMode("select"); setSelectedPinId(""); }}
          title="Select / Move"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            <path d="M13 13l6 6" />
          </svg>
        </Button>
        <Button 
          variant={mode === "pin" ? "primary" : "ghost"}
          size="icon"
          onClick={() => { setMode("pin"); setSelectedPinId(""); }}
          title="Place Pin"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </Button>
        <Button
          variant={mode === "path" ? "primary" : "ghost"}
          size="icon"
          onClick={() => { setMode("path"); setSelectedPinId(""); }}
          title="Draw Path"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M22 12c-4.5 0-4.5-8-9-8s-4.5 8-9 8" />
            <path d="M13 4L22 12" />
          </svg>
        </Button>
        <Button
          variant={mode === "card" ? "primary" : "ghost"}
          size="icon"
          onClick={() => { setMode("card"); setSelectedPinId(""); }}
          title="Place Evidence Card"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <path d="M7 7h10M7 12h10M7 17h10" />
          </svg>
        </Button>
        <div className="toolbar-divider" />
        <Button
          variant={showLayerPanel ? "primary" : "ghost"}
          size="icon"
          onClick={() => setShowLayerPanel(!showLayerPanel)}
          title="Layers & Filters"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={autoArrangeEvents}
          title="Auto-arrange events"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={saveCardsToDatabase}
          disabled={isSaving}
          title="Save cards (Ctrl+S)"
        >
          {isSaving ? (
            <svg className="animate-spin h-5 w-5 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          )}
        </Button>
      </div>

      {/* Layers Panel */}
      {showLayerPanel && (
        <div className="map-inspector bg-panel border border-border shadow-xl rounded-xl animate-in slide-in-from-left-4 duration-200" style={{ left: 16, right: 'auto', top: 80, width: 260 }}>
          <div className="inspector-header border-b border-border pb-3 mb-3">
             <strong className="text-ink">Layers & Filters</strong>
             <button className="close-btn hover:text-ink transition-colors" onClick={() => setShowLayerPanel(false)}>
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                 <path d="M18 6L6 18M6 6l12 12" />
               </svg>
             </button>
          </div>
          <div className="inspector-form space-y-4">
            <div className="space-y-2">
              <label className="checkbox-label text-sm text-ink cursor-pointer flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 rounded border-border text-accent focus:ring-accent" checked={showImage} onChange={(e) => setShowImage(e.target.checked)} />
                Map Image
              </label>
              <label className="checkbox-label text-sm text-ink cursor-pointer flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 rounded border-border text-accent focus:ring-accent" checked={showPins} onChange={(e) => setShowPins(e.target.checked)} />
                Location Pins
              </label>
              <label className="checkbox-label text-sm text-ink cursor-pointer flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 rounded border-border text-accent focus:ring-accent" checked={showPaths} onChange={(e) => setShowPaths(e.target.checked)} />
                Path Lines
              </label>
            </div>
            
            <div className="border-t border-border pt-4">
              <details open className="group">
                <summary className="text-[10px] font-bold uppercase text-muted mb-3 cursor-pointer flex items-center justify-between group-open:mb-4">
                  Location Types
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 transition-transform group-open:rotate-180">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="grid gap-1 max-h-60 overflow-y-auto pr-1">
                  {locationTypes.map(type => (
                    <label key={type} className="flex items-center justify-between p-2 rounded-md hover:bg-bg transition-colors cursor-pointer text-sm">
                      <span className="capitalize text-ink">{type}</span>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                        checked={!hiddenLocationTypes.has(type)} 
                        onChange={() => toggleLocationType(type)} 
                      />
                    </label>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Floating Inspector */}
      {(selectedPinId || (mode === "pin" && pinDraft.x !== null)) && (
        <div className="map-inspector bg-panel border border-border shadow-xl rounded-xl animate-in slide-in-from-right-4 duration-200 w-full max-w-[320px] right-0 md:right-4 top-auto bottom-0 md:top-4 md:bottom-auto rounded-b-none md:rounded-b-xl border-b-0 md:border-b">
          <div className="inspector-header border-b border-border pb-3 mb-4">
            <strong className="text-ink">{selectedPinId ? "Pin Details" : "New Location Pin"}</strong>
            <button className="close-btn hover:text-ink transition-colors" onClick={() => { setSelectedPinId(""); setPinDraft(createPinDraft()); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          {renderPinForm()}
        </div>
      )}

      {/* Path Inspector */}
      {mode === "path" && (
        <div className="map-inspector bg-panel border border-border shadow-xl rounded-xl animate-in slide-in-from-right-4 duration-200 w-full max-w-[280px] right-0 md:right-4 top-auto bottom-0 md:top-4 md:bottom-auto rounded-b-none md:rounded-b-xl border-b-0 md:border-b">
           <div className="inspector-header border-b border-border pb-3 mb-4">
             <strong className="text-ink">Draw Path</strong>
             <button className="close-btn hover:text-ink transition-colors" onClick={() => { setMode("select"); setPathPoints([]); }}>
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                 <path d="M18 6L6 18M6 6l12 12" />
               </svg>
             </button>
           </div>
           <div className="inspector-form space-y-4">
             <div className="flex items-center justify-between text-xs font-medium bg-bg p-2 rounded-lg border border-border">
               <span className="text-muted">Selected Points:</span>
               <span className="text-accent font-bold">{pathPoints.length}</span>
             </div>
             <div className="space-y-1.5">
               <label className="text-xs font-bold uppercase text-muted tracking-wider">Line Style</label>
               <select 
                 className="w-full bg-bg border border-border rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                 value={pathDraft.arrowStyle} 
                 onChange={e => setPathDraft({...pathDraft, arrowStyle: e.target.value})}
               >
                 <option value="arrow">Solid with Arrow</option>
                 <option value="dashed">Dashed Line</option>
                 <option value="dotted">Dotted Line</option>
               </select>
             </div>
             <div className="flex gap-2 pt-2 border-t border-border mt-4">
               <Button onClick={submitPath} disabled={pathPoints.length < 2} className="flex-1">Create Path</Button>
               <Button variant="outline" onClick={() => setPathPoints([])} className="px-3">
                 Clear
               </Button>
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
                {card.type === 'entity' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
                {card.type === 'article' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                )}
                {card.type === 'event' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                )}
                {card.type === 'note' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                )}
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
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

