
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversations" ON public.conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX conversations_user_updated_idx ON public.conversations(user_id, updated_at DESC);
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  parts JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat messages" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX chat_messages_conv_created_idx ON public.chat_messages(conversation_id, created_at);

create extension if not exists vector;

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  category text not null default 'fact',
  source text,
  embedding vector(3072),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.memories to authenticated;
grant all on public.memories to service_role;

alter table public.memories enable row level security;

create policy "own memories" on public.memories
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index memories_user_created_idx on public.memories (user_id, created_at desc);
create index memories_embedding_idx on public.memories
  using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

create trigger memories_updated_at
  before update on public.memories
  for each row execute function public.update_updated_at_column();

create or replace function public.match_memories(
  query_embedding vector(3072),
  match_count int default 6
)
returns table (
  id uuid,
  content text,
  category text,
  similarity float,
  created_at timestamptz
)
language sql stable
security invoker
set search_path = public
as $$
  select
    m.id,
    m.content,
    m.category,
    1 - (m.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity,
    m.created_at
  from public.memories m
  where m.user_id = auth.uid()
    and m.embedding is not null
  order by m.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;
