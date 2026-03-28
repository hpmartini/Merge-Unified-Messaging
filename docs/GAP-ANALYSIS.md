# Merge Unified Messaging - Gap-Analyse für PRD-Erstellung

**Erstellt:** 2026-03-27  
**Analyst:** Senior Software Architect / Product Owner  
**Repository:** `/home/node/repos/Merge-Unified-Messaging`

---

## 1. Vollständige Feature-Übersicht (IST-Zustand)

### 1.1 Frontend-Features (UI, Komponenten, Flows)

#### ✅ Implementiert

| Feature | Komponente | Status | Qualität |
|---------|------------|--------|----------|
| **Timeline-View** | `App.tsx`, `GraphNode.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Git-ähnliche Visualisierung mit Rails | `GraphNode.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| Platform-Color-Coding (13 Plattformen) | `constants.ts` | Vollständig | ⭐⭐⭐⭐⭐ |
| **Sidebar / Kontaktliste** | `Sidebar.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Global Search (Kontakte + Nachrichten) | `Sidebar.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Debounced Input (150ms) | `Sidebar.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| Relative Zeitanzeige ("2m", "Yesterday") | `Sidebar.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Collapsed/Expanded Responsive Mode | `Sidebar.tsx` | Vollständig | ⭐⭐⭐⭐ |
| **Composer / Nachrichten-Eingabe** | `Composer.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| Rich-Text-Editor (contentEditable) | `Composer.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| Markdown-Shortcuts (# H1, - Lists, **bold**) | `Composer.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| HTML→Markdown Konvertierung | `Composer.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Platform-Selector Dropdown | `Composer.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Attachment-Upload (Drag & Drop) | `App.tsx`, `Composer.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Reply-Context-Handling | `Composer.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Emoji Picker | `EmojiPicker.tsx` | Vollständig | ⭐⭐⭐ |
| **Message-Rendering** | `GraphNode.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| Markdown-Rendering (react-markdown + GFM) | `GraphNode.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| Inline-Media (Bilder, Video, Audio) | `GraphNode.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Audio-Waveform-Visualisierung | `AudioWaveform.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Cross-Platform Reply Visualization (Merge) | `GraphNode.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| Search-Highlighting | `GraphNode.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Document-Preview/Download | `GraphNode.tsx` | Vollständig | ⭐⭐⭐⭐ |
| **Media Gallery** | `MediaGallery.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Bilder-Grid mit Zoom | `MediaGallery.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Dokument-Liste | `MediaGallery.tsx` | Vollständig | ⭐⭐⭐⭐ |
| **Lightbox** | `Lightbox.tsx` | Vollständig | ⭐⭐⭐ |
| **PDF-Viewer** | `PDFViewer.tsx` | Vollständig | ⭐⭐⭐ |
| **Settings Modal** | `SettingsModal.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Theme-Auswahl (Dark/Dimmed/Light) | `SettingsModal.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| Account-Verbindung Flow (QR + Forms) | `SettingsModal.tsx` | Vollständig | ⭐⭐⭐⭐ |
| **Theming-System** | `index.html` (CSS Variables) | Vollständig | ⭐⭐⭐⭐⭐ |
| **Mobile Responsive** | Alle Komponenten | Vorhanden | ⭐⭐⭐ |
| Local Conversation Search | `App.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Platform-Filter pro Konversation | `App.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |

### 1.2 Backend-Features (Server, APIs, Integrationen)

#### ✅ Implementiert

| Feature | Datei | Status | Qualität |
|---------|-------|--------|----------|
| **WhatsApp Integration** | `server/whatsapp-server.js` | Vollständig | ⭐⭐⭐⭐ |
| whatsapp-web.js Client | `whatsapp-server.js` | Vollständig | ⭐⭐⭐⭐ |
| QR-Code Authentication | `whatsapp-server.js` | Vollständig | ⭐⭐⭐⭐ |
| Session-Persistenz (LocalAuth) | `whatsapp-server.js` | Vollständig | ⭐⭐⭐⭐ |
| Message-Caching (JSON) | `whatsapp-server.js` | Vollständig | ⭐⭐⭐⭐ |
| Media-Download & Serving | `whatsapp-server.js` | Vollständig | ⭐⭐⭐⭐ |
| Avatar-Download & Caching | `whatsapp-server.js` | Vollständig | ⭐⭐⭐⭐ |
| WebSocket Real-Time Updates | `whatsapp-server.js` | Vollständig | ⭐⭐⭐⭐⭐ |
| Multi-Session Support | `whatsapp-server.js` | Vollständig | ⭐⭐⭐⭐ |
| Dynamic Port Discovery | `whatsapp-server.js` | Vollständig | ⭐⭐⭐⭐ |
| **Signal Integration** | `server/signal-server.js` | Vollständig | ⭐⭐⭐⭐ |
| signal-cli JSON-RPC Interface | `signal-server.js` | Vollständig | ⭐⭐⭐⭐ |
| Device Linking (QR) | `signal-server.js` | Vollständig | ⭐⭐⭐⭐ |
| Contacts & Groups Sync | `signal-server.js` | Vollständig | ⭐⭐⭐⭐ |
| Signal Desktop Message Import | `signal-server.js` | Vollständig | ⭐⭐⭐⭐ |
| Message-Caching (JSON) | `signal-server.js` | Vollständig | ⭐⭐⭐⭐ |
| Sent-Message Echo Deduplication | `signal-server.js` | Vollständig | ⭐⭐⭐⭐⭐ |
| Cached-Ready Fallback | `signal-server.js` | Vollständig | ⭐⭐⭐⭐⭐ |
| Auto-Start bei vorhandenem Account | `signal-server.js` | Vollständig | ⭐⭐⭐⭐ |
| **React Hooks für Messaging** | `hooks/` | Vollständig | ⭐⭐⭐⭐ |
| `useWhatsApp` Hook | `hooks/useWhatsApp.ts` | Vollständig | ⭐⭐⭐⭐⭐ |
| `useSignal` Hook | `hooks/useSignal.ts` | Vollständig | ⭐⭐⭐⭐⭐ |
| Port-Discovery | Beide Hooks | Vollständig | ⭐⭐⭐⭐ |
| Auto-Reconnect-Logic | Beide Hooks | Teilweise | ⭐⭐⭐ |

### 1.3 AI/ML-Features

| Feature | Implementierung | Status | Qualität |
|---------|-----------------|--------|----------|
| **Conversation Summarization** | `App.tsx` (Gemini) | Vollständig | ⭐⭐⭐⭐ |
| Conversation-Block-Grouping | `App.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| Configurable Block Limit | `App.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| Configurable Grouping Window | `App.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| Participant-Filter (Me/Others) | `App.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| Markdown Summary Output | `App.tsx` | Vollständig | ⭐⭐⭐⭐⭐ |
| **AI-Assisted Composition** | `Composer.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Magic Reply Draft | `Composer.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Grammar Fix | `Composer.tsx` | Vollständig | ⭐⭐⭐⭐ |
| Tone Adjustment (Professional/Casual) | `Composer.tsx` | Vollständig | ⭐⭐⭐⭐ |

### 1.4 Testing, DevOps, Deployment

| Feature | Status | Notizen |
|---------|--------|---------|
| Unit Tests | ❌ NICHT vorhanden | Keine test files |
| Integration Tests | ❌ NICHT vorhanden | - |
| E2E Tests | ❌ NICHT vorhanden | - |
| CI/CD Pipeline | ❌ NICHT vorhanden | Keine GitHub Actions |
| Docker/Container | ❌ NICHT vorhanden | - |
| Production Build | ⚠️ Basisch | Vite build |
| Environment Management | ⚠️ Basisch | Nur .env.local |
| Error Monitoring | ❌ NICHT vorhanden | - |
| Analytics | ❌ NICHT vorhanden | - |
| Logging | ⚠️ Console nur | Kein strukturiertes Logging |

---

## 2. Technische Architektur-Übersicht

### 2.1 Component-Hierarchie

```
App.tsx (1,459 Zeilen - MONOLITH)
├── Sidebar.tsx (416 Zeilen)
│   └── Kontaktliste, Global Search
├── GraphNode.tsx (364 Zeilen)
│   └── AudioWaveform.tsx (Inline Media)
├── Composer.tsx (556 Zeilen)
│   └── EmojiPicker.tsx
├── MediaGallery.tsx (137 Zeilen)
├── Lightbox.tsx (~80 Zeilen)
├── PDFViewer.tsx (~80 Zeilen)
└── SettingsModal.tsx (693 Zeilen)
    └── QR-Code Flow, Account Management
```

### 2.2 Data Flow & State Management

```
┌─────────────────────────────────────────────────────────────────┐
│                        App.tsx (STATE CENTER)                    │
├─────────────────────────────────────────────────────────────────┤
│  useState:                                                       │
│  - users: User[]              - selectedUser: User | null       │
│  - messages: Message[]        - visiblePlatforms: Set<Platform> │
│  - theme: 'dark'|'dimmed'|'light'                               │
│  - searchQuery, localSearchQuery                                │
│  - summary, isSummarizing                                       │
│  - replyingTo: Message | null                                   │
│  - isGalleryOpen, lightboxImage, activePDF                      │
│  - draftAttachments, isUploading, isDragging                    │
│  - showMobileChat, isSettingsOpen                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Custom Hooks (Side-Effects)                  │
├─────────────────────────────────────────────────────────────────┤
│  useWhatsApp(sessionId):                                        │
│    - status, qrCode, user, chats, messages, error, serverPort  │
│    - connect(), disconnect(), sendMessage(), getMessages()      │
│                                                                 │
│  useSignal(sessionId):                                          │
│    - status, linkUri, user, chats, messages, error, serverPort │
│    - connect(), startLink(), sendMessage(), getMessages()       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Servers (WebSocket)                   │
├─────────────────────────────────────────────────────────────────┤
│  whatsapp-server.js (Port 3042+)                                │
│    └── whatsapp-web.js + Puppeteer                              │
│                                                                 │
│  signal-server.js (Port 3043+)                                  │
│    └── signal-cli + JSON-RPC                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 API/Server-Kommunikation

```
Frontend (React)
     │
     ▼ WebSocket
┌────────────────────┐
│ whatsapp-server.js │ ◄── whatsapp-web.js ◄── WhatsApp Web
│ Port: 3042-3050    │
└────────────────────┘
     │
     ▼ REST (Avatars, Media)
/avatars/:filename
/media/:filename
/api/status/:sessionId
/api/sessions
/api/port

┌────────────────────┐
│ signal-server.js   │ ◄── signal-cli ◄── Signal Protocol
│ Port: 3043-3050    │
└────────────────────┘
```

### 2.4 Abhängigkeiten & Tech Stack

**Frontend:**
- React 19.2.3 (Bleeding Edge!)
- TypeScript 5.8.2
- Vite 6.2.0
- Tailwind CSS (CDN)
- Lucide React (Icons)
- react-markdown + remark-gfm
- @google/genai (Gemini API)
- qrcode.react

**Backend (Node.js):**
- Express 5.2.1 (Major Version!)
- whatsapp-web.js 1.34.6
- ws 8.19.0 (WebSocket)
- keytar 7.9.0 (OS Keychain)
- signal-cli (external binary)

**Kritische Observations:**
- ⚠️ React 19 ist noch nicht stabil released (2026-03 aktuell)
- ⚠️ Express 5 ist noch in Beta
- ⚠️ Tailwind via CDN (nicht optimal für Production)
- ⚠️ Keine Lock-File für signal-cli Version

---

## 3. Gap-Analyse (Production-Readiness)

### 3.1 🔴 KRITISCH - Must-Have vor Production

#### 3.1.1 Security & Privacy Gaps

| Gap | Risiko | Aufwand | Priorität |
|-----|--------|---------|-----------|
| **API Key im Client-Bundle** | 🔴 KRITISCH | Mittel | P0 |
| `process.env.API_KEY` wird direkt im Frontend exposed. Jeder kann den Gemini API Key extrahieren. | | | |
| **Keine Authentifizierung** | 🔴 KRITISCH | Hoch | P0 |
| Kein User-Login, keine Session-Verwaltung. Jeder mit Zugriff auf die App kann alle Nachrichten sehen. | | | |
| **CORS: Wildcard** | 🟡 HOCH | Niedrig | P1 |
| `app.use(cors())` erlaubt alle Origins. | | | |
| **Keine HTTPS/TLS** | 🟡 HOCH | Mittel | P1 |
| Server laufen auf HTTP localhost. Für Remote-Zugriff fehlt TLS. | | | |
| **Message-Cache unverschlüsselt** | 🟡 HOCH | Mittel | P1 |
| JSON-Dateien im Klartext auf Disk (`server/data/`, `server/data-signal/`). | | | |
| **Keine Rate-Limiting** | 🟡 MITTEL | Niedrig | P2 |
| API-Endpoints haben kein Rate-Limiting. | | | |

#### 3.1.2 Technische Schulden & Code-Qualität

| Gap | Impact | Aufwand | Priorität |
|-----|--------|---------|-----------|
| **App.tsx Monolith (1,459 Zeilen)** | 🟡 HOCH | Hoch | P1 |
| Alles State-Management in einer Datei. Schwer wartbar, testbar, erweiterbar. | | | |
| **Kein State-Management Library** | 🟡 MITTEL | Mittel | P2 |
| Prop-Drilling durch alle Komponenten. Zustand fragmentiert. | | | |
| **Keine TypeScript Strict Mode** | 🟡 MITTEL | Mittel | P2 |
| `tsconfig.json` hat kein `strict: true`. | | | |
| **Console.log als Logging** | 🟡 MITTEL | Niedrig | P2 |
| Kein strukturiertes Logging, keine Log-Level. | | | |
| **Hardcoded Strings** | 🟡 NIEDRIG | Mittel | P3 |
| Keine i18n-Vorbereitung, alle Texte hardcoded. | | | |

### 3.2 🟡 WICHTIG - Production-Enhancement

#### 3.2.1 Fehlende Platform-Integrationen

| Platform | Definiert | Implementiert | Gap |
|----------|-----------|---------------|-----|
| WhatsApp | ✅ | ✅ | - |
| WhatsApp Business | ✅ | ⚠️ (= WhatsApp) | Echte Business API fehlt |
| Signal | ✅ | ✅ | - |
| Mail/Gmail | ✅ | ❌ | **Komplett fehlend** |
| SMS | ✅ | ❌ | **Komplett fehlend** |
| Telegram | ✅ | ❌ | **Komplett fehlend** |
| Slack | ✅ | ❌ | **Komplett fehlend** |
| Teams | ✅ | ❌ | **Komplett fehlend** |
| Twitter/X | ✅ | ❌ | **Komplett fehlend** |
| LinkedIn | ✅ | ❌ | **Komplett fehlend** |
| Facebook Messenger | ✅ | ❌ | **Komplett fehlend** |
| Instagram DM | ✅ | ❌ | **Komplett fehlend** |
| Threema | ✅ | ❌ | **Komplett fehlend** |

**→ 11 von 13 Plattformen fehlen!**

#### 3.2.2 Testing Coverage

| Bereich | Status | Priorität |
|---------|--------|-----------|
| Unit Tests (React Components) | ❌ 0% | P1 |
| Unit Tests (Hooks) | ❌ 0% | P1 |
| Unit Tests (Server Logic) | ❌ 0% | P1 |
| Integration Tests (WebSocket) | ❌ 0% | P2 |
| E2E Tests (User Flows) | ❌ 0% | P2 |
| Visual Regression | ❌ 0% | P3 |

#### 3.2.3 Performance & Scalability

| Gap | Impact | Notizen |
|-----|--------|---------|
| **Keine Message-Pagination** | 🟡 HOCH | Alle Messages werden geladen |
| **Keine Virtualisierung** | 🟡 HOCH | Bei 1000+ Messages = Performance-Probleme |
| **Kein Service Worker** | 🟡 MITTEL | Offline-Fähigkeit fehlt |
| **Keine Image Lazy-Loading** | 🟡 MITTEL | Alle Bilder sofort geladen |
| **Tailwind via CDN** | 🟡 MITTEL | Unnötig großes Bundle, keine Purge |
| **Single-Process Server** | 🟡 MITTEL | Kein Clustering, kein PM2 |
| **In-Memory State** | 🟡 MITTEL | Server-Restart = State verloren |

#### 3.2.4 Deployment & Infrastructure

| Gap | Status | Priorität |
|-----|--------|-----------|
| Dockerfile | ❌ Fehlt | P1 |
| docker-compose.yml | ❌ Fehlt | P1 |
| Kubernetes Manifests | ❌ Fehlt | P3 |
| GitHub Actions CI | ❌ Fehlt | P1 |
| Environment Config (.env.example) | ❌ Fehlt | P1 |
| Health-Check Endpoints | ❌ Fehlt | P1 |
| Graceful Shutdown | ❌ Fehlt | P2 |
| Database (statt JSON-Dateien) | ❌ Fehlt | P2 |

### 3.3 🟢 Nice-to-Have (Post-MVP)

| Feature | Beschreibung |
|---------|--------------|
| **Contact Merging UI** | Manuelles Mergen von Kontakten über Plattformen |
| **Notification System** | Desktop/Push Notifications |
| **Keyboard Shortcuts** | Power-User Features |
| **Message Reactions** | Emoji-Reactions auf Messages |
| **Read Receipts** | Gelesen-Status anzeigen |
| **Typing Indicators** | "X schreibt..." |
| **Message Editing** | Gesendete Nachrichten bearbeiten |
| **Message Deletion** | Nachrichten löschen |
| **Contact/Group Management** | Kontakte/Gruppen erstellen/bearbeiten |
| **Export/Backup** | Conversation Export (PDF, JSON) |
| **Multi-Account** | Mehrere WhatsApp/Signal Accounts |
| **Desktop App** | Electron Wrapper |
| **Voice/Video Calls** | Integration (komplex) |

---

## 4. PRD-Vorschläge (Priorisiert)

### 4.1 Kritische Sicherheits-PRDs (P0)

| # | PRD-Titel | Scope | Komplexität | Business-Impact |
|---|-----------|-------|-------------|-----------------|
| 1 | **API Key Security & Backend Proxy** | Backend-Proxy für Gemini API, kein Key im Client | Mittel (2-3 Tage) | 🔴 KRITISCH - Ohne das: API Key Leak |
| 2 | **User Authentication System** | Login, Sessions, User-DB, JWT | Hoch (1-2 Wochen) | 🔴 KRITISCH - Ohne das: Keine Multi-User |

### 4.2 Platform-Integration PRDs (P1)

| # | PRD-Titel | Scope | Komplexität | Business-Impact |
|---|-----------|-------|-------------|-----------------|
| 3 | **Telegram Integration** | Bot API + User Client (Telethon/Pyrogram) | Hoch (1 Woche) | 🟡 HOCH - Große Userbase |
| 4 | **Email/Gmail Integration** | IMAP/SMTP + OAuth2, Threading | Hoch (1-2 Wochen) | 🟡 HOCH - Universal wichtig |
| 5 | **Slack Integration** | Slack Bot + Workspace OAuth | Mittel (3-5 Tage) | 🟡 HOCH - Business Users |

### 4.3 Architektur & Qualität PRDs (P1)

| # | PRD-Titel | Scope | Komplexität | Business-Impact |
|---|-----------|-------|-------------|-----------------|
| 6 | **State Management Refactoring** | App.tsx aufteilen, Zustand (Context/Zustand) | Hoch (1 Woche) | 🟡 HOCH - Maintainability |
| 7 | **Testing Foundation** | Jest/Vitest Setup, erste Tests, CI | Mittel (3-5 Tage) | 🟡 HOCH - Quality Gate |
| 8 | **Docker & Deployment** | Dockerfile, docker-compose, Docs | Mittel (2-3 Tage) | 🟡 HOCH - Deployability |

### 4.4 Performance PRDs (P2)

| # | PRD-Titel | Scope | Komplexität | Business-Impact |
|---|-----------|-------|-------------|-----------------|
| 9 | **Message Pagination & Virtualization** | Infinite Scroll, react-window/virtuoso | Mittel (3-5 Tage) | 🟡 MITTEL - UX bei vielen Messages |
| 10 | **Database Migration** | SQLite/PostgreSQL statt JSON-Files | Hoch (1 Woche) | 🟡 MITTEL - Scalability |

---

## 5. Empfohlene Reihenfolge

### Phase 1: Security Foundation (Woche 1-2)
1. **PRD #1** - API Key Security
2. **PRD #2** - User Authentication (minimal: Single-User Auth)

### Phase 2: Architecture Cleanup (Woche 3-4)
3. **PRD #6** - State Management Refactoring
4. **PRD #7** - Testing Foundation

### Phase 3: Platform Expansion (Woche 5-8)
5. **PRD #3** - Telegram Integration
6. **PRD #4** - Email/Gmail Integration
7. **PRD #5** - Slack Integration

### Phase 4: Deployment & Scale (Woche 9-10)
8. **PRD #8** - Docker & Deployment
9. **PRD #9** - Message Pagination
10. **PRD #10** - Database Migration

---

## 6. Zusammenfassung

### Stärken des Projekts
- ✅ Exzellente UI/UX (Git-ähnliche Timeline ist innovativ)
- ✅ Solide WhatsApp & Signal Integration
- ✅ Gute AI-Integration (Summarization, Compose-Assist)
- ✅ Responsives Design
- ✅ Durchdachte Code-Struktur in Komponenten

### Kritische Schwächen
- ❌ **Security**: API Key im Client, keine Auth
- ❌ **Scalability**: Kein State Management, keine DB
- ❌ **Completeness**: 11/13 Plattformen fehlen
- ❌ **Quality**: 0% Test Coverage
- ❌ **Operations**: Kein Docker, kein CI/CD

### Production-Readiness Score
**35/100** - Proof-of-Concept mit exzellentem UI, aber weit von Production entfernt.

**Mindestens PRD #1 und #2 müssen vor jedem externen Deployment umgesetzt werden.**

---

*Erstellt mit Senior Software Architect Expertise für Merge Unified Messaging PRD-Planung.*
