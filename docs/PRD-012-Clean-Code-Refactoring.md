# PRD-012: Clean Code & Architecture Refactoring Plan

## 1. Executive Summary
This document outlines a comprehensive architectural analysis and refactoring backlog for the `Merge-Unified-Messaging` project. The current codebase suffers from significant technical debt, including massive "God object" files, tight coupling, and inconsistent backend structure. This plan breaks down the refactoring effort into actionable Epics and Tasks for implementation.

## 2. Architectural & Code Quality Analysis

### 2.1 Findings
- **Frontend Monolith (`App.tsx` - 800+ lines):** `App.tsx` is violating the Single Responsibility Principle (SRP). It is directly responsible for data fetching, platform-specific payload normalization (Telegram, Email, Slack, WhatsApp, Signal), complex state merging, and UI rendering.
- **Backend Monoliths (`server/signal-server.js` - 1265 lines & `whatsapp-server.js` - 786 lines):** These files combine server initialization, route definitions, protocol-specific business logic, and data layer interactions. 
- **Inconsistent Folder Structure:** While some services (Telegram, Slack, Email) are properly split into `routes/` and `services/`, Signal and WhatsApp are standalone monolithic scripts at the root of the `server/` folder.
- **Tight Coupling & DRY Violations:** The frontend directly translates external models to internal models inline instead of using an Adapter pattern. The backend likely duplicates common error handling, logging, and routing logic across the standalone servers.

### 2.2 Evaluation against Clean Code Principles
- **Maintainability:** Low. The massive files make it risky to introduce new features without regressions.
- **Readability:** Poor in the identified monoliths due to deeply nested logic and mixed responsibilities.
- **Reusability (DRY):** Low. Normalization logic and API handling are tightly coupled to the component/server lifecycle.
- **SOLID Principles:** Significant violations of SRP (Single Responsibility Principle) and OCP (Open-Closed Principle) in both the frontend `App` component and backend server files.

---

## 3. Refactoring Backlog (Epics & Tasks)

### Epic 1: Frontend De-coupling and State Management
**Goal:** Extract business logic from `App.tsx`, enforce the Adapter pattern, and modularize the UI.

- **Task 1.1: Extract Data Adapters**
  - Create `src/utils/adapters/` directory.
  - Move the inline mapping logic for `Telegram`, `Email`, `Slack`, `Signal`, and `WhatsApp` from `App.tsx` into standalone adapter functions (e.g., `normalizeTelegramChat(chat)`, `normalizeEmailMessage(msg)`).
- **Task 1.2: Refactor State Management**
  - Extract the massive `useCallback` chains for merging users and messages into a dedicated state management module (e.g., Context API + `useReducer`, Zustand, or a custom hook `useUnifiedChatState.ts`).
- **Task 1.3: Decompose `App.tsx` UI**
  - Break down the visual elements of `App.tsx` into clean, declarative components (e.g., `MainLayout`, `PlatformStatusHeader`, `UnifiedContactList`). `App.tsx` should only compose these components and provide them with the unified state context.

### Epic 2: Backend Modularization
**Goal:** Standardize the backend architecture by breaking down Signal and WhatsApp servers into the `routes`/`services`/`controllers` pattern.

- **Task 2.1: Deconstruct `signal-server.js`**
  - Extract Express routes to `server/routes/signal.js`.
  - Extract protocol logic, socket handling, and DB interactions to `server/services/signalService.js`.
  - Extract the core server initialization to keep it minimal.
- **Task 2.2: Deconstruct `whatsapp-server.js`**
  - Extract routes to `server/routes/whatsapp.js`.
  - Extract business/protocol logic to `server/services/whatsappService.js`.
- **Task 2.3: Restructure `ai-proxy.js`**
  - Move `ai-proxy.js` logic into `server/routes/ai.js` and `server/services/aiService.js` for consistency.

### Epic 3: Standardization & Shared Utilities
**Goal:** Implement shared backend infrastructure to eliminate DRY violations.

- **Task 3.1: Centralize Server Entry Points**
  - If the architecture is a monolith, combine the modularized routes into a single `server/index.js`. (If microservices are intended, ensure consistent Docker/Compose initialization without logic bloat).
- **Task 3.2: Shared Utility Extraction**
  - Identify duplicated logic across the backend (e.g., unified error formatting, token validation, logging) and extract to `server/utils/`.
- **Task 3.3: Remove Dead Code & Cleanup**
  - Audit and remove any unused functions or lingering console logs, ensuring strict ESLint/Prettier compliance.

## 4. Implementation Guidelines for Coding Agents
- **Do not rewrite everything at once.** Tackle tasks iteratively following the sequence above.
- **Run Tests frequently.** Ensure existing tests in `/tests` pass after each Task.
- **Preserve Logic:** Do not change the core behavior or output schemas. Focus purely on structural refactoring.
