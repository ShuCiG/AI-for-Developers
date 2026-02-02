FROM python:3.13.7-slim AS base

COPY --from=ghcr.io/astral-sh/uv:0.9.2 /uv /uvx /bin/

# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy

WORKDIR /app

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  curl python3-dev \
  && apt-get autoremove -yqq --purge \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Install the project's dependencies using the lockfile and settings
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["uv", "run", "--frozen", "run.py"]

# Production image ============================================================
FROM base AS production

COPY . .

# Development image ============================================================
FROM base AS development

COPY . .

RUN uv sync --frozen --no-install-project --all-groups
