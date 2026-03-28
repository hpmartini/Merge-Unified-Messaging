# PRD Library & Best Practices Review

**Reviewer:** Senior Software Architect  
**Date:** 2026-03-28  
**Documents Reviewed:** PRD-001-API-Security-Proxy.md, PRD-002-User-Authentication.md  
**Current Stack:** Express 5.2.1, React 19, Node.js, @google/genai  

---

## 1. Executive Summary

### Overall Assessment: ⚠️ CONDITIONAL PASS

Both PRDs demonstrate solid security architecture and follow industry patterns. However, **critical library choices are not explicitly specified** in several areas, and some implementations reinvent functionality that battle-tested libraries handle better.

| PRD | Status | Key Issues |
|-----|--------|------------|
| **PRD-001** (API Proxy) | ⚠️ Pass with changes | Custom rate limiter shown; input validation library not specified |
| **PRD-002** (Auth) | ✅ Pass | Correctly uses Argon2, JWT; minor improvements needed |

### Critical Findings

| Priority | Issue | Impact |
|----------|-------|--------|
| 🔴 P0 | PRD-001 shows custom rate limiting implementation | Should use `express-rate-limit` or `rate-limiter-flexible` |
| 🔴 P0 | No input validation library specified in PRD-001 | Should use `zod` or `joi` |
| 🟡 P1 | Custom sanitization function in PRD-001 | Consider `DOMPurify` or `xss` library for robustness |
| 🟡 P1 | `helmet` not mentioned in PRD-001 | Essential for security headers |
| 🟢 P2 | No structured logging library specified | Should use `pino` or `winston` |
| 🟢 P2 | PRD-002 mentions `csurf` but it's deprecated | Use `csrf-csrf` or token-based pattern |

---

## 2. PRD-001 Review: API Security Proxy

### 2.1 Rate Limiting

**PRD States:** Custom in-memory rate limiter implementation (Appendix B, lines ~15-35)

```javascript
// FROM PRD-001 (PROBLEMATIC)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 60;

function rateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  // ... custom implementation
}
```

**Issue:** 🔴 **CRITICAL** — Custom rate limiting is error-prone and lacks:
- Memory leak protection (Map grows unbounded)
- Distributed support (Redis)
- Sliding window algorithms
- Burst protection
- Headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset)

**Recommendation:** Use `express-rate-limit` (14M weekly downloads, actively maintained):

```javascript
import rateLimit from 'express-rate-limit';

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests', retryAfter: 60 });
  }
});
```

For Redis-backed distributed limiting, use `rate-limiter-flexible`:

```javascript
import { RateLimiterRedis } from 'rate-limiter-flexible';
```

**Verdict:** ❌ Must change

---

### 2.2 CORS Handling

**PRD States:** Uses `cors` package ✅

```javascript
// FROM PRD-001 (CORRECT)
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:5173'],
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type']
}));
```

**Status:** ✅ **CORRECT** — `cors` package already in package.json, properly configured.

**Minor Improvement:** Add `credentials: true` if cookies will be sent:

```javascript
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:5173'],
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type'],
  credentials: true  // For refresh token cookies
}));
```

**Verdict:** ✅ Pass

---

### 2.3 Security Headers

**PRD States:** Manual security headers (Section 5.5):

```javascript
// FROM PRD-001 (PROBLEMATIC)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-Request-Id', crypto.randomUUID());
  next();
});
```

**Issue:** 🟡 **SHOULD FIX** — Missing critical headers:
- `Strict-Transport-Security` (HSTS)
- `X-XSS-Protection` (legacy but still useful)
- `X-Permitted-Cross-Domain-Policies`
- `Cross-Origin-Embedder-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`

