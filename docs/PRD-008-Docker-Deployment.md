# PRD-008: Docker & Deployment (Platform Expansion Update)

## 1. Overview
Entering Phase 4 (Deployment & Scale). We already have a basic Docker setup (`Dockerfile.frontend`, `Dockerfile.proxy`, `docker-compose.yml`), but we need to update our deployment architecture to properly support the newly added platforms (Telegram, Email, Slack) and their environment variables.

## 2. Goals
- Update `docker-compose.yml` and `docker-compose.prod.yml` to include new environment variables (`TELEGRAM_*`, `EMAIL_*`, `SLACK_*`).
- Ensure the Node.js proxy container has the correct network permissions to establish outbound WebSocket (Slack Socket Mode) and IMAP/SMTP connections.
- Document the deployment process in the `README.md`.

## 3. Phases
### Phase 1: Docker Configuration Update
- Update `.env.staging.example` and `.env.production` templates.
- Update `docker-compose` files to pass through the new environment variables.

### Phase 2: Documentation & Sanity Check
- Update `README.md` with instructions on how to obtain and configure Telegram, Email, and Slack API credentials.
- Verify the build process for both containers.

## 4. Success Criteria
- The system can be brought up using `docker-compose up` without crashing due to missing updated environment variables.
- Clear documentation exists for new developers/sysadmins.
