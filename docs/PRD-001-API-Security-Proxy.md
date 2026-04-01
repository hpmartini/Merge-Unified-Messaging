# PRD-001: API Key Security & Backend Proxy

**Document Version:** 1.1  
**Status:** Draft  
**Author:** Product & Security Architecture Team  
**Created:** 2026-03-27  
**Last Updated:** 2026-03-28

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Goals & Success Criteria](#2-goals--success-criteria)
3. [Technical Solution](#3-technical-solution)
4. [Implementation Details](#4-implementation-details)
5. [Security Considerations](#5-security-considerations)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Out of Scope](#7-out-of-scope)
8. [Testing Strategy](#8-testing-strategy)
9. [Rollout Plan](#9-rollout-plan)
10. [Open Questions](#10-open-questions)
11. [Dependencies](#11-dependencies)

---

## 1. Problem Statement

### 1.1 Current State

The Merge Unified Messaging application currently exposes the **Google Gemini API key directly in the frontend bundle**. This is a **critical security vulnerability** that must be addressed immediately.

**Evidence from codebase:**

```typescript
// vite.config.ts (Lines 12-15)
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
}
```

```typescript
// App.tsx (Line 714) & Composer.tsx (Line 340)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
```

The `define` directive in Vite **inlines the API key value directly into the JavaScript bundle** at build time. Anyone can:

1. Open browser DevTools → Sources → search for the API key string
2. Extract the key from the minified bundle
3. Use it for unlimited API calls at the application owner's expense

### 1.2 Security Impact

| Risk Category | Impact | Severity |
|---------------|--------|----------|
| **Financial Exposure** | Unlimited API calls billed to the application owner. Gemini API costs can escalate rapidly with abuse. | **Critical** |
| **Data Exposure** | Malicious actors could use the key to access any Gemini features, potentially including conversation data if stored in Google's systems. | **High** |
| **Service Disruption** | Key abuse could trigger rate limits or account suspension, breaking AI features for legitimate users. | **High** |
| **Compliance Risk** | API keys in client-side code violate security best practices and may breach compliance requirements (SOC2, GDPR data handling). | **Medium** |
| **Reputation Risk** | Security-aware users discovering this vulnerability may lose trust in the application. | **Medium** |

### 1.3 Affected Features

Two frontend features currently use the exposed API key:

1. **Conversation Summarization** (`App.tsx` → `handleSummarize()`)
   - Summarizes conversation history using Gemini
   - Uses `gemini-3-flash-preview` model
   - Accepts user-configurable block limits and grouping

2. **AI Compose Assistance** (`Composer.tsx` → `handleAIAction()`)
   - Draft reply generation
   - Text improvement (grammar/clarity)
   - Tone adjustment (professional/casual)

---

## 2. Goals & Success Criteria

### 2.1 Primary Goal

**Remove all API keys from the frontend bundle.** The Gemini API key must never reach the client, either at build time or runtime.

### 2.2 Secondary Goals

1. **Create a reusable proxy pattern** that can be extended for other third-party services
2. **Maintain feature parity** — all AI features must work identically after migration
3. **Establish secure-by-default patterns** for future AI integrations

### 2.3 Success Criteria

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| API keys in frontend bundle | **0** | Static analysis scan of production build |
| Latency overhead | **< 200ms p95** | Measure end-to-end AI request latency before/after |
| Error rate | **< 0.1%** | Monitor proxy endpoint error rates in production |
| Feature availability | **100%** | All existing AI features functional post-migration |
| Security audit pass | **Pass** | Penetration test confirms no key exposure |

### 2.4 Non-Goals

- Changing the AI provider (Gemini remains the backend)
- Adding new AI features (scope is security-only)
- Implementing user-specific API key management

---

## 3. Technical Solution

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                           │
│                                                                     │
│   ┌─────────────────┐      ┌─────────────────┐                     │
│   │  handleSummarize│      │  handleAIAction │                     │
│   └────────┬────────┘      └────────┬────────┘                     │
│            │                        │                              │
│            └──────────┬─────────────┘                              │
│                       │                                            │
│                       ▼                                            │
│            ┌─────────────────────┐                                 │
│            │   AI Service Client │  (new module)                   │
│            │   /services/ai.ts   │                                 │
│            └─────────┬───────────┘                                 │
│                      │                                             │
└──────────────────────┼─────────────────────────────────────────────┘
                       │ HTTP POST /api/ai/*
                       │ (Same-origin request)
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js)                               │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                   AI Proxy Server                           │  │
│   │                   server/ai-proxy.js                        │  │
│   │                                                             │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │  │
│   │  │  /summarize  │  │  /compose    │  │  /improve    │      │  │
│   │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │  │
│   │         │                 │                 │               │  │
│   │         └─────────────────┼─────────────────┘               │  │
│   │                           ▼                                 │  │
│   │              ┌────────────────────────┐                     │  │
│   │              │  Request Validation    │ ← zod schemas       │  │
│   │              │  Rate Limiting         │ ← express-rate-limit│  │
│   │              │  Input Sanitization    │                     │  │
│   │              └───────────┬────────────┘                     │  │
│   │                          ▼                                  │  │
│   │              ┌────────────────────────┐                     │  │
│   │              │   Gemini Client        │                     │  │
│   │              │   (API_KEY from env)   │                     │  │
│   │              └───────────┬────────────┘                     │  │
│   └──────────────────────────┼──────────────────────────────────┘  │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ HTTPS
                               ▼
                    ┌─────────────────────┐
                    │   Google Gemini API │
                    │   (External)        │
                    └─────────────────────┘
```

### 3.2 Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **AI Service Client** (`/services/ai.ts`) | Abstracts AI operations; handles HTTP calls to proxy; provides typed interfaces |
| **AI Proxy Server** (`/server/ai-proxy.js`) | Validates requests with zod; enforces rate limits; calls Gemini API; handles errors |
| **Gemini Client** (internal to proxy) | Manages API key; formats requests for Gemini SDK; parses responses |

### 3.3 Authentication & Authorization Flow

Since Merge is a local-first desktop application without user accounts, we implement **origin-based authentication** with request signing:

```
1. Frontend generates request with timestamp + nonce
2. Request sent to same-origin backend proxy
3. Proxy validates:
   - Origin header (must be same-origin or localhost)
   - Request timestamp (reject if > 5 minutes old)
   - Rate limit check per IP/session (via express-rate-limit)
4. If valid, proxy calls Gemini with server-side API key
5. Response returned to frontend
```

**Note:** For future multi-user or cloud deployments, this should be upgraded to session-based or JWT authentication.

### 3.4 Rate Limiting Strategy (using express-rate-limit)

| Limit Type | Value | Window | Action on Exceed |
|------------|-------|--------|------------------|
| Per-session requests | 60 | 1 minute | 429 Too Many Requests |
| Per-session tokens | 50,000 | 1 hour | 429 with reset time |
| Global requests | 1,000 | 1 minute | 503 Service Unavailable |
| Burst protection | 10 | 10 seconds | 429 with backoff hint |

### 3.5 Error Handling & Logging (using pino + pino-http)

**Error Categories:**

| Error Type | HTTP Status | Client Message | Logging Level |
|------------|-------------|----------------|---------------|
| Validation failure | 400 | Specific field errors | INFO |
| Rate limit exceeded | 429 | Retry-After header | WARN |
| Gemini API error | 502 | "AI service temporarily unavailable" | ERROR |
| Gemini rate limit | 429 | Proxied retry-after | WARN |
| Internal error | 500 | Generic error | ERROR |

**Structured Logging with pino:**

```javascript
import pino from 'pino';
import pinoHttp from 'pino-http';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' 
    ? { target: 'pino-pretty' } 
    : undefined
});

// HTTP request logging middleware
const httpLogger = pinoHttp({
  logger,
  customProps: (req) => ({
    requestId: req.id,
    sessionId: hashSessionId(req.ip, req.headers['user-agent'])
  }),
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      // Exclude body to avoid logging sensitive content
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  }
});
```

**Log Output Format:**

```json
{
  "level": 30,
  "time": 1711612800000,
  "requestId": "abc123",
  "sessionId": "hash-ip-ua",
  "method": "POST",
  "url": "/api/ai/summarize",
  "statusCode": 200,
  "responseTime": 847,
  "tokensUsed": 1250
}
```

---

## 4. Implementation Details

### 4.1 API Endpoint Design (REST)

**Base Path:** `/api/ai`

#### 4.1.1 POST `/api/ai/summarize`

Summarize conversation history.

**Request Validation Schema (zod):**

```typescript
import { z } from 'zod';

const MessageSchema = z.object({
  timestamp: z.string().datetime(),
  sender: z.enum(['me', 'other']),
  senderName: z.string().max(100).optional(),
  platform: z.string().max(50),
  content: z.string().max(10000)
});

const SummarizeOptionsSchema = z.object({
  blockLimit: z.number().int().min(1).max(50).default(1),
  groupingMinutes: z.number().int().min(1).max(60).default(5),
  includeMe: z.boolean().default(true),
  includeOther: z.boolean().default(true)
});

export const SummarizeRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(500),
  options: SummarizeOptionsSchema.optional().default({}),
  contactName: z.string().min(1).max(100)
});

export type SummarizeRequest = z.infer<typeof SummarizeRequestSchema>;
```

**Response Schema:**

```typescript
const SummarizeResponseSchema = z.object({
  summary: z.string(),
  tokensUsed: z.number(),
  cached: z.boolean()
});

export type SummarizeResponse = z.infer<typeof SummarizeResponseSchema>;
```

**Example Request:**

```bash
POST /api/ai/summarize
Content-Type: application/json

{
  "messages": [
    {
      "timestamp": "2026-03-27T10:00:00Z",
      "sender": "other",
      "senderName": "Alice",
      "platform": "WhatsApp",
      "content": "Hey, can we reschedule the meeting?"
    },
    {
      "timestamp": "2026-03-27T10:02:00Z",
      "sender": "me",
      "platform": "WhatsApp",
      "content": "Sure, what time works for you?"
    }
  ],
  "options": {
    "blockLimit": 1
  },
  "contactName": "Alice"
}
```

#### 4.1.2 POST `/api/ai/compose`

Generate or improve message text.

**Request Validation Schema (zod):**

```typescript
const ComposeContextSchema = z.object({
  replyTo: z.object({
    content: z.string().max(10000),
    senderName: z.string().max(100),
    platform: z.string().max(50)
  }).optional(),
  currentDraft: z.string().max(5000).optional()
});

export const ComposeRequestSchema = z.object({
  action: z.enum(['reply', 'improve', 'professional', 'casual']),
  context: ComposeContextSchema.optional().default({})
}).refine(
  (data) => {
    // require currentDraft for improve/professional/casual actions
    if (['improve', 'professional', 'casual'].includes(data.action)) {
      return !!data.context?.currentDraft;
    }
    return true;
  },
  { message: 'currentDraft is required for improve, professional, and casual actions' }
);

export type ComposeRequest = z.infer<typeof ComposeRequestSchema>;
```

**Response Schema:**

```typescript
const ComposeResponseSchema = z.object({
  text: z.string(),
  tokensUsed: z.number()
});

export type ComposeResponse = z.infer<typeof ComposeResponseSchema>;
```

#### 4.1.3 GET `/api/ai/health`

Health check endpoint for monitoring.

**Response:**

```json
{
  "status": "healthy",
  "geminiConnected": true,
  "version": "1.0.0"
}
```

### 4.2 Request/Response Validation with zod

**Validation Middleware:**

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from './logger';

export function validateRequest<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.info({ errors: error.errors }, 'Validation failed');
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}
```

**Sanitization (applied after validation):**

```typescript
// Remove potential injection vectors from validated content
function sanitizeContent(content: string): string {
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}
```

### 4.3 Environment Variable Management

**Required Variables:**

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `AI_PROXY_PORT` | Port for AI proxy server (default: 3044) | No |
| `AI_RATE_LIMIT_REQUESTS` | Requests per minute per session (default: 60) | No |
| `LOG_LEVEL` | Logging verbosity for pino (default: info) | No |

**Loading Strategy:**

```javascript
// server/ai-proxy.js
import { config } from 'dotenv';
import pino from 'pino';

config({ path: '.env.local' }); // Local overrides
config({ path: '.env' });        // Defaults

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  logger.fatal('GEMINI_API_KEY not set');
  process.exit(1);
}
```

### 4.4 Migration Path from Current Code

#### Step 1: Create AI Service Module

```typescript
// services/ai.ts
const AI_PROXY_BASE = ''; // Same origin

export interface SummarizeOptions {
  blockLimit?: number;
  groupingMinutes?: number;
  includeMe?: boolean;
  includeOther?: boolean;
}

export async function summarizeConversation(
  messages: Message[],
  contactName: string,
  options: SummarizeOptions = {}
): Promise<string> {
  const response = await fetch(`${AI_PROXY_BASE}/api/ai/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map(m => ({
        timestamp: m.timestamp.toISOString(),
        sender: m.isMe ? 'me' : 'other',
        platform: m.platform,
        content: m.content
      })),
      contactName,
      options
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Summarization failed');
  }
  
  const data = await response.json();
  return data.summary;
}

export async function composeMessage(
  action: 'reply' | 'improve' | 'professional' | 'casual',
  context: { replyTo?: Message; currentDraft?: string }
): Promise<string> {
  const response = await fetch(`${AI_PROXY_BASE}/api/ai/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, context })
  });
  
  if (!response.ok) {
    throw new Error('AI compose failed');
  }
  
  const data = await response.json();
  return data.text;
}
```

#### Step 2: Update App.tsx

```diff
- import { GoogleGenAI } from "@google/genai";
+ import { summarizeConversation } from './services/ai';

  const handleSummarize = async () => {
-   if (!process.env.API_KEY) {
-     console.error("API Key not found");
-     return;
-   }
    if (isSummarizing) return;
    
    // ... validation code unchanged ...
    
    setIsSummarizing(true);
    setSummary(null);
    
    try {
-     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
-     // ... prompt construction ...
-     const response = await ai.models.generateContent({ ... });
-     setSummary(response.text || "No summary available.");
+     const summary = await summarizeConversation(
+       finalMessages,
+       selectedUser.name,
+       summaryOptions
+     );
+     setSummary(summary || "No summary available.");
    } catch (e) {
      console.error("Summarization failed", e);
      setSummary("Failed to generate summary.");
    } finally {
      setIsSummarizing(false);
    }
  };
```

#### Step 3: Update Composer.tsx

```diff
- import { GoogleGenAI } from "@google/genai";
+ import { composeMessage } from '../services/ai';

  const handleAIAction = async (action: 'reply' | 'improve' | 'professional' | 'casual') => {
    setIsAIDropdownOpen(false);
-   
-   if (!process.env.API_KEY) {
-     console.warn("API Key is missing for AI features");
-     return;
-   }
    
    setIsGeneratingAI(true);
    try {
-     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
-     // ... prompt construction ...
-     const response = await ai.models.generateContent({ ... });
-     const text = response.text;
+     const text = await composeMessage(action, {
+       replyTo: replyingTo || undefined,
+       currentDraft: editorRef.current?.innerText || ''
+     });
      
      if (text && editorRef.current) {
        // ... rest unchanged ...
      }
    } catch (error) {
      console.error("AI Generation failed", error);
    } finally {
      setIsGeneratingAI(false);
    }
  };
```

#### Step 4: Update vite.config.ts

```diff
  export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // ...
-     define: {
-       'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
-       'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
-     },
+     define: {
+       // No API keys exposed to frontend
+     },
      // ...
    };
  });
```

#### Step 5: Update package.json Scripts

```diff
  "scripts": {
    "dev": "vite",
-   "dev:all": "concurrently \"npm run dev\" \"npm run whatsapp\" \"npm run signal\"",
+   "dev:all": "concurrently \"npm run dev\" \"npm run whatsapp\" \"npm run signal\" \"npm run ai-proxy\"",
    "whatsapp": "node server/whatsapp-server.js",
    "signal": "node server/signal-server.js",
+   "ai-proxy": "node server/ai-proxy.js",
    // ...
  }
```

---

## 5. Security Considerations

### 5.1 API Key Storage

| Environment | Storage Method | Access Control |
|-------------|----------------|----------------|
| Development | `.env.local` (gitignored) | Developer machine only |
| CI/CD | GitHub Secrets / GitLab CI Variables | Repository admins only |
| Production | Environment variables via deployment platform | Deployment config only |

**Never commit API keys to version control.**

Add to `.gitignore`:

```
.env.local
.env.production.local
*.key
```

### 5.2 Request Validation & Sanitization

**Defense in Depth:**

1. **Origin validation** — Reject requests from unexpected origins
2. **Content-Type enforcement** — Only accept `application/json`
3. **Schema validation with zod** — Reject malformed requests with detailed errors
4. **Content sanitization** — Strip dangerous patterns before AI processing
5. **Size limits** — Prevent memory exhaustion attacks (enforced by zod schemas)

### 5.3 CORS Configuration

```javascript
// server/ai-proxy.js
import cors from 'cors';

const ALLOWED_ORIGINS = [
  'http://localhost:3001',  // Vite dev
  'http://localhost:5173',  // Vite default
  'http://127.0.0.1:3001',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no origin header)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));
```

### 5.4 Audit Logging with pino

All AI proxy requests are logged with:

- Request timestamp
- Request ID (for tracing)
- Endpoint called
- Response status code
- Latency
- Token usage
- Session identifier (hashed IP + user-agent)

Logs are structured JSON for easy parsing and can be shipped to any log aggregator.

### 5.5 Security Headers with helmet

```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

---

## 6. Non-Functional Requirements

### 6.1 Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Proxy latency overhead | < 50ms p50, < 200ms p95 | Users shouldn't notice proxy layer |
| End-to-end AI response | < 5s p95 | Gemini latency dominates; proxy shouldn't add significantly |
| Throughput | 100 req/s | Sufficient for local/small-team use |
| Memory usage | < 100MB | Lightweight proxy |

### 6.2 Scalability Considerations

**Current scope:** Single-node, local-first application.

**Future-proofing:**

- Stateless proxy design enables horizontal scaling
- Rate limiting uses in-memory store (can migrate to Redis for multi-node via `rate-limit-redis`)
- Request logging compatible with centralized logging (pino outputs JSON)

### 6.3 Monitoring & Alerting

**Metrics to Export:**

| Metric | Type | Alert Threshold |
|--------|------|-----------------|
| `ai_proxy_requests_total` | Counter | — |
| `ai_proxy_request_duration_ms` | Histogram | p95 > 500ms |
| `ai_proxy_errors_total` | Counter | > 10/minute |
| `ai_proxy_rate_limit_hits` | Counter | > 50/minute |
| `gemini_api_errors_total` | Counter | > 5/minute |

**Health Check Endpoint:**

```
GET /api/ai/health

{
  "status": "healthy",
  "uptime": 3600,
  "geminiStatus": "connected"
}
```

### 6.4 Availability

- Proxy starts automatically with `npm run dev:all`
- Graceful degradation: AI features show "unavailable" if proxy is down
- No hard dependency on proxy for core messaging features

---

## 7. Out of Scope

The following are explicitly **NOT** covered by this PRD:

| Item | Reason |
|------|--------|
| Changing AI provider (e.g., to OpenAI) | Separate initiative |
| Adding new AI features | Security-focused scope |
| User-specific API key support | No user auth system currently |
| Caching AI responses | Optimization, not security-critical |
| WebSocket-based AI streaming | Enhancement for future |
| End-to-end encryption of AI payloads | Overkill for local-first app |
| Multi-tenant rate limiting | No multi-user support |
| AI model selection UI | Feature, not security |
| Mobile/native platform support | Web-only currently |

---

## 8. Testing Strategy

### 8.1 Unit Tests for Proxy Endpoints

**Framework:** Vitest

```typescript
// server/__tests__/ai-proxy.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../ai-proxy';

describe('POST /api/ai/summarize', () => {
  it('returns 400 for missing messages array', async () => {
    const res = await request(app)
      .post('/api/ai/summarize')
      .send({ contactName: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.details[0].path).toBe('messages');
  });

  it('returns 400 for oversized message content', async () => {
    const res = await request(app)
      .post('/api/ai/summarize')
      .send({
        messages: [{ 
          content: 'x'.repeat(15000), 
          timestamp: new Date().toISOString(),
          sender: 'other',
          platform: 'test'
        }],
        contactName: 'Test'
      });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toContain('10000');
  });

  it('sanitizes script tags from content', async () => {
    const mockGemini = vi.fn().mockResolvedValue({ text: 'Summary' });
    
    await request(app)
      .post('/api/ai/summarize')
      .send({
        messages: [{
          content: 'Hello <script>alert("xss")</script> world',
          timestamp: new Date().toISOString(),
          sender: 'other',
          platform: 'test'
        }],
        contactName: 'Test'
      });
    
    // Verify sanitization occurred
    expect(mockGemini).not.toHaveBeenCalledWith(
      expect.stringContaining('<script>')
    );
  });

  it('enforces rate limits', async () => {
    const validPayload = {
      messages: [{
        content: 'test',
        timestamp: new Date().toISOString(),
        sender: 'other',
        platform: 'test'
      }],
      contactName: 'Test'
    };

    // Send 61 requests rapidly
    for (let i = 0; i < 60; i++) {
      await request(app).post('/api/ai/summarize').send(validPayload);
    }
    
    const res = await request(app).post('/api/ai/summarize').send(validPayload);
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});

describe('POST /api/ai/compose', () => {
  it('validates action enum', async () => {
    const res = await request(app)
      .post('/api/ai/compose')
      .send({ action: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.details[0].path).toBe('action');
  });

  it('requires currentDraft for improve action', async () => {
    const res = await request(app)
      .post('/api/ai/compose')
      .send({ action: 'improve', context: {} });
    expect(res.status).toBe(400);
  });
});
```

### 8.2 Integration Tests with Gemini API

**Note:** Use Google's test/sandbox credentials or mock responses for CI.

```typescript
describe('Gemini Integration', () => {
  // Only run with real API key
  const runIntegration = process.env.GEMINI_API_KEY_TEST;
  
  (runIntegration ? it : it.skip)('successfully summarizes a conversation', async () => {
    const res = await request(app)
      .post('/api/ai/summarize')
      .send({
        messages: [
          { content: 'Meeting tomorrow?', timestamp: '2026-03-27T10:00:00Z', sender: 'other', platform: 'test' },
          { content: 'Yes, 2pm works', timestamp: '2026-03-27T10:01:00Z', sender: 'me', platform: 'test' }
        ],
        contactName: 'Colleague'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.summary).toContain('meeting');
    expect(res.body.tokensUsed).toBeGreaterThan(0);
  });
});
```

### 8.3 Security Tests

```typescript
describe('Security', () => {
  it('rejects requests from disallowed origins', async () => {
    const res = await request(app)
      .post('/api/ai/summarize')
      .set('Origin', 'https://evil.com')
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  it('does not expose API key in error responses', async () => {
    const res = await request(app)
      .post('/api/ai/summarize')
      .send(invalidPayload);
    
    const bodyString = JSON.stringify(res.body);
    expect(bodyString).not.toContain(process.env.GEMINI_API_KEY);
  });

  it('includes security headers in responses', async () => {
    const res = await request(app).get('/api/ai/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});
```

### 8.4 Frontend Integration Tests

```typescript
// services/__tests__/ai.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { summarizeConversation, composeMessage } from '../ai';

describe('AI Service Client', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it('sends correctly formatted summarize request', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ summary: 'Test summary' }));
    
    const messages = [{ id: '1', content: 'Hello', timestamp: new Date(), isMe: true, platform: 'Signal' }];
    await summarizeConversation(messages, 'Contact Name');
    
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/summarize',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });

  it('throws on non-OK response', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ message: 'Rate limited' }), { status: 429 });
    
    await expect(summarizeConversation([], 'Test')).rejects.toThrow('Rate limited');
  });
});
```

### 8.5 Bundle Security Verification

```bash
# Post-build verification script
# scripts/verify-no-secrets.sh

#!/bin/bash
set -e

BUILD_DIR="dist"

# Patterns to search for (case-insensitive)
PATTERNS=(
  "AIza[0-9A-Za-z_-]{35}"  # Google API key pattern
  "GEMINI_API_KEY"
  "API_KEY"
  "sk-[a-zA-Z0-9]{48}"     # OpenAI pattern (future-proofing)
)

echo "Scanning build for exposed secrets..."

for pattern in "${PATTERNS[@]}"; do
  if grep -rliE "$pattern" "$BUILD_DIR"; then
    echo "❌ SECURITY ALERT: Found potential secret matching '$pattern'"
    exit 1
  fi
done

echo "✅ No secrets found in build output"
```

Add to CI pipeline:

```yaml
# .github/workflows/security.yml
- name: Build
  run: npm run build

- name: Verify no secrets in bundle
  run: ./scripts/verify-no-secrets.sh
```

---

## 9. Rollout Plan

### 9.1 Phase 1: Development (Days 1-3)

| Task | Owner | Duration |
|------|-------|----------|
| Create `server/ai-proxy.js` with express-rate-limit, zod, helmet, pino | Backend Dev | 1 day |
| Create `services/ai.ts` | Frontend Dev | 0.5 day |
| Write unit tests with Vitest | QA/Dev | 0.5 day |
| Local integration testing | Dev Team | 1 day |

**Exit Criteria:**
- All tests pass locally
- AI features work via proxy
- No API key in Vite config

### 9.2 Phase 2: Staging (Days 4-5)

| Task | Owner | Duration |
|------|-------|----------|
| Deploy to staging environment | DevOps | 0.5 day |
| Run integration test suite | QA | 0.5 day |
| Security scan of staging build | Security | 0.5 day |
| Performance testing (latency verification) | QA | 0.5 day |

**Exit Criteria:**
- Zero secrets in bundle (verified by script)
- Latency overhead < 200ms p95
- All AI features functional

### 9.3 Phase 3: Production Rollout (Day 6)

| Task | Owner | Duration |
|------|-------|----------|
| Final security review | Security Lead | 2 hours |
| Deploy to production | DevOps | 1 hour |
| Smoke test AI features | QA | 1 hour |
| Monitor error rates | On-call | 4 hours |

**Rollback Trigger:**
- Error rate > 5% for AI endpoints
- Latency > 1s p95
- Any API key exposure detected

**Rollback Procedure:**
1. Revert frontend to previous version (removes proxy calls)
2. Keep proxy running (no harm if unused)
3. Analyze and fix
4. Re-deploy with fix

### 9.4 Backward Compatibility

**During Migration:**

The frontend will be updated to use the proxy. There's no fallback to direct Gemini calls because:

1. Direct calls are the security vulnerability we're fixing
2. Users without proxy will see "AI features unavailable" (graceful degradation)
3. Clean cutover is preferred over gradual migration for security

**Post-Migration:**

- Remove `@google/genai` from frontend `package.json`
- Remove all `process.env.API_KEY` references from frontend
- Update documentation

---

## 10. Open Questions

| # | Question | Stakeholder | Decision Needed By |
|---|----------|-------------|-------------------|
| 1 | Should we implement response caching for identical summarization requests? | Product | Phase 2 (enhancement) |
| 2 | Do we need to support multiple Gemini API keys (e.g., for load distribution)? | Ops | Before scaling |
| 3 | Should the proxy be a separate deployable service or bundled with existing servers? | Architect | Before implementation |
| 4 | What's the acceptable error message when proxy is unavailable? | UX | Before implementation |
| 5 | Should we add usage analytics/telemetry to track AI feature adoption? | Product | Future enhancement |
| 6 | Do we need to support user-provided API keys for power users? | Product | Out of scope for v1 |

---

## 11. Dependencies

### 11.1 NPM Packages

> **⚠️ IMPORTANT: Express 5.x Migration (Updated 2026-04-01)**
> 
> Based on [RESEARCH-TECH-STACK.md](./RESEARCH-TECH-STACK.md), we are using **Express 5.x** which includes:
> - **Breaking Changes:** No regex routes, use Zod for validation instead
> - **Node.js ≥18 required**
> - **Automatic async error handling** (rejected promises caught automatically)
> - **Body parser changes:** `urlencoded({ extended: false })` is now default
> - **CVE-2024-45590 fixed:** Prototype pollution via body-parser depth limit
> 
> See migration guide: https://expressjs.com/en/guide/migrating-5.html

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `express` | **^5.2.1** | HTTP server framework | ⚠️ Major upgrade from 4.x - see breaking changes |
| `express-rate-limit` | **^8.3.2** | Rate limiting middleware | Includes IPv6 bypass fix, new Store API |
| `zod` | **^4.3.6** | Schema validation | Required for Express 5.x (replaces regex routes) |
| `helmet` | **^8.1.0** | Security headers | New COOP/COEP/CORP headers |
| `pino` | **^10.3.1** | Structured logging | Node.js 18+ required, ESM-first |
| `pino-http` | **^10.4.0** | HTTP request logging | |
| `pino-pretty` | ^13.0.0 | Pretty-print logs (dev only) | |
| `cors` | **^2.8.6** | CORS middleware | Stable API |
| `@google/genai` | ^0.5.0 | Gemini SDK (server-side only) | |
| `dotenv` | ^16.3.1 | Environment variable loading | |

### 11.2 Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^1.2.0 | Test framework |
| `supertest` | ^6.3.4 | HTTP testing |
| `@types/express` | ^5.0.0 | TypeScript types (Express 5.x) |
| `@types/cors` | ^2.8.17 | TypeScript types |

### 11.3 Installation

```bash
# Production dependencies (Express 5.x stack)
npm install express@^5.2.1 express-rate-limit@^8.3.2 zod@^4.3.6 helmet@^8.1.0 \
  pino@^10.3.1 pino-http@^10.4.0 cors@^2.8.6 @google/genai dotenv

# Dev dependencies  
npm install -D vitest supertest pino-pretty@^13.0.0 @types/express @types/cors
```

### 11.4 Express 5.x Migration Checklist

Before deploying, ensure:

- [ ] **Node.js ≥18** installed in all environments
- [ ] **No regex routes** — use Zod validation middleware instead
- [ ] **Update deprecated methods:**
  - `res.send(status, body)` → `res.status(status).send(body)`
  - `res.redirect('back')` → `res.redirect(req.get('Referrer') || '/')`
- [ ] **Optional params syntax:** `/:optional?` → `{/:optional}`
- [ ] **Trust proxy:** Ensure `app.set('trust proxy', 1)` for correct IP detection
- [ ] **Body parser defaults:** Review `urlencoded({ extended: false })` behavior

---

## Appendix A: File Structure After Implementation

```
Merge-Unified-Messaging/
├── server/
│   ├── ai-proxy.js          # NEW: AI proxy server
│   ├── schemas/
│   │   └── ai.ts             # NEW: zod schemas
│   ├── middleware/
│   │   ├── validate.ts       # NEW: zod validation middleware
│   │   └── logger.ts         # NEW: pino logger setup
│   ├── signal-server.js      # Existing
│   └── whatsapp-server.js    # Existing
├── services/
│   └── ai.ts                 # NEW: Frontend AI service client
├── components/
│   ├── Composer.tsx          # MODIFIED: Use ai.ts
│   └── ...
├── App.tsx                   # MODIFIED: Use ai.ts
├── vite.config.ts            # MODIFIED: Remove API key defines
├── .env.example              # NEW: Document required env vars
├── .env.local                # Local secrets (gitignored)
└── scripts/
    └── verify-no-secrets.sh  # NEW: CI security check
```

---

## Appendix B: Sample AI Proxy Implementation

```javascript
// server/ai-proxy.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { createServer } from 'http';
import { GoogleGenAI } from "@google/genai";
import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' 
    ? { target: 'pino-pretty' } 
    : undefined
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  logger.fatal('GEMINI_API_KEY environment variable not set');
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.AI_PROXY_PORT) || 3044;

// Initialize Gemini client
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ============================================
// ZOD SCHEMAS
// ============================================
const MessageSchema = z.object({
  timestamp: z.string(),
  sender: z.enum(['me', 'other']),
  senderName: z.string().max(100).optional(),
  platform: z.string().max(50),
  content: z.string().max(10000)
});

const SummarizeRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(500),
  options: z.object({
    blockLimit: z.number().int().min(1).max(50).default(1),
    groupingMinutes: z.number().int().min(1).max(60).default(5),
    includeMe: z.boolean().default(true),
    includeOther: z.boolean().default(true)
  }).optional().default({}),
  contactName: z.string().min(1).max(100)
});

const ComposeRequestSchema = z.object({
  action: z.enum(['reply', 'improve', 'professional', 'casual']),
  context: z.object({
    replyTo: z.object({
      content: z.string().max(10000),
      senderName: z.string().max(100),
      platform: z.string().max(50)
    }).optional(),
    currentDraft: z.string().max(5000).optional()
  }).optional().default({})
});

// ============================================
// MIDDLEWARE
// ============================================

// HTTP request logging
app.use(pinoHttp({ logger }));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"]
    }
  }
}));

// JSON parsing
app.use(express.json({ limit: '1mb' }));

// CORS
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3001'],
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.AI_RATE_LIMIT_REQUESTS) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip }, 'Rate limit exceeded');
    res.status(429).json({ 
      error: 'Rate limit exceeded', 
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});
app.use('/api/ai', limiter);

// Validation middleware factory
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.info({ errors: error.errors }, 'Validation failed');
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

// Sanitize content
function sanitize(content) {
  if (typeof content !== 'string') return '';
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '');
}

// ============================================
// ROUTES
// ============================================

// POST /api/ai/summarize
app.post('/api/ai/summarize', validate(SummarizeRequestSchema), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { messages, contactName, options } = req.body;
    
    // Sanitize and format messages
    const sanitizedMessages = messages.map(m => ({
      timestamp: m.timestamp,
      sender: m.sender === 'me' ? 'Me' : contactName,
      content: sanitize(m.content)
    }));
    
    const historyText = sanitizedMessages
      .map(m => `[${m.timestamp}] ${m.sender}: ${m.content}`)
      .join('\n');
    
    const prompt = `You are a helpful assistant for a unified messaging app.
Analyze the following conversation history between "Me" (the user) and "${contactName}".
Provide a concise summary in markdown format with:
- **TL;DR**: One sentence overview.
- **Key Topics**: Bullet points of main subjects discussed.
- **Action Items**: Any tasks or follow-ups mentioned (if any).

Conversation History:
${historyText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    
    const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
    
    logger.info({
      endpoint: '/summarize',
      tokensUsed,
      latencyMs: Date.now() - startTime
    }, 'Summarize completed');
    
    res.json({
      summary: response.text || 'No summary available.',
      tokensUsed,
      cached: false
    });
    
  } catch (error) {
    logger.error({ error: error.message }, 'Summarize error');
    res.status(502).json({ error: 'AI service temporarily unavailable' });
  }
});

// POST /api/ai/compose
app.post('/api/ai/compose', validate(ComposeRequestSchema), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { action, context } = req.body;
    
    // Validate currentDraft requirement
    if (['improve', 'professional', 'casual'].includes(action) && !context?.currentDraft) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: [{ path: 'context.currentDraft', message: 'Required for this action' }]
      });
    }
    
    let prompt = '';
    
    if (action === 'reply' && context.replyTo) {
      prompt = `You are a helpful messaging assistant.
Context: I am replying to a message from ${context.replyTo.senderName || 'someone'}.
Their message: "${sanitize(context.replyTo.content)}"
Task: Draft a concise, friendly, and relevant reply.
Output Format: Return ONLY valid HTML suitable for a rich text editor (use <p>, <b>, <i> tags). No markdown.`;
    } else {
      const draft = sanitize(context.currentDraft || '');
      
      switch (action) {
        case 'improve':
          prompt = `Rewrite this to fix grammar and clarity: "${draft}". Output as simple HTML.`;
          break;
        case 'professional':
          prompt = `Make this text more professional: "${draft}". Output as simple HTML.`;
          break;
        case 'casual':
          prompt = `Make this text more casual and friendly: "${draft}". Output as simple HTML.`;
          break;
      }
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    
    let text = response.text || '';
    // Clean markdown code blocks if present
    text = text.replace(/^```html\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
    
    const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
    
    logger.info({
      endpoint: '/compose',
      action,
      tokensUsed,
      latencyMs: Date.now() - startTime
    }, 'Compose completed');
    
    res.json({
      text: text.trim(),
      tokensUsed
    });
    
  } catch (error) {
    logger.error({ error: error.message }, 'Compose error');
    res.status(502).json({ error: 'AI service temporarily unavailable' });
  }
});

// GET /api/ai/health
app.get('/api/ai/health', (req, res) => {
  res.json({
    status: 'healthy',
    geminiConnected: !!GEMINI_API_KEY,
    version: '1.0.0'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = createServer(app);
server.listen(PORT, () => {
  logger.info({ port: PORT }, 'AI Proxy server started');
});

export { app }; // For testing
```

---

**Document End**

*This PRD is ready for review and implementation. Questions? Contact the Security & Architecture team.*
