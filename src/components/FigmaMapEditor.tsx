"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Map as LeafletMap, Marker as LeafletMarker, LayerGroup, ImageOverlay, LatLng } from "leaflet";

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
};

type MapPayload = {
  id: string;
  title: string;
  bounds: [[number, number], [number, number]] | null;
  imageUrl: string | null;
  showPathOrder?: boolean | null;
  scenes?: {
    id: string;
    name: string;
    description?: string | null;
    chapterId?: string | null;
    eraId?: string | null;
    viewpointId?: string | null;
    state?: any;
  }[];
  events?: {
    id: string;
    title: string;
    worldStart?: string | null;
    worldEnd?: string | null;
    storyOrder?: number | null;
  }[];
  pins: {
    id: string;
    x: number;
    y: number;
    label?: string | null;
    entityId?: string | null;
    entityTitle?: string | null;
    locationType?: string | null;
    markerShape?: string | null;
    markerColor?: string | null;
    markerStyleId?: string | null;
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
    relatedEntityIds?: string[] | null;
    layerId?: string | null;
  }[];
};

type Entity = { id: string; title: string; type: string; tags?: string[] };
type EraOption = { id: string; name: string };
type ChapterOption = { id: string; name: string; orderIndex: number };
type ViewpointOption = { id: string; name: string };

type FigmaMapEditorProps = {
  map: MapPayload;
  workspaceId: string;
  markerStyles: MarkerStyle[];
  locationTypes: string[];
  entities: Entity[];
  eras: EraOption[];
  chapters: ChapterOption[];
  viewpoints: ViewpointOption[];
};

type ToolMode = "select" | "pin" | "path" | "card";

