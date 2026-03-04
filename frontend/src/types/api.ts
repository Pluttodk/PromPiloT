export interface Project {
  project_id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
}

export interface LLMConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

export interface Prompt {
  prompt_id: string;
  project_id: string;
  name: string;
  description: string;
  template: string;
  llm_config: LLMConfig;
  created_by: string;
  created_at: string;
  updated_at: string;
  production_version: number | null;
  latest_version: number;
}

export interface PromptVersion {
  version_number: number;
  template: string;
  tags: string[];
  created_at: string;
  created_by: string;
}

export interface PromptCreate {
  name: string;
  description?: string;
  template: string;
  llm_config?: LLMConfig;
}

export interface PromptUpdate {
  name?: string;
  description?: string;
  template?: string;
  llm_config?: LLMConfig;
}

export interface Message {
  message: string;
}

export interface ErrorResponse {
  detail: string;
}

// Flow Types
export interface FlowNodePosition {
  x: number;
  y: number;
}

export interface FlowNodeData {
  name?: string;
  label?: string;
  model_config_id?: string;

  // System prompt configuration
  system_prompt_source?: 'prompt' | 'connection' | 'none';
  system_prompt_id?: string;
  systemPromptName?: string;

  // User input configuration
  user_input_source?: 'prompt' | 'connection' | 'none';
  user_input_prompt_id?: string;
  userInputPromptName?: string;

  // Computed variables from prompts (for rendering handles)
  system_prompt_variables?: string[];
  user_input_variables?: string[];

  // Display names for models
  modelName?: string;
  promptName?: string;

  // Legacy field - being replaced by system_prompt_id/user_input_prompt_id
  prompt_id?: string;
}

export interface FlowNode {
  id: string;
  type: string;
  data: FlowNodeData;
  position: FlowNodePosition;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface Flow {
  flow_id: string;
  project_id: string;
  name: string;
  description: string;
  definition: FlowDefinition;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FlowCreate {
  name: string;
  description?: string;
  definition?: FlowDefinition;
}

export interface FlowUpdate {
  name?: string;
  description?: string;
  definition?: FlowDefinition;
}

export interface ModelConfig {
  endpoint?: string;
  model?: string;
  api_version?: string;
  api_key?: string;
}

export interface FlowExecuteRequest {
  inputs: Record<string, unknown>;
  model_config?: ModelConfig;
}

export interface FlowExecuteResponse {
  trace_id: string;
  outputs: Record<string, unknown>;
  execution_time_ms: number;
  node_results: Record<string, unknown>;
}

// Model Configuration Types (Project-level)
export interface ModelConfigResponse {
  model_config_id: string;
  project_id: string;
  name: string;
  provider: string;
  endpoint: string;
  deployment_name: string;
  api_version: string;
  auth_method: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ModelConfigCreate {
  name: string;
  provider?: string;
  endpoint: string;
  deployment_name: string;
  api_version?: string;
  auth_method?: string;
}

export interface ModelConfigUpdate {
  name?: string;
  provider?: string;
  endpoint?: string;
  deployment_name?: string;
  api_version?: string;
  auth_method?: string;
}

export interface ModelTestRequest {
  prompt: string;
  system_prompt?: string;
}

export interface ModelTestResponse {
  response: string;
  execution_time_ms: number;
}

// Trace Types
export interface TraceNodeResult {
  node_id: string;
  node_type: string;
  name?: string;
  prompt_id?: string;
  model_config_id?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  tokens_used?: number;
  execution_time_ms?: number;
  error?: string;
}

export interface TraceResponse {
  trace_id: string;
  project_id: string;
  flow_id: string;
  flow_name: string;
  status: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  node_traces: TraceNodeResult[];
  total_tokens?: number;
  execution_time_ms: number;
  error_message?: string;
  created_at: string;
}

export interface TraceListResponse {
  trace_id: string;
  project_id: string;
  flow_id: string;
  flow_name: string;
  status: string;
  total_tokens?: number;
  execution_time_ms?: number;
  error_message?: string;
  created_at: string;
  eval_run_id?: string | null;
  score_count: number;
}

// Evaluation / Score Types

export interface ScoreCreate {
  trace_id: string;
  name: string;
  score_type: 'numeric' | 'boolean' | 'categorical';
  value_numeric?: number | null;
  value_boolean?: boolean | null;
  value_label?: string | null;
  comment?: string | null;
}

export interface ScoreResponse {
  score_id: string;
  project_id: string;
  trace_id: string;
  name: string;
  score_type: 'numeric' | 'boolean' | 'categorical';
  value_numeric?: number | null;
  value_boolean?: boolean | null;
  value_label?: string | null;
  scorer_type: 'human' | 'llm';
  scorer_id: string;
  comment?: string | null;
  created_at: string;
}

export interface LLMJudgeRequest {
  trace_id: string;
  criteria: string;
  score_name?: string;
  score_type?: 'numeric' | 'boolean' | 'categorical';
  model_config_id?: string | null;
}

export interface LLMJudgeResponse {
  score: ScoreResponse;
  reasoning: string;
}

export interface DatasetCreate {
  name: string;
  description?: string;
}

export interface DatasetResponse {
  dataset_id: string;
  project_id: string;
  name: string;
  description: string;
  item_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DatasetItemCreate {
  input: string;
  expected_output?: string | null;
  notes?: string | null;
}

export interface DatasetItemFromTrace {
  trace_id: string;
  expected_output?: string | null;
  notes?: string | null;
}

export interface DatasetItemResponse {
  item_id: string;
  dataset_id: string;
  input: string;
  expected_output?: string | null;
  source_trace_id?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface DatasetCsvUploadResponse {
  created: number;
  skipped: number;
  truncated: number;
}

export interface EvalRunCreate {
  name: string;
  dataset_id: string;
  flow_id: string;
  auto_score?: boolean;
  judge_criteria?: string | null;
  judge_model_config_id?: string | null;
  item_limit?: number | null;
}

export interface EvalRunResponse {
  run_id: string;
  project_id: string;
  name: string;
  dataset_id: string;
  dataset_name: string;
  flow_id: string;
  flow_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_items: number;
  completed_items: number;
  failed_items: number;
  auto_score: boolean;
  judge_criteria?: string | null;
  judge_model_config_id?: string | null;
  error_message?: string | null;
  created_by: string;
  created_at: string;
  completed_at?: string | null;
}

export interface EvalResultResponse {
  result_id: string;
  run_id: string;
  item_id: string;
  trace_id?: string | null;
  status: 'completed' | 'failed';
  actual_output?: Record<string, unknown> | null;
  expected_output?: string | null;
  score_numeric?: number | null;
  score_label?: string | null;
  judge_reasoning?: string | null;
  error_message?: string | null;
  execution_time_ms?: number | null;
  created_at: string;
}
