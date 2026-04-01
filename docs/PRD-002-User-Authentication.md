# PRD-002: User Authentication System

**Product:** Merge Unified Messaging  
**Version:** 1.1  
**Status:** Draft  
**Author:** Senior Product Owner / Security Architect  
**Created:** 2026-03-27  
**Last Updated:** 2026-03-28  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Criteria](#3-goals--success-criteria)
4. [User Stories](#4-user-stories)
5. [Technical Solution](#5-technical-solution)
6. [Frontend Changes](#6-frontend-changes)
7. [Backend Changes](#7-backend-changes)
8. [Security Considerations](#8-security-considerations)
9. [Data Privacy](#9-data-privacy)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Out of Scope](#11-out-of-scope)
12. [Testing Strategy](#12-testing-strategy)
13. [Rollout Plan](#13-rollout-plan)
14. [Open Questions & Decisions](#14-open-questions--decisions)
15. [Dependencies](#15-dependencies)
16. [Appendix](#appendix)

---

## 1. Executive Summary

Merge Unified Messaging currently operates without any user authentication system. This represents a **critical security vulnerability** — anyone with network access to the application can view, send, and manage messages across all connected platforms (WhatsApp, Signal, and future integrations).

This PRD defines a comprehensive authentication system that will:
- Protect user data with secure login/session management
- Enable multi-user support with complete message isolation
- Establish the foundation for role-based access control (RBAC)
- Ensure compliance with GDPR, CCPA, and messaging privacy standards

**Priority:** P0 (Critical)  
**Estimated Effort:** 10-14 days  
**Dependencies:** None (foundation for all future features)

---

## 2. Problem Statement

### 2.1 Current State

The Merge Unified Messaging application has **zero authentication**:

```
Current Architecture:
┌────────────┐         ┌─────────────────┐
│  Browser   │ ──────► │  React App      │
│  (Anyone)  │         │  (All Data)     │
└────────────┘         └────────┬────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Backend Servers │
                       │ (No Auth Check) │
                       └────────┬────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        ┌──────────┐     ┌──────────┐     ┌──────────┐
        │ WhatsApp │     │  Signal  │     │ (Future) │
        │ Messages │     │ Messages │     │ Messages │
        └──────────┘     └──────────┘     └──────────┘
```

**Risks:**
- Any user on the network can access all messages
- No audit trail of who accessed what
- No ability to support multiple users
- Credentials/sessions for WhatsApp and Signal are shared

### 2.2 Privacy & Security Risks

| Risk | Severity | Description |
|------|----------|-------------|
| **Unauthorized Message Access** | 🔴 Critical | Third parties can read private conversations |
| **Message Impersonation** | 🔴 Critical | Anyone can send messages as the account owner |
| **Data Exfiltration** | 🔴 Critical | Bulk export of all conversation history |
| **Session Hijacking** | 🔴 Critical | WhatsApp/Signal sessions can be stolen |
| **No Accountability** | 🟡 High | No way to track who performed actions |

### 2.3 Compliance Concerns

| Regulation | Requirement | Current Gap |
|------------|-------------|-------------|
| **GDPR (EU)** | Personal data must be protected with appropriate technical measures (Art. 32) | ❌ No access controls |
| **GDPR (EU)** | Data subject must be able to access only their own data (Art. 15) | ❌ All data visible to all |
| **CCPA (California)** | Reasonable security measures for personal information | ❌ No authentication |
| **ePrivacy Directive** | Confidentiality of electronic communications | ❌ Communications exposed |

### 2.4 Business Impact

- **Cannot deploy to production** without authentication
- **Cannot offer to multiple users** (family, team, etc.)
- **Legal liability** for data breaches
- **Trust erosion** if users discover lack of security

---

## 3. Goals & Success Criteria

### 3.1 Primary Goals

| Goal | Description | Metric |
|------|-------------|--------|
| **G1: Secure Authentication** | Users must authenticate to access the application | 100% of routes protected |
| **G2: Session Management** | Maintain user sessions securely across browser restarts | Sessions persist for 7 days |
| **G3: User Isolation** | Each user sees only their own connected accounts/messages | Zero cross-user data leakage |

### 3.2 Secondary Goals

| Goal | Description | Metric |
|------|-------------|--------|
| **G4: RBAC Foundation** | Design supports future role-based permissions | Schema includes roles table |
| **G5: Audit Trail** | Log authentication events and sensitive operations | All auth events logged |

### 3.3 Success Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| **Login Time** | < 2 seconds | P95 latency from submit to dashboard |
| **Auth Uptime** | 99.9% | Auth service availability |
| **Failed Login Detection** | 5 attempts / 15 min | Rate limiting enforcement |
| **Session Timeout** | 30 min inactive / 7 day max | Automatic logout |
| **Password Reset** | < 5 min email delivery | P95 email delivery time |

---

## 4. User Stories

### 4.1 Authentication

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| **US-001** | As a user, I want to log in with email and password so that only I can access my messages | Login form validates credentials; success redirects to dashboard; failure shows error |
| **US-002** | As a user, I want to stay logged in across browser sessions so I don't have to log in every time | Session persists after browser close; "Remember me" option extends session to 30 days |
| **US-003** | As a user, I want to log out so that others cannot access my account on shared devices | Logout clears all session data; redirect to login; invalidate server-side session |
| **US-004** | As a user, I want to reset my password if I forget it | Email link sent within 5 min; link expires in 1 hour; new password required to differ from old |

### 4.2 Account Management

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| **US-005** | As an admin, I want to create user accounts so that authorized people can access the system | Admin can create users via UI; email + temporary password; force password change on first login |
| **US-006** | As an admin, I want to disable user accounts without deleting them | Disabled users cannot log in; their data remains; can be re-enabled |
| **US-007** | As a user, I want to change my password | Requires current password; validates strength; immediate effect |

### 4.3 Multi-User Support

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| **US-008** | As a user, I want my WhatsApp/Signal connections to be private to my account | Each user has their own linked accounts; cannot see other users' connections |
| **US-009** | As a user, I want my message history to be isolated from other users | Messages/chats scoped to user_id; no cross-user queries possible |

---

## 5. Technical Solution

### 5.1 Authentication Strategy: JWT with HttpOnly Cookie Refresh Tokens

**Recommendation: Hybrid JWT + Refresh Token Architecture**

After evaluating the options, I recommend a **stateless JWT for access** combined with **stateful refresh tokens stored in HttpOnly cookies**.

#### Comparison Matrix

| Criterion | Pure JWT | Pure Session | Hybrid (Recommended) |
|-----------|----------|--------------|----------------------|
| Scalability | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Revocation | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Security | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Complexity | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| XSS Resilience | ⭐⭐ (localStorage) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐     ┌─────────────────────────────────┐   │
│  │  Access Token   │     │      Refresh Token Cookie       │   │
│  │  (Memory only)  │     │  (HttpOnly, Secure, SameSite)   │   │
│  │  Expires: 15min │     │       Expires: 7 days           │   │
│  └────────┬────────┘     └─────────────────┬───────────────┘   │
│           │                                │                    │
└───────────┼────────────────────────────────┼────────────────────┘
            │ Authorization: Bearer <token>  │ Cookie (automatic)
            ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER (Node.js)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐     ┌─────────────────────────────────┐   │
│  │  Auth Middleware │     │      Refresh Endpoint          │   │
│  │  Validates JWT   │     │   /api/auth/refresh-token      │   │
│  │  No DB lookup    │     │      Validates in DB           │   │
│  └─────────────────┘     └─────────────────────────────────┘   │
│                                    │                            │
│                                    ▼                            │
│                          ┌─────────────────┐                    │
│                          │   PostgreSQL    │                    │
│                          │   (Sessions DB) │                    │
│                          └─────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

#### Rationale

1. **Short-lived Access Tokens (15 min)**: Minimize window of compromise
2. **HttpOnly Refresh Tokens**: Immune to XSS attacks (cannot be read by JavaScript)
3. **Server-side Refresh Token Storage**: Enables immediate revocation on logout or security events
4. **Stateless API Validation**: No database hit for normal requests (scalable)

### 5.2 Database Schema

Using PostgreSQL (recommended) or SQLite for development.

```sql
-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    avatar_url      VARCHAR(500),
    
    -- Account status
    is_active       BOOLEAN DEFAULT TRUE,
    is_admin        BOOLEAN DEFAULT FALSE,
    email_verified  BOOLEAN DEFAULT FALSE,
    
    -- Password management
    password_changed_at     TIMESTAMP WITH TIME ZONE,
    force_password_change   BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at   TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- SESSIONS TABLE (Refresh Tokens)
-- ============================================
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   VARCHAR(500) NOT NULL UNIQUE,
    
    -- Device/Browser info
    user_agent      VARCHAR(500),
    ip_address      INET,
    device_name     VARCHAR(100),
    
    -- Validity
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at      TIMESTAMP WITH TIME ZONE,
    
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- ROLES TABLE (Foundation for RBAC)
-- ============================================
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    permissions JSONB DEFAULT '[]',
    
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default roles
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Full system access', '["*"]'),
('user', 'Standard user access', '["read:own", "write:own"]');

-- ============================================
-- USER_ROLES TABLE (Many-to-Many)
-- ============================================
CREATE TABLE user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    
    PRIMARY KEY (user_id, role_id)
);

-- ============================================
-- PASSWORD_RESET_TOKENS TABLE
-- ============================================
CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at     TIMESTAMP WITH TIME ZONE,
    
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_password_reset_user_id ON password_reset_tokens(user_id);

-- ============================================
-- AUDIT_LOG TABLE
-- ============================================
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(50) NOT NULL,
    resource    VARCHAR(100),
    resource_id VARCHAR(100),
    ip_address  INET,
    user_agent  VARCHAR(500),
    details     JSONB,
    
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ============================================
-- PLATFORM ACCOUNTS (User-scoped)
-- ============================================
-- Links messaging platform accounts to users
CREATE TABLE platform_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform        VARCHAR(50) NOT NULL, -- 'whatsapp', 'signal', etc.
    account_id      VARCHAR(255) NOT NULL, -- Platform-specific identifier
    session_data    JSONB, -- Encrypted session/auth data
    display_name    VARCHAR(100),
    
    is_active       BOOLEAN DEFAULT TRUE,
    connected_at    TIMESTAMP WITH TIME ZONE,
    last_sync_at    TIMESTAMP WITH TIME ZONE,
    
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, platform, account_id)
);

CREATE INDEX idx_platform_accounts_user_id ON platform_accounts(user_id);
```

### 5.3 Password Hashing

**Using Argon2id** (winner of Password Hashing Competition, recommended by OWASP):

```typescript
// server/auth/password.ts
import argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,    // 64 MB
  timeCost: 3,          // 3 iterations
  parallelism: 4,       // 4 threads
  hashLength: 32        // 256 bits
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Check if hash needs rehashing (after config changes)
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_OPTIONS);
}
```

### 5.4 JWT Configuration

```typescript
// server/auth/jwt.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

interface AccessTokenPayload {
  sub: string;          // user_id
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

interface RefreshTokenPayload {
  sub: string;          // user_id
  sessionId: string;
  iat: number;
  exp: number;
}

// Access Token: Short-lived, stateless
export function generateAccessToken(user: { id: string; email: string; roles: string[] }): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: user.roles
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

// Refresh Token: Long-lived, stored in DB
export function generateRefreshToken(userId: string, sessionId: string): string {
  return jwt.sign(
    {
      sub: userId,
      sessionId
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
```

### 5.5 Request Validation with zod

All authentication endpoints use zod for input validation:

```typescript
// server/auth/schemas.ts
import { z } from 'zod';

// Password policy schema
const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

// Registration request
export const RegisterRequestSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: passwordSchema,
  displayName: z.string().min(1).max(100)
});

// Login request
export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false)
});

// Password reset request
export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email format')
});

// Password reset completion
export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema
});

// Change password (authenticated)
export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema
}).refine(
  data => data.currentPassword !== data.newPassword,
  { message: 'New password must be different from current password', path: ['newPassword'] }
);

// Types
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
```

### 5.6 Authentication Flows

#### 5.6.1 Registration Flow

```
┌─────────┐       ┌─────────┐       ┌─────────────┐       ┌──────────┐
│ Client  │       │ Server  │       │   Database  │       │  Email   │
└────┬────┘       └────┬────┘       └──────┬──────┘       └────┬─────┘
     │                 │                   │                   │
     │ POST /api/auth/register             │                   │
     │ {email, password, displayName}      │                   │
     │ ───────────────►│                   │                   │
     │                 │                   │                   │
     │                 │ Validate with zod │                   │
     │                 │ Check email unique│                   │
     │                 │ ──────────────────►                   │
     │                 │                   │                   │
     │                 │ Hash password     │                   │
     │                 │ (Argon2id)        │                   │
     │                 │                   │                   │
     │                 │ INSERT user       │                   │
     │                 │ ──────────────────►                   │
     │                 │                   │                   │
     │                 │ Generate verification token           │
     │                 │ ─────────────────────────────────────►│
     │                 │                   │                   │
     │ 201 Created     │                   │                   │
     │ {message: "Check email"}            │                   │
     │ ◄───────────────│                   │                   │
     │                 │                   │                   │
```

#### 5.6.2 Login Flow

```
┌─────────┐       ┌─────────┐       ┌─────────────┐
│ Client  │       │ Server  │       │   Database  │
└────┬────┘       └────┬────┘       └──────┬──────┘
     │                 │                   │
     │ POST /api/auth/login               │
     │ {email, password}                  │
     │ ───────────────►│                   │
     │                 │                   │
     │                 │ Validate with zod │
     │                 │ SELECT user       │
     │                 │ WHERE email = ?   │
     │                 │ ──────────────────►
     │                 │                   │
     │                 │ Verify password   │
     │                 │ (Argon2id)        │
     │                 │                   │
     │                 │ Check is_active   │
     │                 │ Check rate limit  │
     │                 │                   │
     │                 │ Create session    │
     │                 │ INSERT sessions   │
     │                 │ ──────────────────►
     │                 │                   │
     │                 │ Generate tokens   │
     │                 │                   │
     │ 200 OK          │                   │
     │ {accessToken, user}                │
     │ Set-Cookie: refreshToken (HttpOnly)│
     │ ◄───────────────│                   │
     │                 │                   │
     │ Store accessToken in memory        │
     │                 │                   │
```

#### 5.6.3 Token Refresh Flow

```
┌─────────┐       ┌─────────┐       ┌─────────────┐
│ Client  │       │ Server  │       │   Database  │
└────┬────┘       └────┬────┘       └──────┬──────┘
     │                 │                   │
     │ Access token expired (401)         │
     │                 │                   │
     │ POST /api/auth/refresh-token       │
     │ Cookie: refreshToken               │
     │ ───────────────►│                   │
     │                 │                   │
     │                 │ Verify JWT        │
     │                 │ Extract sessionId │
     │                 │                   │
     │                 │ SELECT session    │
     │                 │ WHERE id = ?      │
     │                 │ AND revoked_at IS NULL
     │                 │ AND expires_at > NOW()
     │                 │ ──────────────────►
     │                 │                   │
     │                 │ Generate new tokens│
     │                 │ (Token rotation)   │
     │                 │                   │
     │                 │ UPDATE session    │
     │                 │ SET refresh_token │
     │                 │ ──────────────────►
     │                 │                   │
     │ 200 OK          │                   │
     │ {accessToken}   │                   │
     │ Set-Cookie: refreshToken (new)     │
     │ ◄───────────────│                   │
     │                 │                   │
```

#### 5.6.4 Logout Flow

```
┌─────────┐       ┌─────────┐       ┌─────────────┐
│ Client  │       │ Server  │       │   Database  │
└────┬────┘       └────┬────┘       └──────┬──────┘
     │                 │                   │
     │ POST /api/auth/logout              │
     │ Cookie: refreshToken               │
     │ ───────────────►│                   │
     │                 │                   │
     │                 │ UPDATE session    │
     │                 │ SET revoked_at    │
     │                 │ ──────────────────►
     │                 │                   │
     │ 200 OK          │                   │
     │ Clear-Cookie: refreshToken         │
     │ ◄───────────────│                   │
     │                 │                   │
     │ Clear accessToken from memory      │
     │ Redirect to login                  │
     │                 │                   │
```

---

## 6. Frontend Changes

### 6.1 New Components

| Component | Description | Location |
|-----------|-------------|----------|
| `LoginPage.tsx` | Email/password login form | `components/auth/` |
| `RegisterPage.tsx` | User registration form | `components/auth/` |
| `ForgotPasswordPage.tsx` | Password reset request | `components/auth/` |
| `ResetPasswordPage.tsx` | Set new password (from email link) | `components/auth/` |
| `AuthProvider.tsx` | React Context for auth state | `contexts/` |
| `ProtectedRoute.tsx` | HOC for route protection | `components/auth/` |
| `UserMenu.tsx` | Avatar dropdown with logout | `components/` |

### 6.2 Login Screen UI

```tsx
// components/auth/LoginPage.tsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await login(email, password, rememberMe);
      // Redirect handled by AuthProvider
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <div className="w-full max-w-md p-8 bg-zinc-800 rounded-lg shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Merge</h1>
          <p className="text-zinc-400 mt-2">Sign in to your account</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-2 bg-zinc-700 border border-zinc-600 rounded 
                         text-white placeholder-zinc-400 focus:outline-none 
                         focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-2 bg-zinc-700 border border-zinc-600 rounded 
                         text-white placeholder-zinc-400 focus:outline-none 
                         focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-700"
              />
              <span className="ml-2 text-sm text-zinc-300">Remember me</span>
            </label>
            
            <a href="/forgot-password" className="text-sm text-blue-400 hover:underline">
              Forgot password?
            </a>
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                       text-white font-medium rounded transition-colors"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### 6.3 Auth Context & Provider

```tsx
// contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Store access token in memory (not localStorage - XSS protection)
let accessToken: string | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to refresh the session
  useEffect(() => {
    refreshAuth().finally(() => setIsLoading(false));
  }, []);

  // Auto-refresh access token before expiry
  useEffect(() => {
    if (!accessToken) return;
    
    // Refresh 1 minute before expiry (14 min for 15 min token)
    const refreshInterval = setInterval(refreshAuth, 14 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [accessToken]);

  async function login(email: string, password: string, rememberMe = false) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies
      body: JSON.stringify({ email, password, rememberMe })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    accessToken = data.accessToken;
    setUser(data.user);
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } finally {
      accessToken = null;
      setUser(null);
    }
  }

  async function refreshAuth() {
    try {
      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        accessToken = data.accessToken;
        setUser(data.user);
      } else {
        accessToken = null;
        setUser(null);
      }
    } catch {
      accessToken = null;
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      refreshAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Helper to get auth header for API requests
export function getAuthHeader(): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
```

### 6.4 Protected Routes

```tsx
// components/auth/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !user?.roles.includes(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
```

### 6.5 Token Storage Decision

| Storage | XSS Risk | CSRF Risk | Persistence | Recommendation |
|---------|----------|-----------|-------------|----------------|
| `localStorage` | 🔴 HIGH | 🟢 None | ✅ Yes | ❌ Avoid |
| `sessionStorage` | 🔴 HIGH | 🟢 None | Tab only | ❌ Avoid |
| Memory (variable) | 🟢 LOW | 🟢 None | ❌ No | ✅ Access Token |
| HttpOnly Cookie | 🟢 IMMUNE | 🟡 Present | ✅ Yes | ✅ Refresh Token |

**Chosen approach:**
- **Access Token:** In-memory JavaScript variable (cannot be stolen via XSS)
- **Refresh Token:** HttpOnly, Secure, SameSite=Strict cookie

### 6.6 Session Timeout & Auto-Logout

```tsx
// hooks/useSessionTimeout.ts
import { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function useSessionTimeout() {
  const { logout, isAuthenticated } = useAuth();
  
  const handleLogout = useCallback(() => {
    if (isAuthenticated) {
      logout();
      // Optionally show timeout message
      window.location.href = '/login?reason=timeout';
    }
  }, [logout, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    let timeoutId: NodeJS.Timeout;
    
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleLogout, INACTIVITY_TIMEOUT);
    };

    // User activity events
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    
    resetTimer(); // Start timer

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated, handleLogout]);
}
```

---

## 7. Backend Changes

### 7.1 Project Structure

```
server/
├── auth/
│   ├── index.ts              # Export all auth modules
│   ├── password.ts           # Argon2 hashing
│   ├── jwt.ts                # Token generation/verification
│   ├── schemas.ts            # Zod validation schemas
│   ├── middleware.ts         # Auth middleware
│   └── routes.ts             # Auth endpoints
├── db/
│   ├── index.ts              # Database connection
│   ├── migrations/           # Schema migrations
│   └── queries/
│       ├── users.ts
│       └── sessions.ts
├── middleware/
│   ├── rateLimiter.ts        # Rate limiting
│   ├── security.ts           # Security headers (helmet)
│   ├── validate.ts           # Zod validation middleware
│   └── errorHandler.ts       # Global error handling
├── routes/
│   ├── api.ts                # API router
│   └── ...
├── utils/
│   ├── audit.ts              # Audit logging
│   ├── logger.ts             # Pino logger
│   └── email.ts              # Email sending
├── whatsapp-server.js        # Existing (updated)
├── signal-server.js          # Existing (updated)
└── auth-server.ts            # New: Central auth service
```

### 7.2 Auth Middleware

```typescript
// server/auth/middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './jwt';
import { db } from '../db';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);
  
  try {
    const payload = verifyAccessToken(token);
    
    // Verify user still exists and is active
    const user = await db.query(
      'SELECT id, email, is_active FROM users WHERE id = $1',
      [payload.sub]
    );
    
    if (!user.rows[0] || !user.rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles
    };
    
    next();
  } catch (error: any) {
    logger.debug({ error: error.name }, 'Token verification failed');
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const hasRole = roles.some(role => req.user!.roles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}
```

### 7.3 Validation Middleware with zod

```typescript
// server/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.info({ errors: error.errors, path: req.path }, 'Validation failed');
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}
```

### 7.4 Auth Routes

```typescript
// server/auth/routes.ts
import express from 'express';
import { hashPassword, verifyPassword, needsRehash } from './password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from './jwt';
import { 
  RegisterRequestSchema, 
  LoginRequestSchema,
  ChangePasswordRequestSchema 
} from './schemas';
import { validate } from '../middleware/validate';
import { db } from '../db';
import { rateLimiter } from '../middleware/rateLimiter';
import { auditLog } from '../utils/audit';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Rate limiting: 5 attempts per 15 minutes per IP (using express-rate-limit)
const loginLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    auditLog('LOGIN_RATE_LIMITED', { ip: req.ip });
    res.status(429).json({ 
      error: 'Too many login attempts. Please try again later.',
      retryAfter: 15 * 60 // seconds
    });
  }
});

// ============================================
// POST /api/auth/register
// ============================================
router.post('/register', validate(RegisterRequestSchema), async (req, res) => {
  const { email, password, displayName } = req.body;

  try {
    // Check if email exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password with argon2
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, display_name, password_changed_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, email, display_name`,
      [email, passwordHash, displayName]
    );

    // Assign default role
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = 'user'`,
      [result.rows[0].id]
    );

    auditLog('USER_REGISTERED', { userId: result.rows[0].id, email });
    logger.info({ userId: result.rows[0].id }, 'User registered');

    res.status(201).json({ 
      message: 'Registration successful',
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        displayName: result.rows[0].display_name
      }
    });
  } catch (error) {
    logger.error({ error }, 'Registration error');
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ============================================
// POST /api/auth/login
// ============================================
router.post('/login', loginLimiter, validate(LoginRequestSchema), async (req, res) => {
  const { email, password, rememberMe } = req.body;

  try {
    // Get user with roles
    const userResult = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.display_name, u.avatar_url,
              u.is_active, u.force_password_change,
              array_agg(r.name) as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.email = $1
       GROUP BY u.id`,
      [email]
    );

    const user = userResult.rows[0];

    if (!user) {
      auditLog('LOGIN_FAILED', { email, reason: 'user_not_found', ip: req.ip });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.is_active) {
      auditLog('LOGIN_FAILED', { email, reason: 'user_inactive', ip: req.ip });
      return res.status(401).json({ error: 'Account is disabled' });
    }

    // Verify password with argon2
    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      auditLog('LOGIN_FAILED', { email, reason: 'invalid_password', ip: req.ip });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Rehash if needed (security upgrade)
    if (needsRehash(user.password_hash)) {
      const newHash = await hashPassword(password);
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
      logger.info({ userId: user.id }, 'Password rehashed');
    }

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000);
    const refreshToken = generateRefreshToken(user.id, sessionId);

    await db.query(
      `INSERT INTO sessions (id, user_id, refresh_token, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, user.id, refreshToken, req.headers['user-agent'], req.ip, expiresAt]
    );

    // Update last login
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Generate access token
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      roles: user.roles.filter(Boolean)
    });

    auditLog('LOGIN_SUCCESS', { userId: user.id, email, ip: req.ip });
    logger.info({ userId: user.id }, 'User logged in');

    // Set refresh token as HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000,
      path: '/api/auth'
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        roles: user.roles.filter(Boolean)
      },
      forcePasswordChange: user.force_password_change
    });
  } catch (error) {
    logger.error({ error }, 'Login error');
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================
// POST /api/auth/refresh-token
// ============================================
router.post('/refresh-token', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);

    // Verify session exists and is valid
    const sessionResult = await db.query(
      `SELECT s.*, u.email, u.display_name, u.avatar_url, u.is_active,
              array_agg(r.name) as roles
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
       GROUP BY s.id, u.id`,
      [payload.sessionId]
    );

    const session = sessionResult.rows[0];

    if (!session) {
      return res.status(401).json({ error: 'Session expired or revoked' });
    }

    if (!session.is_active) {
      return res.status(401).json({ error: 'User account disabled' });
    }

    // Token rotation: Generate new refresh token
    const newRefreshToken = generateRefreshToken(session.user_id, session.id);
    await db.query(
      'UPDATE sessions SET refresh_token = $1 WHERE id = $2',
      [newRefreshToken, session.id]
    );

    // Generate new access token
    const accessToken = generateAccessToken({
      id: session.user_id,
      email: session.email,
      roles: session.roles.filter(Boolean)
    });

    // Update cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth'
    });

    res.json({
      accessToken,
      user: {
        id: session.user_id,
        email: session.email,
        displayName: session.display_name,
        avatarUrl: session.avatar_url,
        roles: session.roles.filter(Boolean)
      }
    });
  } catch (error) {
    logger.debug({ error }, 'Token refresh error');
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ============================================
// POST /api/auth/logout
// ============================================
router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await db.query(
        'UPDATE sessions SET revoked_at = NOW() WHERE id = $1',
        [payload.sessionId]
      );
      auditLog('LOGOUT', { sessionId: payload.sessionId });
    } catch {
      // Token invalid, but still clear cookie
    }
  }

  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'Logged out successfully' });
});

