# PRD-008: Docker & Deployment Architecture (Platform Expansion)

## 1. Overview
Entering Phase 4 (Deployment & Scale). While a basic Docker setup exists (`Dockerfile.frontend`, `Dockerfile.proxy`, `docker-compose.yml`), it requires an architectural overhaul to support the new Unified Messaging platforms (Telegram, Email, Slack). The introduction of long-lived connections (Slack WebSockets) and external protocol dependencies (IMAP/SMTP) demands robust networking, health checking, and secure secrets management.

## 2. Architectural Goals & Non-Goals
### Goals
- **Robust Networking:** Ensure the Node.js proxy/backend container has required egress access (WSS/443 for Slack, 993 for IMAPS, 465/587 for SMTPS, HTTPS/443 for Telegram Webhooks/Polling).
- **Resilience:** Implement robust Docker healthchecks to detect dead WebSocket connections or hanging IMAP streams.
- **Secrets Management:** Transition from plain `.env` files to Docker Secrets (or secure variable injection) for sensitive production tokens.
- **Observability:** Ensure adequate logging configuration (e.g., JSON logging with rotation) for debugging multi-channel message flows.

### Non-Goals
- Kubernetes migration (sticking to Docker Compose for this phase).
- High Availability / Multi-node scaling of the WebSocket handlers (state management for scale-out is deferred).

## 3. Technical Specifications

### 3.1 Network & Connectivity
- **Slack Socket Mode:** Requires outbound WebSocket connection to `wss://*.slack-msgs.com`. Proxy environment must not block outbound 443.
- **Email (IMAP/SMTP):** Requires outbound TCP to mail servers (ports 993, 465, 587).
- **Internal Networks:** Define isolated bridge networks (`frontend_net`, `backend_net`) to limit attack surfaces.

### 3.2 Healthchecks & Restart Policies
- **Restart Policy:** Enforce `restart: unless-stopped` on all unified-messaging containers.
- **Healthchecks:**
  - Create a dedicated healthcheck endpoint (e.g., `/api/health`) in the Node proxy.
  - The endpoint must verify the status of the Slack WebSocket connection and IMAP idle state, not just HTTP server up-time.
  - Compose configuration should use `curl -f http://localhost:PORT/api/health || exit 1`.

### 3.3 Secrets Management (Production)
- **Current State:** Environment variables via `.env`.
- **Target State (Production):** Utilize Docker Secrets in `docker-compose.prod.yml` for:
  - `TELEGRAM_BOT_TOKEN`
  - `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`
  - `EMAIL_PASSWORD`, `EMAIL_USER`
- Update the application entrypoint/config loader to read from `/run/secrets/` if the direct environment variable is absent.

## 4. Implementation Phases

### Phase 1: Container & Compose Architecture
- Refactor `docker-compose.yml` (dev) and create `docker-compose.prod.yml`.
- Define custom networks and resource limits (memory/CPU limits to prevent memory leaks from IMAP streams).
- Add `healthcheck` blocks to containers.

### Phase 2: Secrets & Environment Configuration
- Implement Docker Secrets mapping in `docker-compose.prod.yml`.
- Update the Node.js application to gracefully fallback to `/run/secrets/<secret_name>`.
- Update `.env.staging.example` and provide a `secrets/` dummy directory for local testing.

### Phase 3: Observability & Documentation
- Configure Docker logging driver (`json-file`, `max-size: 10m`, `max-file: 3`).
- Update `README.md` and `DEPLOYMENT.md` with:
  - Required outbound firewall rules.
  - Instructions on creating and managing Docker Secrets.
  - Healthcheck monitoring instructions.

## 5. Success Criteria
- [ ] `docker-compose.prod.yml` successfully uses Docker Secrets for all messaging tokens.
- [ ] Container healthchecks actively monitor IMAP and Slack WebSocket states and auto-restart on failures.
- [ ] No plaintext sensitive tokens are required in environment variables on the production host.
- [ ] Comprehensive documentation allows a sysadmin to deploy the updated architecture securely.
