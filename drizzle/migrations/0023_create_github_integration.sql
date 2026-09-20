CREATE TABLE IF NOT EXISTS public.github_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id text NOT NULL UNIQUE REFERENCES public.guests(id) ON DELETE CASCADE,
  github_login text NOT NULL,
  github_user_id bigint NOT NULL,
  github_avatar_url text,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.github_repo_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id text NOT NULL UNIQUE REFERENCES public.guests(id) ON DELETE CASCADE,
  repo_id bigint NOT NULL,
  full_name text NOT NULL,
  owner_login text NOT NULL,
  repo_name text NOT NULL,
  is_private boolean NOT NULL DEFAULT false,
  default_branch text NOT NULL DEFAULT 'main',
  selected_branch text NOT NULL DEFAULT 'main',
  html_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.github_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id text NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  step text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  repo_full_name text,
  branch text,
  detail text,
  files_read integer NOT NULL DEFAULT 0,
  files_created integer NOT NULL DEFAULT 0,
  files_changed integer NOT NULL DEFAULT 0,
  files_deleted integer NOT NULL DEFAULT 0,
  commit_sha text,
  commit_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS github_activity_guest_created_idx
  ON public.github_activity (guest_id, created_at DESC);

GRANT ALL ON public.github_connections TO service_role;
GRANT ALL ON public.github_repo_selections TO service_role;
GRANT ALL ON public.github_activity TO service_role;

ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_repo_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_activity ENABLE ROW LEVEL SECURITY;