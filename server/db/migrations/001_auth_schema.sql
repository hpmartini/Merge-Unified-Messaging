CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT NOT NULL UNIQUE CHECK (email LIKE '%@%'),
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100) NOT NULL CHECK (length(trim(display_name)) > 0),
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

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- SESSIONS TABLE (Refresh Tokens)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    
    -- Device/Browser info
    user_agent      VARCHAR(500),
    ip_address      INET,
    device_name     VARCHAR(100),
    
    -- Validity
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at      TIMESTAMP WITH TIME ZONE,
    
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- ROLES TABLE (Foundation for RBAC)
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    permissions JSONB DEFAULT '[]',
    
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default roles
INSERT INTO roles (name, description, permissions) 
VALUES
('admin', 'Full system access', '["*"]'),
('user', 'Standard user access', '["read:own", "write:own"]')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- USER_ROLES TABLE (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    
    PRIMARY KEY (user_id, role_id)
);

-- ============================================
-- PASSWORD_RESET_TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at     TIMESTAMP WITH TIME ZONE,
    
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);

-- ============================================
-- AUDIT_LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
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

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- ============================================
-- PLATFORM ACCOUNTS (User-scoped)
-- ============================================
CREATE TABLE IF NOT EXISTS platform_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform        VARCHAR(50) NOT NULL,
    account_id      VARCHAR(255) NOT NULL,
    session_data    JSONB,
    display_name    VARCHAR(100),
    
    is_active       BOOLEAN DEFAULT TRUE,
    connected_at    TIMESTAMP WITH TIME ZONE,
    last_sync_at    TIMESTAMP WITH TIME ZONE,
    
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_id ON platform_accounts(user_id);
