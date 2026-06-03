# EchoVault Observability

This document explains how monitoring is wired into the EchoVault backend, what each component does, and how to use it to understand the system's behaviour in production.

---

## Overview

Observability answers three questions:

| Question | Pillar | Tool |
|---|---|---|
| Is the system healthy? | **Metrics** | Prometheus + Grafana |
| What happened? | **Logs** | Python `logging` → stdout |
| Where did time go? | **Traces** | Logfire (PydanticAI + FastAPI) |

Both Prometheus and Logfire are configured in a single entry point — `app/observability.py` — which is called once at startup in `app/main.py`.

---

## 1. Metrics: Prometheus + Grafana

### How Prometheus works (pull model)

Prometheus is fundamentally different from services like Datadog that you push data to. Instead, Prometheus periodically **pulls** (scrapes) a `/metrics` HTTP endpoint exposed by your application. This is called the **pull model**.

```
Every 15 seconds:

  Prometheus ──── GET /metrics ────► FastAPI app
               ◄─── metrics text ───
  
  Prometheus stores the values in its time-series database (TSDB)
  
  Grafana ──── PromQL query ────► Prometheus
           ◄─── results ──────
```

The `/metrics` endpoint returns plain text in a format called **OpenMetrics**:

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{handler="/generate-flashcards-batch",method="POST",status_code="200"} 42
```

Each line is: `metric_name{label="value"} numeric_value [timestamp]`

### Why pull instead of push?

- **Simpler failure modes** — if the app crashes, Prometheus just sees a scrape failure. With push, you'd need to handle queuing.
- **Prometheus controls the rate** — the scrape interval is configured once in Prometheus, not scattered across every service.
- **Easy discovery** — Prometheus can auto-discover targets in Kubernetes via service discovery.

### Metric types

**Counter** — only ever increases. Used for totals.

```python
cards_generated = Counter(
    "echovault_cards_generated_total",
    "Total flashcards generated",
    labelnames=["card_type"],
)
cards_generated.labels(card_type="multiple_choice").inc()
```

You never query a counter's raw value — you query its **rate** (how fast it's increasing):
```promql
rate(echovault_cards_generated_total[5m])  # cards/second over last 5 minutes
```

**Histogram** — samples observations into configurable buckets. The key insight: you define the boundaries upfront and Prometheus counts how many observations fell below each boundary. This lets you compute percentiles without storing every individual data point.

```python
llm_duration = Histogram(
    "echovault_llm_duration_seconds",
    "LLM call duration",
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0, 60.0],
)
with llm_duration.time():   # context manager records duration automatically
    result = await agent.run(...)
```

Querying the 95th percentile latency in PromQL:
```promql
histogram_quantile(
  0.95,
  sum(rate(echovault_llm_duration_seconds_bucket[5m])) by (le)
)
```
The `le` label (less than or equal) is automatically added by Prometheus for each bucket boundary.

**Gauge** — can go up or down. Used for current state (queue depth, memory usage, active connections). The `prometheus-fastapi-instrumentator` creates an `http_requests_in_progress` gauge automatically.

### Labels

Labels are key-value pairs attached to metrics that let you slice data in PromQL. For example:

```python
cards_generated.labels(card_type="multiple_choice").inc()
cards_generated.labels(card_type="true_false").inc()
cards_generated.labels(card_type="standard").inc()
```

In Grafana you can then plot each card type as a separate series, or sum them all:
```promql
sum(rate(echovault_cards_generated_total[5m])) by (card_type)
```

**Important**: high-cardinality labels (like user IDs or request IDs) will explode the number of time series and overwhelm Prometheus. Labels should have a small, bounded set of values.

### What `prometheus-fastapi-instrumentator` gives you for free

By calling `Instrumentator().instrument(app).expose(app)` in `observability.py`, every FastAPI route automatically gets:

| Metric | Type | What it measures |
|---|---|---|
| `http_requests_total` | Counter | Total requests, labelled by handler/method/status |
| `http_request_duration_seconds` | Histogram | Full request latency including serialisation |
| `http_requests_in_progress` | Gauge | Concurrent requests right now |

### Custom metrics in EchoVault

Defined in `app/observability.py`, recorded in `app/routes.py` and `app/openrouter.py`:

| Metric | Type | Where recorded | What it tells you |
|---|---|---|---|
| `echovault_cards_generated_total` | Counter | `routes.py` after batch | How many cards of each type are being created |
| `echovault_llm_duration_seconds` | Histogram | `openrouter.py` after agent run | How long the LLM is taking — p95 is the key number |
| `echovault_batch_files` | Histogram | `routes.py` per request | Distribution of batch sizes |
| `echovault_llm_errors_total` | Counter | `routes.py` on failure | LLM failure rate after retries |

---

## 2. Grafana

Grafana is a pure visualisation layer — it doesn't store any data itself. It connects to data sources (Prometheus, Loki, etc.) and renders dashboards from PromQL queries.

### Dashboard provisioning

Rather than clicking through the Grafana UI to configure data sources and dashboards, everything is **provisioned as code** in `monitoring/grafana/`:

```
monitoring/grafana/
├── provisioning/
│   ├── datasources/
│   │   └── prometheus.yml    ← tells Grafana "Prometheus is at http://prometheus:9090"
│   └── dashboards/
│       └── dashboards.yml    ← tells Grafana where to load dashboard JSON files from
└── dashboards/
    └── echovault.json        ← the actual dashboard definition