// ============================================
// POST /api/auth/logout-all
// ============================================
router.post('/logout-all', requireAuth, async (req, res) => {
  await db.query(
    'UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
    [req.user.id]
  );
  
  auditLog('LOGOUT_ALL', { userId: req.user.id });
  
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'Logged out from all devices' });
});

export default router;
```

### 7.5 Rate Limiting with express-rate-limit

```typescript
// server/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: any) => string;
  handler?: (req: any, res: any) => void;
}

export function rateLimiter(options: RateLimiterOptions) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    keyGenerator: options.keyGenerator || ((req) => req.ip),
    handler: options.handler,
    standardHeaders: true,
    legacyHeaders: false
  });
}

// Pre-configured limiters
export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 attempts
});

export const apiRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // 100 requests
});

export const passwordResetLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3 // 3 attempts
});
```

### 7.6 Security Headers with helmet

```typescript
// server/middleware/security.ts
import helmet from 'helmet';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // For Tailwind
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});
```

### 7.7 Structured Logging with pino

```typescript
// server/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' 
    ? { target: 'pino-pretty', options: { colorize: true } } 
    : undefined,
  base: {
    service: 'merge-auth'
  }
});
```

### 7.8 CSRF Protection with csrf-csrf

```typescript
// server/middleware/csrf.ts
import { doubleCsrf } from 'csrf-csrf';