**Recommendation:** Use `helmet` (1M+ weekly downloads, Express's recommended security middleware):

```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com"]
    }
  }
}));

// Add request ID separately
app.use((req, res, next) => {
  res.setHeader('X-Request-Id', crypto.randomUUID());
  next();
});
```

**Verdict:** ❌ Must change

---

### 2.4 Input Validation

**PRD States:** Manual validation described (Section 4.2), no library specified:

```javascript
// FROM PRD-001 (PROBLEMATIC)
if (!Array.isArray(messages) || messages.length === 0) {
  return res.status(400).json({ error: 'messages array required' });
}
```

**Issue:** 🔴 **CRITICAL** — Manual validation is:
- Verbose and error-prone
- Inconsistent error messages
- Missing type coercion
- No schema reuse

**Recommendation:** Use `zod` (modern, TypeScript-first, 10M weekly downloads) or `joi`:

```typescript
import { z } from 'zod';

const SummarizeRequestSchema = z.object({
  messages: z.array(z.object({
    timestamp: z.string().datetime(),
    sender: z.enum(['me', 'other']),
    senderName: z.string().optional(),
    platform: z.string(),
    content: z.string().max(10000)
  })).min(1).max(500),
  options: z.object({
    blockLimit: z.number().int().min(1).max(50).default(1),
    groupingMinutes: z.number().int().min(1).max(60).default(5),
    includeMe: z.boolean().default(true),
    includeOther: z.boolean().default(true)
  }).default({}),
  contactName: z.string().min(1).max(100)
});

// In route handler
app.post('/api/ai/summarize', async (req, res) => {
  const result = SummarizeRequestSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: result.error.flatten()
    });
  }
  const data = result.data; // Typed and validated
});
```

**Verdict:** ❌ Must add library

---

### 2.5 Content Sanitization

**PRD States:** Custom sanitization (Section 4.2):

```javascript
// FROM PRD-001 (WEAK)
function sanitizeContent(content) {
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .substring(0, 10000);
}
```

**Issue:** 🟡 **SHOULD FIX** — Regex-based sanitization is bypassable:
- `<scr<script>ipt>` bypass
- `java&#x73;cript:` unicode bypass
- Many other XSS vectors

**Recommendation:** For HTML sanitization, use `DOMPurify` (server-side via `jsdom`) or `sanitize-html`:

```javascript
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function sanitizeContent(content) {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [], // Strip ALL HTML
    ALLOWED_ATTR: []
  }).substring(0, 10000);
}
```

However, for AI prompt injection, HTML sanitization is not the main concern. Consider:
1. Simply escaping for display
2. Rate limiting + token limits (already in PRD)
3. Content filtering at the AI layer

**Verdict:** ⚠️ Consider improvement (depends on threat model)

---

### 2.6 Request Logging

**PRD States:** Structured JSON logging described (Section 3.5), no library specified.

**Issue:** 🟢 **NICE TO HAVE** — Custom logging misses:
- Log levels
- Log rotation
- Structured metadata
- Performance (async logging)

**Recommendation:** Use `pino` (fastest) or `winston` (most flexible):

```javascript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty' } 
    : undefined
});

// Request logging middleware
import pinoHttp from 'pino-http';
app.use(pinoHttp({ logger }));
```

**Verdict:** ⚠️ Should add library

---

### 2.7 PRD-001 Summary

| Component | PRD Approach | Recommended Library | Status |
|-----------|--------------|---------------------|--------|
| Rate Limiting | Custom Map-based | `express-rate-limit` | ❌ Change |
| CORS | `cors` package | `cors` | ✅ Correct |
| Security Headers | Manual | `helmet` | ❌ Change |
| Input Validation | Manual checks | `zod` or `joi` | ❌ Add |
| Content Sanitization | Regex | `sanitize-html` / `DOMPurify` | ⚠️ Consider |
| Request Logging | Manual JSON | `pino` or `winston` | ⚠️ Should add |

---

## 3. PRD-002 Review: User Authentication

### 3.1 JWT Handling

**PRD States:** Uses `jsonwebtoken` ✅

```typescript
// FROM PRD-002 (CORRECT)
import jwt from 'jsonwebtoken';

export function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, roles: user.roles },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}
```

**Status:** ✅ **CORRECT** — Industry standard library, proper configuration.

**Minor Note:** Consider `jose` for more modern API and better TypeScript support, but `jsonwebtoken` is perfectly fine.

**Verdict:** ✅ Pass

---

### 3.2 Password Hashing

**PRD States:** Uses `argon2` with Argon2id variant ✅

```typescript
// FROM PRD-002 (CORRECT)
import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,    // 64 MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32
};
```

**Status:** ✅ **EXCELLENT** — Argon2id is the OWASP-recommended algorithm (2024). Parameters are appropriate:
- 64MB memory (good for server-side)
- 3 iterations (reasonable balance)
- 4 parallelism (matches typical CPU cores)

**Verdict:** ✅ Pass

---

### 3.3 Session/Token Storage

**PRD States:** PostgreSQL for sessions, HttpOnly cookies for refresh tokens ✅

**Status:** ✅ **CORRECT** — This is the recommended approach:
- Refresh tokens in HttpOnly cookies (XSS-immune)
- Server-side session validation (revocation support)
- PostgreSQL with proper indexing

**Note:** PRD correctly mentions `express-session` compatibility (Section 7.4):

```typescript
// FROM PRD-002
import RedisStore from 'rate-limit-redis';
```

However, the architecture uses custom session handling, not `express-session`. This is **fine** — the JWT + refresh token approach is often better than traditional sessions for SPAs.

**Verdict:** ✅ Pass

---

### 3.4 Rate Limiting (Auth)

**PRD States:** Uses `express-rate-limit` ✅

```typescript
// FROM PRD-002 (CORRECT)
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

export function rateLimiter(options) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore(...) : undefined
  });
}
```

**Status:** ✅ **CORRECT** — Proper library usage with Redis support for distributed environments.

**Verdict:** ✅ Pass

---

### 3.5 CSRF Protection

**PRD States:** Uses `csurf` (Section 8.3):

```typescript
// FROM PRD-002 (DEPRECATED)
import csurf from 'csurf';

export const csrfProtection = csurf({
  cookie: { httpOnly: true, secure: true, sameSite: 'strict' }
});
```

**Issue:** 🟡 **SHOULD FIX** — `csurf` is **deprecated** (archived since 2022) and has known vulnerabilities.

**Recommendation:** Use `csrf-csrf` or implement double-submit cookie pattern:

```javascript
import { doubleCsrf } from 'csrf-csrf';

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: '__Host-csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: true
  }
});

app.use(doubleCsrfProtection);
```

**Alternative:** With SameSite=Strict cookies (which PRD uses), CSRF protection is largely built-in for same-site requests. The PRD's approach is acceptable for the threat model.

**Verdict:** ⚠️ Should update but not critical

---

### 3.6 Security Headers

**PRD States:** Uses `helmet` ✅

```typescript
// FROM PRD-002 (CORRECT)
import helmet from 'helmet';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // ... comprehensive CSP
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
});
```

**Status:** ✅ **EXCELLENT** — Proper `helmet` configuration with HSTS preload.

**Verdict:** ✅ Pass

---

### 3.7 Database Access

**PRD States:** Raw SQL queries with parameterized statements:

```typescript
// FROM PRD-002
const result = await db.query(
  'SELECT id, email FROM users WHERE email = $1',
  [email]
);
```

**Issue:** 🟢 **ACCEPTABLE BUT CONSIDER ORM** — Raw SQL is fine for security (parameterized queries prevent SQL injection), but an ORM provides:
- Type safety (with Prisma/Drizzle)
- Migrations management
- Query building
- Connection pooling (built-in)

**Recommendation:** Consider `Prisma` (most popular, best TypeScript support) or `Drizzle` (lighter, SQL-like):

```typescript
// Prisma example
const user = await prisma.user.findUnique({
  where: { email },
  include: { roles: true }
});
```

**Verdict:** ⚠️ Consider for maintainability (not security-critical)

---

### 3.8 Input Validation

**PRD States:** Manual validation in routes, no library specified.

**Issue:** Same as PRD-001 — should use `zod`:

```typescript
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional()
});

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
  displayName: z.string().min(1).max(100)
});
```

**Verdict:** ⚠️ Should add library

---

### 3.9 PRD-002 Summary

| Component | PRD Approach | Recommended Library | Status |
|-----------|--------------|---------------------|--------|
| JWT | `jsonwebtoken` | `jsonwebtoken` or `jose` | ✅ Correct |
| Password Hashing | `argon2` (Argon2id) | `argon2` | ✅ Correct |
| Session Storage | PostgreSQL + HttpOnly cookies | N/A (custom is fine) | ✅ Correct |
| Rate Limiting | `express-rate-limit` + Redis | Same | ✅ Correct |
| CSRF | `csurf` | `csrf-csrf` (csurf deprecated) | ⚠️ Update |
| Security Headers | `helmet` | `helmet` | ✅ Correct |
| Database | Raw SQL (parameterized) | Prisma or Drizzle (optional) | ⚠️ Consider |
| Input Validation | Manual | `zod` | ⚠️ Should add |

---

## 4. Recommended Library Additions

### 4.1 Required Additions (P0)

```bash
# Rate limiting (for PRD-001)
npm install express-rate-limit

# Security headers (for PRD-001)
npm install helmet

# Input validation (both PRDs)
npm install zod
```

### 4.2 Recommended Additions (P1)

```bash
# Logging (both PRDs)
npm install pino pino-http pino-pretty

# Better CSRF (PRD-002) - if implementing beyond SameSite cookies
npm install csrf-csrf

# Password hashing (PRD-002) - already in PRD
npm install argon2

# JWT (PRD-002) - already in PRD  
npm install jsonwebtoken

# Types for TypeScript
npm install -D @types/express-rate-limit
```

### 4.3 Optional Additions (P2)

```bash
# ORM (if moving from raw SQL)
npm install @prisma/client
npm install -D prisma

# HTML sanitization (if needed)
npm install sanitize-html
npm install -D @types/sanitize-html

# Redis client (for distributed rate limiting)
npm install redis
npm install rate-limit-redis
```

### 4.4 Complete Install Command

```bash
# All required + recommended
npm install express-rate-limit helmet zod pino pino-http argon2 jsonwebtoken

# Dev dependencies
npm install -D @types/express-rate-limit pino-pretty
```

---

## 5. Architectural Concerns

### 5.1 Custom Implementations to Replace

| Location | Current | Should Be |
|----------|---------|-----------|
| PRD-001 Appendix B | Custom rate limiter (Map-based) | `express-rate-limit` middleware |
| PRD-001 Section 4.2 | Manual input validation | `zod` schema validation |
| PRD-001 Section 5.5 | Manual security headers | `helmet` middleware |
| PRD-001 Section 4.2 | Regex sanitization | `sanitize-html` or strip entirely |

### 5.2 File Structure Recommendations

Both PRDs propose reasonable structures. Minor enhancement for shared utilities:

```
server/
├── middleware/
│   ├── auth.ts           # JWT verification (PRD-002)
│   ├── rateLimiter.ts    # express-rate-limit wrapper
│   ├── security.ts       # helmet config
│   └── validate.ts       # zod middleware wrapper
├── schemas/
│   ├── auth.schema.ts    # Login, Register, Reset schemas
│   └── ai.schema.ts      # Summarize, Compose schemas
├── lib/
│   ├── logger.ts         # pino instance
│   ├── db.ts             # Database connection
│   └── redis.ts          # Redis client (optional)
```

### 5.3 Middleware Order (Critical)

```typescript
// server/app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { rateLimiter } from './middleware/rateLimiter';

const app = express();

// 1. Security headers FIRST
app.use(helmet());

// 2. CORS before body parsing
app.use(cors({ origin: [...], credentials: true }));

// 3. Request logging
app.use(pinoHttp());

// 4. Body parsing
app.use(express.json({ limit: '1mb' }));

// 5. Rate limiting (before routes)
app.use('/api', rateLimiter);

// 6. Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
```

---

## 6. Action Items

### Priority 0 (Blockers — Must Fix Before Implementation)

| # | Action | PRD | Owner |
|---|--------|-----|-------|
| 1 | Replace custom rate limiter with `express-rate-limit` | PRD-001 | Backend |
| 2 | Add `helmet` for security headers | PRD-001 | Backend |
| 3 | Add `zod` for request validation (both PRDs) | Both | Backend |
| 4 | Update Appendix B sample code to use libraries | PRD-001 | Tech Writer |

### Priority 1 (Should Fix)

| # | Action | PRD | Owner |
|---|--------|-----|-------|
| 5 | Replace `csurf` with `csrf-csrf` or document SameSite sufficiency | PRD-002 | Backend |
| 6 | Add `pino` for structured logging | Both | Backend |
| 7 | Review sanitization approach for AI prompts | PRD-001 | Security |

### Priority 2 (Nice to Have)

| # | Action | PRD | Owner |
|---|--------|-----|-------|
| 8 | Evaluate Prisma/Drizzle for database layer | PRD-002 | Backend |
| 9 | Add Redis support for production rate limiting | Both | DevOps |
| 10 | Create shared validation schemas package | Both | Backend |

---

## 7. Conclusion

Both PRDs demonstrate strong security thinking and follow modern authentication patterns. The main gaps are:

1. **PRD-001 reinvents rate limiting** — This is the biggest issue. Custom rate limiters are notoriously hard to get right and miss edge cases that `express-rate-limit` handles.

2. **Neither PRD specifies input validation library** — Manual validation is verbose and error-prone. `zod` is the modern standard.

3. **PRD-001 uses manual security headers** — `helmet` is the Express ecosystem standard.

After implementing the P0 changes, both PRDs will use battle-tested, actively maintained libraries throughout the security-critical paths.

**Recommended next step:** Update PRD-001 Appendix B (sample implementation) to use `express-rate-limit`, `helmet`, and `zod` before development begins.

---

*Review completed: 2026-03-28 | Reviewer: Senior Software Architect*
