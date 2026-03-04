import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/layout/Layout";
import { ProjectsPage } from "./pages/ProjectsPage";
import { PromptsPage } from "./pages/PromptsPage";
import { FlowsPage } from "./pages/FlowsPage";
import { FlowDesignerPage } from "./pages/FlowDesignerPage";
import { ModelsPage } from "./pages/ModelsPage";
import { TracesPage } from "./pages/TracesPage";
import { TraceDetailPage } from "./pages/TraceDetailPage";
import { DatasetsPage } from "./pages/DatasetsPage";
import { DatasetDetailPage } from "./pages/DatasetDetailPage";
import { EvalRunsPage } from "./pages/EvalRunsPage";
import { EvalRunDetailPage } from "./pages/EvalRunDetailPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<ProjectsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="prompts" element={<PromptsPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="flows" element={<FlowsPage />} />
            <Route path="flows/:flowId" element={<FlowDesignerPage />} />
            <Route path="traces" element={<TracesPage />} />
            <Route path="traces/:traceId" element={<TraceDetailPage />} />
            <Route path="datasets" element={<DatasetsPage />} />
            <Route path="datasets/:datasetId" element={<DatasetDetailPage />} />
            <Route path="evaluations" element={<EvalRunsPage />} />
            <Route path="evaluations/:runId" element={<EvalRunDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
