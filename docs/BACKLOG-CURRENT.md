# Unified Messaging - Current Backlog

## Epic 1: Slack Integration (Phase 3 Platform Expansion)
**Description:** Integrate Slack into Merge Unified Messaging to allow users to manage Slack DMs, channel messages, and thread replies directly from the unified timeline using a seamless Socket Mode connection.

### Issue #1: [Tech] Set up Slack App and Socket Mode Foundation
**Description:** Initialize the `@slack/bolt` framework in the Node.js backend using Socket Mode to bypass firewall restrictions and avoid local port forwarding (ngrok).
**Acceptance Criteria:**
- Slack App is configured in the Slack API console with Socket Mode enabled.
- Scopes are correctly configured (`channels:history`, `chat:write`, `groups:history`, `im:history`, `users:read`).
- `server/services/slackService.js` initializes `@slack/bolt`.
- Application connects successfully to Slack WS and can receive raw events.
**Story Points:** 3

### Issue #2: [Story] Receive and Normalize Slack Messages
**Description:** As a user, I want to receive incoming Slack messages (DMs, channel messages, mentions) instantly in the unified timeline so I don't have to switch apps.
**Acceptance Criteria:**
- Event listeners ingest `app.message` and `app.event('app_mention')`.
- Slack payloads are normalized to the universal message schema (`chatId` = Channel/DM ID, `threadId` = `thread_ts`, `platform` = "slack").
- Normalized messages are broadcast to connected clients via WebSockets.
**Story Points:** 5

### Issue #3: [Story] Resolve User Profiles for Slack Messages
**Description:** As a user, I want to see actual names and avatars instead of raw user IDs (like U123456) so I know who is messaging me.
**Acceptance Criteria:**
- Backend implements `slackService.getUserProfile(userId)`.
- Profiles are fetched via `users.info` API.
- Caching mechanism is in place to avoid rate-limiting.
- Frontend displays the resolved name and avatar.
**Story Points:** 3

### Issue #4: [Story] Send Messages and Threaded Replies to Slack
**Description:** As a user, I want to send new messages and reply to existing threads in Slack directly from the unified timeline.
**Acceptance Criteria:**
- REST route `POST /api/slack/messages` (or unified adapter) is implemented.
- Backend handles standard messages and `thread_ts` for threaded replies.
- Frontend hook (`useSlack.ts` or adapter in `useAppStore.ts`) sends outgoing payloads correctly.
- `ChatArea.tsx` and `Sidebar.tsx` render Slack-specific UI accurately.
**Story Points:** 5

### Issue #5: [Tech] Security and Automated Testing for Slack Integration
**Description:** Ensure robust handling of environment variables and validate message schemas.
**Acceptance Criteria:**
- Tokens (`SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`) are stored securely in `.env`.
- Payload structures are validated using Zod.
- Vitest/Supertest tests verify message normalization and event routing using a mocked Bolt instance.
**Story Points:** 3

---

## Epic 2: Docker & Deployment Architecture (Phase 4)
**Description:** Overhaul the Docker setup to support Unified Messaging platforms, implementing robust networking, health checking, and secure secrets management.

### Issue #6: [Tech] Refactor Compose Architecture and Networking
**Description:** Update the Docker compose files to establish a secure and isolated network architecture with proper resource limits.
**Acceptance Criteria:**
- `docker-compose.yml` (dev) is refactored, and `docker-compose.prod.yml` is created.
- Isolated bridge networks (`frontend_net`, `backend_net`) are defined.
- Resource limits (memory/CPU) are set to prevent memory leaks from IMAP streams.
- Docker logging driver is configured (`json-file`, `max-size: 10m`, `max-file: 3`).
**Story Points:** 3

### Issue #7: [Tech] Implement Application Healthchecks
**Description:** Ensure containers are resilient by actively monitoring the state of external connections (Slack WebSockets, IMAP streams).
**Acceptance Criteria:**
- Dedicated `/api/health` endpoint exists in the Node proxy.
- Health endpoint verifies HTTP server status AND Slack WebSocket / IMAP idle states.
- Compose configuration includes a `healthcheck` block calling `/api/health`.
- Restart policy `unless-stopped` is enforced.
**Story Points:** 5

### Issue #8: [Tech] Implement Docker Secrets Management
**Description:** Move away from plaintext `.env` files for production to utilize Docker Secrets for sensitive tokens.
**Acceptance Criteria:**
- Application entrypoint reads from `/run/secrets/<secret_name>` if environment variables are missing.
- `docker-compose.prod.yml` maps Docker Secrets for Telegram, Slack, and Email credentials.
- Staging example `.env.staging.example` and local dummy `secrets/` directory are provided.
**Story Points:** 5

### Issue #9: [Story] Document Deployment and Firewall Rules
**Description:** As a sysadmin, I need comprehensive documentation to deploy the unified messaging platform securely and configure network access correctly.
**Acceptance Criteria:**
- `README.md` and `DEPLOYMENT.md` are updated.
- Documentation includes required outbound firewall rules (e.g., WSS/443 for Slack, 993, 465/587 for email).
- Instructions for creating and managing Docker Secrets are clear.
- Healthcheck monitoring instructions are provided.
**Story Points:** 2
