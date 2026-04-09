# PRD-007: Slack Integration

## 1. Overview
As the final part of Phase 3 (Platform Expansion), we are integrating Slack into Merge Unified Messaging. This will allow users to manage Slack DMs, channel messages, and thread replies directly from our unified timeline. This integration ensures seamless communication across platforms from a single interface.

## 2. Goals
- Implement backend connection to a Slack Workspace using robust, modern architecture.
- Receive messages in real-time (DMs, mentions, channel messages) and send replies/threads.
- Seamlessly integrate with the `useAppStore` and existing platform architecture in the frontend.
- Resolve user references appropriately (Slack IDs to human-readable names).

## 3. Architectural Decisions

### 3.1. Slack SDK & Connection Mode
**Decision:** We will use `@slack/bolt` utilizing **Socket Mode** (App-Level Tokens) instead of traditional HTTP Webhooks.
**Rationale:** Socket Mode allows the application to receive events behind corporate firewalls without requiring public HTTP endpoints (avoiding Ngrok or local port-forwarding during development). This significantly simplifies the local development setup and improves security.

### 3.2. Data Structure Mapping (Channels vs. DMs vs. Threads)
**Decision:** We will map Slack's conversational model to our universal message schema as follows:
- **`chatId`:** Maps directly to the Slack Channel ID (for channels) or the DM/Group ID (for direct messages).
- **`threadId`:** Maps to the Slack `thread_ts` timestamp. This natively supports Slack's threading model within our unified UI.
- **`platform`:** Set to `"slack"`.

### 3.3. User Profile Resolution
**Decision:** We must actively resolve Slack User Profiles (IDs like `U1234567`) to human-readable display names and avatars.
**Rationale:** Slack event payloads typically only contain user IDs. To display messages contextually, the backend will implement a caching resolver (`slackService.getUserProfile(userId)`) that fetches user info via `users.info` API and caches the results to avoid rate-limiting.

## 4. Implementation Phases

### Phase 1: Backend Slack Service Foundation
- Set up Slack App in the Slack API console (enable Socket Mode, configure scopes: `channels:history`, `channels:read`, `chat:write`, `groups:history`, `im:history`, `users:read`).
- Install `@slack/bolt`.
- Implement `server/services/slackService.js` to initialize the Bolt app in Socket Mode.
- Implement event listeners (`app.message`, `app.event('app_mention')`) to ingest incoming messages, normalize them to our schema, and broadcast them via WebSockets to connected clients.
- Implement User Profile Caching to resolve `UXXXXX` IDs to names/avatars.

### Phase 2: Message Sending and REST API
- Add REST routes in `server/routes/slack.js` (e.g., `POST /api/slack/messages`) or leverage our unified sending endpoint with a `slack` provider adapter.
- Implement logic to handle sending standard messages and threaded replies (`thread_ts`).

### Phase 3: Frontend Integration
- Create `useSlack.ts` hook or integrate natively into existing `useAppStore.ts` via generic platform adapter.
- Update `ChatArea.tsx` and `Sidebar.tsx` to handle the `slack` platform type, rendering Slack-specific features (e.g., threads, custom Slack emojis if supported).

### Phase 4: Security & Testing
- Validate Slack tokens and payload structures using Zod.
- Store sensitive tokens (`SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`) securely in `.env`.
- Write Vitest/Supertest tests mocking the Bolt app instance to verify message normalization and event routing.

## 5. Success Criteria
- Slack messages (DMs, channel messages) appear instantly in the unified timeline.
- Threaded replies are correctly grouped and displayed.
- Users can send messages to Slack channels and DMs from the web UI.
- Usernames and avatars are correctly resolved and displayed instead of raw Slack IDs.
- Development environment works out of the box without requiring Ngrok.
