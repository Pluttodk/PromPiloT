import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProjectStore {
  currentProjectId: string | null;
  setCurrentProject: (projectId: string | null) => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      currentProjectId: null,
      setCurrentProject: (projectId) => set({ currentProjectId: projectId }),
    }),
    {
      name: "prom-pilot-project",
    }
  )
);
