"use client";

import type { ComponentProps } from "react";
import { MapEditor } from "@/components/MapEditor";

type MapEditorClientProps = ComponentProps<typeof MapEditor>;

export function MapEditorClient(props: MapEditorClientProps) {
  return <MapEditor {...props} />;
}
