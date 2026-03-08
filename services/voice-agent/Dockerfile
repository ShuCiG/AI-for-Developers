FROM python:3.13-slim AS base

COPY --from=ghcr.io/astral-sh/uv:0.9.2 /uv /uvx /bin/

ENV UV_LINK_MODE=copy

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  gcc g++ python3-dev \
  && apt-get autoremove -yqq --purge \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies (no lockfile — generated on first build)
COPY pyproject.toml .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-install-project --no-dev

COPY . .

# Pre-download LiveKit models (VAD, turn detector)
RUN uv run python src/agent.py download-files

CMD ["uv", "run", "python", "src/agent.py", "start"]