const {
  generateToken,
  doubleCsrfProtection
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!,
  cookieName: '__Host-csrf',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS']
});

export { generateToken, doubleCsrfProtection };

// Usage in routes:
// router.post('/api/auth/change-password', doubleCsrfProtection, ...);
```

### 7.9 Password Reset Flow

```typescript
// server/auth/passwordReset.ts
import { randomBytes, createHash } from 'crypto';
import { db } from '../db';
import { hashPassword } from './password';
import { sendEmail } from '../utils/email';
import { auditLog } from '../utils/audit';
import { logger } from '../utils/logger';

export async function initiatePasswordReset(email: string): Promise<void> {
  // Always return success (prevent email enumeration)
  const user = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  
  if (!user.rows[0]) {
    // Don't reveal that email doesn't exist
    logger.debug({ email }, 'Password reset for non-existent email');
    return;
  }

  // Generate secure token
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Invalidate existing tokens
  await db.query(
    `UPDATE password_reset_tokens SET used_at = NOW() 
     WHERE user_id = $1 AND used_at IS NULL`,
    [user.rows[0].id]
  );

  // Store new token
  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.rows[0].id, tokenHash, expiresAt]
  );

  // Send email
  const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset Your Password - Merge',
    html: `
      <h1>Password Reset Request</h1>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>If you didn't request this, ignore this email.</p>
    `
  });

  auditLog('PASSWORD_RESET_REQUESTED', { userId: user.rows[0].id, email });
  logger.info({ userId: user.rows[0].id }, 'Password reset requested');
}

