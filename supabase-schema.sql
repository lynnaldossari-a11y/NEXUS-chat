-- ===== NEXUS SOCIAL PLATFORM - COMPLETE SQL SCHEMA =====
-- This SQL sets up all tables, policies, and real-time subscriptions

-- 1. Create Accounts Table with Profile System
CREATE TABLE IF NOT EXISTS accounts (
  username text PRIMARY KEY,
  password text NOT NULL,
  display_name text DEFAULT '',
  bio text DEFAULT '',
  pfp_url text DEFAULT 'https://ui-avatars.com/api/?name=User&background=7F77DD&color=fff',
  is_admin boolean DEFAULT false,
  is_owner boolean DEFAULT false,
  theme text DEFAULT 'dark',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS display_name text DEFAULT '';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS pfp_url text DEFAULT 'https://ui-avatars.com/api/?name=User&background=7F77DD&color=fff';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_owner boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS theme text DEFAULT 'dark';

-- 2. Create Messages Table with Media Support
CREATE TABLE IF NOT EXISTS messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content text NOT NULL,
  author_username text REFERENCES accounts(username) ON DELETE CASCADE,
  room_id text DEFAULT 'global',
  type text DEFAULT 'text',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS type text DEFAULT 'text';

-- 3. Create Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

INSERT INTO rooms (id, name) VALUES ('global', 'Global Chat') ON CONFLICT (id) DO NOTHING;

-- 4. Create Stickers Table for Admin Management
CREATE TABLE IF NOT EXISTS stickers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sticker text NOT NULL,
  added_by text REFERENCES accounts(username) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now()
);

-- 4b. Create Friends Table
CREATE TABLE IF NOT EXISTS friends (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_username text REFERENCES accounts(username) ON DELETE CASCADE,
  friend_username text REFERENCES accounts(username) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_username, friend_username)
);

-- 4c. Create Friend Requests Table
CREATE TABLE IF NOT EXISTS friend_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_username text REFERENCES accounts(username) ON DELETE CASCADE,
  to_username text REFERENCES accounts(username) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(from_username, to_username)
);

-- 4d. Create Banned Users Table
CREATE TABLE IF NOT EXISTS banned_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  banned_username text REFERENCES accounts(username) ON DELETE CASCADE,
  banned_by_username text REFERENCES accounts(username) ON DELETE CASCADE,
  reason text DEFAULT '',
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(banned_username)
);

ALTER TABLE banned_users ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- 4e. Create Muted Users Table
CREATE TABLE IF NOT EXISTS muted_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  muted_username text REFERENCES accounts(username) ON DELETE CASCADE,
  muted_by_username text REFERENCES accounts(username) ON DELETE CASCADE,
  reason text DEFAULT '',
  muted_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(muted_username)
);

ALTER TABLE muted_users ADD COLUMN IF NOT EXISTS muted_until timestamp with time zone;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE muted_users ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies for Accounts
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'accounts_public_select'
    ) THEN
        CREATE POLICY "accounts_public_select" ON public.accounts FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'accounts_public_insert'
    ) THEN
        CREATE POLICY "accounts_public_insert" ON public.accounts FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'accounts_public_update'
    ) THEN
        CREATE POLICY "accounts_public_update" ON public.accounts FOR UPDATE USING (true);
    END IF;
END $$;

-- 7. Create RLS Policies for Messages
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_public_select'
    ) THEN
        CREATE POLICY "messages_public_select" ON public.messages FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_public_insert'
    ) THEN
        CREATE POLICY "messages_public_insert" ON public.messages FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_public_delete'
    ) THEN
        CREATE POLICY "messages_public_delete" ON public.messages FOR DELETE USING (true);
    END IF;
END $$;

-- 8. Create RLS Policies for Rooms
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'rooms_public_select'
    ) THEN
        CREATE POLICY "rooms_public_select" ON public.rooms FOR SELECT USING (true);
    END IF;
END $$;

