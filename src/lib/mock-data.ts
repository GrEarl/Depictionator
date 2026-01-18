// Mock data for development mode (when DB is not available)

export const MOCK_USER = {
  id: "mock-user-1",
  email: "demo@depictionator.local",
  name: "Demo User",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const MOCK_WORKSPACE = {
  id: "mock-workspace-1",
  name: "Demo Workspace",
  slug: "demo-workspace",
  description: "A demo workspace for UI testing",
  ownerId: MOCK_USER.id,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const MOCK_SESSION = {
  id: "mock-session-1",
  userId: MOCK_USER.id,
  activeWorkspaceId: MOCK_WORKSPACE.id,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  user: MOCK_USER,
  workspace: MOCK_WORKSPACE,
};

export const MOCK_WORKSPACE_MEMBER = {
  id: "mock-member-1",
  userId: MOCK_USER.id,
  workspaceId: MOCK_WORKSPACE.id,
  role: "admin" as const,
  createdAt: new Date("2024-01-01"),
  user: MOCK_USER,
  workspace: MOCK_WORKSPACE,
};

export const isDevelopmentMode = () => {
  return process.env.DEV_SKIP_DB === "true";
};
