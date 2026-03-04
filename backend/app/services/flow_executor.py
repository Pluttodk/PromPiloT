"""Flow execution service.

Executes flows by processing nodes in topological order and records traces.
"""

from collections import defaultdict
from datetime import datetime
import json
import re
import time
from typing import Any
from uuid import uuid4

from jinja2 import Template

from app.models.schemas import (
    Flow,
    FlowDefinition,
    FlowExecuteResponse,
    FlowNode,
    ModelConfig,
    ModelConfigResponse,
    TraceNodeResult,
)
from app.models.entities import TraceEntity
from app.storage.table_client import get_table_storage_client
from app.core.llm_client import LLMClient, LLMResponse


class FlowExecutor:
    """Executes flows by processing nodes in DAG order."""

    def __init__(self, project_id: str, model_config: ModelConfig | None = None):
        """Initialize executor with project context.

        Args:
            project_id: Project ID for fetching prompts
            model_config: Optional model configuration override
        """
        self.project_id = project_id
        self.table_client = get_table_storage_client()
        self.model_config = model_config
        self._model_config_cache: dict[str, ModelConfigResponse] = {}
        self._prompt_cache: dict[str, dict[str, Any]] = {}

    async def execute(
        self,
        flow: Flow,
        inputs: dict[str, Any],
        eval_run_id: str | None = None,
    ) -> FlowExecuteResponse:
        """Execute a flow with given inputs.

        Args:
            flow: Flow to execute
            inputs: Input values keyed by input node ID
            eval_run_id: Optional eval run ID to tag this trace as eval-generated

        Returns:
            FlowExecuteResponse with outputs, timing, and trace_id
        """
        start_time = time.time()
        trace_id = str(uuid4())
        definition = flow.definition

        trace_entity = TraceEntity(
            project_id=self.project_id,
            trace_id=trace_id,
            flow_id=flow.flow_id,
            flow_name=flow.name,
            status="running",
            inputs=json.dumps(inputs),
            created_at=datetime.utcnow(),
            eval_run_id=eval_run_id,
        )
        self.table_client.insert_entity(table_name="traces", entity=trace_entity)

        node_by_id = {node.id: node for node in definition.nodes}
        execution_order = self._topological_sort(definition)

        node_outputs: dict[str, Any] = {}
        node_results: dict[str, Any] = {}
        node_traces: list[TraceNodeResult] = []
        total_tokens = 0
        error_message = None

        try:
            for node_id in execution_order:
                node = node_by_id[node_id]
                node_start_time = time.time()

                if node.type == "input":
                    output = inputs.get(node_id)
                    node_outputs[node_id] = output
                    node_results[node_id] = {
                        "type": "input",
                        "name": node.data.name,
                        "value": output,
                    }

                    node_traces.append(
                        TraceNodeResult(
                            node_id=node_id,
                            node_type="input",
                            name=node.data.name,
                            output=output,
                            execution_time_ms=int((time.time() - node_start_time) * 1000),
                        )
                    )

                elif node.type == "prompt":
                    llm_response, sent_messages = await self._execute_prompt_node(
                        node, definition, node_outputs
                    )
                    output = llm_response.content
                    tokens = llm_response.total_tokens or 0
                    total_tokens += tokens

                    node_outputs[node_id] = output
                    node_results[node_id] = {
                        "type": "prompt",
                        "system_prompt_source": node.data.system_prompt_source,
                        "user_input_source": node.data.user_input_source,
                        "model_config_id": node.data.model_config_id,
                        "output": output,
                    }

                    node_traces.append(
                        TraceNodeResult(
                            node_id=node_id,
                            node_type="prompt",
                            name=node.data.name,
                            prompt_id=node.data.system_prompt_id or node.data.user_input_prompt_id,
                            model_config_id=node.data.model_config_id,
                            input={"messages": sent_messages},
                            output=output,
                            tokens_used=tokens,
                            execution_time_ms=int((time.time() - node_start_time) * 1000),
                        )
                    )

                elif node.type == "output":
                    source_value = self._get_connected_value(
                        node_id, None, definition, node_outputs
                    )
                    output_name = node.data.name or node_id
                    node_outputs[node_id] = source_value
                    node_results[node_id] = {
                        "type": "output",
                        "name": output_name,
                        "value": source_value,
                    }

                    node_traces.append(
                        TraceNodeResult(
                            node_id=node_id,
                            node_type="output",
                            name=output_name,
                            output=source_value,
                            execution_time_ms=int((time.time() - node_start_time) * 1000),
                        )
                    )

            outputs = {}
            for node in definition.nodes:
                if node.type == "output":
                    output_name = node.data.name or node.id
                    outputs[output_name] = node_outputs.get(node.id)

            execution_time_ms = int((time.time() - start_time) * 1000)
            status = "completed"

        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            error_message = str(e)
            status = "failed"
            outputs = {}

            if node_traces:
                node_traces[-1].error = error_message

        self._update_trace(
            trace_id=trace_id,
            status=status,
            outputs=outputs,
            node_traces=node_traces,
            total_tokens=total_tokens,
            execution_time_ms=execution_time_ms,
            error_message=error_message,
        )

        if status == "failed":
            raise Exception(error_message)

        return FlowExecuteResponse(
            trace_id=trace_id,
            outputs=outputs,
            execution_time_ms=execution_time_ms,
            node_results=node_results,
        )

    def _update_trace(
        self,
        trace_id: str,
        status: str,
        outputs: dict[str, Any],
        node_traces: list[TraceNodeResult],
        total_tokens: int,
        execution_time_ms: int,
        error_message: str | None,
    ) -> None:
        """Update trace entity with execution results."""
        entity = self.table_client.get_entity(
            table_name="traces",
            partition_key=self.project_id,
            row_key=trace_id,
        )

        if entity:
            entity["status"] = status
            entity["outputs"] = json.dumps(outputs)
            entity["node_traces"] = json.dumps([t.model_dump() for t in node_traces])
            entity["total_tokens"] = total_tokens
            entity["execution_time_ms"] = execution_time_ms
            entity["error_message"] = error_message

            self.table_client.update_entity(table_name="traces", entity=entity)

    def _topological_sort(self, definition: FlowDefinition) -> list[str]:
        """Sort nodes in execution order using topological sort."""
        in_degree: dict[str, int] = defaultdict(int)
        adjacency: dict[str, list[str]] = defaultdict(list)

        for node in definition.nodes:
            in_degree[node.id] = 0

        for edge in definition.edges:
            adjacency[edge.source].append(edge.target)
            in_degree[edge.target] += 1

        queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
        result = []

        while queue:
            current = queue.pop(0)
            result.append(current)

            for neighbor in adjacency[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(result) != len(definition.nodes):
            raise ValueError("Flow contains cycles, cannot execute")

        return result

    def _get_connected_value(
        self,
        node_id: str,
        target_handle: str | None,
        definition: FlowDefinition,
        node_outputs: dict[str, Any],
    ) -> Any:
        """Get value from connected source node.

        Args:
            node_id: Target node ID
            target_handle: Target handle ID (None for any connection)
            definition: Flow definition
            node_outputs: Outputs computed so far

        Returns:
            Value from connected source, or None if not found
        """
        for edge in definition.edges:
            if edge.target == node_id:
                if target_handle is None or edge.targetHandle == target_handle:
                    source_id = edge.source
                    if source_id in node_outputs:
                        return node_outputs[source_id]

        if target_handle is not None:
            for edge in definition.edges:
                if edge.target == node_id and edge.targetHandle is None:
                    source_id = edge.source
                    if source_id in node_outputs:
                        return node_outputs[source_id]

        return None

    def _resolve_variables_for_prompt(
        self,
        node_id: str,
        prompt_type: str,
        template: str,
        definition: FlowDefinition,
        node_outputs: dict[str, Any],
    ) -> dict[str, Any]:
        """Resolve variables in a template based on edge connections to specific handles.

        Args:
            node_id: Target node ID
            prompt_type: 'system' or 'user'
            template: Prompt template containing {{ variables }}
            definition: Flow definition
            node_outputs: Outputs computed so far

        Returns:
            Dict of resolved variable values
        """
        variables = self._extract_variables(template)
        result = {}

        for var_name in variables:
            handle_id = f"var_{prompt_type}_{var_name}"
            value = self._get_connected_value(node_id, handle_id, definition, node_outputs)
            if value is not None:
                result[var_name] = value

        return result

    def _extract_variables(self, template: str) -> list[str]:
        """Extract {{ variable }} names from template."""
        return list(set(re.findall(r"\{\{\s*(\w+)\s*\}\}", template)))

    def _get_prompt(self, prompt_id: str) -> dict[str, Any] | None:
        """Get prompt from cache or storage, resolving the Production version when set.

        If the prompt header has a production_version set, the corresponding version
        entity is fetched from promptversions and its template is used. Otherwise the
        draft template on the prompt entity is returned as-is for backward compatibility.
        """
        if prompt_id in self._prompt_cache:
            return self._prompt_cache[prompt_id]

        entity = self.table_client.get_entity(
            table_name="prompts",
            partition_key=self.project_id,
            row_key=prompt_id,
        )

        if entity is None:
            return None

        production_version = entity.get("production_version")
        if production_version is not None:
            row_key = f"{production_version:04d}"
            partition_key = f"{self.project_id}~{prompt_id}"
            version_entity = self.table_client.get_entity(
                table_name="promptversions",
                partition_key=partition_key,
                row_key=row_key,
            )
            if version_entity is not None:
                resolved: dict[str, Any] = dict(entity)
                resolved["template"] = version_entity["template"]
                self._prompt_cache[prompt_id] = resolved
                return resolved

        self._prompt_cache[prompt_id] = entity
        return entity

    def _get_model_config(self, model_config_id: str) -> ModelConfigResponse | None:
        """Get model config from cache or storage."""
        if model_config_id in self._model_config_cache:
            return self._model_config_cache[model_config_id]

        entity = self.table_client.get_entity(
            table_name="modelconfigs",
            partition_key=self.project_id,
            row_key=model_config_id,
        )

        if entity is None:
            return None

        config = ModelConfigResponse(
            model_config_id=entity["RowKey"],
            project_id=entity["PartitionKey"],
            name=entity.get("name", ""),
            provider=entity.get("provider", "azure_openai"),
            endpoint=entity.get("endpoint", ""),
            deployment_name=entity.get("deployment_name", ""),
            api_version=entity.get("api_version", "2024-02-01"),
            auth_method=entity.get("auth_method", "default_credential"),
            created_by=entity.get("created_by", ""),
            created_at=entity["created_at"],
            updated_at=entity["updated_at"],
        )

        self._model_config_cache[model_config_id] = config
        return config

    async def _execute_prompt_node(
        self,
        node: FlowNode,
        definition: FlowDefinition,
        node_outputs: dict[str, Any],
    ) -> tuple[LLMResponse, list[dict[str, str]]]:
        """Execute a prompt node by resolving system prompt and user input.

        Args:
            node: The prompt node to execute
            definition: Flow definition
            node_outputs: Outputs computed so far

        Returns:
            Tuple of (LLMResponse with content and token usage, messages sent to LLM)
        """
        data = node.data

        system_prompt = None
        user_input = None

        system_prompt_source = data.system_prompt_source or "none"
        if system_prompt_source == "prompt" and data.system_prompt_id:
            prompt_entity = self._get_prompt(data.system_prompt_id)
            if prompt_entity:
                template = prompt_entity.get("template", "")
                variables = self._resolve_variables_for_prompt(
                    node.id, "system", template, definition, node_outputs
                )
                system_prompt = Template(template).render(**variables)
        elif system_prompt_source == "connection":
            system_prompt = self._get_connected_value(
                node.id, "system_prompt", definition, node_outputs
            )
            if system_prompt is not None:
                system_prompt = str(system_prompt)

        user_input_source = data.user_input_source or "connection"
        if user_input_source == "prompt" and data.user_input_prompt_id:
            prompt_entity = self._get_prompt(data.user_input_prompt_id)
            if prompt_entity:
                template = prompt_entity.get("template", "")
                variables = self._resolve_variables_for_prompt(
                    node.id, "user", template, definition, node_outputs
                )
                user_input = Template(template).render(**variables)
        elif user_input_source == "connection":
            user_input = self._get_connected_value(
                node.id, "user_input", definition, node_outputs
            )
            if user_input is not None:
                user_input = str(user_input)

        if user_input is None and system_prompt is None:
            raise ValueError(
                f"Prompt node {node.id} has no user input or system prompt configured"
            )

        stored_model_config = None
        if data.model_config_id:
            stored_model_config = self._get_model_config(data.model_config_id)

        if not stored_model_config and not self.model_config:
            raise ValueError(f"Prompt node {node.id} has no model configuration")

        llm_client = LLMClient(
            model_config=self.model_config,
            stored_model_config=stored_model_config,
        )

        response = await llm_client.complete_with_prompt(
            prompt=user_input or "",
            system_prompt=system_prompt,
        )

        sent_messages: list[dict[str, str]] = []
        if system_prompt:
            sent_messages.append({"role": "system", "content": system_prompt})
        sent_messages.append({"role": "user", "content": user_input or ""})

        return response, sent_messages
