import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/react";
import { setExtraHeadersProvider } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export interface WorkspaceSummary {
  id: number;
  name: string;
  isPersonal: boolean;
  requireApproval: boolean;
  role: WorkspaceRole;
}

interface WorkspaceContextValue {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: number | null;
  activeWorkspace: WorkspaceSummary | null;
  isLoading: boolean;
  switchWorkspace: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
  createWorkspace: (name: string) => Promise<WorkspaceSummary>;
}

const Ctx = createContext<WorkspaceContextValue | null>(null);

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function hasRoleAtLeast(role: WorkspaceRole | null | undefined, min: WorkspaceRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

let _activeIdRef: number | null = null;

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const qc = useQueryClient();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Keep header provider always installed; when no active workspace, returns nothing.
  useEffect(() => {
    setExtraHeadersProvider(() =>
      _activeIdRef ? { "X-Workspace-Id": String(_activeIdRef) } : null,
    );
    return () => setExtraHeadersProvider(null);
  }, []);

  const fetchWith = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getToken().catch(() => null);
      return fetch(path, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(_activeIdRef ? { "X-Workspace-Id": String(_activeIdRef) } : {}),
        },
      });
    },
    [getToken],
  );

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    setIsLoading(true);
    try {
      const res = await fetchWith("/api/workspaces");
      if (!res.ok) return;
      const data = await res.json();
      const list: WorkspaceSummary[] = data.workspaces ?? [];
      setWorkspaces(list);
      const incoming = data.activeWorkspaceId ?? list[0]?.id ?? null;
      _activeIdRef = incoming;
      setActiveId(incoming);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, fetchWith]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void refresh();
  }, [isLoaded, isSignedIn, refresh]);

  const switchWorkspace = useCallback(
    async (id: number) => {
      const res = await fetchWith("/api/workspaces/switch", {
        method: "POST",
        body: JSON.stringify({ workspaceId: id }),
      });
      if (!res.ok) throw new Error("Failed to switch workspace");
      _activeIdRef = id;
      setActiveId(id);
      qc.clear();
    },
    [fetchWith, qc],
  );

  const createWorkspace = useCallback(
    async (name: string): Promise<WorkspaceSummary> => {
      const res = await fetchWith("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to create workspace");
      }
      const ws = await res.json();
      const summary: WorkspaceSummary = {
        id: ws.id,
        name: ws.name,
        isPersonal: !!ws.isPersonal,
        requireApproval: false,
        role: "owner",
      };
      setWorkspaces((prev) => [...prev, summary]);
      await switchWorkspace(ws.id);
      return summary;
    },
    [fetchWith, switchWorkspace],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspaceId: activeId,
      activeWorkspace: workspaces.find((w) => w.id === activeId) ?? null,
      isLoading,
      switchWorkspace,
      refresh,
      createWorkspace,
    }),
    [workspaces, activeId, isLoading, switchWorkspace, refresh, createWorkspace],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return v;
}
