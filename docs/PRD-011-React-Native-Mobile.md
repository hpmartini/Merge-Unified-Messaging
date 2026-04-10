# PRD & Backlog: Merge Mobile (React Native / Expo)

## 1. Overview & Objectives
**Project**: Merge-Unified-Messaging Mobile App
**Objective**: Extend the existing React/Express/Node unified messaging platform to iOS and Android natively.
**Vision**: Provide a seamless, unified inbox experience on mobile devices. The app will act as a thin client relying on the existing Node.js backend, which already handles the heavy lifting of interfacing with WhatsApp, Signal daemons, Telegram, Slack, and Email APIs.

## 2. Architecture & Technical Strategy
### 2.1 Stack
*   **Framework**: Expo (React Native) - Chosen for rapid development, built-in OTA updates, and simplified push notification routing.
*   **State Management**: Zustand - Lightweight, un-opinionated, and easy to integrate with React Native without the boilerplate of Redux.
*   **Navigation**: React Navigation (or Expo Router) for native stack navigation and deep linking.
*   **Local Storage (Offline)**: WatermelonDB or Expo SQLite combined with Zustand for persisting message threads locally, ensuring fast load times and offline reading capabilities.

### 2.2 Backend Integration
*   **Real-time Communication**: WebSockets (Socket.io or native WebSockets) connected to the existing Express/Node.js backend.
*   **REST API**: For authentication, fetching historical data, and updating user preferences.
*   **Daemons**: The mobile app will *not* run any background daemons for messaging networks (Signal, WA). It will subscribe to events emitted by the Node backend.

### 2.3 Key Considerations
*   **Offline Capabilities**: 
    *   Must cache recent conversations.
    *   Must queue outgoing messages if the device loses connection, syncing them automatically upon reconnection.
*   **Push Notifications**: 
    *   Use Expo Push Notifications service to normalize APNs (iOS) and FCM (Android) tokens.
    *   The Node.js backend requires a new worker to map incoming daemon events to user device tokens and fire off push notifications.
*   **Background Syncing**: Minimal background execution to fetch new messages when a silent push is received (within iOS/Android OS limits).

---

## 3. Epics & Backlog (GitHub-Style Tasks)

### Epic 1: Project Setup & Infrastructure
*   **[Task] Initialize Expo Project**: Create the base repository using Expo CLI (managed workflow or bare workflow depending on native module needs, prefer managed with custom dev clients). Configure TypeScript, ESLint, and Prettier.
*   **[Task] Setup React Navigation / Expo Router**: Implement the base navigation shell (Auth Stack vs. Main App Tab/Drawer Stack).
*   **[Task] CI/CD Pipeline Setup**: Configure EAS (Expo Application Services) Build for iOS and Android test flight/internal tracks.

### Epic 2: Authentication & Backend Connection
*   **[Task] Implement Login/Auth UI**: Create the login screens natively.
*   **[Task] REST API Client Setup**: Setup Axios/Fetch instances with interceptors for JWT/Session token injection and refresh logic.
*   **[Task] WebSocket Integration**: Implement the WebSocket client. Establish connection lifecycle management (connect, disconnect, auto-reconnect with exponential backoff).

### Epic 3: State Management & Offline Support
*   **[Task] Setup Zustand Store**: Create the global store for unified inbox messages, connection status, and active channels.
*   **[Task] Local Database Integration**: Integrate Expo SQLite or WatermelonDB to persist the Zustand store or message entities.
*   **[Task] Offline Message Queue**: Implement a queue system in Zustand that stores outgoing messages locally when offline and processes them upon WebSocket reconnection.
*   **[Task] Hydration Logic**: Build the startup sequence to load cached messages from local storage before syncing delta updates from the server.

### Epic 4: Core Messaging UI
*   **[Task] Unified Inbox View**: Build the main list view showing consolidated threads (WhatsApp, Telegram, Slack, etc.) sorted by recency. Include visual indicators for the source platform.
*   **[Task] Chat Thread View**: Build the individual conversation screen. Support rendering text, basic images, and system messages.
*   **[Task] Message Input Component**: Build a robust text input with auto-expand, send button, and attachment triggers.
*   **[Task] Optimistic UI Updates**: Ensure messages sent by the user appear immediately in the chat thread before the server acknowledges them.

### Epic 5: Push Notifications
*   **[Task] Expo Push Token Registration**: Implement the frontend logic to request notification permissions and retrieve the Expo Push Token.
*   **[Task] Backend Token API**: Create a REST endpoint on the Node.js backend to register/deregister a device token to a user profile.
*   **[Task] Backend Notification Worker**: Implement logic on the Node backend to listen to incoming daemon messages and dispatch notifications to registered Expo tokens via the Expo Server SDK.
*   **[Task] Foreground/Background Handlers**: Implement frontend listeners to handle tapping on notifications (deep linking to the specific thread) and badging.

### Epic 6: Polish & Platform Specifics
*   **[Task] Haptic Feedback**: Add subtle haptics to message sends, receiving new messages while in-app, and errors.
*   **[Task] Native Share Extension (Optional but recommended)**: Investigate writing an Expo Config Plugin to allow sharing links/images from other apps directly into the Merge app.
*   **[Task] Performance Profiling**: Profile rendering performance on long lists (FlashList migration if necessary).
