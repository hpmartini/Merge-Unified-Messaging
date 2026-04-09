# PRD-006: Email & Gmail Integration

## 1. Overview
As part of Phase 3 (Platform Expansion), we are integrating Email (IMAP/SMTP) into Merge Unified Messaging. Emails will be treated as long-form messages in the unified timeline, allowing users to read and reply to emails directly from the chat interface.

## 2. Goals
- Implement backend services for IMAP (reading) and SMTP (sending).
- Parse email bodies (stripping HTML where necessary) to display cleanly in the chat UI.
- Support standard credentials (App Passwords) and secure credential handling.
- Seamlessly integrate with the `useAppStore` in the frontend.

## 3. Phases
### Phase 1: Backend Email Service
- Install necessary packages (e.g., `imapflow` or `node-imap` for reading, `nodemailer` for sending, `mailparser` for parsing).
- Create `server/services/emailService.js`.
- Add REST routes (e.g., `GET /api/email/messages`, `POST /api/email/messages`) in `server/routes/email.js`.

### Phase 2: Frontend Integration
- Extend `useAppStore.ts` and create `useEmail.ts` hook.
- Update `ChatArea.tsx` and `Sidebar.tsx` to handle the 'email' platform type.
- Ensure email subjects and bodies are rendered correctly in message bubbles.

### Phase 3: Security & Testing
- Validate IMAP/SMTP credentials using Zod.
- Write Vitest/Supertest tests for the email backend routes, mocking the IMAP/SMTP servers.

## 4. Success Criteria
- Emails are fetched and displayed in the unified timeline.
- Users can send emails using the standard chat composer.
- No raw HTML breaks the React frontend.