-- 9. Create RLS Policies for Stickers
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stickers' AND policyname = 'stickers_public_select'
    ) THEN
        CREATE POLICY "stickers_public_select" ON public.stickers FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stickers' AND policyname = 'stickers_public_insert'
    ) THEN
        CREATE POLICY "stickers_public_insert" ON public.stickers FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stickers' AND policyname = 'stickers_public_delete'
    ) THEN
        CREATE POLICY "stickers_public_delete" ON public.stickers FOR DELETE USING (true);
    END IF;
END $$;

-- 9b. Create RLS Policies for Friends
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friends' AND policyname = 'friends_public_select'
    ) THEN
        CREATE POLICY "friends_public_select" ON public.friends FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friends' AND policyname = 'friends_public_insert'
    ) THEN
        CREATE POLICY "friends_public_insert" ON public.friends FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friends' AND policyname = 'friends_public_delete'
    ) THEN
        CREATE POLICY "friends_public_delete" ON public.friends FOR DELETE USING (true);
    END IF;
END $$;

-- 9c. Create RLS Policies for Friend Requests
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friend_requests' AND policyname = 'friend_requests_public_select'
    ) THEN
        CREATE POLICY "friend_requests_public_select" ON public.friend_requests FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friend_requests' AND policyname = 'friend_requests_public_insert'
    ) THEN
        CREATE POLICY "friend_requests_public_insert" ON public.friend_requests FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friend_requests' AND policyname = 'friend_requests_public_delete'
    ) THEN
        CREATE POLICY "friend_requests_public_delete" ON public.friend_requests FOR DELETE USING (true);
    END IF;
END $$;

-- 9d. Create RLS Policies for Banned Users
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'banned_users' AND policyname = 'banned_users_public_select'
    ) THEN
        CREATE POLICY "banned_users_public_select" ON public.banned_users FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'banned_users' AND policyname = 'banned_users_public_insert'
    ) THEN
        CREATE POLICY "banned_users_public_insert" ON public.banned_users FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'banned_users' AND policyname = 'banned_users_public_delete'
    ) THEN
        CREATE POLICY "banned_users_public_delete" ON public.banned_users FOR DELETE USING (true);
    END IF;
END $$;

-- 9e. Create RLS Policies for Muted Users
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'muted_users' AND policyname = 'muted_users_public_select'
    ) THEN
        CREATE POLICY "muted_users_public_select" ON public.muted_users FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'muted_users' AND policyname = 'muted_users_public_insert'
    ) THEN
        CREATE POLICY "muted_users_public_insert" ON public.muted_users FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'muted_users' AND policyname = 'muted_users_public_delete'
    ) THEN
        CREATE POLICY "muted_users_public_delete" ON public.muted_users FOR DELETE USING (true);
    END IF;
END $$;

-- 10. Enable Real-time for Messages
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
            SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;

-- 11. Enable Real-time for Accounts
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
            SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'accounts'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
    END IF;
END $$;

-- 12. Enable Real-time for Stickers
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
            SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stickers'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.stickers;
    END IF;
END $$;

-- 12b. Enable Real-time for Friends
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
            SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friends'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
    END IF;
END $$;

-- 12c. Enable Real-time for Friend Requests
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
            SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friend_requests'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
    END IF;
END $$;

-- 12d. Enable Real-time for Banned Users
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
            SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'banned_users'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.banned_users;
    END IF;
END $$;

-- 12e. Enable Real-time for Muted Users
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
            SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'muted_users'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.muted_users;
    END IF;
END $$;

-- ===== OPTIONAL: SET YOUR ADMIN ACCOUNT =====
-- UPDATE accounts SET is_admin = true, is_owner = true WHERE username = 'your_username_here';

-- ===== OPTIONAL: INSERT SAMPLE STICKERS =====
-- INSERT INTO stickers (sticker, added_by) VALUES
-- ('👍', 'admin'),
-- ('❤️', 'admin'),
-- ('😂', 'admin'),
-- ('🔥', 'admin'),
-- ('🎉', 'admin');
