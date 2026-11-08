"""Observability setup for EchoVault backend.

MLflow tracing — every PydanticAI agent run is automatically captured via
mlflow.pydantic_ai.autolog(). The tracking URI is set from MLFLOW_TRACKING_URI
in .env (defaults to http://mlflow.reoneo.dev, reachable via Tailscale).

Call configure() once at startup (before routes are registered).
"""

import logging

import mlflow
import mlflow.pydantic_ai

from .config import settings

logger = logging.getLogger(__name__)


def configure() -> None:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    mlflow.set_experiment(settings.mlflow_experiment_name)
    mlflow.pydantic_ai.autolog()
    logger.info(
        "MLflow tracing configured (uri=%s, experiment=%s, env=%s)",
        settings.mlflow_tracking_uri,
        settings.mlflow_experiment_name,
        settings.environment,
    )
