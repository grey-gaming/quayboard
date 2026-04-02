FROM python:3.12-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CARGO_HOME=/usr/local/cargo \
    RUSTUP_HOME=/usr/local/rustup \
    PATH=/usr/local/cargo/bin:/usr/local/node/bin:$PATH \
    OPENCODE_DISABLE_AUTOUPDATE=1 \
    OPENCODE_DISABLE_CLAUDE_CODE=1 \
    OPENCODE_DISABLE_CLAUDE_CODE_PROMPT=1 \
    OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1

ARG NODE_VERSION=20.19.5
ARG PNPM_VERSION=9.15.4

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    build-essential \
    ca-certificates \
    curl \
    git \
    jq \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  arch="$(dpkg --print-architecture)"; \
  case "$arch" in \
    amd64) node_arch='x64' ;; \
    arm64) node_arch='arm64' ;; \
    *) echo "Unsupported architecture: $arch" >&2; exit 1 ;; \
  esac; \
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz; \
  mkdir -p /usr/local/node; \
  tar -xJf /tmp/node.tar.xz -C /usr/local/node --strip-components=1; \
  rm /tmp/node.tar.xz; \
  corepack enable; \
  corepack prepare "pnpm@${PNPM_VERSION}" --activate

RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal
RUN cargo install wasm-bindgen-cli --version 0.2.100

RUN npm install -g opencode-ai@latest @ai-sdk/openai-compatible@latest
RUN pip install --no-cache-dir litellm==1.75.0 playwright \
  && python -m playwright install --with-deps chromium

COPY qb_entrypoint.sh /usr/local/bin/qb_entrypoint.sh
RUN chmod +x /usr/local/bin/qb_entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/qb_entrypoint.sh"]
