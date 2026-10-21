-- Preferências e histórico privado do proprietário único. Identidades sobrevivem a reinícios e mudanças de fuso.
CREATE TABLE IF NOT EXISTS notification_preferences (
 id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
 preferences JSONB NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS notifications (
 id UUID PRIMARY KEY,
 identity TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK (kind IN ('weekly_digest','review','goals','reminders')),
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 read_at TIMESTAMPTZ,
 dismissed_at TIMESTAMPTZ,
 delivery_status TEXT NOT NULL CHECK (delivery_status IN ('in_app','pending','sending','sent','retry','failed','cancelled')),
 attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 claimed_at TIMESTAMPTZ,
 last_error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS notifications_delivery ON notifications(next_attempt_at) WHERE delivery_status IN ('pending','retry');
