-- Drop By — Database Schema
-- Run this in your Supabase SQL Editor (supabase.com/dashboard → SQL Editor → New query)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TABLES ────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT NOT NULL UNIQUE,
  display_name      TEXT NOT NULL,
  avatar_url        TEXT,
  timezone          TEXT NOT NULL DEFAULT 'UTC',
  google_account_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE circles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  created_by          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_calendar_id  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE circle_memberships (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id   UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

CREATE TABLE pending_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id       UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  invited_email   TEXT NOT NULL,
  invited_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(circle_id, invited_email)
);

CREATE TABLE open_windows (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circle_id           UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  title               TEXT NOT NULL DEFAULT 'Free — Come Over',
  rrule               TEXT NOT NULL,
  start_time          TEXT NOT NULL,  -- HH:MM 24h
  end_time            TEXT NOT NULL,  -- HH:MM 24h
  timezone            TEXT NOT NULL DEFAULT 'UTC',
  google_calendar_id  TEXT,
  google_event_id     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE drop_by_intents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_id   UUID NOT NULL REFERENCES open_windows(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(visitor_id, window_id)
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('drop_by_intent', 'intent_cancelled', 'window_conflict', 'circle_invite')),
  body        TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TRIGGERS ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_drop_by_intents_updated_at
  BEFORE UPDATE ON drop_by_intents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── ROW LEVEL SECURITY ────────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE drop_by_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users: anyone can read, only self can write
CREATE POLICY "Users can read all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Circles: only members can read; only creator can insert; only admins can update
CREATE POLICY "Circle members can read circles" ON circles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM circle_memberships WHERE circle_id = circles.id AND user_id = auth.uid()
  ));
CREATE POLICY "Authenticated users can create circles" ON circles FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update circles" ON circles FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM circle_memberships
    WHERE circle_id = circles.id AND user_id = auth.uid() AND role = 'admin'
  ));

-- Memberships
CREATE POLICY "Members can read memberships" ON circle_memberships FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM circle_memberships cm2
    WHERE cm2.circle_id = circle_memberships.circle_id AND cm2.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own membership" ON circle_memberships FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage memberships" ON circle_memberships FOR DELETE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM circle_memberships cm2
      WHERE cm2.circle_id = circle_memberships.circle_id
        AND cm2.user_id = auth.uid()
        AND cm2.role = 'admin'
    )
  );

-- Pending members
CREATE POLICY "Admins can manage pending members" ON pending_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM circle_memberships
    WHERE circle_id = pending_members.circle_id AND user_id = auth.uid() AND role = 'admin'
  ));
CREATE POLICY "Read own pending invites" ON pending_members FOR SELECT
  USING (invited_email = (SELECT email FROM users WHERE id = auth.uid()));

-- Open windows
CREATE POLICY "Circle members can read windows" ON open_windows FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM circle_memberships
    WHERE circle_id = open_windows.circle_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can manage own windows" ON open_windows FOR ALL
  USING (auth.uid() = user_id);

-- Drop-by intents
CREATE POLICY "Circle members can read intents" ON drop_by_intents FOR SELECT
  USING (
    visitor_id = auth.uid() OR host_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM open_windows ow
      JOIN circle_memberships cm ON cm.circle_id = ow.circle_id
      WHERE ow.id = drop_by_intents.window_id AND cm.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can manage own intents" ON drop_by_intents FOR ALL
  USING (auth.uid() = visitor_id);

-- Notifications
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── REALTIME ──────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE drop_by_intents;
ALTER PUBLICATION supabase_realtime ADD TABLE open_windows;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