export async function completePasswordReset(token: string, newPassword: string): Promise<boolean> {
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const result = await db.query(
    `SELECT prt.id, prt.user_id 
     FROM password_reset_tokens prt
     WHERE prt.token_hash = $1 
       AND prt.used_at IS NULL 
       AND prt.expires_at > NOW()`,
    [tokenHash]
  );

  if (!result.rows[0]) {
    return false;
  }

  const passwordHash = await hashPassword(newPassword);

  // Update password
  await db.query(
    `UPDATE users 
     SET password_hash = $1, password_changed_at = NOW(), force_password_change = FALSE
     WHERE id = $2`,
    [passwordHash, result.rows[0].user_id]
  );

  // Mark token as used
  await db.query(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
    [result.rows[0].id]
  );

  // Revoke all sessions (force re-login)
  await db.query(
    'UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1',
    [result.rows[0].user_id]
  );

  auditLog('PASSWORD_RESET_COMPLETED', { userId: result.rows[0].user_id });
  logger.info({ userId: result.rows[0].user_id }, 'Password reset completed');

  return true;
}
```

### 7.10 Integration with Existing Servers

The existing `whatsapp-server.js` and `signal-server.js` need updates to:
1. Require authentication for all endpoints
2. Scope data to the authenticated user

```javascript
// server/whatsapp-server.js - Key changes

