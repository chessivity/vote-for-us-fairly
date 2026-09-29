CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate text NOT NULL CHECK (candidate IN ('xareba', 'natali')),
  voter_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.votes TO service_role;

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- No policies: all access happens through trusted server code (service role).
