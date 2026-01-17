"use client";

import { createContext, useContext, ReactNode } from 'react';

interface WorkspaceContextType {
  workspaceId: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaceId: null
});

export function WorkspaceProvider({
  children,
  workspaceId
}: {
  children: ReactNode;
  workspaceId: string | null;
}) {
  return (
    <WorkspaceContext.Provider value={{ workspaceId }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
