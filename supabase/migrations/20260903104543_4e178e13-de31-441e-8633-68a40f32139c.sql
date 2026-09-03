
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS main_goals TEXT,
  ADD COLUMN IF NOT EXISTS why_beacon TEXT,
  ADD COLUMN IF NOT EXISTS improvement_areas TEXT,
  ADD COLUMN IF NOT EXISTS about_me TEXT,
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

INSERT INTO public.profiles (id)
SELECT u.id FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

CREATE TABLE IF NOT EXISTS public.memory_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (memory_id, recipient_id),
  CHECK (owner_id <> recipient_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_shares TO authenticated;
GRANT ALL ON public.memory_shares TO service_role;
ALTER TABLE public.memory_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages shares" ON public.memory_shares
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (SELECT 1 FROM public.memories m WHERE m.id = memory_id AND m.user_id = auth.uid())
  );

CREATE POLICY "recipient reads shares" ON public.memory_shares
  FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "recipient reads shared memories" ON public.memories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memory_shares s
      WHERE s.memory_id = memories.id AND s.recipient_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS memory_shares_recipient_idx ON public.memory_shares (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS memory_shares_owner_idx ON public.memory_shares (owner_id, created_at DESC);
