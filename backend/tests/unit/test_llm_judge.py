"""Unit tests for LLMJudgeService._parse_judge_response (pure function)."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

import app.storage.table_client as tbl_module
from app.services.llm_judge import LLMJudgeService


@pytest.fixture
def patch_table(mock_table_client: MagicMock):
    """Set the table storage singleton to the mock before each test."""
    old = tbl_module._table_client
    tbl_module._table_client = mock_table_client
    yield mock_table_client
    tbl_module._table_client = old


def _judge(patch_table: MagicMock) -> LLMJudgeService:
    """Instantiate LLMJudgeService with mocked storage."""
    return LLMJudgeService(project_id="p1")


class TestParseJudgeResponse:
    """Tests for LLMJudgeService._parse_judge_response."""

    def test_parse_numeric_valid_json(self, patch_table: MagicMock) -> None:
        """Numeric score and reasoning are extracted correctly."""
        svc = _judge(patch_table)
        numeric, boolean, label, reasoning = svc._parse_judge_response(
            '{"score": 4.2, "reasoning": "Good answer"}', "numeric"
        )
        assert numeric == pytest.approx(4.2)
        assert boolean is None
        assert label is None
        assert reasoning == "Good answer"

    def test_parse_boolean_true(self, patch_table: MagicMock) -> None:
        """Boolean true literal is parsed as Python True."""
        svc = _judge(patch_table)
        _, boolean, _, _ = svc._parse_judge_response(
            '{"score": true, "reasoning": "Correct"}', "boolean"
        )
        assert boolean is True

    def test_parse_boolean_string(self, patch_table: MagicMock) -> None:
        """String 'true' is coerced to Python True."""
        svc = _judge(patch_table)
        _, boolean, _, _ = svc._parse_judge_response(
            '{"score": "true", "reasoning": "ok"}', "boolean"
        )
        assert boolean is True

    def test_parse_categorical_label(self, patch_table: MagicMock) -> None:
        """Categorical score label is extracted as a string."""
        svc = _judge(patch_table)
        _, _, label, _ = svc._parse_judge_response(
            '{"score": "excellent", "reasoning": "Top quality"}', "categorical"
        )
        assert label == "excellent"

    def test_parse_malformed_json_returns_none(self, patch_table: MagicMock) -> None:
        """Garbage input causes all score values to be None."""
        svc = _judge(patch_table)
        numeric, boolean, label, reasoning = svc._parse_judge_response(
            "not valid json at all !!!!", "numeric"
        )
        assert numeric is None
        assert boolean is None
        assert label is None
        assert "Failed to parse" in reasoning

    def test_parse_json_embedded_in_text(self, patch_table: MagicMock) -> None:
        """JSON block embedded in surrounding prose is extracted via regex."""
        svc = _judge(patch_table)
        text = 'Here is my evaluation:\n{"score": 3.5, "reasoning": "Decent"}\nEnd.'
        numeric, _, _, reasoning = svc._parse_judge_response(text, "numeric")
        assert numeric == pytest.approx(3.5)
        assert reasoning == "Decent"


class TestScoreTrace:
    """Tests for LLMJudgeService.score_trace — storage side-effect only."""

    async def test_score_trace_stores_entity(self, patch_table: MagicMock) -> None:
        """score_trace() inserts exactly one score entity into storage."""
        now = datetime.utcnow()
        patch_table.get_entity.return_value = {
            "PartitionKey": "p1",
            "RowKey": "trace-1",
            "inputs": '{"q": "hello"}',
            "outputs": '{"a": "world"}',
            "created_at": now,
        }

        svc = LLMJudgeService(project_id="p1")

        mock_response = MagicMock()
        mock_response.content = '{"score": 4.0, "reasoning": "Good"}'

        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(
                "app.services.llm_judge.LLMClient.complete",
                AsyncMock(return_value=mock_response),
            )
            score, reasoning = await svc.score_trace(
                trace_id="trace-1",
                criteria="Is the answer helpful?",
                score_type="numeric",
            )

        patch_table.insert_entity.assert_called_once()
        assert score.value_numeric == pytest.approx(4.0)
