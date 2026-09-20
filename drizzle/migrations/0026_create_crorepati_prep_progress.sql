CREATE TABLE public.crorepati_prep_progress (
  guest_id text PRIMARY KEY REFERENCES public.guests(id) ON DELETE CASCADE,
  run_id text NOT NULL,
  total integer NOT NULL DEFAULT 20,
  verified integer NOT NULL DEFAULT 0,
  batches jsonb NOT NULL DEFAULT '[]'::jsonb,
  phase text NOT NULL DEFAULT 'preparing',
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.crorepati_prep_progress TO service_role;

ALTER TABLE public.crorepati_prep_progress ENABLE ROW LEVEL SECURITY;