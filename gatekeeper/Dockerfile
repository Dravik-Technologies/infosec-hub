FROM node:20-slim

WORKDIR /app/gatekeeper

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    golang-go \
    python3 \
    python3-pip \
    ruby-full \
    shellcheck \
  && rm -rf /var/lib/apt/lists/*

COPY gatekeeper/package*.json ./
RUN npm install --omit=dev
RUN npm install -g retire

RUN python3 -m pip install --break-system-packages --no-cache-dir \
  semgrep \
  pip-audit \
  bandit \
  checkov

RUN gem install bundler-audit --no-document

RUN curl -sfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh \
  | sh -s -- -b /usr/local/bin

RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
  | sh -s -- -b /usr/local/bin

RUN curl -sfL https://raw.githubusercontent.com/anchore/grype/main/install.sh \
  | sh -s -- -b /usr/local/bin

RUN curl -sfL https://raw.githubusercontent.com/anchore/syft/main/install.sh \
  | sh -s -- -b /usr/local/bin

RUN curl -sfL https://github.com/hadolint/hadolint/releases/latest/download/hadolint-Linux-x86_64 \
  -o /usr/local/bin/hadolint \
  && chmod +x /usr/local/bin/hadolint

RUN curl -sfL https://raw.githubusercontent.com/securego/gosec/master/install.sh \
  | sh -s -- -b /usr/local/bin

COPY gatekeeper/ ./

RUN chown -R node:node /app
USER node

EXPOSE 8095
ENV NODE_ENV=production

CMD ["node", "server.js"]
