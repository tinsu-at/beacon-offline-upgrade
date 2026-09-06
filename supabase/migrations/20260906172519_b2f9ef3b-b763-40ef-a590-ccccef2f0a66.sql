ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS developer_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS english_correction boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slogan text,
  ADD COLUMN IF NOT EXISTS journal_questions jsonb;

UPDATE public.profiles p
SET telegram_enabled = true,
    developer_mode = true,
    english_correction = true,
    slogan = COALESCE(p.slogan, 'Become someone a child would be proud to imitate.')
FROM auth.users u
WHERE u.id = p.id AND u.email = 'tinsaetsegaye85@gmail.com';