import { requireAuth } from './auth/middleware.js';

// Wrap all routes with auth
app.use('/api', requireAuth);

// Modify data paths to include user_id
function getDataPath(userId, sessionId, type) {
  return join(DATA_DIR, userId, `${sessionId}_${type}.json`);
}

// Update WebSocket to verify token
wss.on('connection', async (ws, req) => {
  const token = new URL(req.url, 'http://localhost').searchParams.get('token');
  
  try {
    const payload = verifyAccessToken(token);
    ws.userId = payload.sub;
    ws.sessionId = req.url.split('/')[2]; // /ws/:sessionId
    
    // Verify this session belongs to the user
    const valid = await verifyUserOwnsSession(ws.userId, ws.sessionId);
    if (!valid) {
      ws.close(4003, 'Forbidden');
      return;
    }
    
    wsConnections.set(ws.sessionId, ws);
  } catch (error) {
    ws.close(4001, 'Unauthorized');
  }
});
```

---

## 8. Security Considerations

### 8.1 Password Requirements

| Requirement | Value | Rationale |
|-------------|-------|-----------|
| **Minimum Length** | 12 characters | NIST 800-63B recommends 8+, we go higher |
| **Character Classes** | 4 (upper, lower, digit, special) | Defense in depth |
| **Max Length** | 128 characters | Prevent DoS via Argon2 |
| **Common Password Check** | Yes | Block top 10K passwords |
| **Username in Password** | Blocked | Prevent obvious choices |

### 8.2 2FA/MFA Preparation (v2)

Design the schema to support TOTP-based 2FA:

```sql
-- Future: Add to users table
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN backup_codes JSONB;

