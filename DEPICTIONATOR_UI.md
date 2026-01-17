# Depictionator UI System

## Layout Philosophy
The application uses a **3-Pane Master-Detail Layout** for its core content types (Articles, Maps, Timeline).

### Grid Structure
- **Pane 1 (Left):** Context & Navigation (Width: 280px)
  - Lists entities, maps, or timelines.
  - Contains local search and filters.
- **Pane 2 (Center):** Main Content (Width: 1fr - Fluid)
  - The canvas, article reader, or timeline visualization.
  - Should handle its own internal scrolling.
- **Pane 3 (Right):** Inspector & Actions (Width: 320px)
  - Metadata, editing forms, details, and secondary actions.
  - Collapsible or context-sensitive.

### Global State
- **Filters:** Era, Chapter, Viewpoint, and Mode are controlled globally via the top bar.
- **URL Sync:** All filters sync to URL search params to ensure shareability and refresh-safety.

## Component Guide

### `ArticleList`
- Shared server component for rendering the entity list sidebar.
- Supports search highlighting and unread indicators.

### `ArticleDetail`
- Renders the "Read", "Edit", "History", and "Relations" views.
- Slots directly into Pane 2 and Pane 3 of the global grid.

### `MapEditor`
- A full-screen canvas in Pane 2.
- Uses a floating toolbar for interaction.
- Inspector renders in Pane 3 (or floating overlay).

### `VisualTimeline`
- Renders swimlanes in Pane 2.
- Uses Pane 3 for creating new events.
