# PRD-005: Telegram Integration

## 1. Overview
As part of Phase 3 (Platform Expansion), we are integrating Telegram into Merge Unified Messaging. This will allow users to read and send Telegram messages from our unified timeline interface alongside WhatsApp and Signal.

## 2. Goals
- Implement a backend service to connect to Telegram.
- Support both Bot API (`telegraf`) for automated channels and MTProto (`telegram` / `gramjs`) for user accounts.
- Integrate the Telegram message stream into the existing unified frontend state (`useAppStore`).
- Ensure no API keys or session strings are exposed to the client.

## 3. Phases
### Phase 1: Backend Telegram Service
- Set up a new Node.js service module in `server/src/services/telegramService.ts` (or `.js`).
- Implement basic connection logic using `gramjs` or `telegraf`.
- Create REST endpoints in our Express API proxy to fetch chats and send messages via Telegram.

### Phase 2: Frontend Integration
- Update `useAppStore` to handle the `telegram` platform type.
- Fetch Telegram chats from the new backend endpoints and merge them into the global message timeline.
- Extend `ChatArea.tsx` and `Sidebar.tsx` to display Telegram-specific metadata (icons, styling).

### Phase 3: Security & Testing
- Validate environment variables (`TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_BOT_TOKEN`) using Zod.
- Write Vitest unit tests for the backend Telegram service.

## 4. Success Criteria
- Telegram messages successfully appear in the unified timeline.
- Users can send messages to Telegram contacts from the web UI.
- Backend handles Telegram connection securely without leaking credentials.