```

When Grafana starts, it reads these files and sets itself up automatically. This means the dashboard is version-controlled and reproducible — anyone who runs `docker compose up` gets the same setup.

### Reading the dashboard

**Request Rate** — plots `rate(http_requests_total[1m])` grouped by handler. A spike here means traffic increased. A sudden drop to zero could mean the service is down.

**P95 Latency** — the 95th percentile request duration. "P95 = 2s" means 95% of requests finish within 2 seconds. This is more useful than the average because averages hide outliers. P99 would show you the worst-case tail.

**Error Rate** — only counts 5xx responses. A non-zero value here needs immediate attention.

**Cards Generated** — rate of card creation by type. Useful for understanding which note types the LLM processes most.

**LLM Call Duration** — P95 and P50 of the actual LLM call. The gap between this and overall request latency is your overhead (serialisation, networking, etc.).

### PromQL fundamentals

PromQL (Prometheus Query Language) has a few core patterns worth knowing:

```promql
# Instant vector — current value of a metric
http_requests_total

# Range vector — values over a time window (used as input to functions)
http_requests_total[5m]

# rate() — per-second average rate of increase over a window
rate(http_requests_total[5m])

# sum() by (label) — aggregate across dimensions, keep one label
sum(rate(http_requests_total[5m])) by (handler)

# histogram_quantile(φ, ...) — compute a percentile from a histogram
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

The `[5m]` window controls smoothing — shorter windows react faster but are noisier; longer windows are smoother but lag behind real changes. 1m is good for real-time alerting, 5m for dashboards.

---

## 3. Logfire

Logfire handles **distributed tracing** and **structured logs**. Unlike Prometheus (which records aggregate statistics), Logfire records individual events with full context.

### How tracing works

A **trace** is a tree of **spans**. Each span represents a unit of work with a start time, end time, and attributes. For example, a single batch request produces a trace like:

```
POST /generate-flashcards-batch  [850ms]
├── generate_cards_from_diff  file=thread.md  [420ms]
│   └── Agent.run  model=qwen3.5  tokens=1243  [410ms]
├── generate_cards_from_diff  file=trie.md  [380ms]
│   └── Agent.run  model=qwen3.5  tokens=890  [370ms]
└── ...
```

`logfire.instrument_fastapi()` creates the outer span automatically. `logfire.instrument_pydantic_ai()` creates the inner `Agent.run` spans — this is why Logfire is particularly valuable here: you see the exact token counts and duration of every LLM call without writing any instrumentation code.

### Logfire vs Prometheus

| | Prometheus | Logfire |
|---|---|---|
| Granularity | Aggregate (rates, percentiles) | Per-request detail |
| Storage | Efficient (counters, buckets) | Higher (full trace per request) |
| Query | PromQL | SQL-like explorer |
| Best for | "Is P95 latency above 5s?" | "Why did this specific request take 30s?" |

Use Prometheus to detect that something is wrong. Use Logfire to diagnose what specifically went wrong.

---

## Running the monitoring stack

```bash
# From backend/monitoring/
docker compose up -d

# Grafana: http://localhost:3000  (admin / admin)
# Prometheus: http://localhost:9090
# Your metrics endpoint: http://localhost:8000/metrics

# Stop
docker compose down

# Stop and delete all stored data
docker compose down -v
```

Prometheus data is persisted in a Docker named volume (`prometheus_data`) so it survives container restarts. Same for Grafana (`grafana_data`) — any dashboards you create in the UI are saved there.

To verify Prometheus is scraping successfully: go to `http://localhost:9090/targets` — the `echovault-backend` job should show `State: UP`.

---

## Adding new metrics

1. Define the metric in `app/observability.py`:
   ```python
   my_counter = Counter("echovault_my_event_total", "Description", labelnames=["label"])
   ```

2. Record it where the event happens:
   ```python
   from .observability import my_counter
   my_counter.labels(label="value").inc()
   ```

3. Add a panel to `monitoring/grafana/dashboards/echovault.json`, or create one interactively in Grafana and export the JSON.

Prometheus picks up new metrics automatically on the next scrape — no restart needed.