type PinDraft = {
  x: number | null;
  y: number | null;
  label: string;
  locationType: string;
  markerStyleId: string;
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

function createIcon(L: any, shape: string, color: string, selected = false) {
  const safeShape = shape || "circle";
  const html = `<span class="marker-shape marker-${safeShape} ${selected ? "marker-selected" : ""}" style="--marker-color:${color}; background-color: ${color}"></span>`;
  return L.divIcon({
    className: `marker-icon${selected ? " marker-icon-selected" : ""}`,
    html,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

export function FigmaMapEditor({
  map,
  workspaceId,
  markerStyles,
  locationTypes,
  entities = [],
  eras,
  chapters,
  viewpoints
}: FigmaMapEditorProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayObjectUrlRef = useRef<string | null>(null);

  // Leaflet refs
  const mapRef = useRef<LeafletMap | null>(null);
  const imageOverlayRef = useRef<ImageOverlay | null>(null);
  const pinsLayerRef = useRef<LayerGroup | null>(null);
  const pathsLayerRef = useRef<LayerGroup | null>(null);
  const draftLayerRef = useRef<LayerGroup | null>(null);
  const guidesLayerRef = useRef<LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const { eraId, chapterId, viewpointId, mode, setFilters } = useGlobalFilters();
  const { toasts, addToast, removeToast } = useToast();

  const [mode, setMode] = useState<ToolMode>("select");
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState("");
  const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);
  const [selectedPathId, setSelectedPathId] = useState("");
  const [isEditingPathPoints, setIsEditingPathPoints] = useState(false);

  const defaultLocationType = locationTypes[0] ?? "other";

  const createPinDraft = useCallback((overrides: Partial<PinDraft> = {}): PinDraft => ({
    x: null,
    y: null,
    label: "",
    locationType: defaultLocationType,
    markerStyleId: "",
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

  const createPathDraft = useCallback((overrides: Partial<PathDraft> = {}): PathDraft => ({
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
    relatedEntityIds: "",
    ...overrides
  }), []);

  const [pinDraft, setPinDraft] = useState<PinDraft>(createPinDraft());
  const [pathPoints, setPathPoints] = useState<{ x: number; y: number }[]>([]);
  const [pathDraft, setPathDraft] = useState<PathDraft>(createPathDraft());
  const [showPathOrder, setShowPathOrder] = useState(Boolean(map.showPathOrder));
  useEffect(() => {
    setShowPathOrder(Boolean(map.showPathOrder));
  }, [map.showPathOrder]);

  const handlePathOrderToggle = useCallback(async (value: boolean) => {
    const previous = showPathOrder;
    setShowPathOrder(value);

    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("mapId", map.id);
    form.append("showPathOrder", String(value));

    try {
      const response = await fetch("/api/maps/settings", {
        method: "POST",
        body: form
      });

      if (!response.ok) {
        let errorText = "";
        try {
          const data = await response.json();
          errorText = data?.error ? String(data.error) : JSON.stringify(data);
        } catch {
          errorText = await response.text();
        }
        throw new Error(errorText || "Failed to update map settings");
      }

      addToast("Path order setting saved", "success");
      router.refresh();
    } catch (error) {
      console.error("Failed to update path order setting:", error);
      setShowPathOrder(previous);
      addToast("Failed to save path order setting", "error");
    }
  }, [addToast, map.id, showPathOrder, workspaceId, router]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Zoom state
  const [zoomLevel, setZoomLevel] = useState(0);

  // Layer visibility
  const [showImage, setShowImage] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [hiddenLocationTypes, setHiddenLocationTypes] = useState<Set<string>>(new Set());

  const toggleLocationType = (type: string) => {
    setHiddenLocationTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Evidence cards
  const [isSaving, setIsSaving] = useState(false);
  const [mapCards, setMapCards] = useState<Array<{
    id: string;
    x: number;
    y: number;
    type: "entity" | "article" | "event" | "note";
    title: string;
    content?: string;
    entityId?: string;
    articleId?: string;
    eventId?: string;
  }>>([]);

  const [cardConnections, setCardConnections] = useState<Array<{
    id: string;
    fromCardId: string;
    toCardId: string;
    type: "timeline" | "causal" | "reference";
    label?: string;
  }>>([]);

  const [connectingFromCardId, setConnectingFromCardId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  // Keep mode in ref
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const saveCardsToDatabase = useCallback(async () => {
    if (!map?.id) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/map-cards/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          mapId: map.id,
          cards: mapCards,
          connections: cardConnections
        })
      });
      if (res.ok) {
        addToast("Cards saved successfully.", "success");
      } else {
        addToast("Failed to save cards.", "error");
      }
    } catch (error) {
      console.error("Failed to save cards:", error);
      addToast("Error saving cards.", "error");
    } finally {
      setIsSaving(false);
    }
  }, [map?.id, workspaceId, mapCards, cardConnections, addToast]);

  useEffect(() => {
    if (!map?.id) return;
    const mapId = map.id;
    async function loadCardsFromDB() {
      try {
        const res = await fetch(`/api/map-cards/load?mapId=${mapId}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.cards)) setMapCards(data.cards);
          if (Array.isArray(data.connections)) setCardConnections(data.connections);
        }
      } catch (error) {
        console.error("Failed to load cards:", error);
      }
    }
    loadCardsFromDB();
  }, [map?.id]);

  const handleCardMouseDown = useCallback((e: React.MouseEvent, card: typeof mapCards[0]) => {
    if (connectingFromCardId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.target as HTMLElement).closest(".evidence-card-on-map")?.getBoundingClientRect();
    if (!rect) return;
    setDraggingCardId(card.id);
  }, [connectingFromCardId]);

  const handleCardMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingCardId || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = e.clientX - containerRect.left;
    const newY = e.clientY - containerRect.top;
    setMapCards((prev) => prev.map((card) => card.id === draggingCardId ? { ...card, x: newX, y: newY } : card));
  }, [draggingCardId]);

  const handleCardMouseUp = useCallback(() => {
    setDraggingCardId(null);
  }, []);

  useEffect(() => {
    if (draggingCardId) {
      document.addEventListener("mousemove", handleCardMouseMove);
      document.addEventListener("mouseup", handleCardMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleCardMouseMove);
        document.removeEventListener("mouseup", handleCardMouseUp);
      };
    }
  }, [draggingCardId, handleCardMouseMove, handleCardMouseUp]);

  const autoArrangeEvents = useCallback(() => {
    const events = map.events ?? [];
    if (!events.length) {
      addToast("No events found on this map.", "info");
      return;
    }
    const sortedEvents = [...events].sort((a, b) => {
      if (a.storyOrder != null && b.storyOrder != null) return a.storyOrder - b.storyOrder;
      if (a.worldStart && b.worldStart) return a.worldStart.localeCompare(b.worldStart);
      return 0;
    });
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
        type: "event" as const,
        title: event.title,
        content: event.worldStart || event.storyOrder?.toString(),
        eventId: event.id
      };
    });
    const newConnections = sortedEvents.slice(0, -1).map((event, index) => ({
      id: `timeline-conn-${index}`,
      fromCardId: `event-card-${event.id}`,
      toCardId: `event-card-${sortedEvents[index + 1].id}`,
      type: "timeline" as const,
      label: "timeline"
    }));
    setMapCards(newCards);
    setCardConnections(newConnections);
  }, [map.events, addToast]);

  // Keyboard shortcuts
  useKeyboardShortcut("v", () => {
    setMode("select");
    clearPinSelection();
    setSelectedPathId("");
    setIsEditingPathPoints(false);
    setShowRightPanel(false);
  });
  useKeyboardShortcut("p", () => {
    setMode("pin");
    clearPinSelection();
    setSelectedPathId("");
    setIsEditingPathPoints(false);
    setPathPoints([]);
    setPinDraft(createPinDraft());
    setShowRightPanel(true);
  });
  useKeyboardShortcut("l", () => {
    setMode("path");
    clearPinSelection();
    setSelectedPathId("");
    setIsEditingPathPoints(false);
    setPathPoints([]);
    setPathDraft(createPathDraft());
    setShowRightPanel(false);
  });
  useKeyboardShortcut("c", () => {
    setMode("card");
    clearPinSelection();
    setShowRightPanel(false);
    draftLayerRef.current?.clearLayers();
  });
  useKeyboardShortcut("s", () => saveCardsToDatabase(), { ctrl: true });
  useKeyboardShortcut("Escape", () => {
    setMode("select");
    clearPinSelection();
    setSelectedPathId("");
    setIsEditingPathPoints(false);
    setPinDraft(createPinDraft());
    setPathDraft(createPathDraft());
    setPathPoints([]);
    setShowRightPanel(false);
    draftLayerRef.current?.clearLayers();
  });

  // Pan with arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!mapRef.current) return;
      const panAmount = 50;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          mapRef.current.panBy([0, -panAmount]);
          break;
        case "ArrowDown":
          e.preventDefault();
          mapRef.current.panBy([0, panAmount]);
          break;
        case "ArrowLeft":
          e.preventDefault();
          mapRef.current.panBy([-panAmount, 0]);
          break;
        case "ArrowRight":
          e.preventDefault();
          mapRef.current.panBy([panAmount, 0]);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter pins by viewpoint/chapter
  const chapterOrderMap = useMemo(() => {
    const m = new Map<string, number>();
    chapters.forEach(c => m.set(c.id, c.orderIndex));
    return m;
  }, [chapters]);

  const visiblePins = useMemo(() => {
    return map.pins.filter((pin) => {
      if (pin.locationType && hiddenLocationTypes.has(pin.locationType)) return false;
      const truthFlag = pin.truthFlag ?? "canonical";
      if (viewpointId === "canon") {
        if (truthFlag !== "canonical") return false;
      } else {
        const isCanon = truthFlag === "canonical";
        const isMyView = pin.viewpointId === viewpointId;
        if (!isCanon && !isMyView) return false;
      }

      if (chapterId !== "all") {
        const currentOrder = chapterOrderMap.get(chapterId);
        if (currentOrder !== undefined) {
          if (pin.storyFromChapterId) {
            const from = chapterOrderMap.get(pin.storyFromChapterId) ?? -1;
            if (from > currentOrder) return false;
          }
          if (pin.storyToChapterId) {
            const to = chapterOrderMap.get(pin.storyToChapterId) ?? 999999;
            if (to < currentOrder) return false;
          }
        }
      }
      return true;
    });
  }, [map.pins, viewpointId, chapterId, chapterOrderMap, hiddenLocationTypes]);

  const selectedPinSet = useMemo(() => new Set(selectedPinIds), [selectedPinIds]);

  useEffect(() => {
    setSelectedPinIds((prev) => prev.filter((id) => visiblePins.some((pin) => pin.id === id)));
  }, [visiblePins]);

  useEffect(() => {
    if (selectedPinId && !selectedPinSet.has(selectedPinId)) {
      setSelectedPinId(selectedPinIds[0] ?? "");
    }
  }, [selectedPinId, selectedPinSet, selectedPinIds]);

  const visiblePaths = useMemo(() => {
    return map.paths.filter((path) => {
      const truthFlag = path.truthFlag ?? "canonical";
      if (viewpointId === "canon") {
        if (truthFlag !== "canonical") return false;
      } else {
        const isCanon = truthFlag === "canonical";
        const isMyView = path.viewpointId === viewpointId;
        if (!isCanon && !isMyView) return false;
      }
      return true;
    });
  }, [map.paths, viewpointId]);

  const selectedPath = useMemo(() => {
    if (!selectedPathId) return null;
    return map.paths.find((path) => path.id === selectedPathId) ?? null;
  }, [map.paths, selectedPathId]);

  // Helper function to convert Leaflet LatLng to map coordinates
  const latLngToMapCoords = useCallback((latlng: LatLng): { x: number; y: number } => {
    // In Leaflet CRS.Simple, lng = x and lat = y
    return {
      x: Number(latlng.lng.toFixed(1)),
      y: Number(latlng.lat.toFixed(1))
    };
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!containerRef.current || !map) return;
    let active = true;

    import("leaflet").then((leafletModule) => {
      if (!active || !containerRef.current) return;
      const L = (leafletModule as any).default ?? leafletModule;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const bounds = map.bounds ?? [[0, 0], [1000, 1000]];
      const mapInstance = L.map(containerRef.current, {
        crs: L.CRS.Simple,
        zoomControl: false,
        minZoom: -2,
        maxZoom: 3,
        attributionControl: false,
        preferCanvas: true
      }) as LeafletMap;

      mapInstance.fitBounds(bounds);
      setTimeout(() => {
        mapInstance.invalidateSize();
      }, 50);

      // Track zoom changes
      mapInstance.on('zoomend', () => {
        setZoomLevel(mapInstance.getZoom());
      });

      // Create Layer Groups
      const pinsLayer = L.layerGroup().addTo(mapInstance);
      const pathsLayer = L.layerGroup().addTo(mapInstance);
      const draftLayer = L.layerGroup().addTo(mapInstance);
      const guidesPane = mapInstance.createPane("guides");
      if (guidesPane) {
        guidesPane.style.zIndex = "450";
        guidesPane.style.pointerEvents = "none";
      }
      const guidesLayer = L.layerGroup().addTo(mapInstance);

      pinsLayerRef.current = pinsLayer;
      pathsLayerRef.current = pathsLayer;
      draftLayerRef.current = draftLayer;
      guidesLayerRef.current = guidesLayer;
      mapRef.current = mapInstance;

      // Image Overlay (fetch-first to avoid auth/caching issues)
      if (map.imageUrl) {
        const addOverlay = (url: string) => {
          if (imageOverlayRef.current) {
            imageOverlayRef.current.remove();
            imageOverlayRef.current = null;
          }
          const overlay = L.imageOverlay(url, bounds, {
            opacity: showImage ? 1 : 0
          }).addTo(mapInstance);
          imageOverlayRef.current = overlay;
          overlay.on("load", () => {
            mapInstance.invalidateSize();
          });
          return overlay;
        };

        const loadOverlay = async () => {
          try {
            const response = await fetch(map.imageUrl as string, { credentials: "include" });
            if (!response.ok) throw new Error("failed to fetch map image");
            const blob = await response.blob();
            if (!active) return;
            const objectUrl = URL.createObjectURL(blob);
            overlayObjectUrlRef.current = objectUrl;
            addOverlay(objectUrl);
          } catch {
            if (!active) return;
            const overlay = addOverlay(map.imageUrl as string);
            const imgEl = overlay.getElement();
            if (imgEl) {
              imgEl.addEventListener("error", async () => {
                try {
                  const response = await fetch(map.imageUrl as string, { credentials: "include" });
                  if (!response.ok) return;
                  const blob = await response.blob();
                  if (!active) return;
                  const objectUrl = URL.createObjectURL(blob);
                  overlayObjectUrlRef.current = objectUrl;
                  overlay.setUrl(objectUrl);
                } catch {
                  // ignore fallback failures
                }
              }, { once: true });
            }
          }
        };

        loadOverlay();
      }

      // Click handler
      mapInstance.on("click", (event: any) => {
        const currentMode = modeRef.current;
        const coords = latLngToMapCoords(event.latlng);

        if (currentMode === "pin") {
          setPinDraft((prev) => ({ ...prev, x: coords.x, y: coords.y }));
          setShowRightPanel(true);

          // Show draft marker
          draftLayer.clearLayers();
          L.circleMarker([coords.y, coords.x], {
            radius: 8,
            color: "#ff0033",
            fillColor: "#ff0033",
            fillOpacity: 0.6,
            weight: 2
          }).addTo(draftLayer);
        } else if (currentMode === "path") {
          setPathPoints((prev) => [...prev, coords]);
        } else if (currentMode === "select") {
          clearPinSelection();
          setSelectedPathId("");
          setIsEditingPathPoints(false);
          setPinDraft(createPinDraft());
          setPathDraft(createPathDraft());
          setShowRightPanel(false);
          draftLayer.clearLayers();
        }
      });

      setMapReady(true);
      setZoomLevel(mapInstance.getZoom());
    });

    return () => {
      active = false;
      setMapReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (overlayObjectUrlRef.current) {
        URL.revokeObjectURL(overlayObjectUrlRef.current);
        overlayObjectUrlRef.current = null;
      }
    };
  }, [map.id, latLngToMapCoords, createPinDraft, createPathDraft, clearPinSelection]);

  useEffect(() => {
    if (!mapRef.current) return;
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 50);
    return () => clearTimeout(timer);
  }, [showLeftSidebar, showRightPanel]);

  // Update Image Overlay Visibility
  useEffect(() => {
    if (!imageOverlayRef.current) return;
    imageOverlayRef.current.setOpacity(showImage ? 1 : 0);
  }, [showImage]);

  // Update Pins Layer
  useEffect(() => {
    if (!mapReady || !pinsLayerRef.current || !mapRef.current) return;

    import("leaflet").then((leafletModule) => {
      const L = (leafletModule as any).default ?? leafletModule;
      const layerGroup = pinsLayerRef.current;
      if (!layerGroup) return;

      layerGroup.clearLayers();

      if (!showPins) return;

      visiblePins.forEach((pin) => {
        const color = pin.markerColor ?? pin.markerStyle?.color ?? "#1f4b99";
        const shape = pin.markerShape ?? pin.markerStyle?.shape ?? "circle";
        const icon = createIcon(L, shape, color, selectedPinSet.has(pin.id));

        // In CRS.Simple: marker position is [lat, lng] which maps to [y, x]
        const marker = L.marker([pin.y, pin.x], {
          icon,
          draggable: mode === "select"
        });

        if (pin.label) {
          marker.bindTooltip(pin.label, { direction: "top", offset: [0, -10] });
        }

        marker.on("click", (e: any) => {
          L.DomEvent.stopPropagation(e);
          if (modeRef.current !== "select") return;
          const originalEvent = e?.originalEvent as MouseEvent | undefined;
          const multi = Boolean(originalEvent?.shiftKey || originalEvent?.metaKey || originalEvent?.ctrlKey);
          if (multi) {
            togglePinSelection(pin.id);
            setSelectedPathId("");
            setIsEditingPathPoints(false);
            setShowRightPanel(false);
          } else {
            selectSinglePin(pin.id);
            setSelectedPathId("");
            setIsEditingPathPoints(false);
            setShowRightPanel(true);
            setPinDraft(createPinDraft({
              x: pin.x,
              y: pin.y,
              label: pin.label ?? "",
              locationType: pin.locationType ?? defaultLocationType,
              markerStyleId: pin.markerStyleId ?? "",
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
          }
        });

        marker.on("drag", (event: any) => {
          const latlng = event.target.getLatLng();
          const coords = latLngToMapCoords(latlng);
          const bounds = map.bounds ?? [[0, 0], [1000, 1000]];
          const [[minY, minX], [maxY, maxX]] = bounds as [[number, number], [number, number]];
          const otherPins = visiblePins.filter((p) => p.id !== pin.id);
          const threshold = 6;
          let snapX = coords.x;
          let snapY = coords.y;
          let guideX: number | null = null;
          let guideY: number | null = null;
          let minDx = threshold + 1;
          let minDy = threshold + 1;

          otherPins.forEach((p) => {
            const dx = Math.abs(p.x - coords.x);
            if (dx <= threshold && dx < minDx) {
              minDx = dx;
              guideX = p.x;
              snapX = p.x;
            }
            const dy = Math.abs(p.y - coords.y);
            if (dy <= threshold && dy < minDy) {
              minDy = dy;
              guideY = p.y;
              snapY = p.y;
            }
          });

          if (guidesLayerRef.current) {
            guidesLayerRef.current.clearLayers();
            if (guideX !== null) {
              L.polyline(
                [[minY, guideX], [maxY, guideX]],
                { color: "#ff0033", weight: 1, dashArray: "4,4", opacity: 0.6, pane: "guides" }
              ).addTo(guidesLayerRef.current);
            }
            if (guideY !== null) {
              L.polyline(
                [[guideY, minX], [guideY, maxX]],
                { color: "#ff0033", weight: 1, dashArray: "4,4", opacity: 0.6, pane: "guides" }
              ).addTo(guidesLayerRef.current);
            }
          }

          if (guideX !== null || guideY !== null) {
            event.target.setLatLng([snapY, snapX]);
          }
        });

        marker.on("dragend", (event: any) => {
          guidesLayerRef.current?.clearLayers();
          const latlng = event.target.getLatLng();
          const coords = latLngToMapCoords(latlng);
          updatePinPosition(pin.id, coords.x, coords.y, { silent: true });
        });

        marker.addTo(layerGroup);
      });
    });
  }, [
    mapReady,
    visiblePins,
    showPins,
    mode,
    defaultLocationType,
    createPinDraft,
    latLngToMapCoords,
    selectedPinSet,
    togglePinSelection,
    selectSinglePin,
    map.bounds,
    selectedPinId
  ]);

  // Update Paths Layer
  useEffect(() => {
    if (!mapReady || !pathsLayerRef.current) return;

    import("leaflet").then((leafletModule) => {
      const L = (leafletModule as any).default ?? leafletModule;
      const layerGroup = pathsLayerRef.current;
      if (!layerGroup) return;

      layerGroup.clearLayers();

      if (!showPaths) return;

      visiblePaths.forEach((path) => {
        if (!path.polyline || !Array.isArray(path.polyline) || path.polyline.length < 2) return;

        const points = path.polyline.map((pt) => [pt.y, pt.x]) as [number, number][];
        const color = path.strokeColor ?? path.markerStyle?.color ?? "#1f4b99";
        const weight = path.strokeWidth ?? 3;

          const polylineLayer = L.polyline(points, {
            color,
            weight,
            dashArray: path.arrowStyle === "dashed" ? "6 6" : path.arrowStyle === "dotted" ? "2 6" : undefined
          }).addTo(layerGroup);

          polylineLayer.on("click", (event: any) => {
            L.DomEvent.stopPropagation(event);
            if (modeRef.current !== "select") return;
            setMode("select");
            clearPinSelection();
            setSelectedPathId(path.id);
            setIsEditingPathPoints(false);
            setPathPoints([]);
            setShowRightPanel(true);
            setPathDraft(createPathDraft({
              arrowStyle: path.arrowStyle ?? "arrow",
              strokeColor: path.strokeColor ?? "",
              strokeWidth: path.strokeWidth ? String(path.strokeWidth) : "",
              markerStyleId: path.markerStyleId ?? "",
              truthFlag: path.truthFlag ?? "canonical",
              viewpointId: path.viewpointId ?? "",
              worldFrom: path.worldFrom ?? "",
              worldTo: path.worldTo ?? "",
              storyFromChapterId: path.storyFromChapterId ?? "",
              storyToChapterId: path.storyToChapterId ?? "",
              relatedEventId: path.relatedEventId ?? "",
              relatedEntityIds: Array.isArray(path.relatedEntityIds) ? path.relatedEntityIds.join(",") : ""
            }));
          });

        if (showPathOrder) {
          path.polyline.forEach((pt, idx) => {
            const icon = L.divIcon({
              className: "path-point-index",
              html: `<span class="path-index-badge">${idx + 1}</span>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            });
            L.marker([pt.y, pt.x], { icon, interactive: false }).addTo(layerGroup);
          });
        }
      });
      });
    }, [mapReady, visiblePaths, showPaths, showPathOrder, createPathDraft, clearPinSelection]);

  // Update Draft Layer (Path Drawing)
  useEffect(() => {
    if (!draftLayerRef.current) return;

    import("leaflet").then((leafletModule) => {
      const L = (leafletModule as any).default ?? leafletModule;
      const layerGroup = draftLayerRef.current;
      if (!layerGroup) return;

      layerGroup.clearLayers();

      if (mode === "path" && pathPoints.length > 0) {
        const points = pathPoints.map((pt) => [pt.y, pt.x]) as [number, number][];

        // Draw the path line
        if (points.length > 1) {
          const dashArray =
            pathDraft.arrowStyle === "dashed"
              ? "6 6"
              : pathDraft.arrowStyle === "dotted"
                ? "2 6"
                : undefined;
          L.polyline(points, {
            color: "#ff0033",
            weight: 3,
            dashArray,
            opacity: 0.8
          }).addTo(layerGroup);
        }

        // Draw point markers
        pathPoints.forEach((pt, idx) => {
          L.circleMarker([pt.y, pt.x], {
            radius: 5,
            color: "#ff0033",
            fillColor: "#ff0033",
            fillOpacity: 1,
            weight: 2
          }).addTo(layerGroup);

          if (showPathOrder) {
            const icon = L.divIcon({
              className: "path-point-index",
              html: `<span class="path-index-badge">${idx + 1}</span>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            });
            L.marker([pt.y, pt.x], { icon, interactive: false }).addTo(layerGroup);
          }
        });
      }
    });
  }, [pathPoints, mode, pathDraft.arrowStyle, showPathOrder]);

  // Drag & Drop Handling
  useEffect(() => {
    const mapContainer = containerRef.current;
    if (!mapContainer || !map || !mapReady || !mapRef.current) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer?.getData("type");
      const entityId = e.dataTransfer?.getData("id");
      const title = e.dataTransfer?.getData("title");

      if (type === "entity" && entityId && mapRef.current) {
        const containerRect = mapContainer.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;

        if (modeRef.current === "card") {
          const newCard = {
            id: `card-${Date.now()}`,
            x: mouseX,
            y: mouseY,
            type: "entity" as const,
            title: title || "",
            entityId
          };
          setMapCards((prev) => [...prev, newCard]);
          return;
        }

        // Convert container point to map coordinates
        const latlng = mapRef.current.containerPointToLatLng([mouseX, mouseY]);
        const coords = latLngToMapCoords(latlng);

        // Create pin
        const form = new FormData();
        form.append("workspaceId", workspaceId);
        form.append("mapId", map.id);
        form.append("entityId", entityId);
        form.append("label", title || "");
        form.append("x", String(coords.x));
        form.append("y", String(coords.y));
        form.append("locationType", defaultLocationType);
        form.append("truthFlag", "canonical");

        try {
          const response = await fetch("/api/pins/create", { method: "POST", body: form });
          if (response.ok) {
            router.refresh();
            addToast("Pin created from entity", "success");
          } else {
            const errorText = await response.text();
            console.error("Failed to create pin:", errorText);
            addToast("Failed to create pin", "error");
          }
        } catch (error) {
          console.error("Error creating pin:", error);
          addToast("Error creating pin", "error");
        }
      }
    };

    mapContainer.addEventListener("dragover", handleDragOver);
    mapContainer.addEventListener("drop", handleDrop);

    return () => {
      mapContainer.removeEventListener("dragover", handleDragOver);
      mapContainer.removeEventListener("drop", handleDrop);
    };
  }, [map, mapReady, workspaceId, defaultLocationType, router, addToast, latLngToMapCoords]);

  // API Actions
  const validatePinForm = () => {
    const newErrors: Record<string, boolean> = {};
    if (!pinDraft.label.trim()) newErrors.label = true;
    if (pinDraft.x === null) newErrors.x = true;
    if (pinDraft.y === null) newErrors.y = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const safeEntities = Array.isArray(entities) ? entities : [];
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [entityGenreFilter, setEntityGenreFilter] = useState("all");

  const entityTypeOptions = useMemo(() => {
    const types = new Set<string>();
    safeEntities.forEach((entity) => {
      if (entity.type) types.add(entity.type);
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [safeEntities]);

  const entityGenreMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    safeEntities.forEach((entity) => {
      (entity.tags ?? []).forEach((rawTag) => {
        const tag = rawTag.trim();
        const lower = tag.toLowerCase();
        if (!lower.startsWith("genre:") && !lower.startsWith("category:")) return;
        const label = tag.split(":").slice(1).join(":").trim();
        if (!label) return;
        if (!map.has(label)) {
          map.set(label, new Set<string>());
        }
        map.get(label)?.add(lower);
      });
    });
    return map;
  }, [safeEntities]);

  const entityGenreOptions = useMemo(() => {
    return Array.from(entityGenreMap.keys()).sort((a, b) => a.localeCompare(b));
  }, [entityGenreMap]);

  const filteredEntities = useMemo(() => {
    return safeEntities.filter((entity) => {
      if (entityTypeFilter !== "all" && entity.type !== entityTypeFilter) return false;
      if (entityGenreFilter !== "all") {
        const allowedTags = entityGenreMap.get(entityGenreFilter);
        if (!allowedTags || allowedTags.size === 0) return false;
        const matches = (entity.tags ?? []).some((tag) => allowedTags.has(tag.trim().toLowerCase()));
        if (!matches) return false;
      }
      return true;
    });
  }, [safeEntities, entityTypeFilter, entityGenreFilter, entityGenreMap]);

  const scenes = map.scenes ?? [];
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [sceneFormOpen, setSceneFormOpen] = useState(false);
  const [sceneSaving, setSceneSaving] = useState(false);
  const [sceneForm, setSceneForm] = useState({
    name: "",
    description: "",
    eraId: "",
    chapterId: "",
    viewpointId: ""
  });

  const resolveSceneFilterId = useCallback((value: string, options: { id: string }[]) => {
    return options.some((option) => option.id === value) ? value : "";
  }, []);

  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId]
  );

  const captureSceneState = useCallback(() => {
    const mapInstance = mapRef.current;
    const center = mapInstance?.getCenter();
    return {
      zoom: mapInstance?.getZoom() ?? null,
      center: center
        ? { x: Number(center.lng.toFixed(2)), y: Number(center.lat.toFixed(2)) }
        : null,
      showImage,
      showPins,
      showPaths,
      showPathOrder,
      hiddenLocationTypes: Array.from(hiddenLocationTypes),
      entityTypeFilter,
      entityGenreFilter,
      filters: {
        eraId,
        chapterId,
        viewpointId,
        mode
      }
    };
  }, [
    showImage,
    showPins,
    showPaths,
    showPathOrder,
    hiddenLocationTypes,
    entityTypeFilter,
    entityGenreFilter,
    eraId,
    chapterId,
    viewpointId,
    mode
  ]);

  const applySceneState = useCallback(
    (scene: NonNullable<MapPayload["scenes"]>[number]) => {
      const state = (scene.state ?? {}) as any;
      if (mapRef.current && state?.center && typeof state.zoom === "number") {
        mapRef.current.setView([state.center.y, state.center.x], state.zoom, { animate: false });
      }
      if (typeof state?.showImage === "boolean") setShowImage(state.showImage);
      if (typeof state?.showPins === "boolean") setShowPins(state.showPins);
      if (typeof state?.showPaths === "boolean") setShowPaths(state.showPaths);
      if (typeof state?.showPathOrder === "boolean") setShowPathOrder(state.showPathOrder);
      if (Array.isArray(state?.hiddenLocationTypes)) {
        setHiddenLocationTypes(new Set(state.hiddenLocationTypes));
      }
      if (typeof state?.entityTypeFilter === "string") {
        setEntityTypeFilter(state.entityTypeFilter);
      }
      if (typeof state?.entityGenreFilter === "string") {
        setEntityGenreFilter(state.entityGenreFilter);
      }

      const storedFilters = state?.filters ?? {};
      const nextFilters: { eraId?: string; chapterId?: string; viewpointId?: string; mode?: string } = {};
      if (typeof storedFilters.eraId === "string") nextFilters.eraId = storedFilters.eraId;
      else if (scene.eraId) nextFilters.eraId = scene.eraId;
      if (typeof storedFilters.chapterId === "string") nextFilters.chapterId = storedFilters.chapterId;
      else if (scene.chapterId) nextFilters.chapterId = scene.chapterId;
      if (typeof storedFilters.viewpointId === "string") nextFilters.viewpointId = storedFilters.viewpointId;
      else if (scene.viewpointId) nextFilters.viewpointId = scene.viewpointId;
      if (typeof storedFilters.mode === "string") nextFilters.mode = storedFilters.mode;

      if (Object.keys(nextFilters).length > 0) {
        setFilters(nextFilters);
      }
    },
    [setFilters]
  );

  const openNewSceneForm = useCallback(() => {
    setSceneForm({
      name: "",
      description: "",
      eraId: resolveSceneFilterId(eraId, eras),
      chapterId: resolveSceneFilterId(chapterId, chapters),
      viewpointId: resolveSceneFilterId(viewpointId, viewpoints)
    });
    setSceneFormOpen(true);
  }, [resolveSceneFilterId, eraId, chapterId, viewpointId, eras, chapters, viewpoints]);

  const saveSceneSnapshot = useCallback(async () => {
    if (!selectedSceneId) return;
    setSceneSaving(true);
    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("sceneId", selectedSceneId);
    const resolvedEraId = resolveSceneFilterId(eraId, eras);
    const resolvedChapterId = resolveSceneFilterId(chapterId, chapters);
    const resolvedViewpointId = resolveSceneFilterId(viewpointId, viewpoints);
    form.append("eraId", resolvedEraId);
    form.append("chapterId", resolvedChapterId);
    form.append("viewpointId", resolvedViewpointId);
    form.append("state", JSON.stringify(captureSceneState()));

    try {
      const response = await fetch("/api/map-scenes/update", { method: "POST", body: form });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update scene");
      }
      addToast("Scene snapshot saved", "success");
      router.refresh();
    } catch (error) {
      console.error("Error saving scene snapshot:", error);
      addToast("Failed to save scene snapshot", "error");
    } finally {
      setSceneSaving(false);
    }
  }, [
    addToast,
    captureSceneState,
    selectedSceneId,
    workspaceId,
    resolveSceneFilterId,
    eraId,
    chapterId,
    viewpointId,
    eras,
    chapters,
    viewpoints,
    router
  ]);

  const createScene = useCallback(async () => {
    if (!sceneForm.name.trim()) {
      addToast("Scene name is required", "error");
      return;
    }
    setSceneSaving(true);
    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("mapId", map.id);
    form.append("name", sceneForm.name.trim());
    form.append("description", sceneForm.description.trim());
    form.append("eraId", sceneForm.eraId);
    form.append("chapterId", sceneForm.chapterId);
    form.append("viewpointId", sceneForm.viewpointId);
    form.append("state", JSON.stringify(captureSceneState()));

    try {
      const response = await fetch("/api/map-scenes/create", { method: "POST", body: form });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to create scene");
      }
      addToast("Scene created", "success");
      setSceneFormOpen(false);
      setSceneForm({ name: "", description: "", eraId: "", chapterId: "", viewpointId: "" });
      router.refresh();
    } catch (error) {
      console.error("Error creating scene:", error);
      addToast("Failed to create scene", "error");
    } finally {
      setSceneSaving(false);
    }
  }, [addToast, captureSceneState, map.id, sceneForm, workspaceId, router]);

  async function submitPin() {
    if (!validatePinForm()) {
      addToast("Please fill in all required fields.", "error");
      return;
    }
    if (pinDraft.entityQuery.trim() && !pinDraft.entityId) {
      addToast("Select a matching entity from the list or clear the field.", "error");
      return;
    }
    try {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("mapId", map.id);
      form.append("label", pinDraft.label);
      form.append("x", String(pinDraft.x));
      form.append("y", String(pinDraft.y));
      form.append("locationType", pinDraft.locationType);
      form.append("truthFlag", pinDraft.truthFlag);
      if (pinDraft.markerStyleId) form.append("markerStyleId", pinDraft.markerStyleId);
      if (pinDraft.markerColor) form.append("markerColor", pinDraft.markerColor);
      if (pinDraft.viewpointId) form.append("viewpointId", pinDraft.viewpointId);
      if (pinDraft.worldFrom) form.append("worldFrom", pinDraft.worldFrom);
      if (pinDraft.worldTo) form.append("worldTo", pinDraft.worldTo);
      if (pinDraft.storyFromChapterId) form.append("storyFromChapterId", pinDraft.storyFromChapterId);
      if (pinDraft.storyToChapterId) form.append("storyToChapterId", pinDraft.storyToChapterId);
      if (pinDraft.entityId) form.append("entityId", pinDraft.entityId);
      if (!pinDraft.entityId && pinDraft.entityQuery.trim()) {
        form.append("entityQuery", pinDraft.entityQuery.trim());
      }

      const response = await fetch("/api/pins/create", { method: "POST", body: form });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to create pin:", errorText);
        throw new Error(response.statusText);
      }

      clearPinSelection();
      setPinDraft(createPinDraft());
      setMode("select");
      setShowRightPanel(false);
      draftLayerRef.current?.clearLayers();
      router.refresh();
      addToast("Pin created successfully", "success");
    } catch (error) {
      console.error("Error creating pin:", error);
      addToast("Failed to create pin", "error");
    }
  }

  async function updatePinPosition(pinId: string, x: number, y: number, options?: { silent?: boolean }) {
    try {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("pinId", pinId);
      form.append("x", String(x));
      form.append("y", String(y));

      const response = await fetch("/api/pins/update", { method: "POST", body: form });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to update pin position:", errorText);
        throw new Error(response.statusText);
      }

      if (selectedPinId === pinId) {
        setPinDraft((prev) => ({ ...prev, x, y }));
      }

      if (!options?.silent) {
        addToast("Pin position updated", "success");
      }
    } catch (error) {
      console.error("Error updating pin position:", error);
      if (!options?.silent) {
        addToast("Failed to update pin position", "error");
      }
    }
  }

  async function alignSelectedPins(axis: "x" | "y") {
    const selectedPins = visiblePins.filter((pin) => selectedPinSet.has(pin.id));
    if (selectedPins.length < 2) return;
    const total = selectedPins.reduce((sum, pin) => sum + (axis === "x" ? pin.x : pin.y), 0);
    const target = Number((total / selectedPins.length).toFixed(1));

    try {
      await Promise.all(
        selectedPins.map((pin) =>
          updatePinPosition(
            pin.id,
            axis === "x" ? target : pin.x,
            axis === "y" ? target : pin.y,
            { silent: true }
          )
        )
      );
      addToast(`Aligned ${selectedPins.length} pins`, "success");
      clearPinSelection();
      router.refresh();
    } catch (error) {
      console.error("Error aligning pins:", error);
      addToast("Failed to align pins", "error");
    }
  }

  async function submitPinUpdate() {
    if (!selectedPinId) return;
    if (!validatePinForm()) {
      addToast("Label is required", "error");
      return;
    }
    if (pinDraft.entityQuery.trim() && !pinDraft.entityId) {
      addToast("Select a matching entity from the list or clear the field.", "error");
      return;
    }
    try {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("pinId", selectedPinId);
      form.append("label", pinDraft.label);
      if (pinDraft.x !== null) form.append("x", String(pinDraft.x));
      if (pinDraft.y !== null) form.append("y", String(pinDraft.y));
      form.append("locationType", pinDraft.locationType);
      form.append("truthFlag", pinDraft.truthFlag);
      if (pinDraft.markerStyleId) form.append("markerStyleId", pinDraft.markerStyleId);
      if (pinDraft.markerColor) form.append("markerColor", pinDraft.markerColor);
      if (pinDraft.viewpointId) form.append("viewpointId", pinDraft.viewpointId);
      if (pinDraft.worldFrom) form.append("worldFrom", pinDraft.worldFrom);
      if (pinDraft.worldTo) form.append("worldTo", pinDraft.worldTo);
      if (pinDraft.storyFromChapterId) form.append("storyFromChapterId", pinDraft.storyFromChapterId);
      if (pinDraft.storyToChapterId) form.append("storyToChapterId", pinDraft.storyToChapterId);
      if (pinDraft.entityId) form.append("entityId", pinDraft.entityId);
      if (!pinDraft.entityId && pinDraft.entityQuery.trim()) {
        form.append("entityQuery", pinDraft.entityQuery.trim());
      }

      const response = await fetch("/api/pins/update", { method: "POST", body: form });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to update pin:", errorText);
        throw new Error(response.statusText);
      }

      router.refresh();
      addToast("Pin updated successfully", "success");
    } catch (error) {
      console.error("Error updating pin:", error);
      addToast("Failed to update pin", "error");
    }
  }

  async function deletePin() {
    if (!selectedPinId) return;
    if (!confirm("Delete this pin?")) return;
    try {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("pinId", selectedPinId);
      const response = await fetch("/api/pins/delete", { method: "POST", body: form });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to delete pin:", errorText);
        throw new Error(response.statusText);
      }

      clearPinSelection();
      setPinDraft(createPinDraft());
      setShowRightPanel(false);
      draftLayerRef.current?.clearLayers();
      router.refresh();
      addToast("Pin deleted", "success");
    } catch (error) {
      console.error("Error deleting pin:", error);
      addToast("Failed to delete pin", "error");
    }
  }

  async function submitPath() {
    if (isEditingPathPoints && selectedPathId) {
      await submitPathUpdate({ includePolyline: true, exitEdit: true });
      return;
    }
    if (!map || pathPoints.length < 2) {
      addToast("Please add at least 2 points to create a path", "info");
      return;
    }
    if (!workspaceId) {
      addToast("Workspace not found. Please reload and try again.", "error");
      return;
    }
    try {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("mapId", map.id);
      form.append("polyline", JSON.stringify(pathPoints));
      form.append("arrowStyle", pathDraft.arrowStyle || "arrow");
      if (pathDraft.strokeColor) form.append("strokeColor", pathDraft.strokeColor);
      if (pathDraft.strokeWidth) form.append("strokeWidth", pathDraft.strokeWidth);
      if (pathDraft.markerStyleId) form.append("markerStyleId", pathDraft.markerStyleId);
      if (pathDraft.truthFlag) form.append("truthFlag", pathDraft.truthFlag);
      if (pathDraft.viewpointId) form.append("viewpointId", pathDraft.viewpointId);
      if (pathDraft.worldFrom) form.append("worldFrom", pathDraft.worldFrom);
      if (pathDraft.worldTo) form.append("worldTo", pathDraft.worldTo);
      if (pathDraft.storyFromChapterId) form.append("storyFromChapterId", pathDraft.storyFromChapterId);
      if (pathDraft.storyToChapterId) form.append("storyToChapterId", pathDraft.storyToChapterId);
      if (pathDraft.relatedEventId) form.append("relatedEventId", pathDraft.relatedEventId);
      if (pathDraft.relatedEntityIds) form.append("relatedEntityIds", pathDraft.relatedEntityIds);

      const response = await fetch("/api/paths/create", { method: "POST", body: form });
      if (!response.ok) {
        let errorText = "";
        try {
          const data = await response.json();
          errorText = data?.error ? String(data.error) : JSON.stringify(data);
        } catch {
          errorText = await response.text();
        }
        console.error("Failed to create path:", errorText);
        addToast(errorText || "Failed to create path", "error");
        return;
      }

      setPathPoints([]);
      setMode("select");
      setPathDraft(createPathDraft());
      draftLayerRef.current?.clearLayers();
      router.refresh();
      addToast("Path created successfully", "success");
    } catch (error) {
      console.error("Error creating path:", error);
      addToast("Failed to create path", "error");
    }
  }

  async function submitPathUpdate({ includePolyline = false, exitEdit = false }: { includePolyline?: boolean; exitEdit?: boolean } = {}) {
    if (!selectedPathId) return;
    if (!workspaceId) {
      addToast("Workspace not found. Please reload and try again.", "error");
      return;
    }
    if (includePolyline && pathPoints.length < 2) {
      addToast("Please add at least 2 points to update the path", "info");
      return;
    }
    try {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("pathId", selectedPathId);
      form.append("arrowStyle", pathDraft.arrowStyle || "arrow");
      if (pathDraft.strokeColor) form.append("strokeColor", pathDraft.strokeColor);
      if (pathDraft.strokeWidth) form.append("strokeWidth", pathDraft.strokeWidth);
      if (pathDraft.markerStyleId) form.append("markerStyleId", pathDraft.markerStyleId);
      if (pathDraft.truthFlag) form.append("truthFlag", pathDraft.truthFlag);
      if (pathDraft.viewpointId) form.append("viewpointId", pathDraft.viewpointId);
      if (pathDraft.worldFrom) form.append("worldFrom", pathDraft.worldFrom);
      if (pathDraft.worldTo) form.append("worldTo", pathDraft.worldTo);
      if (pathDraft.storyFromChapterId) form.append("storyFromChapterId", pathDraft.storyFromChapterId);
      if (pathDraft.storyToChapterId) form.append("storyToChapterId", pathDraft.storyToChapterId);
      if (pathDraft.relatedEventId) form.append("relatedEventId", pathDraft.relatedEventId);
      if (pathDraft.relatedEntityIds) form.append("relatedEntityIds", pathDraft.relatedEntityIds);
      if (includePolyline) {
        form.append("polyline", JSON.stringify(pathPoints));
      }

      const response = await fetch("/api/paths/update", { method: "POST", body: form });
      if (!response.ok) {
        let errorText = "";
        try {
          const data = await response.json();
          errorText = data?.error ? String(data.error) : JSON.stringify(data);
        } catch {
          errorText = await response.text();
        }
        console.error("Failed to update path:", errorText);
        addToast(errorText || "Failed to update path", "error");
        return;
      }

      if (exitEdit) {
        setIsEditingPathPoints(false);
        setPathPoints([]);
        setMode("select");
        draftLayerRef.current?.clearLayers();
      }
      router.refresh();
      addToast("Path updated", "success");
    } catch (error) {
      console.error("Error updating path:", error);
      addToast("Failed to update path", "error");
    }
  }

  async function deletePath() {
    if (!selectedPathId) return;
    if (!workspaceId) {
      addToast("Workspace not found. Please reload and try again.", "error");
      return;
    }
    try {
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      form.append("pathId", selectedPathId);
      const response = await fetch("/api/paths/delete", { method: "POST", body: form });
      if (!response.ok) {
        let errorText = "";
        try {
          const data = await response.json();
          errorText = data?.error ? String(data.error) : JSON.stringify(data);
        } catch {
          errorText = await response.text();
        }
        console.error("Failed to delete path:", errorText);
        addToast(errorText || "Failed to delete path", "error");
        return;
      }
      setSelectedPathId("");
      setShowRightPanel(false);
      setIsEditingPathPoints(false);
      setPathPoints([]);
      router.refresh();
      addToast("Path deleted", "success");
    } catch (error) {
      console.error("Error deleting path:", error);
      addToast("Failed to delete path", "error");
    }
  }

  const handleEntityQueryChange = (value: string) => {
    const normalized = value.trim().toLowerCase();
    const match = safeEntities.find((entity) => entity.title.toLowerCase() === normalized);
    setPinDraft((prev) => ({
      ...prev,
      entityQuery: value,
      entityId: match ? match.id : ""
    }));
  };

  const clearPinSelection = useCallback(() => {
    setSelectedPinId("");
    setSelectedPinIds([]);
  }, []);

  const selectSinglePin = useCallback((pinId: string) => {
    setSelectedPinId(pinId);
    setSelectedPinIds([pinId]);
  }, []);

  const togglePinSelection = useCallback((pinId: string) => {
    setSelectedPinId(pinId);
    setSelectedPinIds((prev) => {
      if (prev.includes(pinId)) {
        return prev.filter((id) => id !== pinId);
      }
      return [...prev, pinId];
    });
  }, []);

  const filterPillClass = (active: boolean) =>
    `map-filter-pill ${active ? "is-active" : "is-inactive"}`;

  return (
    <div className="map-editor-root h-full min-h-0 w-full flex flex-col bg-bg overflow-hidden">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Top Toolbar - Figma style */}
      <header className="map-editor-header border-b border-border bg-panel px-4 py-3 flex flex-col gap-3 flex-shrink-0 z-50">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/maps" className="text-muted hover:text-ink transition-colors" title="Back to maps">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <div className="w-px h-6 bg-border" />
            <h1 className="font-bold text-ink text-sm">{map.title}</h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-bg border border-border rounded-lg p-1">
              <button
              onClick={() => {
                setMode("select");
                clearPinSelection();
                setShowRightPanel(false);
                setSelectedPathId("");
                setIsEditingPathPoints(false);
                draftLayerRef.current?.clearLayers();
              }}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                  mode === "select" ? "bg-accent text-white" : "text-muted hover:bg-bg-elevated"
                }`}
                title="Select/Move Mode (V)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                </svg>
                <span className="hidden sm:inline">Select</span>
              </button>
              <button
              onClick={() => {
                setMode("pin");
                clearPinSelection();
                setSelectedPathId("");
                setIsEditingPathPoints(false);
                setPathPoints([]);
                setPinDraft(createPinDraft());
              }}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                  mode === "pin" ? "bg-accent text-white" : "text-muted hover:bg-bg-elevated"
                }`}
                title="Place Pin Mode (P)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="hidden sm:inline">Pin</span>
              </button>
              <button
              onClick={() => {
                setMode("path");
                clearPinSelection();
                setSelectedPathId("");
                setIsEditingPathPoints(false);
                setPathPoints([]);
                setPathDraft(createPathDraft());
                setShowRightPanel(false);
              }}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                  mode === "path" ? "bg-accent text-white" : "text-muted hover:bg-bg-elevated"
                }`}
                title="Draw Path Mode (L)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M22 12c-4.5 0-4.5-8-9-8s-4.5 8-9 8" />
                </svg>
                <span className="hidden sm:inline">Path</span>
              </button>
              <button
              onClick={() => {
                setMode("card");
                clearPinSelection();
                setSelectedPathId("");
                setIsEditingPathPoints(false);
                setShowRightPanel(false);
                draftLayerRef.current?.clearLayers();
              }}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                  mode === "card" ? "bg-accent text-white" : "text-muted hover:bg-bg-elevated"
                }`}
                title="Place Card Mode (C)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <path d="M7 7h10M7 12h10M7 17h10" />
                </svg>
                <span className="hidden sm:inline">Card</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-bg border border-border rounded-lg p-1">
                <button
                  onClick={autoArrangeEvents}
                  className="px-2 py-1.5 text-muted hover:text-ink hover:bg-bg-elevated rounded transition-colors"
                  title="Auto-arrange events"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </button>
                <button
                  onClick={saveCardsToDatabase}
                  className="px-2 py-1.5 text-muted hover:text-ink hover:bg-bg-elevated rounded transition-colors"
                  title="Save cards (Ctrl+S)"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <svg className="animate-spin h-4 w-4 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                  )}
                </button>
              </div>
              {selectedPinIds.length > 1 && (
                <div className="flex items-center gap-1 bg-bg border border-border rounded-lg p-1">
                  <button
                    onClick={() => alignSelectedPins("x")}
                    className="px-2 py-1 text-muted hover:text-ink hover:bg-bg-elevated rounded transition-colors text-xs font-semibold"
                    title="Align vertical (same X)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <line x1="12" y1="4" x2="12" y2="20" />
                      <rect x="5" y="6" width="5" height="4" rx="1" />
                      <rect x="14" y="14" width="5" height="4" rx="1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => alignSelectedPins("y")}
                    className="px-2 py-1 text-muted hover:text-ink hover:bg-bg-elevated rounded transition-colors text-xs font-semibold"
                    title="Align horizontal (same Y)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <rect x="6" y="5" width="4" height="5" rx="1" />
                      <rect x="14" y="13" width="4" height="5" rx="1" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1 text-xs text-muted bg-bg border border-border rounded px-2 py-1">
                <button
                  onClick={() => mapRef.current?.zoomOut()}
                  className="px-1 py-0.5 hover:text-ink transition-colors"
                  title="Zoom Out"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </button>
                <span className="px-1 font-medium min-w-[3ch] text-center">{Math.round((zoomLevel + 2) * 50)}%</span>
                <button
                  onClick={() => mapRef.current?.zoomIn()}
                  className="px-1 py-0.5 hover:text-ink transition-colors"
                  title="Zoom In"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setShowLeftSidebar(!showLeftSidebar)}
                className="px-2 py-1.5 text-muted hover:text-ink hover:bg-bg-elevated rounded transition-colors"
                title="Toggle Sidebar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="map-filter-label">Scenes</span>
            <select
              value={selectedSceneId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedSceneId(nextId);
                const scene = scenes.find((s) => s.id === nextId);
                if (scene) {
                  applySceneState(scene);
                }
              }}
              className="bg-bg border border-border rounded-lg px-2 py-1 text-xs min-w-[160px]"
            >
              <option value="">Current view</option>
              {scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={saveSceneSnapshot}
              disabled={!selectedSceneId || sceneSaving}
            >
              Save snapshot
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (sceneFormOpen ? setSceneFormOpen(false) : openNewSceneForm())}
            >
              {sceneFormOpen ? "Close" : "New scene"}
            </Button>
          </div>
          {selectedScene && (
            <span className="text-xs text-muted">
              {selectedScene.description ? selectedScene.description : "No description"}
            </span>
          )}
        </div>

        {sceneFormOpen && (
          <div className="rounded-xl border border-border bg-bg/70 px-3 py-3 flex flex-wrap gap-3">
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="map-filter-label">Name</label>
              <input
                value={sceneForm.name}
                onChange={(e) => setSceneForm((prev) => ({ ...prev, name: e.target.value }))}
                className="bg-bg border border-border rounded-lg px-2 py-1 text-xs"
                placeholder="Scene name"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[200px] flex-1">
              <label className="map-filter-label">Description</label>
              <input
                value={sceneForm.description}
                onChange={(e) => setSceneForm((prev) => ({ ...prev, description: e.target.value }))}
                className="bg-bg border border-border rounded-lg px-2 py-1 text-xs"
                placeholder="Optional note"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="map-filter-label">Era</label>
              <select
                value={sceneForm.eraId}
                onChange={(e) => setSceneForm((prev) => ({ ...prev, eraId: e.target.value }))}
                className="bg-bg border border-border rounded-lg px-2 py-1 text-xs"
              >
                <option value="">Any</option>
                {eras.map((era) => (
                  <option key={era.id} value={era.id}>{era.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="map-filter-label">Chapter</label>
              <select
                value={sceneForm.chapterId}
                onChange={(e) => setSceneForm((prev) => ({ ...prev, chapterId: e.target.value }))}
                className="bg-bg border border-border rounded-lg px-2 py-1 text-xs"
              >
                <option value="">Any</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>{chapter.orderIndex}. {chapter.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="map-filter-label">Viewpoint</label>
              <select
                value={sceneForm.viewpointId}
                onChange={(e) => setSceneForm((prev) => ({ ...prev, viewpointId: e.target.value }))}
                className="bg-bg border border-border rounded-lg px-2 py-1 text-xs"
              >
                <option value="">Any</option>
                {viewpoints.map((vp) => (
                  <option key={vp.id} value={vp.id}>{vp.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button size="sm" onClick={createScene} disabled={sceneSaving}>
                Create
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className={`flex-1 rounded-xl border border-border bg-bg/70 px-3 ${filtersExpanded ? "py-2 space-y-2" : "py-1.5"}`}>
            {filtersExpanded ? (
              <>
                <div className="space-y-2">
                  <div className="map-filter-label">Layers</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={filterPillClass(showImage)}>
                      <input type="checkbox" className="sr-only" checked={showImage} onChange={(e) => setShowImage(e.target.checked)} />
                      Map Image
                    </label>
                    <label className={filterPillClass(showPins)}>
                      <input type="checkbox" className="sr-only" checked={showPins} onChange={(e) => setShowPins(e.target.checked)} />
                      Pins ({visiblePins.length})
                    </label>
                    <label className={filterPillClass(showPaths)}>
                      <input type="checkbox" className="sr-only" checked={showPaths} onChange={(e) => setShowPaths(e.target.checked)} />
                      Paths ({visiblePaths.length})
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="map-filter-label">Location Types</div>
                  <div className="flex flex-wrap items-center gap-2 max-h-24 overflow-y-auto pr-1">
                    {locationTypes.map((type) => {
                      const active = !hiddenLocationTypes.has(type);
                      return (
                        <label key={type} className={filterPillClass(active)}>
                          <input type="checkbox" className="sr-only" checked={active} onChange={() => toggleLocationType(type)} />
                          <span className="capitalize">{type}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Filters</span>
                  <span className="text-[11px]">
                    Layers {Number(showImage) + Number(showPins) + Number(showPaths)}/3 ・ Types {locationTypes.length - hiddenLocationTypes.size}/{locationTypes.length}
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setFiltersExpanded((prev) => !prev)}
            className="px-2 py-1 rounded-lg border border-border bg-bg text-[10px] font-semibold uppercase tracking-[0.2em] text-muted hover:text-ink hover:border-accent transition-colors leading-none"
            title="Toggle filter layout"
          >
            {filtersExpanded ? "2段" : "1段"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        {showLeftSidebar && (
          <aside className="w-64 border-r border-border bg-panel flex flex-col flex-shrink-0 overflow-hidden min-h-0">
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="p-4 border-b border-border flex-shrink-0">
                <h3 className="text-xs font-bold uppercase text-muted mb-2">Entities</h3>
                <p className="text-xs text-muted mb-3">Drag onto map to create pins</p>
                <div className="grid gap-2">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted">Type</label>
                    <select
                      value={entityTypeFilter}
                      onChange={(e) => setEntityTypeFilter(e.target.value)}
                      className="w-full mt-1"
                    >
                      <option value="all">All types</option>
                      {entityTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted">Genre</label>
                    <select
                      value={entityGenreFilter}
                      onChange={(e) => setEntityGenreFilter(e.target.value)}
                      className="w-full mt-1"
                      disabled={entityGenreOptions.length === 0}
                    >
                      <option value="all">All genres</option>
                      {entityGenreOptions.map((genre) => (
                        <option key={genre} value={genre}>
                          {genre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-auto p-4">
                <div className="space-y-1">
                  {filteredEntities.map((entity) => (
                  <div
                    key={entity.id}
                    className="p-2 bg-bg rounded border border-border hover:border-accent transition-colors cursor-move text-sm group"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("type", "entity");
                      e.dataTransfer.setData("id", entity.id);
                      e.dataTransfer.setData("title", entity.title);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted capitalize">{entity.type}</span>
                      <span className="text-ink group-hover:text-accent transition-colors flex-1 truncate">{entity.title}</span>
                    </div>
                  </div>
                  ))}
                  {filteredEntities.length === 0 && (
                    <p className="text-xs text-muted italic">No entities match the current filters</p>
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Main Canvas */}
          <main className="flex-1 min-w-0 relative bg-bg-elevated overflow-hidden">
            <div
              ref={containerRef}
              className="absolute inset-0 w-full h-full"
              style={{
                cursor: mode === "path" ? "crosshair" : mode === "pin" ? "crosshair" : "default",
                width: "100%",
                height: "100%"
              }}
            />

          {/* Mode indicator */}
          <div className="map-mode-indicator absolute bottom-4 right-4 bg-panel border border-border rounded-lg px-3 py-2 text-xs font-medium text-ink shadow-lg pointer-events-none z-10">
            {mode === "select" && "Select Mode (V) - Click pins to edit, drag to move"}
            {mode === "pin" && "Pin Mode (P) - Click on map to place a pin"}
            {mode === "path" && `Path Mode (L) - ${pathPoints.length} point${pathPoints.length !== 1 ? "s" : ""} ${pathPoints.length < 2 ? "(need 2+ to create)" : "ready"}`}
            {mode === "card" && "Card Mode (C) - Drag entities onto map to create cards"}
          </div>

          {/* Evidence Cards Layer */}
          <div className="map-cards-layer">
            <svg className="card-connections-svg" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              <defs>
                <marker id="arrowhead-timeline" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#f39c12" />
                </marker>
                <marker id="arrowhead-causal" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#e74c3c" />
                </marker>
              </defs>
              {cardConnections.map((conn) => {
                const fromCard = mapCards.find((c) => c.id === conn.fromCardId);
                const toCard = mapCards.find((c) => c.id === conn.toCardId);
                if (!fromCard || !toCard) return null;
                return (
                  <line
                    key={conn.id}
                    x1={fromCard.x}
                    y1={fromCard.y}
                    x2={toCard.x}
                    y2={toCard.y}
                    className={`connection-line ${conn.type}`}
                    stroke={conn.type === "timeline" ? "#f39c12" : conn.type === "causal" ? "#e74c3c" : "#95a5a6"}
                    strokeWidth={conn.type === "timeline" ? 3 : 2}
                    strokeDasharray={conn.type === "reference" ? "5,5" : "none"}
                    markerEnd={conn.type === "causal" ? "url(#arrowhead-causal)" : conn.type === "timeline" ? "url(#arrowhead-timeline)" : "none"}
                  />
                );
              })}
            </svg>

            {mapCards.map((card) => (
              <div
                key={card.id}
                className={`evidence-card-on-map ${connectingFromCardId === card.id ? "connecting-from" : ""} ${connectingFromCardId && connectingFromCardId !== card.id ? "connectable" : ""} ${draggingCardId === card.id ? "dragging" : ""}`}
                style={{
                  position: "absolute",
                  left: `${card.x}px`,
                  top: `${card.y}px`,
                  transform: "translate(-50%, -50%)"
                }}
                onMouseDown={(e) => handleCardMouseDown(e, card)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (connectingFromCardId) {
                    if (connectingFromCardId !== card.id) {
                      const newConnection = {
                        id: `conn-${Date.now()}`,
                        fromCardId: connectingFromCardId,
                        toCardId: card.id,
                        type: "timeline" as const
                      };
                      setCardConnections((prev) => [...prev, newConnection]);
                    }
                    setConnectingFromCardId(null);
                  }
                }}
              >
                <div className={`card-header type-${card.type}`}>
                  <span className="card-icon">
                    {card.type === "entity" && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                    {card.type === "article" && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    )}
                    {card.type === "event" && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    )}
                    {card.type === "note" && (
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

            {connectingFromCardId && (
              <div className="connection-hint-overlay">
                Click another card to connect (timeline)
                <button onClick={() => setConnectingFromCardId(null)} className="cancel-connection-btn">
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="map-legend floating">
            <strong>Legend</strong>
            {markerStyles.map((style) => (
              <div key={style.id} className="legend-row">
                <span className={`marker-shape marker-${style.shape}`} style={{ "--marker-color": style.color, backgroundColor: style.color } as CSSProperties} />
                <span>{style.name}</span>
              </div>
            ))}
          </div>
        </main>

        {/* Right Properties Panel */}
        {showRightPanel && selectedPathId && (
          <aside className="w-80 border-l border-border bg-panel flex flex-col flex-shrink-0 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-ink">Edit Path</h3>
              <button
                onClick={() => {
                  setShowRightPanel(false);
                  setSelectedPathId("");
                  setIsEditingPathPoints(false);
                  setPathDraft(createPathDraft());
                }}
                className="text-muted hover:text-ink transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="bg-bg border border-border rounded-lg p-3 text-xs text-muted">
                {selectedPath?.polyline?.length ? `${selectedPath.polyline.length} points` : "No points yet"}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted tracking-wider">Line Style</label>
                <select
                  className="w-full bg-bg border border-border rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                  value={pathDraft.arrowStyle}
                  onChange={(e) => setPathDraft({ ...pathDraft, arrowStyle: e.target.value })}
                >
                  <option value="arrow">Solid with Arrow</option>
                  <option value="dashed">Dashed Line</option>
                  <option value="dotted">Dotted Line</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-muted tracking-wider">Stroke Color</label>
                  <div className="grid grid-cols-[1fr_auto] gap-2 items-center mt-1">
                    <input
                      type="color"
                      value={pathDraft.strokeColor || "#1f4b99"}
                      onChange={(e) => setPathDraft({ ...pathDraft, strokeColor: e.target.value })}
                      className="w-full h-9 bg-bg border border-border rounded-lg px-2"
                    />
                    <button
                      type="button"
                      onClick={() => setPathDraft({ ...pathDraft, strokeColor: "" })}
                      className="text-xs px-2 py-2 rounded-lg border border-border text-muted hover:text-ink hover:border-accent transition-colors"
                      title="Reset to default"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted tracking-wider">Stroke Width</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={pathDraft.strokeWidth}
                    onChange={(e) => setPathDraft({ ...pathDraft, strokeWidth: e.target.value })}
                    className="w-full bg-bg border border-border rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-accent mt-1"
                    placeholder="3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted mb-1">Truth Status</label>
                  <select
                    className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                    value={pathDraft.truthFlag}
                    onChange={(e) => setPathDraft({ ...pathDraft, truthFlag: e.target.value })}
                  >
                    <option value="canonical">Canonical</option>
                    <option value="rumor">Rumor</option>
                    <option value="belief">Belief</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted mb-1">Viewpoint</label>
                  <select
                    className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                    value={pathDraft.viewpointId}
                    onChange={(e) => setPathDraft({ ...pathDraft, viewpointId: e.target.value })}
                  >
                    <option value="">Global / Canon</option>
                    {viewpoints.map((vp) => (
                      <option key={vp.id} value={vp.id}>{vp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted mb-1">Start (World Time)</label>
                  <input
                    className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                    placeholder="e.g. 1000"
                    value={pathDraft.worldFrom}
                    onChange={(e) => setPathDraft({ ...pathDraft, worldFrom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted mb-1">End (World Time)</label>
                  <input
                    className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                    placeholder="e.g. 1200"
                    value={pathDraft.worldTo}
                    onChange={(e) => setPathDraft({ ...pathDraft, worldTo: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted mb-1">From Chapter</label>
                  <select
                    className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                    value={pathDraft.storyFromChapterId}
                    onChange={(e) => setPathDraft({ ...pathDraft, storyFromChapterId: e.target.value })}
                  >
                    <option value="">Start</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>{c.orderIndex}. {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted mb-1">To Chapter</label>
                  <select
                    className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                    value={pathDraft.storyToChapterId}
                    onChange={(e) => setPathDraft({ ...pathDraft, storyToChapterId: e.target.value })}
                  >
                    <option value="">End</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>{c.orderIndex}. {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-muted mb-1">Related Event</label>
                <select
                  className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                  value={pathDraft.relatedEventId}
                  onChange={(e) => setPathDraft({ ...pathDraft, relatedEventId: e.target.value })}
                >
                  <option value="">None</option>
                  {(map.events ?? []).map((event) => (
                    <option key={event.id} value={event.id}>{event.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-border flex flex-col gap-2 flex-shrink-0">
              <Button
                onClick={() => {
                  if (!selectedPath?.polyline?.length) {
                    addToast("This path has no points to edit.", "info");
                    return;
                  }
                  setPathPoints(selectedPath.polyline.map((pt) => ({ x: pt.x, y: pt.y })));
                  setIsEditingPathPoints(true);
                  setMode("path");
                  setShowRightPanel(false);
                }}
                variant="outline"
              >
                Edit Points
              </Button>
              <div className="flex gap-2">
                <Button onClick={() => submitPathUpdate()} className="flex-1">Save Path</Button>
                <Button variant="danger" onClick={deletePath} title="Delete Path">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </Button>
              </div>
            </div>
          </aside>
        )}

        {showRightPanel && !selectedPathId && (selectedPinId || (mode === "pin" && pinDraft.x !== null)) && (
          <aside className="w-80 border-l border-border bg-panel flex flex-col flex-shrink-0 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-ink">{selectedPinId ? "Edit Pin" : "New Pin"}</h3>
              <button
                onClick={() => {
                  setShowRightPanel(false);
                  clearPinSelection();
                  setSelectedPathId("");
                  setIsEditingPathPoints(false);
                  setPathPoints([]);
                  setPinDraft(createPinDraft());
                  draftLayerRef.current?.clearLayers();
                }}
                className="text-muted hover:text-ink transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-muted mb-2">Label *</label>
                <input
                  type="text"
                  value={pinDraft.label}
                  onChange={(e) => {
                    setPinDraft({ ...pinDraft, label: e.target.value });
                    if (errors.label) setErrors({ ...errors, label: false });
                  }}
                  className={`w-full bg-bg border rounded-lg px-3 py-2 text-sm outline-none transition-colors ${
                    errors.label ? "border-red-500 ring-1 ring-red-500" : "border-border focus:border-accent"
                  }`}
                  placeholder="Enter location name..."
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-muted mb-2">X Coordinate</label>
                  <input
                    type="text"
                    value={pinDraft.x ?? ""}
                    readOnly
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm opacity-60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-muted mb-2">Y Coordinate</label>
                  <input
                    type="text"
                    value={pinDraft.y ?? ""}
                    readOnly
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-muted mb-2">Type</label>
                <select
                  value={pinDraft.locationType}
                  onChange={(e) => setPinDraft({ ...pinDraft, locationType: e.target.value })}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent capitalize transition-colors"
                >
                  {locationTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-muted mb-2">Marker Style</label>
                <select
                  value={pinDraft.markerStyleId}
                  onChange={(e) => setPinDraft({ ...pinDraft, markerStyleId: e.target.value })}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                >
                  <option value="">Default</option>
                  {markerStyles.filter(s => s.target !== 'path').map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-muted mb-2">Marker Color</label>
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <input
                    type="color"
                    value={pinDraft.markerColor || "#1f4b99"}
                    onChange={(e) => setPinDraft({ ...pinDraft, markerColor: e.target.value })}
                    className="w-full h-10 bg-bg border border-border rounded-lg px-2"
                  />
                  <button
                    type="button"
                    onClick={() => setPinDraft({ ...pinDraft, markerColor: "" })}
                    className="text-xs px-2 py-2 rounded-lg border border-border text-muted hover:text-ink hover:border-accent transition-colors"
                    title="Reset to default"
                  >
                    Reset
                  </button>
                </div>
                <p className="text-[10px] text-muted mt-1">Leave default to use the style color.</p>
              </div>

              <div className="border-t border-border pt-4">
                <details className="group">
                  <summary className="text-xs font-bold uppercase text-muted mb-3 cursor-pointer flex items-center gap-2">
                    Advanced Settings
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 transition-transform group-open:rotate-180">
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>

                  <div className="space-y-4 pb-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted mb-1">Truth Status</label>
                        <select
                          className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                          value={pinDraft.truthFlag}
                          onChange={(e) => setPinDraft({ ...pinDraft, truthFlag: e.target.value })}
                        >
                          <option value="canonical">Canonical</option>
                          <option value="rumor">Rumor</option>
                          <option value="belief">Belief</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted mb-1">Viewpoint</label>
                        <select
                          className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                          value={pinDraft.viewpointId}
                          onChange={(e) => setPinDraft({ ...pinDraft, viewpointId: e.target.value })}
                        >
                          <option value="">Global / Canon</option>
                          {viewpoints.map((vp) => (
                            <option key={vp.id} value={vp.id}>{vp.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted mb-1">Start (World Time)</label>
                        <input
                          className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                          placeholder="e.g. 1000"
                          value={pinDraft.worldFrom}
                          onChange={(e) => setPinDraft({ ...pinDraft, worldFrom: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted mb-1">End (World Time)</label>
                        <input
                          className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                          placeholder="e.g. 1200"
                          value={pinDraft.worldTo}
                          onChange={(e) => setPinDraft({ ...pinDraft, worldTo: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted mb-1">From Chapter</label>
                        <select
                          className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                          value={pinDraft.storyFromChapterId}
                          onChange={(e) => setPinDraft({ ...pinDraft, storyFromChapterId: e.target.value })}
                        >
                          <option value="">Start</option>
                          {chapters.map((c) => (
                            <option key={c.id} value={c.id}>{c.orderIndex}. {c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted mb-1">To Chapter</label>
                        <select
                          className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent transition-colors"
                          value={pinDraft.storyToChapterId}
                          onChange={(e) => setPinDraft({ ...pinDraft, storyToChapterId: e.target.value })}
                        >
                          <option value="">End</option>
                          {chapters.map((c) => (
                            <option key={c.id} value={c.id}>{c.orderIndex}. {c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </details>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-muted mb-2">Linked Entity (Optional)</label>
                <input
                  type="text"
                  value={pinDraft.entityQuery}
                  onChange={(e) => handleEntityQueryChange(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                  placeholder="Type entity name..."
                  list="entity-search"
                />
                <datalist id="entity-search">
                  {safeEntities.map((entity) => (
                    <option key={entity.id} value={entity.title} />
                  ))}
                </datalist>
                {pinDraft.entityQuery && !pinDraft.entityId && (
                  <p className="text-xs text-muted mt-1">Type to search, or leave blank</p>
                )}
                {pinDraft.entityId && (
                  <p className="text-xs text-accent mt-1">Linked to entity</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border flex-shrink-0">
              {selectedPinId ? (
                <div className="flex gap-2">
                  <Button onClick={submitPinUpdate} className="flex-1">Save Changes</Button>
                  <Button variant="danger" onClick={deletePin} title="Delete Pin">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </Button>
                </div>
              ) : (
                <Button onClick={submitPin} disabled={pinDraft.x === null || !pinDraft.label.trim()} className="w-full">
                  Create Pin
                </Button>
              )}
            </div>
          </aside>
        )}
        {/* Path panel */}
        {mode === "path" && pathPoints.length > 0 && !showRightPanel && (
          <aside className="w-80 border-l border-border bg-panel flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-ink">{isEditingPathPoints ? "Edit Path" : "Draw Path"}</h3>
              <button
                onClick={() => {
                  setPathPoints([]);
                  setMode("select");
                  setIsEditingPathPoints(false);
                  draftLayerRef.current?.clearLayers();
                }}
                className="text-muted hover:text-ink transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="bg-bg border border-border rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted">Points:</span>
                  <span className="text-accent font-bold">{pathPoints.length}</span>
                </div>
                {pathPoints.length < 2 && (
                  <p className="text-xs text-muted">Click on the map to add more points (minimum 2 required)</p>
                )}
                {pathPoints.length >= 2 && (
                  <p className="text-xs text-accent">Ready to create path</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted tracking-wider">Line Style</label>
                <select
                  className="w-full bg-bg border border-border rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                  value={pathDraft.arrowStyle}
                  onChange={(e) => setPathDraft({ ...pathDraft, arrowStyle: e.target.value })}
                >
                  <option value="arrow">Solid with Arrow</option>
                  <option value="dashed">Dashed Line</option>
                  <option value="dotted">Dotted Line</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-muted tracking-wider">Stroke Color</label>
                  <div className="grid grid-cols-[1fr_auto] gap-2 items-center mt-1">
                    <input
                      type="color"
                      value={pathDraft.strokeColor || "#1f4b99"}
                      onChange={(e) => setPathDraft({ ...pathDraft, strokeColor: e.target.value })}
                      className="w-full h-9 bg-bg border border-border rounded-lg px-2"
                    />
                    <button
                      type="button"
                      onClick={() => setPathDraft({ ...pathDraft, strokeColor: "" })}
                      className="text-xs px-2 py-2 rounded-lg border border-border text-muted hover:text-ink hover:border-accent transition-colors"
                      title="Reset to default"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted tracking-wider">Stroke Width</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={pathDraft.strokeWidth}
                    onChange={(e) => setPathDraft({ ...pathDraft, strokeWidth: e.target.value })}
                    className="w-full bg-bg border border-border rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-accent mt-1"
                    placeholder="3"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pathPoints.map((pt, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-bg-elevated p-2 rounded">
                    <span className="text-muted">Point {idx + 1}:</span>
                    <span className="text-ink font-mono">({pt.x}, {pt.y})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-border space-y-3">
              <label className="flex items-center justify-between text-xs font-semibold text-muted">
                <span>Show step numbers</span>
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={showPathOrder}
                  onChange={(e) => handlePathOrderToggle(e.target.checked)}
                />
              </label>
              <Button
                onClick={submitPath}
                disabled={pathPoints.length < 2}
                className="w-full"
              >
                {isEditingPathPoints ? "Update Path" : "Create Path"} ({pathPoints.length} points)
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPathPoints((prev) => prev.slice(0, -1));
                  draftLayerRef.current?.clearLayers();
                }}
                disabled={pathPoints.length === 0}
                className="w-full"
              >
                Undo Last Point
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPathPoints([]);
                  draftLayerRef.current?.clearLayers();
                }}
                className="w-full"
              >
                Clear Points
              </Button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