-- Future: 2FA recovery
CREATE TABLE mfa_backup_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   VARCHAR(255) NOT NULL,
    used_at     TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 8.3 XSS Prevention

See Section 7.6 for helmet configuration with CSP headers.

### 8.4 Secure Session Storage

Sessions are stored server-side with:
- **Hashed tokens**: Refresh tokens stored as SHA-256 hashes
- **Expiration**: Auto-cleanup of expired sessions
- **Revocation**: Immediate invalidation on logout

```sql
-- Cleanup job (run via cron or pg_cron)
DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '7 days';
DELETE FROM password_reset_tokens WHERE expires_at < NOW() - INTERVAL '24 hours';
```

---

## 9. Data Privacy

### 9.1 User Data Isolation

Every database query must be scoped to the authenticated user:

```typescript
// WRONG - No user scoping
const messages = await db.query('SELECT * FROM messages WHERE chat_id = $1', [chatId]);

// RIGHT - User-scoped
const messages = await db.query(
  `SELECT m.* FROM messages m
   JOIN platform_accounts pa ON m.platform_account_id = pa.id
   WHERE m.chat_id = $1 AND pa.user_id = $2`,
  [chatId, req.user.id]
);
```

### 9.2 File System Isolation

```
server/data/
├── user_abc123/           # User A's data
│   ├── whatsapp/
│   │   ├── session1_chats.json
│   │   ├── session1_messages.json
│   │   └── media/
│   └── signal/
│       └── ...
├── user_def456/           # User B's data
│   └── ...
```

### 9.3 Audit Logging

```typescript
// server/utils/audit.ts
import { db } from '../db';
import { logger } from './logger';

interface AuditEntry {
  action: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export async function auditLog(action: string, data: Partial<AuditEntry> = {}) {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, action, resource, resource_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.userId || null,
        action,
        data.resourceType || null,
        data.resourceId || null,
        data.ip || null,
        data.userAgent || null,
        data.details ? JSON.stringify(data.details) : null
      ]
    );
  } catch (error) {
    logger.error({ error, action, data }, 'Audit log failed');
  }
}
```

**Audited Events:**
| Event | Data Captured |
|-------|---------------|
| `LOGIN_SUCCESS` | userId, ip, userAgent |
| `LOGIN_FAILED` | email, reason, ip |
| `LOGOUT` | userId, sessionId |
| `PASSWORD_CHANGED` | userId |
| `PASSWORD_RESET_REQUESTED` | userId, email |
| `PASSWORD_RESET_COMPLETED` | userId |
| `USER_CREATED` | userId, createdBy |
| `USER_DISABLED` | userId, disabledBy |
| `PLATFORM_CONNECTED` | userId, platform |
| `MESSAGE_SENT` | userId, platform, chatId |

---

## 10. Non-Functional Requirements

### 10.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Login latency (P95) | < 500ms | Server-side timing |
| Token refresh latency | < 100ms | Server-side timing |
| Concurrent users | 1,000 | Load testing |
| Database connections | Pool of 20 | PostgreSQL config |

### 10.2 Scalability

- **Horizontal scaling**: Stateless JWT validation allows multiple server instances
- **Session storage**: PostgreSQL with connection pooling; Redis optional for high-scale
- **Refresh token rotation**: Prevents token reuse, limits blast radius

### 10.3 Availability

| Requirement | Target |
|-------------|--------|
| Auth service uptime | 99.9% |
| Planned maintenance window | < 15 min/month |
| Recovery Time Objective (RTO) | < 30 min |
| Recovery Point Objective (RPO) | < 5 min |

