# PRD-010: Feature Parity Across Messaging Platforms

## 1. Executive Summary
The Merge-Unified-Messaging project integrates five distinct communication platforms: WhatsApp, Signal, Telegram, Slack, and Email. The current implementation successfully handles basic text message routing. However, users expect a rich messaging experience that matches the native clients. This PRD outlines the gaps between our current capabilities and the native features of these platforms, and provides an actionable backlog to achieve feature parity.

## 2. Platform Feature Matrix
| Feature | WhatsApp | Signal | Telegram | Slack | Email |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Text Messages** | Yes | Yes | Yes | Yes | Yes |
| **File Attachments**| Yes | Yes | Yes | Yes | Yes |
| **Voice Notes** | Yes | Yes | Yes | Yes | No |
| **Reactions** | Yes | Yes | Yes | Yes | No |
| **Read Receipts** | Yes | Yes | Yes | No* | Tracking (Opt) |
| **Typing Indicators**| Yes | Yes | Yes | Yes | No |
| **Threads/Replies** | Yes (Replies) | Yes (Replies) | Yes (Threads/Rep)| Yes (Threads)| Yes (Threads) |

*\* Slack handles read states differently, primarily via cursor marks.*

## 3. Current Codebase State Analysis
Based on the analysis of `server/` and `src/`:
- **Text Messages**: Fully implemented across all 5 platforms.
- **Threads**: Partially implemented (Slack supports `thread_ts`).
- **File Attachments**: Partially implemented. Frontend has `draftAttachments` and `Attachment` types in `useAppStore.ts` and `ChatArea.tsx`. Backend `signal-server.js` detects attachments (`hasMedia`) but lacks download logic (`// TODO: Download attachments`).
- **Typing Indicators**: Missing. Signal backend catches `typingMessage` but immediately drops it (`// Skip typing messages`).
- **Read Receipts**: Missing. Signal catches `receiptMessage` but doesn't propagate state.
- **Reactions**: Missing entirely from both Frontend and Backend data structures.
- **Voice Notes**: Missing entirely.

## 4. Product Requirements
We must support the following capabilities in our Unified Chat UI and map them to the respective backend services:
1. **Rich Media Sync**: Users can upload, send, receive, and download attachments (images, docs).
2. **Reactions Sync**: Users can react to messages, and native reactions reflect in the unified UI.
3. **Presence & Typing**: Users see when counterparts are typing.
4. **Message Status**: Users see sent, delivered, and read indicators.
5. **Voice Notes**: Users can record and playback audio messages natively in the UI.

## 5. Backlog & Actionable Issues

### Epic 1: File Attachments & Media (High Priority)
**Backend Tasks:**
- `[BE-101]` Implement Signal attachment downloading and saving (Fix `TODO: Download attachments` in `signal-server.js`).
- `[BE-102]` Implement media upload/download for WhatsApp (`whatsapp-web.js` media handler).
- `[BE-103]` Implement media upload/download for Telegram.
- `[BE-104]` Implement media upload/download for Slack.
- `[BE-105]` Unify attachment storage in `server/data/media/` and serve via static endpoints.

**Frontend Tasks:**
- `[FE-101]` Wire `draftAttachments` payload to backend POST endpoints.
- `[FE-102]` Render incoming media (Images/PDFs) inline within `ChatArea.tsx`.

### Epic 2: Read Receipts & Message Status (Medium Priority)
**Backend Tasks:**
- `[BE-201]` Parse and emit `receiptMessage` events from Signal, WhatsApp, and Telegram to the frontend via WebSockets/Events.
- `[BE-202]` Update local database schema to track message status (`sent`, `delivered`, `read`).

**Frontend Tasks:**
- `[FE-201]` Display checkmark icons (✓ and ✓✓) in message bubbles based on message status.

### Epic 3: Typing Indicators (Medium Priority)
**Backend Tasks:**
- `[BE-301]` Remove `// Skip typing messages` in `signal-server.js` and emit typing events.
- `[BE-302]` Capture typing events from WhatsApp, Telegram, and Slack, and route them to the active client.

**Frontend Tasks:**
- `[FE-301]` Add a "User is typing..." animation in `ChatArea.tsx` when a typing event is received.

### Epic 4: Reactions (Low/Medium Priority)
**Backend Tasks:**
- `[BE-401]` Add `reactions` table/column to DB schema.
- `[BE-402]` Parse incoming reaction events from Slack, Telegram, WhatsApp, and Signal.
- `[BE-403]` Expose `POST /messages/:id/react` endpoint to push reactions back to native platforms.

**Frontend Tasks:**
- `[FE-401]` Add emoji picker to message hover states.
- `[FE-402]` Render reaction badges under message bubbles.

### Epic 5: Voice Notes (Low Priority)
**Backend Tasks:**
- `[BE-501]` Treat `.ogg` / `.m4a` PTT (Push To Talk) as special attachments and map them correctly.

**Frontend Tasks:**
- `[FE-501]` Add a microphone button next to the chat input to record audio.
- `[FE-502]` Build an inline audio player for rendering Voice Notes.
