"""LLM Client wrapper using LiteLLM for multi-provider support."""

from dataclasses import dataclass
from typing import Any, TYPE_CHECKING
import litellm
from litellm import acompletion

from app.config import settings

if TYPE_CHECKING:
    from app.models.schemas import ModelConfig, ModelConfigResponse


@dataclass
class LLMResponse:
    """Response from LLM including content and token usage."""

    content: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


def _get_azure_token_provider():
    """Get Azure AD token provider for DefaultAzureCredential auth.

    Returns:
        Token provider function for Azure OpenAI
    """
    from azure.identity import DefaultAzureCredential, get_bearer_token_provider

    credential = DefaultAzureCredential()
    return get_bearer_token_provider(
        credential, "https://cognitiveservices.azure.com/.default"
    )


class LLMClient:
    """Client for calling LLM providers using LiteLLM.

    Supports OpenAI, Azure OpenAI, Anthropic, and other providers through LiteLLM.
    """

    def __init__(
        self,
        model_config: "ModelConfig | None" = None,
        stored_model_config: "ModelConfigResponse | None" = None,
    ):
        """Initialize LLM client with configured API keys.

        Args:
            model_config: Optional runtime model configuration override (legacy)
            stored_model_config: Optional project-level model configuration
        """
        self.model_config = model_config
        self.stored_model_config = stored_model_config
        self._token_provider = None

        if settings.openai_api_key:
            litellm.openai_key = settings.openai_api_key

        if settings.azure_openai_api_key and settings.azure_openai_endpoint:
            litellm.azure_key = settings.azure_openai_api_key

        litellm.drop_params = True

    async def complete(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Call LLM with messages and return completion with token usage.

        Args:
            messages: List of message dicts with 'role' and 'content' keys
            model: Model name (defaults to settings.default_llm_model)
            temperature: Sampling temperature (defaults to settings.default_llm_temperature)
            max_tokens: Max tokens in response (defaults to settings.default_llm_max_tokens)
            **kwargs: Additional arguments passed to LiteLLM

        Returns:
            LLMResponse with content and token usage
        """
        if self.stored_model_config:
            model_to_use = model or self.stored_model_config.deployment_name
            if not model_to_use.startswith("azure/"):
                model_to_use = f"azure/{model_to_use}"
            kwargs["api_base"] = self.stored_model_config.endpoint
            kwargs["api_version"] = self.stored_model_config.api_version

            if self.stored_model_config.auth_method == "default_credential":
                if self._token_provider is None:
                    self._token_provider = _get_azure_token_provider()
                kwargs["azure_ad_token_provider"] = self._token_provider
        elif self.model_config and self.model_config.endpoint:
            model_to_use = self.model_config.model or model or settings.default_llm_model
            if not model_to_use.startswith("azure/"):
                model_to_use = f"azure/{model_to_use}"
            kwargs["api_base"] = self.model_config.endpoint
            kwargs["api_version"] = self.model_config.api_version or settings.azure_openai_api_version
            if self.model_config.api_key:
                kwargs["api_key"] = self.model_config.api_key
        else:
            model_to_use = model or settings.default_llm_model
            if settings.azure_openai_endpoint and settings.azure_openai_api_key:
                if not model_to_use.startswith("azure/"):
                    model_to_use = f"azure/{model_to_use}"
                kwargs["api_base"] = settings.azure_openai_endpoint
                kwargs["api_version"] = settings.azure_openai_api_version

        temperature = temperature if temperature is not None else settings.default_llm_temperature
        max_tokens = max_tokens or settings.default_llm_max_tokens

        response = await acompletion(
            model=model_to_use,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )

        content = response.choices[0].message.content or ""
        usage = getattr(response, "usage", None)

        return LLMResponse(
            content=content,
            prompt_tokens=getattr(usage, "prompt_tokens", None) if usage else None,
            completion_tokens=getattr(usage, "completion_tokens", None) if usage else None,
            total_tokens=getattr(usage, "total_tokens", None) if usage else None,
        )

    async def complete_with_prompt(
        self,
        prompt: str,
        system_prompt: str | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Call LLM with a single prompt string.

        Args:
            prompt: User prompt text
            system_prompt: Optional system prompt
            model: Model name
            temperature: Sampling temperature
            max_tokens: Max tokens in response
            **kwargs: Additional arguments

        Returns:
            LLMResponse with content and token usage
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        return await self.complete(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )


llm_client = LLMClient()