### 10.4 Monitoring & Alerting

```typescript
// Metrics to expose (Prometheus format)
const metrics = {
  auth_login_total: 'Counter',           // Total login attempts
  auth_login_success_total: 'Counter',   // Successful logins
  auth_login_failed_total: 'Counter',    // Failed logins
  auth_token_refresh_total: 'Counter',   // Token refreshes
  auth_session_active: 'Gauge',          // Active sessions
  auth_login_latency: 'Histogram'        // Login duration
};
```

**Alerts:**
| Alert | Condition | Severity |
|-------|-----------|----------|
| High Login Failures | >10 failures/min for 5 min | Warning |
| Auth Service Down | >3 health check failures | Critical |
| Unusual Login Spike | >5x normal rate | Warning |
| Session DB Latency | P95 > 500ms | Warning |

---

## 11. Out of Scope

The following features are explicitly **NOT** included in this PRD and deferred to future versions:

| Feature | Reason | Target Version |
|---------|--------|----------------|
| **OAuth2 Providers** (Google, GitHub, Apple) | Adds complexity; basic auth sufficient for MVP | v2.0 |
| **Two-Factor Authentication (2FA/MFA)** | Schema prepared; UI/flow not included | v2.0 |
| **Passwordless Login** (Magic Links) | Nice-to-have; not critical | v2.0 |
| **Single Sign-On (SSO/SAML)** | Enterprise feature | v3.0 |
| **Biometric Authentication** | Platform-specific; desktop app focus | v3.0 |
| **Account Linking** | Complex edge cases | v2.0 |
| **Self-Service Email Change** | Security implications require careful design | v1.1 |

---

## 12. Testing Strategy

### 12.1 Unit Tests

**Framework:** Vitest

```typescript
// tests/auth/password.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, needsRehash } from '../../server/auth/password';

describe('Password Hashing', () => {
  it('hashes password successfully', async () => {
    const hash = await hashPassword('SecureP@ssw0rd!');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('verifies correct password', async () => {
    const hash = await hashPassword('SecureP@ssw0rd!');
    const valid = await verifyPassword('SecureP@ssw0rd!', hash);
    expect(valid).toBe(true);
  });

  it('rejects incorrect password', async () => {
    const hash = await hashPassword('SecureP@ssw0rd!');
    const valid = await verifyPassword('WrongPassword', hash);
    expect(valid).toBe(false);
  });
});
```

### 12.2 Integration Tests

```typescript
// tests/auth/login.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/app';
import { db } from '../../server/db';

describe('Login Flow', () => {
  beforeEach(async () => {
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM sessions');
    // Create test user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd!',
        displayName: 'Test User'
      });
  });

  it('successful login returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd!'
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=.+; HttpOnly/);
  });

  it('invalid password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'WrongPassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('rate limiting after 5 attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'SecureP@ssw0rd!' });

    expect(res.status).toBe(429);
  });
});
```

### 12.3 Security Tests

```typescript
// tests/security/auth.security.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/app';

describe('Security Tests', () => {
  it('cannot access protected route without token', async () => {
    const res = await request(app).get('/api/messages');
    expect(res.status).toBe(401);
  });

  it('cannot access other user data', async () => {
    const userA = await createUserAndLogin('a@example.com');
    const userB = await createUserAndLogin('b@example.com');
    
    // Create message as user A
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: 'Secret message' });

    // User B cannot see user A's messages
    const res = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${userB.token}`);

    expect(res.body.messages).toHaveLength(0);
  });

  it('expired token returns 401 with TOKEN_EXPIRED code', async () => {
    const expiredToken = generateExpiredToken();
    
    const res = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('revoked session prevents refresh', async () => {
    const { refreshToken, sessionId } = await createUserAndLogin('test@example.com');
    
    // Revoke session
    await db.query('UPDATE sessions SET revoked_at = NOW() WHERE id = $1', [sessionId]);

    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', `refreshToken=${refreshToken}`);

    expect(res.status).toBe(401);
  });
});
```

### 12.4 Test Coverage Targets

| Area | Target Coverage |
|------|-----------------|
| Password hashing | 100% |
| JWT generation/verification | 100% |
| Auth middleware | 95% |
| Login/logout flows | 95% |
| Password reset | 90% |
| Rate limiting | 90% |

---

## 13. Rollout Plan

### Phase 1: Development (Days 1-5)

| Day | Tasks |
|-----|-------|
| 1 | Database schema, migrations, password hashing with argon2 |
| 2 | JWT implementation, zod schemas, auth middleware |
| 3 | Auth routes (register, login, logout, refresh) with csrf-csrf |
| 4 | Frontend: Login page, AuthContext, protected routes |
| 5 | Integration: Update whatsapp-server.js, signal-server.js |

### Phase 2: Testing (Days 6-8)

| Day | Tasks |
|-----|-------|
| 6 | Unit tests, integration tests with Vitest |
| 7 | Security testing, penetration testing |
| 8 | Performance testing, bug fixes |

### Phase 3: Staging (Days 9-10)

| Day | Tasks |
|-----|-------|
| 9 | Deploy to staging environment |
| 10 | QA testing, user acceptance testing |

### Phase 4: Production (Days 11-14)

| Day | Tasks |
|-----|-------|
| 11 | Production deployment (maintenance window) |
| 12 | Monitoring, hotfix readiness |
| 13-14 | Stabilization period |

### 13.1 Migration Strategy

For existing installations with no users:
1. Run database migrations
2. Deploy new backend
3. Deploy new frontend
4. Create initial admin user via CLI

```bash
# Create initial admin user
node server/scripts/create-admin.js --email admin@example.com --password <secure>
```

For future multi-user migration:
1. All existing data becomes owned by the initial admin
2. Admin can create additional users
3. Platform accounts must be re-linked per user

### 13.2 Rollback Plan

If critical issues are discovered:
1. Revert frontend to previous version (removes login requirement)
2. Keep database changes (no data loss)
3. Analyze and fix issues
4. Re-deploy

---

## 14. Open Questions & Decisions

### 14.1 Resolved Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| **JWT vs Session-based auth?** | Hybrid JWT + Refresh Tokens | Best of both: stateless scaling + revocation capability |
| **Single user vs multi-user MVP?** | Multi-user from day 1 | Schema and isolation designed for multi-user; minimal overhead |
| **Self-service registration?** | Admin-only initially | Security-first; self-registration can be enabled later |
| **bcrypt vs argon2?** | Argon2id | Modern, PHC winner, recommended by OWASP 2024 |
| **csurf vs csrf-csrf?** | csrf-csrf | csurf is deprecated; csrf-csrf is actively maintained |

### 14.2 Open Questions

| Question | Options | Owner | Due Date |
|----------|---------|-------|----------|
| Database choice (PostgreSQL vs SQLite for dev)? | PostgreSQL for consistency | Tech Lead | Day 1 |
| Email provider for password reset? | SendGrid / Mailgun / SES | DevOps | Day 3 |
| Monitoring stack (Prometheus + Grafana)? | Yes/No | DevOps | Day 8 |
| Redis for session storage (vs PostgreSQL only)? | Start with PostgreSQL, add Redis if needed | Tech Lead | Day 5 |

---

## 15. Dependencies

### 15.1 NPM Packages

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
| `jsonwebtoken` | **^9.0.3** | JWT generation/verification | Historical CVEs fixed |
| `argon2` | **^0.44.0** | Password hashing | OWASP recommended, use argon2id |
| `express-session` | ^1.17.3 | Session middleware (for future use) | |
| `csrf-csrf` | **^4.0.3** | CSRF protection | ⚠️ Replaces deprecated csurf! |
| `cookie-parser` | ^1.4.6 | Cookie parsing | |
| `uuid` | ^9.0.1 | UUID generation | |
| `pg` | ^8.11.3 | PostgreSQL client | |

### 15.2 Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^1.2.0 | Test framework |
| `supertest` | ^6.3.4 | HTTP testing |
| `@types/express` | ^5.0.0 | TypeScript types (Express 5.x) |
| `@types/jsonwebtoken` | ^9.0.5 | TypeScript types |
| `@types/pg` | ^8.10.9 | TypeScript types |

### 15.3 Installation

```bash
# Production dependencies (Express 5.x stack)
npm install express@^5.2.1 express-rate-limit@^8.3.2 zod@^4.3.6 helmet@^8.1.0 \
  pino@^10.3.1 pino-http@^10.4.0 cors@^2.8.6 jsonwebtoken@^9.0.3 argon2@^0.44.0 \
  express-session csrf-csrf@^4.0.3 cookie-parser uuid pg

