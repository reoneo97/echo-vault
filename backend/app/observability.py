"""
Centralised observability setup for EchoVault backend.

Two systems are configured here:

1. Prometheus — pull-based metrics. FastAPI exposes a /metrics endpoint that
   Prometheus scrapes on a schedule. Metrics are low-cardinality numeric
   measurements (counters, histograms, gauges).

2. Logfire — push-based traces and structured logs. Every PydanticAI agent run
   and every FastAPI request is automatically captured with full context.

Call `configure(app)` once at startup (before routes are registered).
Both systems degrade gracefully: Prometheus always runs, Logfire is skipped if
LOGFIRE_TOKEN is not set.
"""

import logging

import logfire
from fastapi import FastAPI
from prometheus_client import Counter, Histogram, make_asgi_app
from prometheus_fastapi_instrumentator import Instrumentator

from .config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Custom application metrics
#
# Prometheus metric types:
#   Counter   — monotonically increasing count (never decreases)
#   Histogram — samples observations into configurable buckets; lets you
#               compute percentiles (p50, p95, p99) using PromQL
#   Gauge     — value that can go up and down (e.g. queue depth)
# ---------------------------------------------------------------------------

cards_generated = Counter(
    "echovault_cards_generated_total",
    "Total flashcards generated, broken down by card type",
    labelnames=["card_type"],          # labels let you filter/group in PromQL
)

llm_duration = Histogram(
    "echovault_llm_duration_seconds",
    "End-to-end LLM call duration in seconds",
    # Buckets define the histogram boundaries. Observations are counted in
    # whichever bucket they fall into. Choose buckets that span the expected
    # range of values with good resolution where it matters.
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0, 60.0],
)

batch_files = Histogram(
    "echovault_batch_files",
    "Number of files processed per batch request",
    buckets=[1, 2, 5, 10, 20, 50],
)

llm_errors = Counter(
    "echovault_llm_errors_total",
    "Total LLM call failures (after retries)",
)

cards_accepted = Counter(
    "echovault_cards_accepted_total",
    "Total flashcards accepted by the user in the staging panel",
)

cards_rejected = Counter(
    "echovault_cards_rejected_total",
    "Total flashcards rejected by the user in the staging panel",
)

cards_edited = Counter(
    "echovault_cards_edited_total",
    "Total flashcards edited before accepting",
)


def configure(app: FastAPI) -> None:
    _setup_prometheus(app)
    _setup_logfire(app)


def _setup_prometheus(app: FastAPI) -> None:
    # Instrumentator automatically creates metrics for every FastAPI route:
    #   http_requests_total          (counter, labelled by method/path/status)
    #   http_request_duration_seconds (histogram of latency)
    #   http_requests_in_progress    (gauge of concurrent requests)
    Instrumentator(
        should_group_status_codes=False,
        excluded_handlers=["/metrics", "/docs", "/redoc", "/openapi.json"],
    ).instrument(app).expose(app, endpoint="/metrics")

    logger.info("Prometheus metrics available at /metrics")


def _setup_logfire(app: FastAPI) -> None:
    if not settings.logfire_token:
        logger.info("LOGFIRE_TOKEN not set — Logfire disabled")
        return

    logfire.configure(
        token=settings.logfire_token,
        service_name="echovault-backend",
        service_version="0.1.0",
        environment=settings.environment,
        send_to_logfire=True,
    )

    # instrument_fastapi wraps every route in an OpenTelemetry span so you
    # see the full request lifecycle in the Logfire UI
    logfire.instrument_fastapi(app)

    # instrument_pydantic_ai hooks into every Agent.run() call and records
    # the model used, prompt tokens, completion tokens, and latency
    logfire.instrument_pydantic_ai()

    logger.info(
        "Logfire configured (service=echovault-backend, env=%s)",
        settings.environment,
    )