# Dev dependencies
npm install -D vitest supertest pino-pretty@^13.0.0 @types/express @types/jsonwebtoken @types/pg
```

### 15.4 Express 5.x Migration Checklist

Before deploying, ensure:

- [ ] **Node.js ≥18** installed in all environments
- [ ] **No regex routes** — use Zod validation middleware instead
- [ ] **Update deprecated methods:**
  - `res.send(status, body)` → `res.status(status).send(body)`
  - `res.redirect('back')` → `res.redirect(req.get('Referrer') || '/')`
- [ ] **Optional params syntax:** `/:optional?` → `{/:optional}`
- [ ] **Trust proxy:** Ensure `app.set('trust proxy', 1)` for correct IP detection
- [ ] **Body parser defaults:** Review `urlencoded({ extended: false })` behavior

### 15.5 Argon2 Best Practices (OWASP Recommended)

```typescript
import argon2 from 'argon2';

const hash = await argon2.hash(password, {
  type: argon2.argon2id,  // Hybrid mode (recommended)
  memoryCost: 65536,      // 64 MiB (OWASP minimum: 47 MiB)
  timeCost: 3,            // 3 iterations
  parallelism: 4          // 4 threads
});
```

---

## Appendix

### A. Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/merge_auth
DATABASE_POOL_SIZE=20

# JWT Secrets (generate with: openssl rand -base64 64)
JWT_SECRET=<64-char-secret>
JWT_REFRESH_SECRET=<64-char-secret>

# CSRF Secret
CSRF_SECRET=<32-char-secret>

# Application
APP_URL=https://merge.example.com
NODE_ENV=production
LOG_LEVEL=info

# Email (choose one provider)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
SMTP_FROM=noreply@merge.example.com

# Optional: Redis
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5
```

### B. API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Create new user (admin-only in v1) |
| POST | `/api/auth/login` | Public | Authenticate user |
| POST | `/api/auth/logout` | Cookie | End current session |
| POST | `/api/auth/logout-all` | Bearer | End all user sessions |
| POST | `/api/auth/refresh-token` | Cookie | Get new access token |
| POST | `/api/auth/forgot-password` | Public | Request password reset |
| POST | `/api/auth/reset-password` | Token | Complete password reset |
| POST | `/api/auth/change-password` | Bearer | Change password (logged in) |
| GET | `/api/auth/me` | Bearer | Get current user info |
| GET | `/api/auth/sessions` | Bearer | List active sessions |
| DELETE | `/api/auth/sessions/:id` | Bearer | Revoke specific session |

### C. Security Checklist

- [ ] Passwords hashed with Argon2id (not MD5/SHA1/bcrypt)
- [ ] JWT secrets are 256-bit+ random values
- [ ] Access tokens expire in ≤15 minutes
- [ ] Refresh tokens are HttpOnly, Secure, SameSite=Strict
- [ ] Rate limiting on all auth endpoints (express-rate-limit)
- [ ] No sensitive data in JWT payload
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (CSP headers via helmet, input sanitization)
- [ ] CSRF protection (csrf-csrf for state-changing operations)
- [ ] Timing attack resistant password comparison
- [ ] Account lockout after failed attempts
- [ ] Secure password reset (time-limited, hashed tokens)
- [ ] Audit logging for security events (pino)
- [ ] HTTPS enforced in production
- [ ] Security headers (helmet)
- [ ] Input validation on all endpoints (zod)

---

**Document Approval**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Security Architect | | | |
| Tech Lead | | | |
| Engineering Manager | | | |

---

*This PRD was prepared following security best practices from OWASP, NIST 800-63B, and industry standards for authentication systems.*
